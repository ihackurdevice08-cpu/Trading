import { NextResponse } from "next/server";
import { getAuthInfo } from "@/lib/firebase/serverAuth";
import { getDoc, queryDocs } from "@/lib/firebase/firestoreRest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const n = (value: any) => (Number.isFinite(Number(value)) ? Number(value) : 0);

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function tsToMs(value: any): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") return new Date(value).getTime();
  return 0;
}

function iso(value: any): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return null;
}

export async function GET() {
  const auth = await getAuthInfo();
  if (!auth) return bad("unauthorized", 401);
  const { uid, token } = auth;
  const base = `users/${uid}`;

  const [summaryDoc, snapshotDocs, tradeDocs] = await Promise.all([
    getDoc(token, `${base}/prop_summary/current`),
    queryDocs(token, `${base}/prop_snapshots`, {
      orderBy: [{ field: { fieldPath: "timestamp" }, direction: "DESCENDING" }],
      limit: 240,
    }).catch(() => [] as Record<string, any>[]),
    queryDocs(token, `${base}/prop_trades`, {
      orderBy: [{ field: { fieldPath: "closed_at" }, direction: "DESCENDING" }],
      limit: 5000,
    }).catch(() => [] as Record<string, any>[]),
  ]);

  const latestSnapshot = snapshotDocs[0] ?? null;
  const hasData = Boolean(summaryDoc || latestSnapshot);
  const account = {
    accountKey: String(summaryDoc?.account_key ?? latestSnapshot?.account_key ?? "fastpro_1"),
    accountLabel: String(summaryDoc?.account_label ?? latestSnapshot?.account_label ?? "ForTraders FAST PRO"),
    phase: String(summaryDoc?.account_phase ?? latestSnapshot?.account_phase ?? "challenge"),
    updatedAt: iso(summaryDoc?.updated_at ?? latestSnapshot?.timestamp),
  };

  const snapshotSource = summaryDoc ?? latestSnapshot ?? {};
  const currentProfit = n(snapshotSource.current_profit);
  const profitTarget = n(snapshotSource.profit_target_amount);
  const profitToTarget = snapshotSource.profit_to_target != null
    ? n(snapshotSource.profit_to_target)
    : Math.max(0, profitTarget - currentProfit);

  const closedTrades = tradeDocs.map(doc => {
    const netPnl = doc.net_pnl != null
      ? n(doc.net_pnl)
      : n(doc.realized_pnl) - n(doc.commission);
    return {
      id: String(doc.__id ?? doc.position_id ?? ""),
      accountKey: String(doc.account_key ?? account.accountKey),
      symbol: String(doc.symbol ?? ""),
      side: String(doc.side ?? ""),
      lots: n(doc.lots ?? doc.size_lots ?? doc.size),
      entry: n(doc.entry ?? doc.entry_price),
      exit: n(doc.exit ?? doc.exit_price),
      realizedPnl: n(doc.realized_pnl),
      commission: n(doc.commission),
      netPnl,
      closedAt: iso(doc.closed_at ?? doc.timestamp),
      closedMs: tsToMs(doc.closed_at ?? doc.timestamp),
    };
  });

  const realized = closedTrades.filter(trade => trade.netPnl !== 0 || trade.realizedPnl !== 0);
  const wins = realized.filter(trade => trade.netPnl > 0).length;
  const losses = realized.filter(trade => trade.netPnl < 0).length;
  const totalNetPnl = realized.reduce((sum, trade) => sum + trade.netPnl, 0);
  const totalFees = closedTrades.reduce((sum, trade) => sum + trade.commission, 0);
  const bestTrade = realized.reduce((best, trade) => Math.max(best, trade.netPnl), 0);
  const worstTrade = realized.reduce((worst, trade) => Math.min(worst, trade.netPnl), 0);

  const symbolMap: Record<string, { symbol: string; netPnl: number; trades: number; wins: number; losses: number }> = {};
  for (const trade of realized) {
    const symbol = trade.symbol || "UNKNOWN";
    if (!symbolMap[symbol]) symbolMap[symbol] = { symbol, netPnl: 0, trades: 0, wins: 0, losses: 0 };
    symbolMap[symbol].netPnl += trade.netPnl;
    symbolMap[symbol].trades += 1;
    if (trade.netPnl > 0) symbolMap[symbol].wins += 1;
    if (trade.netPnl < 0) symbolMap[symbol].losses += 1;
  }

  const bySymbol = Object.values(symbolMap)
    .sort((a, b) => Math.abs(b.netPnl) - Math.abs(a.netPnl))
    .map(row => ({ ...row, netPnl: Number(row.netPnl.toFixed(2)) }));

  const ddSeries = [...snapshotDocs]
    .reverse()
    .map(doc => ({
      timestamp: iso(doc.timestamp),
      balance: Number(n(doc.balance).toFixed(2)),
      equity: Number(n(doc.equity).toFixed(2)),
      maxDdLine: Number(n(doc.max_dd_line).toFixed(2)),
      maxDdBuffer: Number(n(doc.max_dd_buffer).toFixed(2)),
      totalExposure: Number(n(doc.total_exposure).toFixed(2)),
    }))
    .filter(row => row.timestamp);

  return NextResponse.json({
    ok: true,
    hasData,
    account,
    stats: {
      balance: Number(n(snapshotSource.balance).toFixed(2)),
      equity: Number(n(snapshotSource.equity).toFixed(2)),
      currentProfit: Number(currentProfit.toFixed(2)),
      profitTarget: Number(profitTarget.toFixed(2)),
      profitToTarget: Number(profitToTarget.toFixed(2)),
      maxDdLine: Number(n(snapshotSource.max_dd_line).toFixed(2)),
      maxDdBuffer: Number(n(snapshotSource.max_dd_buffer).toFixed(2)),
      totalExposure: Number(n(snapshotSource.total_exposure).toFixed(2)),
      openPositionsCount: Number(snapshotSource.open_positions_count ?? 0),
      profitableDayCount: Number(snapshotSource.profitable_day_count ?? 0),
      profitableDayTarget: Number(snapshotSource.profitable_day_target ?? 4),
      bestDayProfit: Number(n(snapshotSource.best_day_profit).toFixed(2)),
      closedTradeCount: closedTrades.length,
      realizedTradeCount: realized.length,
      wins,
      losses,
      winRate: realized.length ? Number(((wins / realized.length) * 100).toFixed(1)) : null,
      totalNetPnl: Number(totalNetPnl.toFixed(2)),
      totalFees: Number(totalFees.toFixed(2)),
      bestTrade: Number(bestTrade.toFixed(2)),
      worstTrade: Number(worstTrade.toFixed(2)),
    },
    recentTrades: closedTrades.slice(0, 20),
    bySymbol,
    ddSeries,
  });
}
