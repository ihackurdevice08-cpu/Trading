import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/supabase/serverAuth";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function kstDateStr(ts?: string): string {
  const d = ts ? new Date(ts) : new Date();
  return new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
}
function kstHourStr(ts?: string): string {
  const d = ts ? new Date(ts) : new Date();
  return new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 13);
}
function todayKST_UTC(): string {
  // KST 오늘 00:00을 UTC ISO로 변환
  const kst = new Date(Date.now() + 9 * 3600_000);
  const y = kst.getUTCFullYear(), m = kst.getUTCMonth(), d = kst.getUTCDate();
  return new Date(Date.UTC(y, m, d, 0, 0, 0) - 9 * 3600_000).toISOString();
}
function thisHourKST_UTC(): string {
  const kst = new Date(Date.now() + 9 * 3600_000);
  const y = kst.getUTCFullYear(), m = kst.getUTCMonth(), d = kst.getUTCDate(), h = kst.getUTCHours();
  return new Date(Date.UTC(y, m, d, h, 0, 0) - 9 * 3600_000).toISOString();
}

export async function GET() {
  const uid = await getAuthUserId();
  if (!uid) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const sb = supabaseServer();
  const todayUTC    = todayKST_UTC();
  const thisHourUTC = thisHourKST_UTC();

  // 병렬로 필요한 데이터만 최소한으로 가져오기
  const [rsResult, allPnlResult, todayResult, hourResult, recentResult] = await Promise.all([
    // 리스크 설정
    sb.from("risk_settings").select("*").eq("user_id", uid).maybeSingle(),
    // 전체 누적 PnL 집계 (DB에서 sum - JS 루프 제거)
    sb.from("manual_trades").select("pnl").eq("user_id", uid).not("pnl", "is", null),
    // 오늘 거래 (count + pnl)
    sb.from("manual_trades").select("pnl").eq("user_id", uid).gte("opened_at", todayUTC),
    // 이번 시간 거래 count
    sb.from("manual_trades").select("id", { count: "exact", head: true }).eq("user_id", uid).gte("opened_at", thisHourUTC),
    // 연속 손실 계산용: 최근 50건만 (충분)
    sb.from("manual_trades").select("pnl,opened_at").eq("user_id", uid)
      .not("pnl", "is", null).order("opened_at", { ascending: false }).limit(50),
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

  const seed = settings.seed_usd;

  // 누적 PnL 집계 (JS sum - DB에서 row 받아 합산, RPC 없이도 충분히 빠름)
  const allPnl  = (allPnlResult.data || []);
  const cumPnl  = allPnl.reduce((s, r) => s + n(r.pnl), 0);

  // 최대 낙폭 계산: 시간순 정렬된 전체 데이터 필요
  // 하지만 최근 50건 기반 연속손실은 별도로 계산
  // maxDD는 allPnl에서 시간순으로 정렬 필요 → 별도 경량 쿼리로 처리
  // (이미 allPnlResult는 pnl만 가져와서 opened_at 없음 → joined 쿼리로)
  // 실용적 근사: peakEquity = seed + max(누적 PnL), maxDdUsd = peakEquity - equityNow
  const equityNow = seed + cumPnl;
  // 정확한 maxDD 계산을 위해 opened_at 포함 데이터 사용
  const { data: timeSeriesData } = await sb
    .from("manual_trades")
    .select("pnl,opened_at")
    .eq("user_id", uid)
    .not("pnl", "is", null)
    .order("opened_at", { ascending: true });

  let peakEquity = seed;
  let maxDdUsd   = 0;
  let runPnl     = 0;
  for (const r of (timeSeriesData || [])) {
    runPnl += n(r.pnl);
    const eq = seed + runPnl;
    if (eq > peakEquity) peakEquity = eq;
    const dd = peakEquity - eq;
    if (dd > maxDdUsd) maxDdUsd = dd;
  }

  // 오늘 통계
  const todayRows  = todayResult.data || [];
  const todayPnl   = todayRows.reduce((s, r) => s + n(r.pnl), 0);
  const tradesToday = todayRows.length;
  const tradesThisHour = hourResult.count ?? 0;

  // 현재 연속 손실 (최근 50건, 최신순)
  let consecLoss = 0;
  for (const r of (recentResult.data || [])) {
    if (n(r.pnl) < 0) consecLoss++;
    else break;
  }

  const pnlPct       = seed ? (cumPnl / seed) * 100 : 0;
  const ddPct        = equityNow > 0 ? (maxDdUsd / equityNow) * 100 : 0;
  const dailyLossUsd = Math.min(0, todayPnl);
  const dailyLossPct = equityNow > 0 ? (dailyLossUsd / equityNow) * 100 : 0;

  const reasons: string[] = [];
  if (maxDdUsd >= settings.max_dd_usd || ddPct >= settings.max_dd_pct)
    reasons.push("드로다운");
  if (Math.abs(dailyLossUsd) >= settings.max_daily_loss_usd || Math.abs(dailyLossPct) >= settings.max_daily_loss_pct)
    reasons.push("일 손실");
  if (consecLoss >= settings.max_consecutive_losses)
    reasons.push("연속 손실");
  if (settings.manual_trading_state === "Stop")
    reasons.push("수동 중단");

  let state: "NORMAL" | "SLOWDOWN" | "STOP" = "NORMAL";
  if (settings.manual_trading_state === "Stop")           state = "STOP";
  else if (settings.manual_trading_state === "Slow Down") state = "SLOWDOWN";
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
      maxConsecLoss: consecLoss,
    },
  });
}
