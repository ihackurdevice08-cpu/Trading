import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/firebase/serverAuth";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ok(data: any)  { return NextResponse.json({ ok: true,  ...data }); }
function bad(msg: string, status = 400) { return NextResponse.json({ ok: false, error: msg }, { status }); }

export async function POST(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const db = adminDb();

  const tradesSnap = await db.collection("users").doc(uid).collection("manual_trades").get();
  const cumPnl = tradesSnap.docs.reduce((s, d) => s + (Number(d.data().pnl) || 0), 0);

  const ref = db.collection("users").doc(uid).collection("risk_cycles").doc();
  const data = {
    started_at:       new Date(),
    note:             String(body.note || "").trim(),
    equity_snapshot:  Number(body.equity_snapshot) || cumPnl,
    created_at:       new Date(),
  };
  await ref.set(data);
  return ok({ cycle: { id: ref.id, ...data, started_at: data.started_at.toISOString() } });
}

export async function GET() {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const snap = await adminDb().collection("users").doc(uid).collection("risk_cycles")
    .orderBy("started_at", "desc").limit(20).get();

  const cycles = snap.docs.map(d => ({
    id: d.id, ...d.data(),
    started_at: d.data().started_at?.toDate?.()?.toISOString() ?? null,
  }));
  return ok({ cycles });
}
