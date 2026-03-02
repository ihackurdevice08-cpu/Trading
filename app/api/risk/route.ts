import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/supabase/serverAuth";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function todayKST(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}
function thisHourKST(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 13);
}
function dayKeyKST(ts: string): string {
  const kst = new Date(new Date(ts).getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}
function hourKeyKST(ts: string): string {
  const kst = new Date(new Date(ts).getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 13);
}

export async function GET() {
  const uid = await getAuthUserId();
  if (!uid) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const sb = supabaseServer();

  const [rsResult, rowsResult] = await Promise.all([
    sb.from("risk_settings").select("*").eq("user_id", uid).maybeSingle(),
    sb.from("manual_trades")
      .select("opened_at,pnl")
      .eq("user_id", uid)
      .order("opened_at", { ascending: false })
      .limit(2000),
  ]);

  const rs = rsResult.data;
  const settings = {
    seed_usd:               n(rs?.seed_usd               ?? 10000),
    max_dd_usd:             n(rs?.max_dd_usd             ?? 500),
    max_dd_pct:             n(rs?.max_dd_pct             ?? 5),
    max_daily_loss_usd:     n(rs?.max_daily_loss_usd     ?? 300),
    max_daily_loss_pct:     n(rs?.max_daily_loss_pct     ?? 3),
    max_consecutive_losses: Number(rs?.max_consecutive_losses ?? 3),
    max_trades_per_day:     Number(rs?.max_trades_per_day     ?? 20),
    max_trades_per_hour:    Number(rs?.max_trades_per_hour    ?? 8),
    manual_trading_state:   String(rs?.manual_trading_state   ?? "auto"),
  };

  if (rowsResult.error)
    return NextResponse.json({ ok: false, error: rowsResult.error.message }, { status: 500 });

  // 최신순 → 시간순
  const list = (rowsResult.data || []).reverse();

  const seed        = settings.seed_usd;
  const today       = todayKST();
  const currentHour = thisHourKST();

  let cumPnl     = 0;
  let peakEquity = seed;
  let maxDdUsd   = 0;
  let todayPnl   = 0;
  let consecLoss = 0;  // 현재 진행 중인 연속 손실

  const byDayCount:  Record<string, number> = {};
  const byHourCount: Record<string, number> = {};

  for (const r of list) {
    const ts  = String(r.opened_at || "");
    const pnl = n(r.pnl ?? 0);

    cumPnl += pnl;
    const equity = seed + cumPnl;
    if (equity > peakEquity) peakEquity = equity;
    const dd = peakEquity - equity;
    if (dd > maxDdUsd) maxDdUsd = dd;

    if (dayKeyKST(ts) === today) todayPnl += pnl;

    const dk = dayKeyKST(ts);
    if (dk) byDayCount[dk]  = (byDayCount[dk]  || 0) + 1;
    const hk = hourKeyKST(ts);
    if (hk) byHourCount[hk] = (byHourCount[hk] || 0) + 1;

    // pnl < 0 → 연속손실 증가, pnl >= 0 (0 포함) → 리셋
    if (pnl < 0) consecLoss++;
    else         consecLoss = 0;
  }

  const equityNow    = seed + cumPnl;
  const pnlPct       = seed ? (cumPnl / seed) * 100 : 0;
  const ddPct        = peakEquity ? (maxDdUsd / peakEquity) * 100 : 0;
  const dailyLossUsd = Math.min(0, todayPnl);
  const dailyLossPct = seed ? (dailyLossUsd / seed) * 100 : 0;
  const tradesToday    = byDayCount[today]        || 0;
  const tradesThisHour = byHourCount[currentHour] || 0;

  const reasons: string[] = [];
  if (maxDdUsd >= settings.max_dd_usd || ddPct >= settings.max_dd_pct)
    reasons.push("드로다운");
  if (Math.abs(dailyLossUsd) >= settings.max_daily_loss_usd || Math.abs(dailyLossPct) >= settings.max_daily_loss_pct)
    reasons.push("일 손실");
  if (consecLoss >= settings.max_consecutive_losses)   // ★ 현재 연속 손실
    reasons.push("연속 손실");
  if (tradesToday >= settings.max_trades_per_day)
    reasons.push("일 거래 과다");
  if (tradesThisHour >= settings.max_trades_per_hour)
    reasons.push("시간당 거래 과다");
  if (settings.manual_trading_state === "Stop")
    reasons.push("수동 중단");

  let state: "NORMAL" | "SLOWDOWN" | "STOP" = "NORMAL";
  if (settings.manual_trading_state === "Stop")            state = "STOP";
  else if (settings.manual_trading_state === "Slow Down")  state = "SLOWDOWN";
  else if (reasons.length >= 3) state = "STOP";
  else if (reasons.length >= 1) state = "SLOWDOWN";

  return NextResponse.json({
    ok: true,
    state,
    reasons,
    settings,
    stats: {
      seed, equityNow, cumPnl, pnlPct,
      peakEquity, maxDdUsd, ddPct,
      todayPnl, dailyLossUsd, dailyLossPct,
      tradesToday, tradesThisHour,
      consecLoss,
      maxConsecLoss: consecLoss,  // 하위호환 (위젯에서 참조)
    },
  });
}
