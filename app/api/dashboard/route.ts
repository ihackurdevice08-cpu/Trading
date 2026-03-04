import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/supabase/serverAuth";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function kstBoundary(offsetDays = 0): Date {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear(), m = kst.getUTCMonth(), d = kst.getUTCDate() + offsetDays;
  return new Date(Date.UTC(y, m, d, 0, 0, 0) - 9 * 60 * 60 * 1000);
}
function startOfWeekKST(): Date {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear(), m = kst.getUTCMonth(), d = kst.getUTCDate();
  const day = new Date(Date.UTC(y, m, d)).getUTCDay();
  const diffToMon = (day + 6) % 7;
  return new Date(Date.UTC(y, m, d - diffToMon, 0, 0, 0) - 9 * 60 * 60 * 1000);
}
function startOfMonthKST(): Date {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), 1, 0, 0, 0) - 9 * 60 * 60 * 1000);
}

export async function GET(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  // ?from=YYYY-MM-DD 로 누적 PnL 기산일 설정 (없으면 전체)
  const url     = new URL(req.url);
  const pnlFrom = url.searchParams.get("from") || null;

  const fromToday = kstBoundary(0).toISOString();
  const fromWeek  = startOfWeekKST().toISOString();
  const fromMonth = startOfMonthKST().toISOString();

  const sb = supabaseServer();

  const [tradesRes, recentRes, withdrawRes, riskRes] = await Promise.all([
    // 이번 달 전체 집계용
    sb.from("manual_trades").select("opened_at,pnl,symbol,side,tags")
      .eq("user_id", uid).gte("opened_at", fromMonth).order("opened_at", { ascending: false }).limit(5000),
    // 최근 5건
    sb.from("manual_trades").select("id,symbol,side,opened_at,pnl,tags")
      .eq("user_id", uid).order("opened_at", { ascending: false }).limit(5),
    // 출금 합계
    sb.from("withdrawals").select("amount,source").eq("user_id", uid),
    // 리스크 설정 (seed + pnl_from)
    sb.from("risk_settings").select("seed_usd, pnl_from").eq("user_id", uid).maybeSingle(),
  ]);

  const list     = tradesRes.data  || [];
  const recent   = recentRes.data  || [];
  const wdList   = withdrawRes.data || [];
  const seed     = Number(riskRes.data?.seed_usd || 10000);
  const pnlFrom  = riskRes.data?.pnl_from || null;  // null = 전체 기간

  // 기간별 PnL
  let sumMonth = 0, sumWeek = 0, sumToday = 0;
  let win = 0, loss = 0, realizedCount = 0;
  const todayMs = Date.parse(fromToday);
  const weekMs  = Date.parse(fromWeek);

  // 심볼별 PnL 집계
  const symbolMap: Record<string, { pnl: number; count: number; wins: number }> = {};

  for (const r of list) {
    const pnl = r.pnl == null ? null : Number(r.pnl);
    const t   = Date.parse(r.opened_at);
    const sym = r.symbol || "unknown";

    if (pnl !== null && Number.isFinite(pnl)) {
      realizedCount++;
      sumMonth += pnl;
      if (t >= weekMs)  sumWeek  += pnl;
      if (t >= todayMs) sumToday += pnl;
      if (pnl > 0) win++; else if (pnl < 0) loss++;

      if (!symbolMap[sym]) symbolMap[sym] = { pnl: 0, count: 0, wins: 0 };
      symbolMap[sym].pnl   += pnl;
      symbolMap[sym].count += 1;
      if (pnl > 0) symbolMap[sym].wins += 1;
    }
  }

  const winRate = realizedCount > 0 ? (win / realizedCount) * 100 : null;

  // 심볼별 TOP5 (PnL 절댓값 기준)
  const topSymbols = Object.entries(symbolMap)
    .sort((a, b) => Math.abs(b[1].pnl) - Math.abs(a[1].pnl))
    .slice(0, 5)
    .map(([symbol, d]) => ({
      symbol,
      pnl:  Number(d.pnl.toFixed(2)),
      count: d.count,
      winRate: d.count > 0 ? Math.round((d.wins / d.count) * 100) : 0,
    }));

  // 누적 PnL (pnlFrom 이후 기간)
  let cumPnlQuery = sb.from("manual_trades").select("pnl").eq("user_id", uid);
  if (pnlFrom) cumPnlQuery = cumPnlQuery.gte("opened_at", new Date(pnlFrom).toISOString());
  const { data: allTrades } = await cumPnlQuery;
  const cumPnl = (allTrades || []).reduce((s, r) => s + (Number(r.pnl) || 0), 0);

  // 출금 합계
  const totalWithdrawal  = wdList.reduce((s, r) => s + Number(r.amount || 0), 0);
  const profitWithdrawal = wdList.filter(r => r.source === "profit")
    .reduce((s, r) => s + Number(r.amount || 0), 0);
  const seedWithdrawal   = wdList.filter(r => r.source === "seed")
    .reduce((s, r) => s + Number(r.amount || 0), 0);

  // 현재 자산 = 최초 시드 + 누적 수익 - 전체 출금
  const equityNow = seed + cumPnl - totalWithdrawal;

  // 순수익 = 누적 수익 - 수익 출금분 (계좌에 남아있는 수익)
  // 단순하게: 현재 자산 - (최초 시드 - 원금회수)
  const effectiveSeed = seed - seedWithdrawal;   // 실제 남은 원금
  const retainedProfit = equityNow - effectiveSeed; // 계좌에 남은 순수익

  // 일별 PnL (이번 달, 차트용)
  const dailyMap: Record<string, number> = {};
  for (const r of list) {
    if (r.pnl == null) continue;
    const day = new Date(new Date(r.opened_at).getTime() + 9 * 60 * 60 * 1000)
      .toISOString().slice(0, 10);
    dailyMap[day] = (dailyMap[day] || 0) + Number(r.pnl);
  }
  const dailyPnl = Object.entries(dailyMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, pnl]) => ({ date, pnl: Number(pnl.toFixed(2)) }));

  return NextResponse.json({
    ok: true,
    stats: {
      todayPnL: sumToday, weekPnL: sumWeek, monthPnL: sumMonth,
      totalTrades: list.length, realizedTrades: realizedCount,
      wins: win, losses: loss, winRate,
      cumPnl:           Number(cumPnl.toFixed(2)),
      equityNow:        Number(equityNow.toFixed(2)),
      seed,
      pnlFrom: pnlFrom ?? null,
      totalWithdrawal:  Number(totalWithdrawal.toFixed(2)),
      profitWithdrawal: Number(profitWithdrawal.toFixed(2)),
      seedWithdrawal:   Number(seedWithdrawal.toFixed(2)),
      retainedProfit:   Number(retainedProfit.toFixed(2)),
    },
    recent,
    topSymbols,
    dailyPnl,
  });
}
