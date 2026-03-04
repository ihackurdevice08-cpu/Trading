import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/supabase/serverAuth";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ok(data: any)  { return NextResponse.json({ ok: true,  ...data }); }
function bad(msg: string, status = 400) { return NextResponse.json({ ok: false, error: msg }, { status }); }

// 숫자 변환 - 빈 값은 null 반환 (0으로 덮어쓰지 않음)
function toNum(v: any): number | null {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// DB 기본값
const DEFAULTS = {
  seed_usd:               10000,
  max_dd_usd:             500,
  max_dd_pct:             5,
  dd_mode:                "drawdown",  // drawdown | floor
  dd_floor_usd:           null,        // 절대 잔고 하한선
  max_daily_loss_usd:     300,
  max_daily_loss_pct:     3,
  max_consecutive_losses: 3,
  manual_trading_state:   "auto",
  pnl_from:               null,  // 누적 PnL 기산일 (null = 전체)
};

export async function GET() {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const { data: rs } = await supabaseServer()
    .from("risk_settings")
    .select("*")
    .eq("user_id", uid)
    .maybeSingle();

  const settings = {
    seed_usd:               rs?.seed_usd               ?? DEFAULTS.seed_usd,
    max_dd_usd:             rs?.max_dd_usd             ?? DEFAULTS.max_dd_usd,
    max_dd_pct:             rs?.max_dd_pct             ?? DEFAULTS.max_dd_pct,
    dd_mode:                rs?.dd_mode                ?? DEFAULTS.dd_mode,
    dd_floor_usd:           rs?.dd_floor_usd            ?? DEFAULTS.dd_floor_usd,
    max_daily_loss_usd:     rs?.max_daily_loss_usd     ?? DEFAULTS.max_daily_loss_usd,
    max_daily_loss_pct:     rs?.max_daily_loss_pct     ?? DEFAULTS.max_daily_loss_pct,
    max_consecutive_losses: rs?.max_consecutive_losses ?? DEFAULTS.max_consecutive_losses,
    manual_trading_state:   rs?.manual_trading_state   ?? DEFAULTS.manual_trading_state,
    pnl_from:               rs?.pnl_from               ?? DEFAULTS.pnl_from,
  };

  return ok({ settings });
}

export async function POST(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const body = await req.json().catch(() => ({}));

  // 기존 값 먼저 조회 (부분 업데이트 지원)
  const { data: existing } = await supabaseServer()
    .from("risk_settings")
    .select("*")
    .eq("user_id", uid)
    .maybeSingle();

  // 보내온 값이 있으면 사용, 없으면 기존값, 없으면 기본값
  function pick(key: string, def: any) {
    const sent = toNum(body[key]);
    if (sent !== null) return sent;                    // 새 값
    if (existing?.[key] != null) return existing[key]; // 기존 DB 값
    return def;                                        // 기본값
  }

  const payload = {
    user_id:               uid,
    seed_usd:              pick("seed_usd",               DEFAULTS.seed_usd),
    max_dd_usd:            pick("max_dd_usd",             DEFAULTS.max_dd_usd),
    max_dd_pct:            pick("max_dd_pct",             DEFAULTS.max_dd_pct),
    dd_mode:               body.dd_mode ?? existing?.dd_mode ?? DEFAULTS.dd_mode,
    dd_floor_usd:          toNum(body.dd_floor_usd) ?? existing?.dd_floor_usd ?? DEFAULTS.dd_floor_usd,
    max_daily_loss_usd:    pick("max_daily_loss_usd",     DEFAULTS.max_daily_loss_usd),
    max_daily_loss_pct:    pick("max_daily_loss_pct",     DEFAULTS.max_daily_loss_pct),
    max_consecutive_losses: pick("max_consecutive_losses", DEFAULTS.max_consecutive_losses),
    // 문자열 필드
    manual_trading_state:  body.manual_trading_state ?? existing?.manual_trading_state ?? DEFAULTS.manual_trading_state,
    pnl_from:              body.pnl_from !== undefined ? (body.pnl_from || null) : (existing?.pnl_from ?? DEFAULTS.pnl_from),
  };

  const { error } = await supabaseServer()
    .from("risk_settings")
    .upsert(payload, { onConflict: "user_id" });

  if (error) return bad(error.message, 500);
  return ok({ settings: payload });
}
