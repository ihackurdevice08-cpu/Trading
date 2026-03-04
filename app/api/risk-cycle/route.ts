import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/supabase/serverAuth";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ok(data: any)  { return NextResponse.json({ ok: true,  ...data }); }
function bad(msg: string, status = 400) { return NextResponse.json({ ok: false, error: msg }, { status }); }

// 리스크 사이클 리셋: 현재 누적 PnL을 스냅샷으로 저장하고 새 사이클 시작
export async function POST(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const sb = supabaseServer();

  // 현재까지 누적 PnL 계산
  const { data: trades } = await sb
    .from("manual_trades")
    .select("pnl")
    .eq("user_id", uid);

  const cumPnl = (trades || []).reduce((s, r) => s + (Number(r.pnl) || 0), 0);

  // 사이클 스냅샷 저장
  const { data: row, error } = await sb
    .from("risk_cycles")
    .insert({
      user_id:    uid,
      started_at: new Date().toISOString(),
      note:       String(body.note || "").trim(),
      equity_snapshot: Number(body.equity_snapshot) || cumPnl,
    })
    .select("*")
    .single();

  if (error) return bad(error.message, 500);
  return ok({ cycle: row });
}

export async function GET() {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const { data, error } = await supabaseServer()
    .from("risk_cycles")
    .select("*")
    .eq("user_id", uid)
    .order("started_at", { ascending: false })
    .limit(20);

  if (error) return bad(error.message, 500);
  return ok({ cycles: data || [] });
}
