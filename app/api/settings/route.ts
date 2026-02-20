import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/supabase/serverAuth";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function GET() {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const sb = supabaseServer();
  const { data: row, error } = await sb
    .from("user_settings")
    .select("appearance")
    .eq("user_id", uid)
    .maybeSingle();

  if (error) return bad(error.message, 500);

  // 명시적으로 { ok, appearance } 반환 (Provider는 j.appearance를 읽음)
  return NextResponse.json({ ok: true, appearance: row?.appearance || {} });
}

export async function POST(req: Request) {
  try {
    const uid = await getAuthUserId();
    if (!uid) return bad("unauthorized", 401);

    const body = await req.json().catch(() => ({}));
    const appearance = body?.appearance ?? body ?? {};

    const sb = supabaseServer();
    const { error } = await sb
      .from("user_settings")
      .upsert({ user_id: uid, appearance }, { onConflict: "user_id" });

    if (error) return bad(error.message, 500);

    return NextResponse.json({ ok: true, note: "Saved." });
  } catch (e: any) {
    return bad(String(e?.message || e), 500);
  }
}
