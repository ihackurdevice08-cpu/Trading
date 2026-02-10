import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function supabaseFromCookies() {
  const store = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return store.getAll();
        },
        setAll(cs) {
          cs.forEach(({ name, value, options }) => store.set(name, value, options));
        },
      },
    }
  );
}

export async function POST(req: Request) {
  try {
    const supabase = supabaseFromCookies();
    const { data, error } = await supabase.auth.getUser();
    const uid = data?.user?.id;

    if (error || !uid) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const appearance = body?.appearance ?? body ?? {};

    const sb = supabaseServer(); // service role
    const { error: upErr } = await sb.from("user_settings").upsert(
      { user_id: uid, appearance },
      { onConflict: "user_id" }
    );

    if (upErr) {
      return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, note: "Saved. (cookie session)" });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
