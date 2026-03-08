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

  const url     = new URL(req.url);
  const pnlFrom = url.searchParams.get("from") || null;

  const fromToday = kstBoundary(0).toISOString();
  const fromWeek  = startOfWeekKST().toISOString();
  const fromMonth = startOfMonthKST().toISOString();

  const sb = supabaseServer();

  // 히트맵용: 최근 90일치 데이터 (시간대/요일 분석)
  const from90 = new Date(Date.now() - 90 * 86400_000).toISOString();

  const [tradesRes, recentRes, withdrawRes, riskRes, heatmapRes] = await Promise.all([
    sb.from("manual_trades").select("opened_at,pnl,symbol,side,tags")
      .eq("user_id", uid).gte("opened_at", fromMonth).order("opened_at", { ascending: false }).limit(5000),
    sb.from("manual_trades").select("id,symbol,side,opened_at,pnl,tags")
      .eq("user_id", uid).order("opened_at", { ascending: false }).limit(5),
    sb.from("withdrawals").select("amount,source").eq("user_id", uid),
    sb.from("risk_settings").select("seed_usd").eq("user_id", uid).maybeSingle(),
    sb.from("manual_trades").select("opened_at,pnl,symbol")
      .eq("user_id", uid).gte("opened_at", from90)
      .not("symbol", "eq", "FUNDING").order("opened_at", { ascending: true }),
  ]);

  const list       = tradesRes.data  || [];
  const recent     = recentRes.data  || [];
  const wdList     = withdrawRes.data || [];
  const seed       = Number(riskRes.data?.seed_usd || 10000);
  const heatmapRaw = heatmapRes.data  || [];

  // 기간별 PnL
  let sumMonth = 0, sumWeek = 0, sumToday = 0;
  let win = 0, loss = 0, realizedCount = 0;
  const todayMs = Date.parse(fromToday);
  const weekMs  = Date.parse(fromWeek);
  const symbolMap: Record<string, { pnl: number; count: number; wins: number; losses: number; avgWin: number; avgLoss: number; _wins: number[]; _losses: number[] }> = {};

  for (const r of list) {
    const pnl = r.pnl == null ? null : Number(r.pnl);
    const t   = Date.parse(r.opened_at);
    const sym = r.symbol || "unknown";
    if (sym === "FUNDING") continue;
    if (pnl !== null && Number.isFinite(pnl)) {
      realizedCount++;
      sumMonth += pnl;
      if (t >= weekMs)  sumWeek  += pnl;
      if (t >= todayMs) sumToday += pnl;
      if (pnl > 0) win++; else if (pnl < 0) loss++;
      if (!symbolMap[sym]) symbolMap[sym] = { pnl: 0, count: 0, wins: 0, losses: 0, avgWin: 0, avgLoss: 0, _wins: [], _losses: [] };
      symbolMap[sym].pnl   += pnl;
      symbolMap[sym].count += 1;
      if (pnl > 0) { symbolMap[sym].wins += 1; symbolMap[sym]._wins.push(pnl); }
      else if (pnl < 0) { symbolMap[sym].losses += 1; symbolMap[sym]._losses.push(pnl); }
    }
  }

  const winRate   = realizedCount > 0 ? (win / realizedCount) * 100 : null;
  const topSymbols = Object.entries(symbolMap)
    .sort((a, b) => Math.abs(b[1].pnl) - Math.abs(a[1].pnl))
    .slice(0, 8)
    .map(([symbol, d]) => {
      const avgW = d._wins.length  ? d._wins.reduce((s,v)=>s+v,0)  / d._wins.length  : null;
      const avgL = d._losses.length ? d._losses.reduce((s,v)=>s+v,0) / d._losses.length : null;
      return {
        symbol,
        pnl:     Number(d.pnl.toFixed(2)),
        count:   d.count,
        wins:    d.wins,
        losses:  d.losses,
        winRate: d.count > 0 ? Math.round((d.wins / d.count) * 100) : 0,
        avgWin:  avgW !== null ? Number(avgW.toFixed(2)) : null,
        avgLoss: avgL !== null ? Number(avgL.toFixed(2)) : null,
      };
    });

  // 누적 PnL (기간 필터)
  let cumPnlQuery = sb.from("manual_trades").select("pnl,opened_at").eq("user_id", uid);
  if (pnlFrom) cumPnlQuery = cumPnlQuery.gte("opened_at", new Date(pnlFrom).toISOString());
  const { data: allTrades } = await cumPnlQuery;
  const cumPnl = (allTrades || []).reduce((s, r) => s + (Number(r.pnl) || 0), 0);

  // 드로다운 시계열 계산 (allTrades 사용, 시간순 정렬)
  const sortedForDD = [...(allTrades || [])]
    .filter(r => r.pnl != null)
    .sort((a, b) => a.opened_at.localeCompare(b.opened_at));
  let runningPnl = 0, peakPnl = 0;
  const drawdownSeries: { date: string; dd: number; cumPnl: number }[] = [];
  for (const r of sortedForDD) {
    runningPnl += Number(r.pnl);
    if (runningPnl > peakPnl) peakPnl = runningPnl;
    const dd = peakPnl > 0 ? ((peakPnl - runningPnl) / peakPnl) * 100 : 0;
    const day = new Date(new Date(r.opened_at).getTime() + 9 * 3600_000).toISOString().slice(0, 10);
    drawdownSeries.push({ date: day, dd: Number(dd.toFixed(2)), cumPnl: Number(runningPnl.toFixed(2)) });
  }
  // 날짜별 마지막 값만
  const ddByDay: Record<string, { dd: number; cumPnl: number }> = {};
  for (const p of drawdownSeries) ddByDay[p.date] = { dd: p.dd, cumPnl: p.cumPnl };
  const ddSeries = Object.entries(ddByDay)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({ date, ...v }));
  const currentDD = ddSeries.length > 0 ? ddSeries[ddSeries.length - 1].dd : 0;
  const maxDD     = ddSeries.length > 0 ? Math.max(...ddSeries.map(d => d.dd)) : 0;
  // 리커버리: 현재 DD에서 원금 복구까지 필요 수익률
  const recoveryNeeded = currentDD > 0 ? (100 / (100 - currentDD) - 1) * 100 : 0;

  // 출금
  const totalWithdrawal  = wdList.reduce((s, r) => s + Number(r.amount || 0), 0);
  const profitWithdrawal = wdList.filter(r => r.source === "profit").reduce((s, r) => s + Number(r.amount || 0), 0);
  const seedWithdrawal   = wdList.filter(r => r.source === "seed").reduce((s, r) => s + Number(r.amount || 0), 0);

  let totalCumPnl = cumPnl;
  if (pnlFrom) {
    const { data: allTime } = await sb.from("manual_trades").select("pnl").eq("user_id", uid);
    totalCumPnl = (allTime || []).reduce((s, r) => s + (Number(r.pnl) || 0), 0);
  }
  const equityNow     = seed + totalCumPnl - totalWithdrawal;
  const effectiveSeed = seed - seedWithdrawal;
  const retainedProfit = equityNow - effectiveSeed;

  // 일별 PnL 차트
  const dailyMap: Record<string, number> = {};
  for (const r of list) {
    if (r.pnl == null || r.symbol === "FUNDING") continue;
    const day = new Date(new Date(r.opened_at).getTime() + 9 * 3600_000).toISOString().slice(0, 10);
    dailyMap[day] = (dailyMap[day] || 0) + Number(r.pnl);
  }
  const dailyPnl = Object.entries(dailyMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, pnl]) => ({ date, pnl: Number(pnl.toFixed(2)) }));

  // 히트맵: 요일(0=월~6=일) × 시간대(0~23) 승률
  // [요일][시간대] = { wins, total }
  const heatmap: Record<number, Record<number, { wins: number; total: number; pnl: number }>> = {};
  for (let d = 0; d < 7; d++) { heatmap[d] = {}; for (let h = 0; h < 24; h++) heatmap[d][h] = { wins: 0, total: 0, pnl: 0 }; }
  for (const r of heatmapRaw) {
    if (r.pnl == null) continue;
    const kstDate = new Date(new Date(r.opened_at).getTime() + 9 * 3600_000);
    const dow  = (kstDate.getUTCDay() + 6) % 7; // 0=월 ~ 6=일
    const hour = kstDate.getUTCHours();
    const pnl  = Number(r.pnl);
    heatmap[dow][hour].total += 1;
    heatmap[dow][hour].pnl   += pnl;
    if (pnl > 0) heatmap[dow][hour].wins += 1;
  }
  // 직렬화
  const heatmapData: { dow: number; hour: number; winRate: number | null; total: number; pnl: number }[] = [];
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      const cell = heatmap[d][h];
      heatmapData.push({
        dow: d, hour: h,
        winRate: cell.total >= 2 ? Math.round((cell.wins / cell.total) * 100) : null,
        total: cell.total,
        pnl: Number(cell.pnl.toFixed(2)),
      });
    }
  }

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
      currentDD:        Number(currentDD.toFixed(2)),
      maxDD:            Number(maxDD.toFixed(2)),
      recoveryNeeded:   Number(recoveryNeeded.toFixed(2)),
    },
    recent, topSymbols, dailyPnl, ddSeries, heatmapData,
  });
}
