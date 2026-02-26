import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/supabase/serverAuth";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

export async function GET(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const url = new URL(req.url);
  const from    = url.searchParams.get("from");    // YYYY-MM-DD
  const to      = url.searchParams.get("to");      // YYYY-MM-DD
  const symbol  = url.searchParams.get("symbol");
  const tag     = url.searchParams.get("tag");
  const limit   = Math.min(Number(url.searchParams.get("limit") || "500"), 2000);

  let q = supabaseServer()
    .from("manual_trades")
    .select("id,symbol,side,opened_at,closed_at,pnl,tags,notes,source")
    .eq("user_id", uid)
    .order("opened_at", { ascending: false })
    .limit(limit);

  // from 있을 때만 날짜 필터 적용 (없으면 전체 조회)
  const fromDate = from || null;
  if (fromDate) q = q.gte("opened_at", fromDate + "T00:00:00.000Z");

  if (to)     q = q.lte("opened_at", to + "T23:59:59.999Z");
  if (symbol) q = q.ilike("symbol", `%${symbol}%`);
  if (tag)    q = q.contains("tags", [tag]);

  const { data: rows, error } = await q;
  if (error) return bad(error.message, 500);

  return NextResponse.json({ ok: true, trades: rows || [], from: fromDate });
}

export async function POST(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const symbol   = String(body.symbol || "").trim().toUpperCase();
  const side     = String(body.side   || "").trim().toLowerCase();
  const opened_at = body.opened_at;

  if (!symbol)   return bad("symbol 필요");
  if (side !== "long" && side !== "short") return bad("side는 long/short");
  if (!opened_at) return bad("opened_at 필요");

  const payload = {
    user_id: uid,
    symbol,
    side,
    opened_at,
    closed_at: body.closed_at ?? null,
    pnl:       body.pnl  != null ? Number(body.pnl)  : null,
    tags:      Array.isArray(body.tags) ? body.tags.map(String) : [],
    notes:     body.notes ?? null,
    source:    "manual",
  };

  const { data: row, error } = await supabaseServer()
    .from("manual_trades")
    .insert(payload)
    .select("id,symbol,side,opened_at,closed_at,pnl,tags,notes,source")
    .single();

  if (error) return bad(error.message, 500);
  return NextResponse.json({ ok: true, trade: row });
}

export async function DELETE(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return bad("id 필요");

  const { error } = await supabaseServer()
    .from("manual_trades")
    .delete()
    .eq("id", id)
    .eq("user_id", uid);

  if (error) return bad(error.message, 500);
  return NextResponse.json({ ok: true });
}
