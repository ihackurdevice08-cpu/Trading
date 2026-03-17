import { NextResponse } from "next/server";
import { getAuthInfo } from "@/lib/firebase/serverAuth";
import { getDoc, setDoc } from "@/lib/firebase/firestoreRest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ok(d: any) { return NextResponse.json({ ok: true, ...d }); }
function bad(m: string, s = 400) { return NextResponse.json({ ok: false, error: m }, { status: s }); }
const toNum = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

const DEFAULTS = {
  seed_usd: 10000, max_dd_usd: 500, max_dd_pct: 5,
  dd_mode: "drawdown", dd_floor_usd: null,
  max_daily_loss_usd: 300, max_daily_loss_pct: 3,
  max_consecutive_losses: 3, manual_trading_state: "auto", pnl_from: null,
};

export async function GET() {
  const auth = await getAuthInfo();
  if (!auth) return bad("unauthorized", 401);
  const { uid, token } = auth;

  const rs = await getDoc(token, `users/${uid}/risk_settings/default`) ?? {};

  return ok({ settings: {
    seed_usd:               rs.seed_usd               ?? DEFAULTS.seed_usd,
    max_dd_usd:             rs.max_dd_usd             ?? DEFAULTS.max_dd_usd,
    max_dd_pct:             rs.max_dd_pct             ?? DEFAULTS.max_dd_pct,
    dd_mode:                rs.dd_mode                ?? DEFAULTS.dd_mode,
    dd_floor_usd:           rs.dd_floor_usd           ?? DEFAULTS.dd_floor_usd,
    max_daily_loss_usd:     rs.max_daily_loss_usd     ?? DEFAULTS.max_daily_loss_usd,
    max_daily_loss_pct:     rs.max_daily_loss_pct     ?? DEFAULTS.max_daily_loss_pct,
    max_consecutive_losses: rs.max_consecutive_losses ?? DEFAULTS.max_consecutive_losses,
    manual_trading_state:   rs.manual_trading_state   ?? DEFAULTS.manual_trading_state,
    pnl_from:               rs.pnl_from               ?? DEFAULTS.pnl_from,
  }});
}

export async function POST(req: Request) {
  const auth = await getAuthInfo();
  if (!auth) return bad("unauthorized", 401);
  const { uid, token } = auth;

  const body = await req.json().catch(() => ({}));
  const rs   = await getDoc(token, `users/${uid}/risk_settings/default`) ?? {};

  function pick(key: string, def: any) {
    const sent = toNum(body[key]);
    if (sent !== null) return sent;
    if (rs[key] != null) return rs[key];
    return def;
  }

  const payload = {
    seed_usd:              pick("seed_usd",               DEFAULTS.seed_usd),
    max_dd_usd:            pick("max_dd_usd",             DEFAULTS.max_dd_usd),
    max_dd_pct:            pick("max_dd_pct",             DEFAULTS.max_dd_pct),
    dd_mode:               body.dd_mode ?? rs.dd_mode ?? DEFAULTS.dd_mode,
    dd_floor_usd:          toNum(body.dd_floor_usd) ?? rs.dd_floor_usd ?? DEFAULTS.dd_floor_usd,
    max_daily_loss_usd:    pick("max_daily_loss_usd",     DEFAULTS.max_daily_loss_usd),
    max_daily_loss_pct:    pick("max_daily_loss_pct",     DEFAULTS.max_daily_loss_pct),
    max_consecutive_losses: pick("max_consecutive_losses", DEFAULTS.max_consecutive_losses),
    manual_trading_state:  body.manual_trading_state ?? rs.manual_trading_state ?? DEFAULTS.manual_trading_state,
    pnl_from:              body.pnl_from !== undefined ? (body.pnl_from || null) : (rs.pnl_from ?? null),
  };

  await setDoc(token, `users/${uid}/risk_settings/default`, payload);
  return ok({ settings: payload });
}
