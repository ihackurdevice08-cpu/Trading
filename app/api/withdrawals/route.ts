import { NextResponse } from "next/server";
import { getAuthInfo } from "@/lib/firebase/serverAuth";
import { listDocs, addDoc, deleteDoc } from "@/lib/firebase/firestoreRest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(m: string, s = 400) { return NextResponse.json({ ok: false, error: m }, { status: s }); }

function toDateStr(v: any): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string") return v.slice(0, 10);
  return null;
}

export async function GET() {
  const auth = await getAuthInfo();
  if (!auth) return bad("unauthorized", 401);
  const { uid, token } = auth;

  const docs = await listDocs(token, `users/${uid}/withdrawals`);

  const withdrawals = docs.map(d => ({
    id:           d.__id,
    amount:       Number(d.amount || 0),
    source:       d.source ?? "profit",
    note:         d.note ?? null,
    // withdrawn_at 우선, 없으면 date, 없으면 created_at
    withdrawn_at: toDateStr(d.withdrawn_at) ?? toDateStr(d.date) ?? toDateStr(d.created_at) ?? null,
  }));

  // source별 합계 계산
  const totals = {
    total:   withdrawals.reduce((s, w) => s + w.amount, 0),
    profit:  withdrawals.filter(w => w.source === "profit").reduce((s, w) => s + w.amount, 0),
    seed:    withdrawals.filter(w => w.source === "seed").reduce((s, w) => s + w.amount, 0),
    rebate:  withdrawals.filter(w => w.source === "rebate").reduce((s, w) => s + w.amount, 0),
  };

  return NextResponse.json({ ok: true, withdrawals, totals });
}

export async function POST(req: Request) {
  const auth = await getAuthInfo();
  if (!auth) return bad("unauthorized", 401);
  const { uid, token } = auth;

  const body = await req.json().catch(() => ({}));
  if (!body.amount || Number(body.amount) <= 0) return bad("amount 필요");

  const dateStr = body.withdrawn_at || body.date
    ? (body.withdrawn_at || body.date)
    : new Date().toISOString().slice(0, 10);

  const id = await addDoc(token, `users/${uid}/withdrawals`, {
    amount:       Number(body.amount),
    source:       body.source ?? "profit",
    note:         body.note   ?? null,
    withdrawn_at: dateStr,
    created_at:   new Date(),
  });

  return NextResponse.json({ ok: true, id });
}

export async function DELETE(req: Request) {
  const auth = await getAuthInfo();
  if (!auth) return bad("unauthorized", 401);
  const { uid, token } = auth;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return bad("id 필요");

  await deleteDoc(token, `users/${uid}/withdrawals/${id}`);
  return NextResponse.json({ ok: true });
}
