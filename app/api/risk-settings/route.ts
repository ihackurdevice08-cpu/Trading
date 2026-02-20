import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/supabase/serverAuth";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ok(data: any) { return NextResponse.json({ ok: true, ...data }); }
function bad(msg: string, status = 400) { return NextResponse.json({ ok: false, error: msg }, { status }); }
const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export async function GET() {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const { data: rs } = await supabaseServer()
    .from("risk_settings")
    .select("*")
    .eq("user_id", uid)
    .maybeSingle();

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

  return ok({ settings });
}

export async function POST(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const body = await req.json().catch(() => ({}));

  const payload = {
    user_id: uid,
    seed_usd: n(body.seed_usd),
    max_dd_usd: n(body.max_dd_usd),
    max_dd_pct: n(body.max_dd_pct),
    max_daily_loss_usd: n(body.max_daily_loss_usd),
    max_daily_loss_pct: n(body.max_daily_loss_pct),
    max_consecutive_losses: Number(body.max_consecutive_losses || 3),
    max_trades_per_day: Number(body.max_trades_per_day || 20),
    max_trades_per_hour: Number(body.max_trades_per_hour || 8),
  };

  const { error } = await supabaseServer()
    .from("risk_settings")
    .upsert(payload, { onConflict: "user_id" });

  if (error) return bad(error.message, 500);
  return ok({});
}
