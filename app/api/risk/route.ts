import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/firebase/serverAuth";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function todayKST_UTC(): Date {
  const kst = new Date(Date.now() + 9 * 3600_000);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - 9 * 3600_000);
}
function thisHourKST_UTC(): Date {
  const kst = new Date(Date.now() + 9 * 3600_000);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate(), kst.getUTCHours()) - 9 * 3600_000);
}

export async function GET(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const url     = new URL(req.url);
  const pnlFrom = url.searchParams.get("from") || null;
  const pnlFromMs = pnlFrom ? new Date(pnlFrom).getTime() : 0;

  const db       = adminDb();
  const userRef  = db.collection("users").doc(uid);
  const todayUTC = todayKST_UTC();
  const thisHour = thisHourKST_UTC();

  const [rsSnap, tsSnap, todaySnap, hourSnap, recentSnap, wSnap] = await Promise.all([
    userRef.collection("risk_settings").doc("default").get(),
    userRef.collection("manual_trades").where("pnl", "!=", null).orderBy("pnl").orderBy("opened_at", "asc").get(),
    userRef.collection("manual_trades").where("opened_at", ">=", todayUTC).get(),
    userRef.collection("manual_trades").where("opened_at", ">=", thisHour).get(),
    userRef.collection("manual_trades").where("pnl", "!=", null).orderBy("pnl", "desc").orderBy("opened_at", "desc").limit(50).get(),
    userRef.collection("withdrawals").get(),
  ]);

  const rs = rsSnap.exists ? rsSnap.data() : {};
  const settings = {
    seed_usd:               n(rs?.seed_usd               ?? 10000),
    max_dd_usd:             n(rs?.max_dd_usd             ?? 500),
    max_dd_pct:             n(rs?.max_dd_pct             ?? 5),
    max_daily_loss_usd:     n(rs?.max_daily_loss_usd     ?? 300),
    max_daily_loss_pct:     n(rs?.max_daily_loss_pct     ?? 3),
    max_consecutive_losses: Number(rs?.max_consecutive_losses ?? 3),
    manual_trading_state:   String(rs?.manual_trading_state   ?? "auto"),
    dd_mode:                String(rs?.dd_mode ?? "drawdown"),
    dd_floor_usd:           rs?.dd_floor_usd != null ? Number(rs.dd_floor_usd) : null,
  };

  const seed = settings.seed_usd;
  const totalWithdrawal = wSnap.docs.reduce((s, d) => s + Number(d.data().amount || 0), 0);

  // 시계열 정렬 (Firestore compound query 한계로 메모리 정렬)
  const tsSorted = tsSnap.docs
    .map(d => ({ pnl: n(d.data().pnl), opened_at: d.data().opened_at?.toDate?.() ?? new Date(d.data().opened_at) }))
    .sort((a, b) => a.opened_at.getTime() - b.opened_at.getTime());

  let cumPnl = 0, peakEquity = seed, maxDdUsd = 0, totalCumPnl = 0;
  for (const r of tsSorted) {
    totalCumPnl += r.pnl;
    if (pnlFromMs && r.opened_at.getTime() < pnlFromMs) continue;
    cumPnl += r.pnl;
    const eq = seed + cumPnl;
    if (eq > peakEquity) peakEquity = eq;
    const dd = peakEquity - eq;
    if (dd > maxDdUsd) maxDdUsd = dd;
  }

  const equityNow = seed + totalCumPnl - totalWithdrawal;
  const pnlPct    = seed > 0 ? (cumPnl / seed) * 100 : 0;
  const ddPct     = equityNow > 0 ? (maxDdUsd / equityNow) * 100 : 0;

  const todayRows      = todaySnap.docs.map(d => n(d.data().pnl));
  const todayPnl       = todayRows.reduce((s, p) => s + p, 0);
  const tradesToday    = todayRows.length;
  const tradesThisHour = hourSnap.size;
  const dailyLossUsd   = Math.min(0, todayPnl);
  const dailyLossPct   = equityNow > 0 ? (dailyLossUsd / equityNow) * 100 : 0;

  // 최근 거래 (내림차순 opened_at)
  const recentRows = recentSnap.docs
    .map(d => ({ pnl: n(d.data().pnl), opened_at: d.data().opened_at?.toDate?.() ?? new Date(d.data().opened_at) }))
    .sort((a, b) => b.opened_at.getTime() - a.opened_at.getTime());
  let consecLoss = 0;
  for (const r of recentRows) {
    if (r.pnl < 0) consecLoss++;
    else break;
  }

  const reasons: string[] = [];
  if (settings.dd_mode === "floor") {
    if (settings.dd_floor_usd !== null && equityNow <= settings.dd_floor_usd) reasons.push("잔고 하한선 도달");
  } else {
    if (maxDdUsd >= settings.max_dd_usd || ddPct >= settings.max_dd_pct) reasons.push("드로다운");
  }
  if (Math.abs(dailyLossUsd) >= settings.max_daily_loss_usd || Math.abs(dailyLossPct) >= settings.max_daily_loss_pct) reasons.push("일 손실");
  if (consecLoss >= settings.max_consecutive_losses) reasons.push("연속 손실");
  if (settings.manual_trading_state === "Stop") reasons.push("수동 중단");

  let state: "NORMAL" | "SLOWDOWN" | "STOP" = "NORMAL";
  if      (settings.manual_trading_state === "Stop")      state = "STOP";
  else if (settings.manual_trading_state === "Slow Down") state = "SLOWDOWN";
  else if (reasons.length >= 3)                           state = "STOP";
  else if (reasons.length >= 1)                           state = "SLOWDOWN";

  return NextResponse.json({
    ok: true, state, reasons, settings,
    stats: {
      seed, equityNow, cumPnl, pnlPct,
      peakEquity, maxDdUsd, ddPct,
      todayPnl, dailyLossUsd, dailyLossPct,
      tradesToday, tradesThisHour,
      consecLoss, maxConsecLoss: consecLoss,
      totalWithdrawal: Number(totalWithdrawal.toFixed(2)),
      ddMode: settings.dd_mode, ddFloorUsd: settings.dd_floor_usd,
    },
  });
}
