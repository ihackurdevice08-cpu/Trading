import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

// GET /api/manual-trades?from=...&to=...&symbol=...&tag=...
export async function GET(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) return bad("로그인이 필요합니다.", 401);

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const symbol = url.searchParams.get("symbol");
  const tag = url.searchParams.get("tag");

  let q = supabase
    .from("manual_trades")
    .select("*")
    .eq("user_id", user.id)
    .order("opened_at", { ascending: false })
    .limit(200);

  if (from) q = q.gte("opened_at", from);
  if (to) q = q.lte("opened_at", to);
  if (symbol) q = q.ilike("symbol", `%${symbol}%`);

  if (tag) q = q.contains("tags", [tag]);

  const { data, error } = await q;
  if (error) return bad(error.message, 500);

  return NextResponse.json({ ok: true, trades: data ?? [] });
}

// POST /api/manual-trades
export async function POST(req: Request) {
  const supabase = createRouteHandlerClient({ cookies });

  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) return bad("로그인이 필요합니다.", 401);

  const body = await req.json().catch(() => null);
  if (!body) return bad("요청 본문이 비어있습니다.");

  const symbol = String(body.symbol ?? "").trim();
  const side = String(body.side ?? "").trim();
  const opened_at = String(body.opened_at ?? "").trim();

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

  const { data, error } = await supabase
    .from("manual_trades")
    .insert(payload)
    .select("*")
    .single();

  if (error) return bad(error.message, 500);

  return NextResponse.json({ ok: true, trade: data });
}
