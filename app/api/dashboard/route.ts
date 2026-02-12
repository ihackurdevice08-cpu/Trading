import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

/** KST(UTC+9) 기준 오늘 00:00의 UTC ISO */
function startOfDayKSTUtcISO(now = new Date()) {
  const kstMs = now.getTime() + 9 * 60 * 60 * 1000;
  const kst = new Date(kstMs);
  const y = kst.getUTCFullYear();
  const m = kst.getUTCMonth();
  const d = kst.getUTCDate();
  const kstStartMs = Date.UTC(y, m, d, 0, 0, 0);
  const utcMs = kstStartMs - 9 * 60 * 60 * 1000;
  return new Date(utcMs).toISOString();
}

/** KST 기준 이번 주(월요일) 00:00의 UTC ISO */
function startOfWeekKSTUtcISO(now = new Date()) {
  const kstMs = now.getTime() + 9 * 60 * 60 * 1000;
  const kst = new Date(kstMs);
  const y = kst.getUTCFullYear();
  const m = kst.getUTCMonth();
  const d = kst.getUTCDate();
  const day = new Date(Date.UTC(y, m, d)).getUTCDay(); // 0=Sun..6=Sat
  const diffToMon = (day + 6) % 7; // Mon=0
  const kstStartMs = Date.UTC(y, m, d - diffToMon, 0, 0, 0);
  const utcMs = kstStartMs - 9 * 60 * 60 * 1000;
  return new Date(utcMs).toISOString();
}

/** KST 기준 이번 달 1일 00:00의 UTC ISO */
function startOfMonthKSTUtcISO(now = new Date()) {
  const kstMs = now.getTime() + 9 * 60 * 60 * 1000;
  const kst = new Date(kstMs);
  const y = kst.getUTCFullYear();
  const m = kst.getUTCMonth();
  const kstStartMs = Date.UTC(y, m, 1, 0, 0, 0);
  const utcMs = kstStartMs - 9 * 60 * 60 * 1000;
  return new Date(utcMs).toISOString();
}

async function sbFromCookies() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return store.getAll();
        },
        setAll(cs) {
          cs.forEach(({ name, value, options }) => store.set(name, value, options));
        },
      },
    }
  );
}

export async function GET() {
  const sbAuth = await sbFromCookies();
  const { data } = await sbAuth.auth.getUser();
  const uid = data.user?.id;
  if (!uid) return bad("unauthorized", 401);

  const now = new Date();
  const fromToday = startOfDayKSTUtcISO(now);
  const fromWeek = startOfWeekKSTUtcISO(now);
  const fromMonth = startOfMonthKSTUtcISO(now);

  // 안정성 우선: 필요한 컬럼만 가져옴
  const sb = supabaseServer();

  // 최근 거래 (UI용)
  const { data: recent, error: e1 } = await sb
    .from("manual_trades")
    .select("id,symbol,side,opened_at,pnl,tags,notes")
    .eq("user_id", uid)
    .order("opened_at", { ascending: false })
    .limit(50);
  if (e1) return bad(e1.message, 500);

  // 월초 이후 데이터로 집계 (Phase1 MVP)
  const { data: rows, error: e2 } = await sb
    .from("manual_trades")
    .select("opened_at,pnl")
    .eq("user_id", uid)
    .gte("opened_at", fromMonth)
    .order("opened_at", { ascending: false })
    .limit(5000);
  if (e2) return bad(e2.message, 500);

  const list = rows || [];

  let totalCount = 0;
  let realizedCount = 0;

  let sumMonth = 0;
  let sumWeek = 0;
  let sumToday = 0;

  let win = 0;
  let loss = 0;

  const todayMs = Date.parse(fromToday);
  const weekMs = Date.parse(fromWeek);

  for (const r of list) {
    totalCount += 1;
    const pnl = r.pnl === null || r.pnl === undefined ? null : Number(r.pnl);
    const t = Date.parse(r.opened_at);

    if (pnl !== null && Number.isFinite(pnl)) {
      realizedCount += 1;

      sumMonth += pnl;
      if (t >= weekMs) sumWeek += pnl;
      if (t >= todayMs) sumToday += pnl;

      if (pnl > 0) win += 1;
      else if (pnl < 0) loss += 1;
    }
  }

  const winRate = realizedCount ? (win / realizedCount) : 0;
  const avgPnl = realizedCount ? (sumMonth / realizedCount) : 0;

  return NextResponse.json({
    ok: true,
    kst: {
      fromToday,
      fromWeek,
      fromMonth,
    },
    stats: {
      monthPnL: sumMonth,
      weekPnL: sumWeek,
      todayPnL: sumToday,
      tradesCount: totalCount,
      realizedCount,
      win,
      loss,
      winRate,
      avgPnl,
    },
    recent: recent || [],
  });
}
