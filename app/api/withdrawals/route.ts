import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/firebase/serverAuth";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ok(data: any)  { return NextResponse.json({ ok: true,  ...data }); }
function bad(msg: string, status = 400) { return NextResponse.json({ ok: false, error: msg }, { status }); }
const toN = (v: any) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };

function docToRow(d: any) {
  return {
    id: d.id, ...d.data(),
    withdrawn_at: d.data().withdrawn_at?.toDate?.()?.toISOString() ?? d.data().withdrawn_at,
  };
}

export async function GET() {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const snap = await adminDb().collection("users").doc(uid).collection("withdrawals")
    .orderBy("withdrawn_at", "desc").get();
  const list = snap.docs.map(docToRow);

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

  const source = ["profit","seed","rebate"].includes(body.source) ? body.source : "profit";
  const note   = String(body.note || "").trim();
  const withdrawn_at = body.withdrawn_at
    ? new Date(body.withdrawn_at)
    : new Date();

  const ref = adminDb().collection("users").doc(uid).collection("withdrawals").doc();
  await ref.set({ amount, source, note, withdrawn_at, created_at: FieldValue.serverTimestamp() });
  return ok({ withdrawal: { id: ref.id, amount, source, note, withdrawn_at: withdrawn_at.toISOString() } });
}

export async function DELETE(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return bad("id required");

  await adminDb().collection("users").doc(uid).collection("withdrawals").doc(id).delete();
  return ok({});
}
