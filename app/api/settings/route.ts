import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function makeSupabaseFromCookies(req: Request) {
  const cookieStore = (req as any).cookies; // Next injects cookies here in route handlers
  const cookiesToSet: any[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore?.getAll?.() ?? [];
        },
        setAll(cs) {
          cs.forEach((c) => cookiesToSet.push(c));
        },
      },
    }
  );

  return { supabase, cookiesToSet };
}

export async function POST(req: Request) {
  try {
    const { supabase, cookiesToSet } = makeSupabaseFromCookies(req);

    const { data: u, error: uErr } = await supabase.auth.getUser();
    const uid = u?.user?.id;
    if (uErr || !uid) {
      const res = NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
      cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      return res;
    }

    const body = await req.json().catch(() => ({}));
    const appearance = body?.appearance ?? body ?? {};

    const sb = supabaseServer(); // service role
    const { error } = await sb.from("user_settings").upsert(
      { user_id: uid, appearance },
      { onConflict: "user_id" }
    );

    if (error) {
      const res = NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      return res;
    }

    const res = NextResponse.json({ ok: true, note: "Saved. (cookie session)" });
    cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
    return res;
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
