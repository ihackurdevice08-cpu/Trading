import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/supabase/serverAuth";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ok(data: any) { return NextResponse.json({ ok: true, ...data }); }
function bad(msg: string, status = 400) { return NextResponse.json({ ok: false, error: msg }, { status }); }

const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function startOfMonthKST(): string {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), 1) - 9 * 60 * 60 * 1000).toISOString();
}

export async function GET(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const url = new URL(req.url);
  const includeArchived  = url.searchParams.get("includeArchived")  === "1";
  const includeCompleted = url.searchParams.get("includeCompleted") === "1";

  const sb = supabaseServer();

  let q = sb.from("goals_v2").select("*").eq("user_id", uid);
  if (!includeArchived)  q = q.neq("status", "archived");
  if (!includeCompleted) q = q.neq("status", "completed");

  const [goalsResult, historyResult, pnlResult] = await Promise.all([
    q.order("created_at", { ascending: false }),
    sb.from("goals_history").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
    sb.from("manual_trades").select("pnl").eq("user_id", uid).gte("opened_at", startOfMonthKST()),
  ]);

  if (goalsResult.error)   return bad(goalsResult.error.message,   500);
  if (historyResult.error) return bad(historyResult.error.message, 500);

  const goals   = goalsResult.data  || [];
  const history = historyResult.data || [];

  const monthPnl        = (pnlResult.data || []).reduce((s: number, r: any) => s + n(r.pnl), 0);
  const monthPnlRounded = Number(monthPnl.toFixed(4));

  const enrichedGoals: any[] = [];
  const autoCompleteIds: string[] = [];

  for (const g of goals) {
    if (g.mode === "auto" && g.type === "pnl" && g.status === "active") {
      const enriched = { ...g, current_value: monthPnlRounded };
      enrichedGoals.push(enriched);
      if (n(g.target_value) > 0 && monthPnlRounded >= n(g.target_value)) {
        autoCompleteIds.push(g.id);
      }
    } else {
      enrichedGoals.push(g);
    }
  }

  // auto 완료 처리 (응답 블로킹 안 함)
  if (autoCompleteIds.length > 0) {
    Promise.all(autoCompleteIds.map(async (gid) => {
      const goal = goals.find((g: any) => g.id === gid);
      if (!goal) return;
      await sb.from("goals_history").insert({
        user_id: uid, goal_id: gid, type: goal.type, title: goal.title,
        target_value: goal.target_value, current_value: monthPnlRounded, unit: goal.unit,
      }).then(() =>
        sb.from("goals_v2").update({
          status: "completed", current_value: monthPnlRounded,
          updated_at: new Date().toISOString(),
        }).eq("id", gid).eq("user_id", uid)
      );
    })).catch(() => {});

    for (const g of enrichedGoals) {
      if (autoCompleteIds.includes(g.id)) g.status = "completed";
    }
  }

  return ok({ goals: enrichedGoals, history });
}

export async function POST(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body) return bad("invalid json");

  const type  = String(body.type  || "pnl");
  const title = String(body.title || "").trim();
  if (!title) return bad("title required");
  if (type !== "boolean" && n(body.target_value) <= 0) return bad("목표 수치는 0보다 커야 합니다");

  const payload = {
    user_id:       uid,
    title,
    type,
    mode:          (type === "pnl" || type === "withdrawal") ? "auto" : "manual",
    period:        String(body.period || "monthly"),
    target_value:  (type === "boolean") ? null : n(body.target_value),
    current_value: 0,
    unit:          (type === "pnl" || type === "withdrawal") ? "usd" : "count",
    status:        "active",
    meta:          body.meta ?? {},
  };

  const { data: row, error } = await supabaseServer()
    .from("goals_v2").insert(payload).select("*").single();

  if (error) return bad(error.message, 500);
  return ok({ goal: row });
}

export async function PATCH(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body?.id) return bad("id required");

  if (body.current_value !== undefined && !Number.isFinite(Number(body.current_value)))
    return bad("current_value는 숫자여야 합니다");

  const sb = supabaseServer();

  const { data: goal, error: e0 } = await sb
    .from("goals_v2").select("*")
    .eq("id", body.id).eq("user_id", uid).single();
  if (e0 || !goal) return bad(e0?.message || "not found", 404);

  // 제목만 수정
  const isTitleOnly = body.title !== undefined &&
    body.current_value === undefined && body.status === undefined;
  if (isTitleOnly) {
    const { error } = await sb.from("goals_v2").update({
      title: String(body.title).trim(), updated_at: new Date().toISOString(),
    }).eq("id", goal.id).eq("user_id", uid);
    if (error) return bad(error.message, 500);
    return ok({});
  }

  const updated = {
    ...goal, ...body,
    current_value: body.current_value !== undefined ? Number(body.current_value) : goal.current_value,
  };

  const isBoolean = updated.type === "boolean";
  const hasTarget = updated.target_value != null && n(updated.target_value) > 0;
  const done = isBoolean
    ? n(updated.current_value) >= 1
    : hasTarget && n(updated.current_value) >= n(updated.target_value);
  const shouldComplete = done && goal.status !== "completed";

  if (shouldComplete) {
    const { error: histErr } = await sb.from("goals_history").insert({
      user_id:       uid,
      goal_id:       updated.id,
      type:          updated.type,
      title:         updated.title,
      target_value:  updated.target_value,
      current_value: updated.current_value,  // 실제 달성값
      unit:          updated.unit,
    });
    if (histErr) return bad(`History 저장 실패: ${histErr.message}`, 500);
    updated.status = "completed";
  }

  const { error: e1 } = await sb.from("goals_v2").update({
    title: updated.title, type: updated.type, mode: updated.mode,
    period: updated.period, target_value: updated.target_value,
    current_value: updated.current_value, unit: updated.unit,
    status: updated.status, meta: updated.meta ?? {},
    updated_at: new Date().toISOString(),
  }).eq("id", updated.id).eq("user_id", uid);

  if (e1) return bad(e1.message, 500);
  return ok({ completed: shouldComplete });
}

export async function DELETE(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const url  = new URL(req.url);
  const id   = url.searchParams.get("id");
  const hard = url.searchParams.get("hard") === "1";
  if (!id) return bad("id required");

  const sb = supabaseServer();

  if (hard) {
    await sb.from("goals_history").delete().eq("user_id", uid).eq("goal_id", id);
    const { error } = await sb.from("goals_v2").delete().eq("user_id", uid).eq("id", id);
    if (error) return bad(error.message, 500);
    return ok({});
  }

  const { error } = await sb.from("goals_v2")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("user_id", uid).eq("id", id);

  if (error) return bad(error.message, 500);
  return ok({});
}
