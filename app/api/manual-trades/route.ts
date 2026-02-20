import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/supabase/serverAuth";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function GET(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const symbol = url.searchParams.get("symbol");
  const tag = url.searchParams.get("tag");

  let q = supabaseServer()
    .from("manual_trades")
    .select("id,symbol,side,opened_at,closed_at,pnl,tags,notes")
    .eq("user_id", uid)
    .order("opened_at", { ascending: false })
    .limit(200);

  if (from) q = q.gte("opened_at", from);
  if (to) q = q.lte("opened_at", to);
  if (symbol) q = q.ilike("symbol", `%${symbol}%`);
  if (tag) q = q.contains("tags", [tag]);

  const { data: rows, error } = await q;
  if (error) return bad(error.message, 500);

  return NextResponse.json({ ok: true, trades: rows || [] });
}

export async function POST(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const body = await req.json().catch(() => ({}));

  const symbol = String(body.symbol || "").trim().toUpperCase();
  const side = String(body.side || "").trim().toLowerCase();
  const opened_at = body.opened_at;

  if (!symbol) return bad("symbol이 필요합니다.");
  if (side !== "long" && side !== "short") return bad("side는 long/short만 가능합니다.");
  if (!opened_at) return bad("opened_at이 필요합니다.");

  const tags = Array.isArray(body.tags) ? body.tags.map((x: any) => String(x)) : [];

  const payload = {
    user_id: uid,
    symbol,
    side,
    opened_at,
    closed_at: body.closed_at ?? null,
    pnl: body.pnl ?? null,
    tags,
    notes: body.notes ?? null,
  };

  const { data: row, error } = await supabaseServer()
    .from("manual_trades")
    .insert(payload)
    .select("id,symbol,side,opened_at,closed_at,pnl,tags,notes")
    .single();

  if (error) return bad(error.message, 500);

  // 대시보드 캐시 무효화를 위해 헤더 사용
  return NextResponse.json({ ok: true, trade: row });
}

export async function DELETE(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return bad("id가 필요합니다.");

  const { error } = await supabaseServer()
    .from("manual_trades")
    .delete()
    .eq("id", id)
    .eq("user_id", uid);

  if (error) return bad(error.message, 500);
  return NextResponse.json({ ok: true });
}
