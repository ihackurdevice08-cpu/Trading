import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/supabase/serverAuth";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}
function kstBoundary(offsetDays = 0): Date {
  const kst = new Date(Date.now() + 9 * 3600_000);
  const y = kst.getUTCFullYear(), m = kst.getUTCMonth(), d = kst.getUTCDate() + offsetDays;
  return new Date(Date.UTC(y, m, d) - 9 * 3600_000);
}
function startOfWeekKST(): Date {
  const kst = new Date(Date.now() + 9 * 3600_000);
  const y = kst.getUTCFullYear(), m = kst.getUTCMonth(), d = kst.getUTCDate();
  const day = new Date(Date.UTC(y, m, d)).getUTCDay();
  return new Date(Date.UTC(y, m, d - (day + 6) % 7) - 9 * 3600_000);
}
function startOfMonthKST(): Date {
  const kst = new Date(Date.now() + 9 * 3600_000);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), 1) - 9 * 3600_000);
}

export async function GET(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  // ?from=YYYY-MM-DD → 누적 PnL 기산일 (localStorage에서 전달, DB 저장 없음)
  const url     = new URL(req.url);
  const pnlFrom = url.searchParams.get("from") || null;

  const fromToday = kstBoundary(0).toISOString();
  const fromWeek  = startOfWeekKST().toISOString();
  const fromMonth = startOfMonthKST().toISOString();

  const sb = supabaseServer();

  const [tradesRes, recentRes, withdrawRes, riskRes] = await Promise.all([
    sb.from("manual_trades").select("opened_at,pnl,symbol,side,tags")
      .eq("user_id", uid).gte("opened_at", fromMonth).order("opened_at", { ascending: false }).limit(5000),
    sb.from("manual_trades").select("id,symbol,side,opened_at,pnl,tags")
      .eq("user_id", uid).order("opened_at", { ascending: false }).limit(5),
    sb.from("withdrawals").select("amount,source").eq("user_id", uid),
    sb.from("risk_settings").select("seed_usd").eq("user_id", uid).maybeSingle(),
  ]);

  const list   = tradesRes.data  || [];
  const recent = recentRes.data  || [];
  const wdList = withdrawRes.data || [];
  const seed   = Number(riskRes.data?.seed_usd || 10000);

  // 기간별 PnL
  let sumMonth = 0, sumWeek = 0, sumToday = 0;
  let win = 0, loss = 0, realizedCount = 0;
  const todayMs = Date.parse(fromToday);
  const weekMs  = Date.parse(fromWeek);
  const symbolMap: Record<string, { pnl: number; count: number; wins: number }> = {};

  for (const r of list) {
    const pnl = r.pnl == null ? null : Number(r.pnl);
    const t   = Date.parse(r.opened_at);
    const sym = r.symbol || "unknown";
    if (pnl !== null && Number.isFinite(pnl)) {
      realizedCount++;
      sumMonth += pnl;
      if (t >= weekMs)  sumWeek  += pnl;
      if (t >= todayMs) sumToday += pnl;
      if (pnl > 0) win++; else if (pnl < 0) loss++;
      if (!symbolMap[sym]) symbolMap[sym] = { pnl: 0, count: 0, wins: 0 };
      symbolMap[sym].pnl   += pnl;
      symbolMap[sym].count += 1;
      if (pnl > 0) symbolMap[sym].wins += 1;
    }
  }

  const winRate = realizedCount > 0 ? (win / realizedCount) * 100 : null;
  const topSymbols = Object.entries(symbolMap)
    .sort((a, b) => Math.abs(b[1].pnl) - Math.abs(a[1].pnl))
    .slice(0, 5)
    .map(([symbol, d]) => ({
      symbol, pnl: Number(d.pnl.toFixed(2)), count: d.count,
      winRate: d.count > 0 ? Math.round((d.wins / d.count) * 100) : 0,
    }));

  // 누적 PnL: pnlFrom 이후 기간만
  let cumPnlQuery = sb.from("manual_trades").select("pnl").eq("user_id", uid);
  if (pnlFrom) cumPnlQuery = cumPnlQuery.gte("opened_at", new Date(pnlFrom).toISOString());
  const { data: allTrades } = await cumPnlQuery;
  const cumPnl = (allTrades || []).reduce((s, r) => s + (Number(r.pnl) || 0), 0);

  // 출금
  const totalWithdrawal  = wdList.reduce((s, r) => s + Number(r.amount || 0), 0);
  const profitWithdrawal = wdList.filter(r => r.source === "profit").reduce((s, r) => s + Number(r.amount || 0), 0);
  const seedWithdrawal   = wdList.filter(r => r.source === "seed").reduce((s, r) => s + Number(r.amount || 0), 0);

  // 현재 자산 = 시드 + 전체 누적 PnL(기간 무관) - 전체 출금
  // 단 cumPnl이 기간 필터된 경우 전체도 별도 계산
  let totalCumPnl = cumPnl;
  if (pnlFrom) {
    const { data: allTime } = await sb.from("manual_trades").select("pnl").eq("user_id", uid);
    totalCumPnl = (allTime || []).reduce((s, r) => s + (Number(r.pnl) || 0), 0);
  }
  const equityNow      = seed + totalCumPnl - totalWithdrawal;
  const effectiveSeed  = seed - seedWithdrawal;
  const retainedProfit = equityNow - effectiveSeed;

  // 일별 PnL 차트
  const dailyMap: Record<string, number> = {};
  for (const r of list) {
    if (r.pnl == null) continue;
    const day = new Date(new Date(r.opened_at).getTime() + 9 * 3600_000).toISOString().slice(0, 10);
    dailyMap[day] = (dailyMap[day] || 0) + Number(r.pnl);
  }
  const dailyPnl = Object.entries(dailyMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, pnl]) => ({ date, pnl: Number(pnl.toFixed(2)) }));

  return NextResponse.json({
    ok: true,
    stats: {
      todayPnL: sumToday, weekPnL: sumWeek, monthPnL: sumMonth,
      totalTrades: list.length, realizedTrades: realizedCount,
      wins: win, losses: loss, winRate,
      cumPnl:           Number(cumPnl.toFixed(2)),
      pnlFrom,
      seed,
      equityNow:        Number(equityNow.toFixed(2)),
      totalWithdrawal:  Number(totalWithdrawal.toFixed(2)),
      profitWithdrawal: Number(profitWithdrawal.toFixed(2)),
      seedWithdrawal:   Number(seedWithdrawal.toFixed(2)),
      retainedProfit:   Number(retainedProfit.toFixed(2)),
    },
    recent, topSymbols, dailyPnl,
  });
}
