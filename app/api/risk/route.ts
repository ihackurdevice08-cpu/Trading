import { NextResponse } from "next/server";
import { getAuthInfo } from "@/lib/firebase/serverAuth";
import { queryDocs, listDocs, getDoc } from "@/lib/firebase/firestoreRest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function kstToday(): number {
  const kst = new Date(Date.now() + 9 * 3600_000);
  return Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - 9 * 3600_000;
}
function kstThisHour(): number {
  const kst = new Date(Date.now() + 9 * 3600_000);
  return Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate(), kst.getUTCHours()) - 9 * 3600_000;
}
function tsToMs(v: any): number {
  if (!v) return 0;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "string") return new Date(v).getTime();
  return 0;
}

export async function GET(req: Request) {
  const auth = await getAuthInfo();
  if (!auth) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { uid, token } = auth;

  const url       = new URL(req.url);
  const pnlFromParam = url.searchParams.get("from") || null;
  let pnlFrom   = pnlFromParam;
  let pnlFromMs = pnlFrom ? new Date(pnlFrom).getTime() : 0;

  const base = `users/${uid}`;

  const [rsDoc, allTradeDocs, wdDocs] = await Promise.all([
    getDoc(token, `${base}/risk_settings/default`),
    queryDocs(token, `${base}/manual_trades`, {
      orderBy: [{ field: { fieldPath: "opened_at" }, direction: "DESCENDING" }],
      limit: 10000,
    }),
    listDocs(token, `${base}/withdrawals`),
  ]);

  const rs = rsDoc ?? {};
  const settings = {
    seed_usd:               n(rs.seed_usd               ?? 10000),
    max_dd_usd:             n(rs.max_dd_usd             ?? 500),
    max_dd_pct:             n(rs.max_dd_pct             ?? 5),
    max_daily_loss_usd:     n(rs.max_daily_loss_usd     ?? 300),
    max_daily_loss_pct:     n(rs.max_daily_loss_pct     ?? 3),
    max_consecutive_losses: Number(rs.max_consecutive_losses ?? 3),
    manual_trading_state:   String(rs.manual_trading_state   ?? "auto"),
    dd_mode:                String(rs.dd_mode ?? "drawdown"),
    dd_floor_usd:           rs.dd_floor_usd != null ? Number(rs.dd_floor_usd) : null,
  };

  const seed            = settings.seed_usd;
  // URL 파라미터 없으면 risk_settings.pnl_from 적용
  if (!pnlFromParam && rs?.pnl_from) {
    pnlFrom = String(rs.pnl_from);
    pnlFromMs = new Date(pnlFrom).getTime();
  }
  const totalWithdrawal = wdDocs.reduce((s, d) => s + Number(d.amount || 0), 0);
  const todayMs         = kstToday();
  const hourMs          = kstThisHour();

  // 정규화
  const allTrades = allTradeDocs.map(doc => ({
    openMs: tsToMs(doc.opened_at),
    pnl:    doc.pnl != null ? Number(doc.pnl) : null,
  }));

  // 오름차순으로 누적 PnL 계산
  let cumPnl = 0, peakEquity = seed, maxDdUsd = 0, totalCumPnl = 0;
  for (const r of [...allTrades].reverse()) {
    if (r.pnl === null) continue;
    totalCumPnl += r.pnl;
    if (pnlFromMs && r.openMs < pnlFromMs) continue;
    cumPnl += r.pnl;
    const eq = seed + cumPnl;
    if (eq > peakEquity) peakEquity = eq;
    const dd = peakEquity - eq;
    if (dd > maxDdUsd) maxDdUsd = dd;
  }

  const equityNow   = seed + totalCumPnl - totalWithdrawal;
  const pnlPct      = seed > 0 ? (cumPnl / seed) * 100 : 0;
  const ddPct       = equityNow > 0 ? (maxDdUsd / equityNow) * 100 : 0;

  const todayTrades    = allTrades.filter(r => r.openMs >= todayMs);
  const todayPnl       = todayTrades.reduce((s, r) => s + n(r.pnl), 0);
  const tradesToday    = todayTrades.length;
  const tradesThisHour = allTrades.filter(r => r.openMs >= hourMs).length;
  const dailyLossUsd   = Math.min(0, todayPnl);
  const dailyLossPct   = equityNow > 0 ? (dailyLossUsd / equityNow) * 100 : 0;

  // 연속 손실 (desc 정렬 상태 그대로)
  let consecLoss = 0;
  for (const r of allTrades) {
    if (r.pnl === null) continue;
    if (r.pnl < 0) consecLoss++;
    else break;
  }

  const reasons: string[] = [];
  if (settings.dd_mode === "floor") {
    if (settings.dd_floor_usd !== null && equityNow <= settings.dd_floor_usd)
      reasons.push("잔고 하한선 도달");
  } else {
    if (maxDdUsd >= settings.max_dd_usd || ddPct >= settings.max_dd_pct)
      reasons.push("드로다운");
  }
  if (Math.abs(dailyLossUsd) >= settings.max_daily_loss_usd ||
      Math.abs(dailyLossPct) >= settings.max_daily_loss_pct)
    reasons.push("일 손실");
  if (consecLoss >= settings.max_consecutive_losses)
    reasons.push("연속 손실");
  if (settings.manual_trading_state === "Stop")
    reasons.push("수동 중단");

  let state: "NORMAL" | "SLOWDOWN" | "STOP" = "NORMAL";
  if      (settings.manual_trading_state === "Stop")      state = "STOP";
  else if (settings.manual_trading_state === "Slow Down") state = "SLOWDOWN";
  else if (reasons.length >= 3)                           state = "STOP";
  else if (reasons.length >= 1)                           state = "SLOWDOWN";

  return NextResponse.json({
    ok: true, state, reasons, settings,
    stats: {
      seed, equityNow: Number(equityNow.toFixed(2)), cumPnl: Number(cumPnl.toFixed(2)),
      pnlPct: Number(pnlPct.toFixed(2)), peakEquity: Number(peakEquity.toFixed(2)),
      maxDdUsd: Number(maxDdUsd.toFixed(2)), ddPct: Number(ddPct.toFixed(2)),
      todayPnl: Number(todayPnl.toFixed(2)),
      dailyLossUsd: Number(dailyLossUsd.toFixed(2)),
      dailyLossPct: Number(dailyLossPct.toFixed(2)),
      tradesToday, tradesThisHour, consecLoss, maxConsecLoss: consecLoss,
      totalWithdrawal: Number(totalWithdrawal.toFixed(2)),
      ddMode: settings.dd_mode, ddFloorUsd: settings.dd_floor_usd,
    },
  });
}
