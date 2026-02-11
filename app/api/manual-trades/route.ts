import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
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

  const sb = supabaseServer();
  const { data: rows, error } = await sb
    .from("manual_trades")
    .select("*")
    .eq("user_id", uid)
    .order("opened_at", { ascending: false });

  if (error) return bad(error.message, 500);
  return NextResponse.json({ ok: true, trades: rows || [] });
}

export async function POST(req: Request) {
  const sbAuth = await sbFromCookies();
  const { data } = await sbAuth.auth.getUser();
  const user = data.user;
  if (!user) return bad("unauthorized", 401);

  const body = await req.json().catch(() => ({}));

  const symbol = String(body.symbol || "").trim().toUpperCase();
  const side = String(body.side || "").trim().toLowerCase();
  const opened_at = body.opened_at;

  if (!symbol) return bad("symbol이 필요합니다.");
  if (side !== "long" && side !== "short") return bad("side는 long/short만 가능합니다.");
  if (!opened_at) return bad("opened_at이 필요합니다.");

  const tags = Array.isArray(body.tags) ? body.tags.map((x: any) => String(x)) : [];

  const payload = {
    user_id: user.id,
    symbol,
    side,
    opened_at,
    closed_at: body.closed_at ?? null,
    pnl: body.pnl ?? null,
    tags,
    notes: body.notes ?? null,
  };

  const sb = supabaseServer();
  const { data: row, error } = await sb
    .from("manual_trades")
    .insert(payload)
    .select("*")
    .single();

  if (error) return bad(error.message, 500);
  return NextResponse.json({ ok: true, trade: row });
}
