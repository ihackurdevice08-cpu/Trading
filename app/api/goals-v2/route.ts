import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/firebase/serverAuth";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ok(data: any) { return NextResponse.json({ ok: true, ...data }); }
function bad(msg: string, status = 400) { return NextResponse.json({ ok: false, error: msg }, { status }); }
const n = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function startOfMonthKST(): Date {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), 1) - 9 * 60 * 60 * 1000);
}
function toIso(v: any) { return v?.toDate?.()?.toISOString() ?? v ?? null; }
function docToGoal(d: FirebaseFirestore.DocumentSnapshot) {
  const data = d.data() ?? {};
  return { id: d.id, ...data, created_at: toIso(data.created_at), updated_at: toIso(data.updated_at) };
}

export async function GET(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const url = new URL(req.url);
  const includeArchived  = url.searchParams.get("includeArchived")  === "1";
  const includeCompleted = url.searchParams.get("includeCompleted") === "1";

  const db      = adminDb();
  const userRef = db.collection("users").doc(uid);
  const monthStart = startOfMonthKST();

  let goalsQuery: FirebaseFirestore.Query = userRef.collection("goals_v2").orderBy("created_at", "desc");
  const [goalsSnap, histSnap, pnlSnap] = await Promise.all([
    goalsQuery.get(),
    userRef.collection("goals_history").orderBy("created_at", "desc").get(),
    userRef.collection("manual_trades").where("opened_at", ">=", monthStart).get(),
  ]);

  let goals = goalsSnap.docs.map(docToGoal);
  if (!includeArchived)  goals = goals.filter(g => g.status !== "archived");
  if (!includeCompleted) goals = goals.filter(g => g.status !== "completed");

  const history = histSnap.docs.map(d => ({ id: d.id, ...d.data(), created_at: toIso(d.data().created_at) }));
  const monthPnl = pnlSnap.docs.reduce((s, d) => s + (Number(d.data().pnl) || 0), 0);
  const monthPnlRounded = Number(monthPnl.toFixed(4));

  const autoCompleteIds: string[] = [];
  for (const g of goals) {
    if (g.mode === "auto" && g.type === "pnl" && g.status === "active") {
      g.current_value = monthPnlRounded;
      if (n(g.target_value) > 0 && monthPnlRounded >= n(g.target_value)) autoCompleteIds.push(g.id);
    }
  }

  if (autoCompleteIds.length > 0) {
    Promise.all(autoCompleteIds.map(async (gid) => {
      const goal = goals.find(g => g.id === gid);
      if (!goal) return;
      const batch = db.batch();
      const histRef = userRef.collection("goals_history").doc();
      batch.set(histRef, { goal_id: gid, type: goal.type, title: goal.title,
        target_value: goal.target_value, current_value: monthPnlRounded, unit: goal.unit,
        created_at: FieldValue.serverTimestamp() });
      batch.update(userRef.collection("goals_v2").doc(gid), {
        status: "completed", current_value: monthPnlRounded, updated_at: FieldValue.serverTimestamp(),
      });
      await batch.commit();
    })).catch(() => {});
    for (const g of goals) { if (autoCompleteIds.includes(g.id)) g.status = "completed"; }
  }

  return ok({ goals, history });
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

  const ref = adminDb().collection("users").doc(uid).collection("goals_v2").doc();
  const payload = {
    title, type,
    mode:          (type === "pnl" || type === "withdrawal") ? "auto" : "manual",
    period:        String(body.period || "monthly"),
    target_value:  (type === "boolean") ? null : n(body.target_value),
    current_value: 0,
    unit:          (type === "pnl" || type === "withdrawal") ? "usd" : "count",
    status:        "active",
    meta:          body.meta ?? {},
    created_at:    FieldValue.serverTimestamp(),
    updated_at:    FieldValue.serverTimestamp(),
  };
  await ref.set(payload);
  return ok({ goal: { id: ref.id, ...payload } });
}

export async function PATCH(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body?.id) return bad("id required");
  if (body.current_value !== undefined && !Number.isFinite(Number(body.current_value)))
    return bad("current_value는 숫자여야 합니다");

  const db = adminDb();
  const goalRef = db.collection("users").doc(uid).collection("goals_v2").doc(body.id);
  const snap = await goalRef.get();
  if (!snap.exists) return bad("not found", 404);
  const goal = snap.data()!;

  if (body.title !== undefined && body.current_value === undefined && body.status === undefined) {
    await goalRef.update({ title: String(body.title).trim(), updated_at: FieldValue.serverTimestamp() });
    return ok({});
  }

  const updated = { ...goal, ...body, current_value: body.current_value !== undefined ? Number(body.current_value) : goal.current_value };
  const isBoolean  = updated.type === "boolean";
  const hasTarget  = updated.target_value != null && n(updated.target_value) > 0;
  const done       = isBoolean ? n(updated.current_value) >= 1 : hasTarget && n(updated.current_value) >= n(updated.target_value);
  const shouldComplete = done && goal.status !== "completed";

  if (shouldComplete) {
    const histRef = db.collection("users").doc(uid).collection("goals_history").doc();
    await histRef.set({ goal_id: body.id, type: updated.type, title: updated.title,
      target_value: updated.target_value, current_value: updated.current_value, unit: updated.unit,
      created_at: FieldValue.serverTimestamp() });
    updated.status = "completed";
  }

  await goalRef.update({
    title: updated.title, type: updated.type, mode: updated.mode,
    period: updated.period, target_value: updated.target_value,
    current_value: updated.current_value, unit: updated.unit,
    status: updated.status, meta: updated.meta ?? {},
    updated_at: FieldValue.serverTimestamp(),
  });
  return ok({ completed: shouldComplete });
}

export async function DELETE(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const url  = new URL(req.url);
  const id   = url.searchParams.get("id");
  const hard = url.searchParams.get("hard") === "1";
  if (!id) return bad("id required");

  const db = adminDb();
  if (hard) {
    const histSnap = await db.collection("users").doc(uid).collection("goals_history")
      .where("goal_id", "==", id).get();
    const batch = db.batch();
    histSnap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(db.collection("users").doc(uid).collection("goals_v2").doc(id));
    await batch.commit();
    return ok({});
  }

  await db.collection("users").doc(uid).collection("goals_v2").doc(id)
    .update({ status: "archived", updated_at: FieldValue.serverTimestamp() });
  return ok({});
}
