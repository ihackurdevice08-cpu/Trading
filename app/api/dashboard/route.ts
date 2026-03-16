import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/firebase/serverAuth";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(m: string, s = 400) { return NextResponse.json({ ok: false, error: m }, { status: s }); }

function tsToMs(v: any): number {
  if (!v) return 0;
  if (typeof v.toDate === "function") return v.toDate().getTime();
  if (v instanceof Date) return v.getTime();
  const n = Number(v);
  if (!isNaN(n) && n > 1e10) return n;
  return new Date(v).getTime();
}
function tsToISO(v: any): string {
  const ms = tsToMs(v);
  return ms ? new Date(ms).toISOString() : "";
}
function kstMs(offsetDays = 0): number {
  const kst = new Date(Date.now() + 9 * 3600_000);
  return Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() + offsetDays) - 9 * 3600_000;
}
function weekStartMs(): number {
  const kst = new Date(Date.now() + 9 * 3600_000);
  const day = (new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate())).getUTCDay() + 6) % 7;
  return Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() - day) - 9 * 3600_000;
}
function monthStartMs(): number {
  const kst = new Date(Date.now() + 9 * 3600_000);
  return Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), 1) - 9 * 3600_000;
}

export async function GET(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const url     = new URL(req.url);
  const pnlFrom = url.searchParams.get("from") || null;

  const db      = adminDb();
  const userRef = db.collection("users").doc(uid);

  const [allSnap, recentSnap, wdSnap, rsSnap] = await Promise.all([
    userRef.collection("manual_trades").orderBy("opened_at", "desc").limit(10000).get(),
    userRef.collection("manual_trades").orderBy("opened_at", "desc").limit(5).get(),
    userRef.collection("withdrawals").get(),
    userRef.collection("risk_settings").doc("default").get(),
  ]);

  const seed      = Number(rsSnap.exists ? rsSnap.data()?.seed_usd ?? 10000 : 10000);
  const wdList    = wdSnap.docs.map(d => d.data());

  const todayMs  = kstMs(0);
  const weekMs   = weekStartMs();
  const monthMs  = monthStartMs();
  const from90Ms = Date.now() - 90 * 86400_000;
  const pnlFromMs = pnlFrom ? new Date(pnlFrom).getTime() : 0;

  // 전체 거래 배열 (내림차순)
  const allTrades = allSnap.docs.map(d => {
    const data = d.data();
    const openMs = tsToMs(data.opened_at);
    return {
      id:        d.id,
      openMs,
      closeMs:   tsToMs(data.closed_at),
      openISO:   tsToISO(data.opened_at),
      closeISO:  tsToISO(data.closed_at),
      pnl:       data.pnl != null ? Number(data.pnl) : null,
      symbol:    String(data.symbol ?? "unknown"),
      side:      String(data.side   ?? "long"),
      tags:      data.tags ?? [],
    };
  });

  // 오늘/주/월 PnL 집계
  let sumToday = 0, sumWeek = 0, sumMonth = 0;
  let win = 0, loss = 0, realizedCount = 0;
  let longCount = 0, shortCount = 0;
  let maxConsecWin = 0, maxConsecLoss = 0, curWin = 0, curLoss = 0;
  let totalDurMs = 0, durCount = 0;
  const symbolMap: Record<string, { pnl: number; _wins: number[]; _losses: number[] }> = {};

  // 오름차순으로 순회 (연속승패 계산을 위해)
  const asc = [...allTrades].reverse();
  for (const r of asc) {
    if (r.symbol === "FUNDING") continue;
    if (r.pnl === null) continue;
    realizedCount++;
    if (r.openMs >= monthMs) sumMonth += r.pnl;
    if (r.openMs >= weekMs)  sumWeek  += r.pnl;
    if (r.openMs >= todayMs) sumToday += r.pnl;
    if (r.pnl > 0) { win++; curWin++; curLoss = 0; maxConsecWin = Math.max(maxConsecWin, curWin); }
    else           { loss++; curLoss++; curWin = 0; maxConsecLoss = Math.max(maxConsecLoss, curLoss); }
    if (r.side === "long") longCount++; else shortCount++;
    if (r.closeMs && r.openMs) {
      const dur = r.closeMs - r.openMs;
      if (dur > 0 && dur < 86400_000 * 30) { totalDurMs += dur; durCount++; }
    }
    if (!symbolMap[r.symbol]) symbolMap[r.symbol] = { pnl: 0, _wins: [], _losses: [] };
    symbolMap[r.symbol].pnl += r.pnl;
    if (r.pnl > 0) symbolMap[r.symbol]._wins.push(r.pnl);
    else           symbolMap[r.symbol]._losses.push(r.pnl);
  }
  const winRate       = realizedCount > 0 ? (win / realizedCount) * 100 : null;
  const avgDurationMin = durCount > 0 ? Math.round(totalDurMs / durCount / 60000) : null;

  const topSymbols = Object.entries(symbolMap)
    .sort((a, b) => Math.abs(b[1].pnl) - Math.abs(a[1].pnl))
    .slice(0, 8)
    .map(([symbol, d]) => {
      const avgW = d._wins.length   ? d._wins.reduce((s, v) => s + v, 0)   / d._wins.length   : null;
      const avgL = d._losses.length ? d._losses.reduce((s, v) => s + v, 0) / d._losses.length : null;
      const cnt  = d._wins.length + d._losses.length;
      return {
        symbol, pnl: Number(d.pnl.toFixed(2)), count: cnt,
        wins: d._wins.length, losses: d._losses.length,
        winRate: cnt > 0 ? Math.round((d._wins.length / cnt) * 100) : 0,
        avgWin:  avgW !== null ? Number(avgW.toFixed(2)) : null,
        avgLoss: avgL !== null ? Number(avgL.toFixed(2)) : null,
      };
    });

  // 누적 PnL (pnlFrom 필터 적용)
  const filteredTrades = pnlFrom
    ? allTrades.filter(r => r.openMs >= pnlFromMs)
    : allTrades;

  const cumPnl     = filteredTrades.reduce((s, r) => s + (r.pnl ?? 0), 0);
  const totalCumPnl = allTrades.reduce((s, r) => s + (r.pnl ?? 0), 0);

  // 드로다운 시계열 (오름차순)
  const forDD = [...filteredTrades].filter(r => r.pnl !== null).reverse();
  let runPnl = 0, peakPnl = 0;
  const ddByDay: Record<string, { dd: number; cumPnl: number }> = {};
  for (const r of forDD) {
    runPnl += r.pnl!;
    if (runPnl > peakPnl) peakPnl = runPnl;
    const dd  = peakPnl > 0 ? ((peakPnl - runPnl) / peakPnl) * 100 : 0;
    const day = new Date(r.openMs + 9 * 3600_000).toISOString().slice(0, 10);
    ddByDay[day] = { dd: Number(dd.toFixed(2)), cumPnl: Number(runPnl.toFixed(2)) };
  }
  const ddSeries = Object.entries(ddByDay)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({ date, ...v }));
  const currentDD      = ddSeries.length ? ddSeries[ddSeries.length - 1].dd : 0;
  const maxDD          = ddSeries.length ? Math.max(...ddSeries.map(d => d.dd)) : 0;
  const recoveryNeeded = currentDD > 0 ? (100 / (100 - currentDD) - 1) * 100 : 0;

  // 출금
  const totalWithdrawal  = wdList.reduce((s, r) => s + Number(r.amount || 0), 0);
  const profitWithdrawal = wdList.filter(r => r.source === "profit").reduce((s, r) => s + Number(r.amount || 0), 0);
  const seedWithdrawal   = wdList.filter(r => r.source === "seed").reduce((s, r) => s + Number(r.amount || 0), 0);
  const equityNow        = seed + totalCumPnl - totalWithdrawal;
  const effectiveSeed    = seed - seedWithdrawal;
  const retainedProfit   = equityNow - effectiveSeed;

  // 일별 PnL (이번달 + pnlFrom 범위)
  const dailyMap: Record<string, number> = {};
  for (const r of filteredTrades) {
    if (r.pnl === null || r.symbol === "FUNDING") continue;
    const day = new Date(r.openMs + 9 * 3600_000).toISOString().slice(0, 10);
    dailyMap[day] = (dailyMap[day] || 0) + r.pnl;
  }
  const dailyPnl = Object.entries(dailyMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, pnl]) => ({ date, pnl: Number(pnl.toFixed(2)) }));

  // 히트맵 (90일)
  const heatmap: Record<number, Record<number, { wins: number; total: number; pnl: number }>> = {};
  for (let d = 0; d < 7; d++) { heatmap[d] = {}; for (let h = 0; h < 24; h++) heatmap[d][h] = { wins: 0, total: 0, pnl: 0 }; }
  for (const r of allTrades) {
    if (r.pnl === null || r.openMs < from90Ms || r.symbol === "FUNDING") continue;
    const kstDate = new Date(r.openMs + 9 * 3600_000);
    const dow  = (kstDate.getUTCDay() + 6) % 7;
    const hour = kstDate.getUTCHours();
    heatmap[dow][hour].total += 1;
    heatmap[dow][hour].pnl   += r.pnl;
    if (r.pnl > 0) heatmap[dow][hour].wins += 1;
  }
  const heatmapData = [];
  for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) {
    const c = heatmap[d][h];
    heatmapData.push({ dow: d, hour: h, total: c.total, pnl: Number(c.pnl.toFixed(2)),
      winRate: c.total >= 2 ? Math.round((c.wins / c.total) * 100) : null });
  }

  // 월별 PnL
  const monthlyMap: Record<string, number> = {};
  for (const r of allTrades) {
    if (!r.pnl) continue;
    const month = r.openISO.slice(0, 7);
    if (month) monthlyMap[month] = (monthlyMap[month] || 0) + r.pnl;
  }
  const monthlyPnl = Object.entries(monthlyMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, pnl]) => ({ month, pnl: Number(pnl.toFixed(2)) }));

  // 최근 5건
  const recent = recentSnap.docs.map(d => ({
    id: d.id, symbol: d.data().symbol, side: d.data().side,
    opened_at: tsToISO(d.data().opened_at),
    pnl: d.data().pnl ?? null, tags: d.data().tags ?? [],
  }));

  return NextResponse.json({
    ok: true,
    stats: {
      todayPnL: Number(sumToday.toFixed(2)),
      weekPnL:  Number(sumWeek.toFixed(2)),
      monthPnL: Number(sumMonth.toFixed(2)),
      totalTrades: allTrades.filter(r => r.symbol !== "FUNDING").length,
      realizedTrades: realizedCount,
      wins: win, losses: loss, winRate,
      cumPnl: Number(cumPnl.toFixed(2)), pnlFrom, seed,
      equityNow:        Number(equityNow.toFixed(2)),
      totalWithdrawal:  Number(totalWithdrawal.toFixed(2)),
      profitWithdrawal: Number(profitWithdrawal.toFixed(2)),
      seedWithdrawal:   Number(seedWithdrawal.toFixed(2)),
      retainedProfit:   Number(retainedProfit.toFixed(2)),
      currentDD: Number(currentDD.toFixed(2)),
      maxDD:     Number(maxDD.toFixed(2)),
      recoveryNeeded: Number(recoveryNeeded.toFixed(2)),
      longCount, shortCount, maxConsecWin, maxConsecLoss, avgDurationMin,
    },
    recent, topSymbols, dailyPnl, ddSeries, heatmapData, monthlyPnl,
  });
}
