import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/supabase/serverAuth";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/** KST(UTC+9) 기준 날짜 범위 유틸 */
function kstBoundary(offsetDays = 0): Date {
  const now = new Date();
  const kstMs = now.getTime() + 9 * 60 * 60 * 1000;
  const kst = new Date(kstMs);
  const y = kst.getUTCFullYear();
  const m = kst.getUTCMonth();
  const d = kst.getUTCDate() + offsetDays;
  const kstStartMs = Date.UTC(y, m, d, 0, 0, 0);
  return new Date(kstStartMs - 9 * 60 * 60 * 1000);
}

function startOfWeekKST(): Date {
  const now = new Date();
  const kstMs = now.getTime() + 9 * 60 * 60 * 1000;
  const kst = new Date(kstMs);
  const y = kst.getUTCFullYear();
  const m = kst.getUTCMonth();
  const d = kst.getUTCDate();
  const day = new Date(Date.UTC(y, m, d)).getUTCDay();
  const diffToMon = (day + 6) % 7;
  const kstStartMs = Date.UTC(y, m, d - diffToMon, 0, 0, 0);
  return new Date(kstStartMs - 9 * 60 * 60 * 1000);
}

function startOfMonthKST(): Date {
  const now = new Date();
  const kstMs = now.getTime() + 9 * 60 * 60 * 1000;
  const kst = new Date(kstMs);
  const y = kst.getUTCFullYear();
  const m = kst.getUTCMonth();
  const kstStartMs = Date.UTC(y, m, 1, 0, 0, 0);
  return new Date(kstStartMs - 9 * 60 * 60 * 1000);
}

export async function GET() {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const now = new Date();
  const fromToday = kstBoundary(0).toISOString();
  const fromWeek = startOfWeekKST().toISOString();
  const fromMonth = startOfMonthKST().toISOString();

  const sb = supabaseServer();

  // 최근 거래 (UI용) - 필요한 컬럼만
  const { data: recent, error: e1 } = await sb
    .from("manual_trades")
    .select("id,symbol,side,opened_at,pnl,tags,notes")
    .eq("user_id", uid)
    .order("opened_at", { ascending: false })
    .limit(20);
  if (e1) return bad(e1.message, 500);

  // 월초 이후 집계 (opened_at + pnl만)
  const { data: rows, error: e2 } = await sb
    .from("manual_trades")
    .select("opened_at,pnl")
    .eq("user_id", uid)
    .gte("opened_at", fromMonth)
    .order("opened_at", { ascending: false })
    .limit(5000);
  if (e2) return bad(e2.message, 500);

  const list = rows || [];

  let sumMonth = 0, sumWeek = 0, sumToday = 0;
  let win = 0, loss = 0, totalCount = 0, realizedCount = 0;

  const todayMs = Date.parse(fromToday);
  const weekMs = Date.parse(fromWeek);

  for (const r of list) {
    totalCount += 1;
    const pnl = r.pnl == null ? null : Number(r.pnl);
    const t = Date.parse(r.opened_at);

    if (pnl !== null && Number.isFinite(pnl)) {
      realizedCount += 1;
      sumMonth += pnl;
      if (t >= weekMs) sumWeek += pnl;
      if (t >= todayMs) sumToday += pnl;
      if (pnl > 0) win++;
      else if (pnl < 0) loss++;
    }
  }

  const winRate = realizedCount > 0 ? (win / realizedCount) * 100 : null;

  return NextResponse.json({
    ok: true,
    stats: {
      todayPnL: sumToday,
      weekPnL: sumWeek,
      monthPnL: sumMonth,
      totalTrades: totalCount,
      realizedTrades: realizedCount,
      wins: win,
      losses: loss,
      winRate,
    },
    recent: recent || [],
  });
}
