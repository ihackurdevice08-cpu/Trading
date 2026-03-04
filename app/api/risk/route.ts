import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/supabase/serverAuth";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function todayKST_UTC(): string {
  const kst = new Date(Date.now() + 9 * 3600_000);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - 9 * 3600_000).toISOString();
}
function thisHourKST_UTC(): string {
  const kst = new Date(Date.now() + 9 * 3600_000);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate(), kst.getUTCHours()) - 9 * 3600_000).toISOString();
}

export async function GET(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  // ?from=YYYY-MM-DD → 누적 PnL 기산일
  const url     = new URL(req.url);
  const pnlFrom = url.searchParams.get("from") || null;
  const pnlFromMs = pnlFrom ? new Date(pnlFrom).getTime() : 0;

  const sb = supabaseServer();
  const todayUTC    = todayKST_UTC();
  const thisHourUTC = thisHourKST_UTC();

  const [rsResult, timeSeriesResult, todayResult, hourResult, recentResult, withdrawResult] = await Promise.all([
    sb.from("risk_settings").select("*").eq("user_id", uid).maybeSingle(),
    sb.from("manual_trades").select("pnl, opened_at").eq("user_id", uid)
      .not("pnl", "is", null).order("opened_at", { ascending: true }),
    sb.from("manual_trades").select("pnl").eq("user_id", uid).gte("opened_at", todayUTC),
    sb.from("manual_trades").select("id", { count: "exact", head: true }).eq("user_id", uid).gte("opened_at", thisHourUTC),
    sb.from("manual_trades").select("pnl").eq("user_id", uid)
      .not("pnl", "is", null).order("opened_at", { ascending: false }).limit(50),
    sb.from("withdrawals").select("amount").eq("user_id", uid),
  ]);

  const rs = rsResult.data;
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
  const totalWithdrawal = (withdrawResult.data || []).reduce((sum, r) => sum + Number(r.amount || 0), 0);

  // cumPnl + maxDD (pnlFrom 이후만 집계)
  let cumPnl     = 0;
  let peakEquity = seed;
  let maxDdUsd   = 0;
  // 현재 자산용 전체 cumPnl (기산일 무관)
  let totalCumPnl = 0;

  for (const r of (timeSeriesResult.data || [])) {
    totalCumPnl += n(r.pnl);
    if (pnlFromMs && new Date(r.opened_at).getTime() < pnlFromMs) continue;
    cumPnl += n(r.pnl);
    const eq = seed + cumPnl;
    if (eq > peakEquity) peakEquity = eq;
    const dd = peakEquity - eq;
    if (dd > maxDdUsd) maxDdUsd = dd;
  }

  // 현재 자산은 항상 전체 기간 기준
  const equityNow = seed + totalCumPnl - totalWithdrawal;
  const pnlPct    = seed > 0 ? (cumPnl / seed) * 100 : 0;
  const ddPct     = equityNow > 0 ? (maxDdUsd / equityNow) * 100 : 0;

  const todayRows      = todayResult.data || [];
  const todayPnl       = todayRows.reduce((s, r) => s + n(r.pnl), 0);
  const tradesToday    = todayRows.length;
  const tradesThisHour = hourResult.count ?? 0;
  const dailyLossUsd   = Math.min(0, todayPnl);
  const dailyLossPct   = equityNow > 0 ? (dailyLossUsd / equityNow) * 100 : 0;

  let consecLoss = 0;
  for (const r of (recentResult.data || [])) {
    if (n(r.pnl) < 0) consecLoss++;
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
  if (Math.abs(dailyLossUsd) >= settings.max_daily_loss_usd || Math.abs(dailyLossPct) >= settings.max_daily_loss_pct)
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
      seed, equityNow, cumPnl, pnlPct,
      peakEquity, maxDdUsd, ddPct,
      todayPnl, dailyLossUsd, dailyLossPct,
      tradesToday, tradesThisHour,
      consecLoss, maxConsecLoss: consecLoss,
      totalWithdrawal: Number(totalWithdrawal.toFixed(2)),
      ddMode: settings.dd_mode,
      ddFloorUsd: settings.dd_floor_usd,
    },
  });
}
