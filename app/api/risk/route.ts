import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function sbFromCookies() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return store.getAll(); },
        setAll(cs) { cs.forEach(({ name, value, options }) => store.set(name, value, options)); },
      },
    }
  );
}

const n = (v:any) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const dayKey = (ts:string) => (ts || "").slice(0, 10);
const hourKey = (ts:string) => (ts || "").slice(0, 13);

export async function GET() {
  const sbAuth = await sbFromCookies();
  const { data } = await sbAuth.auth.getUser();
  const uid = data.user?.id;
  if (!uid) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const sb = supabaseServer();

  const { data: rs } = await sb.from("risk_settings").select("*").eq("user_id", uid).maybeSingle();
  const settings = {
    seed_usd: n(rs?.seed_usd ?? 10000),
    max_dd_usd: n(rs?.max_dd_usd ?? 500),
    max_dd_pct: n(rs?.max_dd_pct ?? 5),
    max_daily_loss_usd: n(rs?.max_daily_loss_usd ?? 300),
    max_daily_loss_pct: n(rs?.max_daily_loss_pct ?? 3),
    max_consecutive_losses: Number(rs?.max_consecutive_losses ?? 3),
    max_trades_per_day: Number(rs?.max_trades_per_day ?? 20),
    max_trades_per_hour: Number(rs?.max_trades_per_hour ?? 8),
  };

  const { data: rows, error } = await sb
    .from("manual_trades")
    .select("*")
    .eq("user_id", uid)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ ok:false, error:error.message }, { status: 500 });

  const seed = settings.seed_usd;

  let cumPnl = 0;
  let peakEquity = seed;
  let maxDdUsd = 0;

  const today = new Date().toISOString().slice(0,10);
  let todayPnl = 0;

  const byDayCount: Record<string, number> = {};
  const byHourCount: Record<string, number> = {};

  let consecLoss = 0;
  let maxConsecLoss = 0;

  for (const r of (rows || [])) {
    const ts = String(r.closed_at || r.created_at || r.opened_at || "");
    const pnl = n(r.pnl ?? r.realized_pnl ?? r.net_pnl ?? r.profit ?? 0);

    cumPnl += pnl;

    const equity = seed + cumPnl;
    if (equity > peakEquity) peakEquity = equity;
    const dd = peakEquity - equity;
    if (dd > maxDdUsd) maxDdUsd = dd;

    if (dayKey(ts) === today) todayPnl += pnl;

    const d = dayKey(ts); if (d) byDayCount[d] = (byDayCount[d] || 0) + 1;
    const h = hourKey(ts); if (h) byHourCount[h] = (byHourCount[h] || 0) + 1;

    if (pnl < 0) { consecLoss += 1; maxConsecLoss = Math.max(maxConsecLoss, consecLoss); }
    else if (pnl > 0) { consecLoss = 0; }
  }

  const equityNow = seed + cumPnl;
  const pnlPct = seed ? (cumPnl / seed) * 100 : 0;

  const ddPct = peakEquity ? (maxDdUsd / peakEquity) * 100 : 0;
  const dailyLossUsd = Math.min(0, todayPnl);
  const dailyLossPct = seed ? (dailyLossUsd / seed) * 100 : 0;

  const tradesToday = byDayCount[today] || 0;
  const thisHour = new Date().toISOString().slice(0,13);
  const tradesThisHour = byHourCount[thisHour] || 0;

  const reasons: string[] = [];
  if (maxDdUsd >= settings.max_dd_usd || ddPct >= settings.max_dd_pct) reasons.push("드로다운");
  if (Math.abs(dailyLossUsd) >= settings.max_daily_loss_usd || Math.abs(dailyLossPct) >= settings.max_daily_loss_pct) reasons.push("일 손실");
  if (maxConsecLoss >= settings.max_consecutive_losses) reasons.push("연속 손실");
  if (tradesToday >= settings.max_trades_per_day) reasons.push("일 거래 과다");
  if (tradesThisHour >= settings.max_trades_per_hour) reasons.push("시간당 거래 과다");

  let state: "NORMAL" | "SLOWDOWN" | "STOP" = "NORMAL";
  if (reasons.length >= 3) state = "STOP";
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
      tradesToday, tradesThisHour, maxConsecLoss
    }
  });
}
