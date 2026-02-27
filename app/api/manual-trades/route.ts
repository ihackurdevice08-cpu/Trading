import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/supabase/serverAuth";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

const SELECT_COLS = "id, symbol, side, opened_at, closed_at, pnl, tags, notes, group_id";

export async function GET(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const url    = new URL(req.url);
  const from   = url.searchParams.get("from");
  const to     = url.searchParams.get("to");
  const symbol = url.searchParams.get("symbol");
  const tag    = url.searchParams.get("tag");
  const limit  = Math.min(Number(url.searchParams.get("limit") || "500"), 2000);

  let q = supabaseServer()
    .from("manual_trades")
    .select(SELECT_COLS)
    .eq("user_id", uid)
    .order("opened_at", { ascending: false })
    .limit(limit);

  if (from)   q = q.gte("opened_at", from + "T00:00:00.000Z");
  if (to)     q = q.lte("opened_at", to   + "T23:59:59.999Z");
  if (symbol) q = q.ilike("symbol", `%${symbol}%`);
  if (tag)    q = q.contains("tags", [tag]);

  const { data, error } = await q;
  if (error) return bad(error.message, 500);

  return NextResponse.json({ ok: true, trades: data || [], from: from || null });
}

export async function POST(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const body      = await req.json().catch(() => ({}));
  const symbol    = String(body.symbol || "").trim().toUpperCase();
  const side      = String(body.side   || "").trim().toLowerCase();
  const opened_at = body.opened_at;

  if (!symbol)                                     return bad("symbol 필요");
  if (side !== "long" && side !== "short")         return bad("side는 long/short");
  if (!opened_at)                                  return bad("opened_at 필요");
  if (body.pnl != null && isNaN(Number(body.pnl))) return bad("pnl은 숫자여야 합니다");

  const { data, error } = await supabaseServer()
    .from("manual_trades")
    .insert({
      user_id:   uid,
      symbol,
      side,
      opened_at,
      closed_at: body.closed_at ?? null,
      pnl:       body.pnl != null ? Number(body.pnl) : null,
      tags:      Array.isArray(body.tags) ? [...body.tags.map(String), "manual"] : ["manual"],
      notes:     body.notes ?? null,
    })
    .select(SELECT_COLS)
    .single();

  if (error) return bad(error.message, 500);
  return NextResponse.json({ ok: true, trade: data });
}

export async function PATCH(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const { ids, group_id } = body;

  if (!Array.isArray(ids) || ids.length === 0) return bad("ids 필요");
  // ids 최대 100개 제한 (대량 업데이트 방지)
  if (ids.length > 100) return bad("ids는 최대 100개");
  // group_id 형식 검증 (grp_ 접두어 또는 null)
  if (group_id != null && typeof group_id !== "string") return bad("group_id는 문자열 또는 null");

  const { error } = await supabaseServer()
    .from("manual_trades")
    .update({ group_id: group_id ?? null })
    .in("id", ids)
    .eq("user_id", uid); // 본인 데이터만 수정

  if (error) return bad(error.message, 500);
  return NextResponse.json({ ok: true, updated: ids.length });
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
    .eq("user_id", uid); // 본인 데이터만 삭제

  if (error) return bad(error.message, 500);
  return NextResponse.json({ ok: true });
}
