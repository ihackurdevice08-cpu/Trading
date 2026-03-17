import { NextResponse } from "next/server";
import { getAuthInfo } from "@/lib/firebase/serverAuth";
import { listDocs, addDoc, deleteDoc } from "@/lib/firebase/firestoreRest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(m: string, s = 400) { return NextResponse.json({ ok: false, error: m }, { status: s }); }

export async function GET() {
  const auth = await getAuthInfo();
  if (!auth) return bad("unauthorized", 401);
  const { uid, token } = auth;
  const docs = await listDocs(token, `users/${uid}/withdrawals`);
  return NextResponse.json({ ok: true, withdrawals: docs.map(d=>({id:d.__id,...d,__id:undefined})) });
}

export async function POST(req: Request) {
  const auth = await getAuthInfo();
  if (!auth) return bad("unauthorized", 401);
  const { uid, token } = auth;
  const body = await req.json().catch(() => ({}));
  if (!body.amount) return bad("amount 필요");
  const id = await addDoc(token, `users/${uid}/withdrawals`, {
    amount: Number(body.amount),
    source: body.source ?? "profit",
    note:   body.note   ?? null,
    date:   body.date ? new Date(body.date) : new Date(),
    created_at: new Date(),
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
