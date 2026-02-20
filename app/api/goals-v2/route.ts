import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/supabase/serverAuth";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ok(data: any) { return NextResponse.json({ ok: true, ...data }); }
function bad(msg: string, status = 400) { return NextResponse.json({ ok: false, error: msg }, { status }); }

const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export async function GET(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const url = new URL(req.url);
  const includeArchived = url.searchParams.get("includeArchived") === "1";
  const includeCompleted = url.searchParams.get("includeCompleted") === "1";

  const sb = supabaseServer();

  let q = sb.from("goals_v2").select("*").eq("user_id", uid);
  if (!includeArchived) q = q.neq("status", "archived");
  if (!includeCompleted) q = q.neq("status", "completed");

  const { data: goals, error: e1 } = await q.order("created_at", { ascending: false });
  if (e1) return bad(e1.message, 500);

  const { data: history, error: e2 } = await sb
    .from("goals_history")
    .select("*")
    .eq("user_id", uid)
    .order("created_at", { ascending: false });
  if (e2) return bad(e2.message, 500);

  return ok({ goals: goals || [], history: history || [] });
}

export async function POST(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body) return bad("invalid json");

  const type = String(body.type || "pnl");
  const title = String(body.title || "").trim();
  if (!title) return bad("title required");

  const payload = {
    user_id: uid,
    title,
    type,
    mode: (type === "pnl" || type === "withdrawal") ? "auto" : "manual",
    period: String(body.period || "monthly"),
    target_value: (type === "boolean") ? null : n(body.target_value),
    current_value: (type === "boolean") ? 0 : n(body.current_value ?? 0),
    unit: (type === "pnl" || type === "withdrawal") ? "usd" : "count",
    status: "active",
    meta: body.meta ?? {},
  };

  const { data: row, error } = await supabaseServer()
    .from("goals_v2")
    .insert(payload)
    .select("*")
    .single();

  if (error) return bad(error.message, 500);
  return ok({ goal: row });
}

export async function PATCH(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body?.id) return bad("id required");

  const sb = supabaseServer();

  // 소유권 확인
  const { data: goal, error: e0 } = await sb
    .from("goals_v2")
    .select("*")
    .eq("id", body.id)
    .eq("user_id", uid)
    .single();
  if (e0 || !goal) return bad(e0?.message || "not found", 404);

  const updated = { ...goal, ...body };

  // 자동 완료 조건 판단
  const isBoolean = updated.type === "boolean";
  const hasTarget = updated.target_value != null && n(updated.target_value) > 0;
  const done =
    isBoolean
      ? n(updated.current_value) >= 1
      : hasTarget && n(updated.current_value) >= n(updated.target_value);

  // 완료 처리: goals_history에 기록 (중복 방지: 이미 completed이면 스킵)
  if (done && goal.status !== "completed") {
    await sb.from("goals_history").insert({
      user_id: uid,
      goal_id: updated.id,
      type: updated.type,
      title: updated.title,
      target_value: updated.target_value,
      unit: updated.unit,
    });
    updated.status = "completed";
  }

  const { error: e1 } = await sb.from("goals_v2").update({
    title: updated.title,
    type: updated.type,
    mode: updated.mode,
    period: updated.period,
    target_value: updated.target_value,
    current_value: updated.current_value,
    unit: updated.unit,
    status: updated.status,
    meta: updated.meta ?? {},
    updated_at: new Date().toISOString(),
  }).eq("id", updated.id).eq("user_id", uid);

  if (e1) return bad(e1.message, 500);
  return ok({});
}

export async function DELETE(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const hard = url.searchParams.get("hard") === "1";
  if (!id) return bad("id required");

  const sb = supabaseServer();

  if (hard) {
    await sb.from("goals_history").delete().eq("user_id", uid).eq("goal_id", id);
    const { error } = await sb.from("goals_v2").delete().eq("user_id", uid).eq("id", id);
    if (error) return bad(error.message, 500);
    return ok({});
  }

  // 기본: 아카이브(숨김)
  const { error } = await sb
    .from("goals_v2")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("user_id", uid)
    .eq("id", id);

  if (error) return bad(error.message, 500);
  return ok({});
}
