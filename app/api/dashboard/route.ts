import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/supabase/serverAuth";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function kstBoundary(offsetDays = 0): Date {
  const now   = new Date();
  const kstMs = now.getTime() + 9 * 60 * 60 * 1000;
  const kst   = new Date(kstMs);
  const kstStartMs = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() + offsetDays);
  return new Date(kstStartMs - 9 * 60 * 60 * 1000);
}
function startOfWeekKST(): Date {
  const now   = new Date();
  const kstMs = now.getTime() + 9 * 60 * 60 * 1000;
  const kst   = new Date(kstMs);
  const day   = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate())).getUTCDay();
  const diff  = (day + 6) % 7;
  const kstStartMs = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() - diff);
  return new Date(kstStartMs - 9 * 60 * 60 * 1000);
}
function startOfMonthKST(): Date {
  const now   = new Date();
  const kstMs = now.getTime() + 9 * 60 * 60 * 1000;
  const kst   = new Date(kstMs);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), 1) - 9 * 60 * 60 * 1000);
}

export async function GET() {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const fromMonth = startOfMonthKST().toISOString();
  const sb        = supabaseServer();

  // 두 쿼리 병렬 실행
  const [recentResult, rowsResult] = await Promise.all([
    sb.from("manual_trades")
      .select("id,symbol,side,opened_at,pnl,tags,notes")
      .eq("user_id", uid)
      .order("opened_at", { ascending: false })
      .limit(20),
    sb.from("manual_trades")
      .select("opened_at,pnl")
      .eq("user_id", uid)
      .gte("opened_at", fromMonth)
      .order("opened_at", { ascending: false })
      .limit(5000),
  ]);

  if (recentResult.error) return bad(recentResult.error.message, 500);
  if (rowsResult.error)   return bad(rowsResult.error.message, 500);

  const list      = rowsResult.data || [];
  const todayMs   = kstBoundary(0).getTime();
  const weekMs    = startOfWeekKST().getTime();

  let sumMonth = 0, sumWeek = 0, sumToday = 0;
  let win = 0, loss = 0, totalCount = 0, realizedCount = 0;

  for (const r of list) {
    totalCount++;
    const pnl = r.pnl == null ? null : Number(r.pnl);
    const t   = Date.parse(r.opened_at);
    if (pnl !== null && Number.isFinite(pnl)) {
      realizedCount++;
      sumMonth += pnl;
      if (t >= weekMs)  sumWeek  += pnl;
      if (t >= todayMs) sumToday += pnl;
      if (pnl > 0) win++;
      else if (pnl < 0) loss++;
    }
  }

  return NextResponse.json({
    ok: true,
    stats: {
      todayPnL: sumToday, weekPnL: sumWeek, monthPnL: sumMonth,
      totalTrades: totalCount, realizedTrades: realizedCount,
      wins: win, losses: loss,
      winRate: realizedCount > 0 ? (win / realizedCount) * 100 : null,
    },
    recent: recentResult.data || [],
  });
}
