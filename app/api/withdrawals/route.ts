import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/supabase/serverAuth";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ok(data: any)  { return NextResponse.json({ ok: true,  ...data }); }
function bad(msg: string, status = 400) { return NextResponse.json({ ok: false, error: msg }, { status }); }
const toN = (v: any) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

export async function GET() {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const { data, error } = await supabaseServer()
    .from("withdrawals")
    .select("*")
    .eq("user_id", uid)
    .order("withdrawn_at", { ascending: false });

  if (error) return bad(error.message, 500);

  const list = data || [];
  const totals = {
    profit:  list.filter(r => r.source === "profit").reduce((s, r) => s + toN(r.amount), 0),
    seed:    list.filter(r => r.source === "seed").reduce((s, r) => s + toN(r.amount), 0),
    rebate:  list.filter(r => r.source === "rebate").reduce((s, r) => s + toN(r.amount), 0),
    total:   list.reduce((s, r) => s + toN(r.amount), 0),
  };

  return ok({ withdrawals: list, totals });
}

export async function POST(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body) return bad("invalid json");

  const amount = toN(body.amount);
  if (amount <= 0) return bad("금액은 0보다 커야 합니다");

  const source       = ["profit","seed","rebate"].includes(body.source) ? body.source : "profit";
  const note         = String(body.note || "").trim();
  const withdrawn_at = body.withdrawn_at
    ? new Date(body.withdrawn_at).toISOString()
    : new Date().toISOString();

  const { data: row, error } = await supabaseServer()
    .from("withdrawals")
    .insert({ user_id: uid, amount, source, note, withdrawn_at })
    .select("*")
    .single();

  if (error) return bad(error.message, 500);
  return ok({ withdrawal: row });
}

export async function DELETE(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return bad("id required");

  const { error } = await supabaseServer()
    .from("withdrawals")
    .delete()
    .eq("id", id)
    .eq("user_id", uid);

  if (error) return bad(error.message, 500);
  return ok({});
}
