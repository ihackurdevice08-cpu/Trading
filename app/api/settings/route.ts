import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function sbFromCookies() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return store.getAll(); },
        setAll(cs) { cs.forEach(({ name, value, options }) => store.set(name, value, options)); },
      },
    }
  );
}

export async function GET() {
  const sbAuth = await sbFromCookies();
  const { data } = await sbAuth.auth.getUser();
  const uid = data.user?.id;
  if (!uid) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const sb = supabaseServer();
  const { data: row, error } = await sb.from("user_settings").select("appearance").eq("user_id", uid).maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, appearance: row?.appearance || {} });
}

export async function POST(req: Request) {
  try {
    const sbAuth = await sbFromCookies();
    const { data } = await sbAuth.auth.getUser();
    const uid = data.user?.id;
    if (!uid) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const appearance = body?.appearance ?? body ?? {};

    const sb = supabaseServer();
    const { error } = await sb.from("user_settings").upsert({ user_id: uid, appearance }, { onConflict: "user_id" });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, note: "Saved. (account-bound)" });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
