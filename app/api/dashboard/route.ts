import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/firebase/serverAuth";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(message: string, status = 400) { return NextResponse.json({ ok: false, error: message }, { status }); }

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

function toDate(v: any): Date | null {
  if (!v) return null;
  if (v?.toDate) return v.toDate();
  if (v instanceof Date) return v;
  return new Date(v);
}

export async function GET(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const url     = new URL(req.url);
  const pnlFrom = url.searchParams.get("from") || null;

  const fromMonth = startOfMonthKST();
  const from90    = new Date(Date.now() - 90 * 86400_000);

  const db      = adminDb();
  const userRef = db.collection("users").doc(uid);

  const [monthSnap, recentSnap, wdSnap, rsSnap, heatmapSnap] = await Promise.all([
    userRef.collection("manual_trades").where("opened_at", ">=", fromMonth).orderBy("opened_at", "desc").limit(5000).get(),
    userRef.collection("manual_trades").orderBy("opened_at", "desc").limit(5).get(),
    userRef.collection("withdrawals").get(),
    userRef.collection("risk_settings").doc("default").get(),
    userRef.collection("manual_trades").where("opened_at", ">=", from90).where("symbol", "!=", "FUNDING").orderBy("symbol").orderBy("opened_at", "asc").get(),
  ]);

  const list = monthSnap.docs.map(d => ({
    opened_at: toDate(d.data().opened_at)?.toISOString() ?? "",
    closed_at: toDate(d.data().closed_at)?.toISOString() ?? null,
    pnl:       d.data().pnl ?? null,
    symbol:    d.data().symbol ?? "unknown",
    side:      d.data().side ?? "long",
    tags:      d.data().tags ?? [],
  }));
  const recent = recentSnap.docs.map(d => ({
    id: d.id, symbol: d.data().symbol, side: d.data().side,
    opened_at: toDate(d.data().opened_at)?.toISOString() ?? "",
    pnl: d.data().pnl ?? null, tags: d.data().tags ?? [],
  }));
  const wdList     = wdSnap.docs.map(d => d.data());
  const seed       = Number(rsSnap.exists ? rsSnap.data()?.seed_usd ?? 10000 : 10000);
  const heatmapRaw = heatmapSnap.docs.map(d => ({
    opened_at: toDate(d.data().opened_at)?.toISOString() ?? "",
    pnl: d.data().pnl ?? null,
    symbol: d.data().symbol,
  }));

  const fromToday = kstBoundary(0);
  const fromWeek  = startOfWeekKST();
  const todayMs = fromToday.getTime();
  const weekMs  = fromWeek.getTime();

  let sumMonth = 0, sumWeek = 0, sumToday = 0;
  let win = 0, loss = 0, realizedCount = 0;
  const symbolMap: Record<string, { pnl: number; count: number; wins: number; losses: number; _wins: number[]; _losses: number[] }> = {};

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
      if (!symbolMap[sym]) symbolMap[sym] = { pnl: 0, count: 0, wins: 0, losses: 0, _wins: [], _losses: [] };
      symbolMap[sym].pnl   += pnl;
      symbolMap[sym].count += 1;
      if (pnl > 0) symbolMap[sym]._wins.push(pnl);
      else if (pnl < 0) symbolMap[sym]._losses.push(pnl);
    }
  }
  for (const [, d] of Object.entries(symbolMap)) {
    (d as any).wins   = d._wins.length;
    (d as any).losses = d._losses.length;
  }

  // Long/Short 집계
  let longCount = 0, shortCount = 0;
  let maxConsecWin = 0, maxConsecLoss = 0, curWin = 0, curLoss = 0;
  let totalDurationMs = 0, durationCount = 0;
  const sortedList = [...list].filter(r => r.pnl != null && r.symbol !== "FUNDING")
    .sort((a, b) => a.opened_at.localeCompare(b.opened_at));
  for (const r of sortedList) {
    if (r.side === "long") longCount++; else shortCount++;
    const pnl = Number(r.pnl);
    if (pnl > 0) { curWin++; curLoss = 0; maxConsecWin = Math.max(maxConsecWin, curWin); }
    else if (pnl < 0) { curLoss++; curWin = 0; maxConsecLoss = Math.max(maxConsecLoss, curLoss); }
    if (r.closed_at && r.opened_at) {
      const dur = Date.parse(r.closed_at) - Date.parse(r.opened_at);
      if (dur > 0 && dur < 86400_000 * 30) { totalDurationMs += dur; durationCount++; }
    }
  }
  const avgDurationMin = durationCount > 0 ? Math.round(totalDurationMs / durationCount / 60000) : null;
  const winRate = realizedCount > 0 ? (win / realizedCount) * 100 : null;
  const topSymbols = Object.entries(symbolMap)
    .sort((a, b) => Math.abs(b[1].pnl) - Math.abs(a[1].pnl))
    .slice(0, 8)
    .map(([symbol, d]) => {
      const avgW = d._wins.length  ? d._wins.reduce((s,v)=>s+v,0)  / d._wins.length  : null;
      const avgL = d._losses.length ? d._losses.reduce((s,v)=>s+v,0) / d._losses.length : null;
      return {
        symbol, pnl: Number(d.pnl.toFixed(2)), count: d.count,
        wins: d._wins.length, losses: d._losses.length,
        winRate: d.count > 0 ? Math.round((d._wins.length / d.count) * 100) : 0,
        avgWin:  avgW !== null ? Number(avgW.toFixed(2)) : null,
        avgLoss: avgL !== null ? Number(avgL.toFixed(2)) : null,
      };
    });

  // 누적 PnL (기간 필터)
  let allTradesQuery: FirebaseFirestore.Query = userRef.collection("manual_trades");
  if (pnlFrom) allTradesQuery = allTradesQuery.where("opened_at", ">=", new Date(pnlFrom));
  const allTradesSnap = await allTradesQuery.get();
  const allTrades = allTradesSnap.docs.map(d => ({
    pnl: d.data().pnl, opened_at: toDate(d.data().opened_at)?.toISOString() ?? "",
  }));
  const cumPnl = allTrades.reduce((s, r) => s + (Number(r.pnl) || 0), 0);

  // 드로다운 시계열
  const sortedForDD = [...allTrades].filter(r => r.pnl != null)
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
  const ddByDay: Record<string, { dd: number; cumPnl: number }> = {};
  for (const p of drawdownSeries) ddByDay[p.date] = { dd: p.dd, cumPnl: p.cumPnl };
  const ddSeries = Object.entries(ddByDay).sort((a,b)=>a[0].localeCompare(b[0])).map(([date,v])=>({date,...v}));
  const currentDD = ddSeries.length > 0 ? ddSeries[ddSeries.length - 1].dd : 0;
  const maxDD     = ddSeries.length > 0 ? Math.max(...ddSeries.map(d => d.dd)) : 0;
  const recoveryNeeded = currentDD > 0 ? (100 / (100 - currentDD) - 1) * 100 : 0;

  // 출금
  const totalWithdrawal  = wdList.reduce((s, r) => s + Number(r.amount || 0), 0);
  const profitWithdrawal = wdList.filter(r => r.source === "profit").reduce((s, r) => s + Number(r.amount || 0), 0);
  const seedWithdrawal   = wdList.filter(r => r.source === "seed").reduce((s, r) => s + Number(r.amount || 0), 0);

  let totalCumPnl = cumPnl;
  if (pnlFrom) {
    const allTimeSnap = await userRef.collection("manual_trades").get();
    totalCumPnl = allTimeSnap.docs.reduce((s, d) => s + (Number(d.data().pnl) || 0), 0);
  }
  const equityNow      = seed + totalCumPnl - totalWithdrawal;
  const effectiveSeed  = seed - seedWithdrawal;
  const retainedProfit = equityNow - effectiveSeed;

  // 일별 PnL
  const dailyMap: Record<string, number> = {};
  for (const r of list) {
    if (r.pnl == null || r.symbol === "FUNDING") continue;
    const day = new Date(new Date(r.opened_at).getTime() + 9 * 3600_000).toISOString().slice(0, 10);
    dailyMap[day] = (dailyMap[day] || 0) + Number(r.pnl);
  }
  const dailyPnl = Object.entries(dailyMap).sort((a,b)=>a[0].localeCompare(b[0]))
    .map(([date,pnl])=>({date,pnl:Number(pnl.toFixed(2))}));

  // 히트맵
  const heatmap: Record<number, Record<number, { wins: number; total: number; pnl: number }>> = {};
  for (let d = 0; d < 7; d++) { heatmap[d] = {}; for (let h = 0; h < 24; h++) heatmap[d][h] = { wins: 0, total: 0, pnl: 0 }; }
  for (const r of heatmapRaw) {
    if (r.pnl == null) continue;
    const kstDate = new Date(new Date(r.opened_at).getTime() + 9 * 3600_000);
    const dow  = (kstDate.getUTCDay() + 6) % 7;
    const hour = kstDate.getUTCHours();
    const pnl  = Number(r.pnl);
    heatmap[dow][hour].total += 1;
    heatmap[dow][hour].pnl   += pnl;
    if (pnl > 0) heatmap[dow][hour].wins += 1;
  }
  const heatmapData: { dow: number; hour: number; winRate: number | null; total: number; pnl: number }[] = [];
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      const cell = heatmap[d][h];
      heatmapData.push({ dow: d, hour: h,
        winRate: cell.total >= 2 ? Math.round((cell.wins / cell.total) * 100) : null,
        total: cell.total, pnl: Number(cell.pnl.toFixed(2)) });
    }
  }

  // 월별 PnL (전체 기간)
  const monthlyMap: Record<string, number> = {};
  for (const r of allTrades) {
    if (!r.pnl) continue;
    const month = r.opened_at.slice(0, 7);
    monthlyMap[month] = (monthlyMap[month] || 0) + Number(r.pnl);
  }
  const monthlyPnl = Object.entries(monthlyMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, pnl]) => ({ month, pnl: Number(pnl.toFixed(2)) }));

  return NextResponse.json({
    ok: true,
    stats: {
      todayPnL: sumToday, weekPnL: sumWeek, monthPnL: sumMonth,
      totalTrades: list.length, realizedTrades: realizedCount,
      wins: win, losses: loss, winRate,
      cumPnl: Number(cumPnl.toFixed(2)), pnlFrom, seed,
      equityNow:        Number(equityNow.toFixed(2)),
      totalWithdrawal:  Number(totalWithdrawal.toFixed(2)),
      profitWithdrawal: Number(profitWithdrawal.toFixed(2)),
      seedWithdrawal:   Number(seedWithdrawal.toFixed(2)),
      retainedProfit:   Number(retainedProfit.toFixed(2)),
      currentDD: Number(currentDD.toFixed(2)), maxDD: Number(maxDD.toFixed(2)),
      recoveryNeeded: Number(recoveryNeeded.toFixed(2)),
      longCount, shortCount, maxConsecWin, maxConsecLoss, avgDurationMin,
    },
    recent, topSymbols, dailyPnl, ddSeries, heatmapData, monthlyPnl,
  });
}
