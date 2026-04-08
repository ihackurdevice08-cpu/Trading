import { NextResponse } from "next/server";
import { getAuthInfo } from "@/lib/firebase/serverAuth";
import { queryDocs, listDocs, getDoc } from "@/lib/firebase/firestoreRest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(m: string, s = 400) { return NextResponse.json({ ok: false, error: m }, { status: s }); }

function tsToMs(v: any): number {
  if (!v) return 0;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "string") return new Date(v).getTime();
  return 0;
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
  const auth = await getAuthInfo();
  if (!auth) return bad("unauthorized", 401);
  const { uid, token } = auth;

  const url     = new URL(req.url);
  const pnlFromParam = url.searchParams.get("from") || null;
  // URL 파라미터 없으면 risk_settings.pnl_from 사용 (아래서 rsDoc fetch 후 재설정)
  let pnlFrom = pnlFromParam;
  let pnlFromMs = pnlFrom ? new Date(pnlFrom).getTime() : 0;

  const base = `users/${uid}`;

  // 병렬로 데이터 가져오기 (recentDocs는 allTradeDocs.slice로 대체)
  // 1단계: risk_settings 먼저 읽어서 pnl_from 확정
  const rsDoc = await getDoc(token, `${base}/risk_settings/default`);
  const seed  = Number(rsDoc?.seed_usd ?? 10000);
  if (!pnlFromParam && rsDoc?.pnl_from) {
    pnlFrom = String(rsDoc.pnl_from);
    pnlFromMs = new Date(pnlFrom).getTime();
  }

  // 2단계: pnlFrom이 있으면 그 이후 데이터만 쿼리 (Firestore 레벨 필터 → 전송량 대폭 감소)
  // totalCumPnl을 위해 전체 데이터도 pnl 필드만 경량 조회
  const filteredQuery = pnlFromMs ? {
    where: {
      fieldFilter: {
        field: { fieldPath: "opened_at" },
        op: "GREATER_THAN_OR_EQUAL",
        value: { timestampValue: new Date(pnlFromMs).toISOString() },
      },
    },
    orderBy: [{ field: { fieldPath: "opened_at" }, direction: "DESCENDING" }],
    limit: 5000,
  } : {
    orderBy: [{ field: { fieldPath: "opened_at" }, direction: "DESCENDING" }],
    limit: 5000,
  };

  // pnlFrom이 있을 때: 필터된 거래 + 전체 누적 PnL (pnl 필드만) 병렬 조회
  // pnlFrom이 없을 때: 단일 쿼리로 처리
  const fullQuery = {
    orderBy: [{ field: { fieldPath: "opened_at" }, direction: "DESCENDING" }],
    limit: 5000,
  };

  const [allTradeDocs, wdDocs, fullPnlDocs] = await Promise.all([
    queryDocs(token, `${base}/manual_trades`, filteredQuery),
    listDocs(token, `${base}/withdrawals`),
    // equityNow 계산용 전체 PnL (pnlFrom 있을 때만 별도 조회)
    pnlFromMs
      ? queryDocs(token, `${base}/manual_trades`, fullQuery)
          .catch(() => [] as any[])
      : Promise.resolve(null),
  ]);
  const wdList = wdDocs;

  const todayMs  = kstMs(0);
  const weekMs   = weekStartMs();
  const monthMs  = monthStartMs();
  const from90Ms = Date.now() - 90 * 86400_000;
  const pnlFromMsClamped = pnlFromMs;

  // 전체 거래 정규화
  const allTrades = allTradeDocs.map(doc => ({
    id:       doc.__id,
    openMs:   tsToMs(doc.opened_at),
    closeMs:  tsToMs(doc.closed_at),
    openISO:  doc.opened_at instanceof Date ? doc.opened_at.toISOString() : String(doc.opened_at ?? ""),
    closeISO: doc.closed_at instanceof Date ? doc.closed_at.toISOString() : String(doc.closed_at ?? ""),
    pnl:      doc.pnl != null ? Number(doc.pnl) : null,
    symbol:   String(doc.symbol ?? "unknown"),
    side:     String(doc.side   ?? "long"),
    tags:     doc.tags ?? [],
  }));

  // 오늘/주/월 PnL + 통계 (오름차순으로 순회)
  let sumToday = 0, sumWeek = 0, sumMonth = 0;
  let win = 0, loss = 0, realizedCount = 0;
  let cycleWin = 0, cycleLoss = 0, cycleCount = 0; // 사이클 기준
  let longCount = 0, shortCount = 0;
  let maxConsecWin = 0, maxConsecLoss = 0, curWin = 0, curLoss = 0;
  let totalDurMs = 0, durCount = 0;
  const symbolMap: Record<string, { pnl: number; _wins: number[]; _losses: number[] }> = {};

  for (const r of [...allTrades].reverse()) {
    if (r.symbol === "FUNDING" || r.pnl === null) continue;
    realizedCount++;
    if (r.openMs >= monthMs) sumMonth += r.pnl;
    if (r.openMs >= weekMs)  sumWeek  += r.pnl;
    if (r.openMs >= todayMs) sumToday += r.pnl;
    if (r.pnl > 0) { win++; curWin++; curLoss = 0; maxConsecWin = Math.max(maxConsecWin, curWin); }
    else           { loss++; curLoss++; curWin = 0; maxConsecLoss = Math.max(maxConsecLoss, curLoss); }
    // 사이클 기준 승률 (pnlFrom 이후 거래만)
    if (!pnlFromMsClamped || r.openMs >= pnlFromMsClamped) {
      cycleCount++;
      if (r.pnl > 0) cycleWin++; else cycleLoss++;
    }
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

  const winRate      = realizedCount > 0 ? (win / realizedCount) * 100 : null;
  const cycleWinRate = cycleCount > 0 ? (cycleWin / cycleCount) * 100 : null;
  const avgDurationMin = durCount > 0 ? Math.round(totalDurMs / durCount / 60000) : null;

  const topSymbols = Object.entries(symbolMap)
    .sort((a, b) => Math.abs(b[1].pnl) - Math.abs(a[1].pnl))
    .slice(0, 8)
    .map(([symbol, d]) => {
      const cnt  = d._wins.length + d._losses.length;
      const avgW = d._wins.length   ? d._wins.reduce((s,v)=>s+v,0)   / d._wins.length   : null;
      const avgL = d._losses.length ? d._losses.reduce((s,v)=>s+v,0) / d._losses.length : null;
      return {
        symbol, pnl: Number(d.pnl.toFixed(2)), count: cnt,
        wins: d._wins.length, losses: d._losses.length,
        winRate: cnt > 0 ? Math.round((d._wins.length / cnt) * 100) : 0,
        avgWin:  avgW !== null ? Number(avgW.toFixed(2)) : null,
        avgLoss: avgL !== null ? Number(avgL.toFixed(2)) : null,
      };
    });

  // 누적 PnL (pnlFrom 필터)
  const filtered = pnlFromMsClamped
    ? allTrades.filter(r => r.openMs >= pnlFromMsClamped)
    : allTrades;

  // cumPnl: pnlFrom 이후 거래 기준
  const cumPnl = filtered.reduce((s, r) => s + (r.pnl ?? 0), 0);
  // totalCumPnl: 전체 기간 (equityNow 계산용)
  const totalCumPnl = fullPnlDocs
    ? fullPnlDocs.reduce((s: number, d: any) => s + Number(d.pnl ?? 0), 0)
    : cumPnl; // pnlFrom 없을 때는 allTrades = 전체 기간

  // 드로다운
  const forDD = [...filtered].filter(r => r.pnl !== null).reverse();
  let runPnl = 0, peakPnl = 0;
  const ddByDay: Record<string, { dd: number; cumPnl: number }> = {};
  for (const r of forDD) {
    runPnl += r.pnl!;
    if (runPnl > peakPnl) peakPnl = runPnl;
    const dd  = peakPnl > 0 ? ((peakPnl - runPnl) / peakPnl) * 100 : 0;
    const day = new Date(r.openMs + 9 * 3600_000).toISOString().slice(0, 10);
    ddByDay[day] = { dd: Number(dd.toFixed(2)), cumPnl: Number(runPnl.toFixed(2)) };
  }
  const ddSeries = Object.entries(ddByDay).sort((a,b)=>a[0].localeCompare(b[0])).map(([date,v])=>({date,...v}));
  const currentDD      = ddSeries.length ? ddSeries[ddSeries.length-1].dd : 0;
  const maxDD          = ddSeries.length ? Math.max(...ddSeries.map(d=>d.dd)) : 0;
  const recoveryNeeded = currentDD > 0 ? (100/(100-currentDD)-1)*100 : 0;

  // 출금
  const totalWithdrawal  = wdList.reduce((s,r)=>s+Number(r.amount||0),0);
  const profitWithdrawal = wdList.filter(r=>r.source==="profit").reduce((s,r)=>s+Number(r.amount||0),0);
  const seedWithdrawal   = wdList.filter(r=>r.source==="seed").reduce((s,r)=>s+Number(r.amount||0),0);
  const equityNow        = seed + totalCumPnl - totalWithdrawal;
  const retainedProfit   = equityNow - (seed - seedWithdrawal);

  // 일별 PnL
  const dailyMap: Record<string, number> = {};
  for (const r of filtered) {
    if (r.pnl === null || r.symbol === "FUNDING") continue;
    const day = new Date(r.openMs + 9 * 3600_000).toISOString().slice(0, 10);
    dailyMap[day] = (dailyMap[day] || 0) + r.pnl;
  }
  const dailyPnl = Object.entries(dailyMap).sort((a,b)=>a[0].localeCompare(b[0]))
    .map(([date,pnl])=>({date,pnl:Number(pnl.toFixed(2))}));

  // 히트맵 (90일)
  const heatmap: Record<string,{wins:number;total:number;pnl:number}> = {};
  for (let d=0;d<7;d++) for (let h=0;h<24;h++) heatmap[`${d}_${h}`]={wins:0,total:0,pnl:0};
  for (const r of allTrades) {
    if (r.pnl===null||r.openMs<from90Ms||r.symbol==="FUNDING") continue;
    const kstDate = new Date(r.openMs + 9*3600_000);
    const dow  = (kstDate.getUTCDay()+6)%7;
    const hour = kstDate.getUTCHours();
    const key  = `${dow}_${hour}`;
    heatmap[key].total++;
    heatmap[key].pnl += r.pnl;
    if (r.pnl>0) heatmap[key].wins++;
  }
  const heatmapData = [];
  for (let d=0;d<7;d++) for (let h=0;h<24;h++) {
    const c = heatmap[`${d}_${h}`];
    heatmapData.push({dow:d,hour:h,total:c.total,pnl:Number(c.pnl.toFixed(2)),
      winRate:c.total>=2?Math.round((c.wins/c.total)*100):null});
  }

  // 월별 PnL
  const monthlyMap: Record<string,number> = {};
  for (const r of allTrades) {
    if (!r.pnl||!r.openISO) continue;
    const month = r.openISO.slice(0,7);
    monthlyMap[month] = (monthlyMap[month]||0) + r.pnl;
  }
  const monthlyPnl = Object.entries(monthlyMap).sort((a,b)=>a[0].localeCompare(b[0]))
    .map(([month,pnl])=>({month,pnl:Number(pnl.toFixed(2))}));

  // 최근 5건 (allTradeDocs에서 slice — 별도 쿼리 불필요)
  const recent = allTradeDocs.slice(0, 5).map(doc => ({
    id: doc.__id, symbol: doc.symbol, side: doc.side,
    opened_at: doc.opened_at instanceof Date ? doc.opened_at.toISOString() : String(doc.opened_at ?? ""),
    pnl: doc.pnl ?? null, tags: doc.tags ?? [],
  }));

  return NextResponse.json({
    ok: true,
    stats: {
      todayPnL: Number(sumToday.toFixed(2)),
      weekPnL:  Number(sumWeek.toFixed(2)),
      monthPnL: Number(sumMonth.toFixed(2)),
      totalTrades: allTrades.filter(r=>r.symbol!=="FUNDING").length,
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
      cycleWin, cycleLoss, cycleCount, cycleWinRate: cycleWinRate !== null ? Number(cycleWinRate.toFixed(1)) : null,
    },
    recent, topSymbols, dailyPnl, ddSeries, heatmapData, monthlyPnl,
  });
}

// optimized: 20260318013014
