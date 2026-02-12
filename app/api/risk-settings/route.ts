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

const DEFAULTS = {
  seed_usd: 10000,
  max_dd_usd: 500,
  max_dd_pct: 5,
  max_daily_loss_usd: 300,
  max_daily_loss_pct: 3,
  max_consecutive_losses: 3,
  max_trades_per_day: 20,
  max_trades_per_hour: 8,
};

export async function GET() {
  const sbAuth = await sbFromCookies();
  const { data } = await sbAuth.auth.getUser();
  const uid = data.user?.id;
  if (!uid) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const sb = supabaseServer();
  const { data: row, error } = await sb
    .from("risk_settings")
    .select("*")
    .eq("user_id", uid)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, settings: { ...DEFAULTS, ...(row || {}) } });
}

export async function POST(req: Request) {
  const sbAuth = await sbFromCookies();
  const { data } = await sbAuth.auth.getUser();
  const uid = data.user?.id;
  if (!uid) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const pick = (k: string, d: any) => (body?.[k] ?? d);

  const settings = {
    user_id: uid,
    seed_usd: Number(pick("seed_usd", DEFAULTS.seed_usd)),
    max_dd_usd: Number(pick("max_dd_usd", DEFAULTS.max_dd_usd)),
    max_dd_pct: Number(pick("max_dd_pct", DEFAULTS.max_dd_pct)),
    max_daily_loss_usd: Number(pick("max_daily_loss_usd", DEFAULTS.max_daily_loss_usd)),
    max_daily_loss_pct: Number(pick("max_daily_loss_pct", DEFAULTS.max_daily_loss_pct)),
    max_consecutive_losses: Number(pick("max_consecutive_losses", DEFAULTS.max_consecutive_losses)),
    max_trades_per_day: Number(pick("max_trades_per_day", DEFAULTS.max_trades_per_day)),
    max_trades_per_hour: Number(pick("max_trades_per_hour", DEFAULTS.max_trades_per_hour)),
    updated_at: new Date().toISOString(),
  };

  const sb = supabaseServer();
  const { error } = await sb.from("risk_settings").upsert(settings, { onConflict: "user_id" });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, settings });
}
