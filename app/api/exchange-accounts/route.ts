import { NextResponse } from "next/server";
import { getAuthInfo } from "@/lib/firebase/serverAuth";
import { listDocs, setDoc, deleteDoc, addDoc } from "@/lib/firebase/firestoreRest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(m: string, s = 400) { return NextResponse.json({ ok: false, error: m }, { status: s }); }

export async function GET() {
  const auth = await getAuthInfo();
  if (!auth) return bad("unauthorized", 401);
  const { uid, token } = auth;
  const docs = await listDocs(token, `users/${uid}/exchange_accounts`);
  const accounts = docs.map(d => ({ id: d.__id, ...d, __id: undefined }));
  return NextResponse.json({ ok: true, accounts });
}

export async function POST(req: Request) {
  const auth = await getAuthInfo();
  if (!auth) return bad("unauthorized", 401);
  const { uid, token } = auth;

  const body = await req.json().catch(() => ({}));
  if (!body.exchange) return bad("exchange 필요");

  const id = await addDoc(token, `users/${uid}/exchange_accounts`, {
    ...body, created_at: new Date(),
  });
  return NextResponse.json({ ok: true, id });
}

export async function DELETE(req: Request) {
  const auth = await getAuthInfo();
  if (!auth) return bad("unauthorized", 401);
  const { uid, token } = auth;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return bad("id 필요");
  await deleteDoc(token, `users/${uid}/exchange_accounts/${id}`);
  return NextResponse.json({ ok: true });
}
