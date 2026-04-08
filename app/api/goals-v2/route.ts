import { NextResponse } from "next/server";
import { getAuthInfo } from "@/lib/firebase/serverAuth";
import { queryDocs, addDoc, setDoc, deleteDoc } from "@/lib/firebase/firestoreRest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(m: string, s = 400) { return NextResponse.json({ ok: false, error: m }, { status: s }); }

export async function GET(req: Request) {
  const auth = await getAuthInfo();
  if (!auth) return bad("unauthorized", 401);
  const { uid, token } = auth;

  const url = new URL(req.url);
  const includeCompleted = url.searchParams.get("includeCompleted") === "1";

  const docs = await queryDocs(token, `users/${uid}/goals_v2`, {
    orderBy: [{ field: { fieldPath: "created_at" }, direction: "DESCENDING" }],
    limit: 100,
  });

  const goals = docs
    .map(d => ({ id: d.__id, ...d, __id: undefined }))
    .filter(g => includeCompleted || !g.completed);

  return NextResponse.json({ ok: true, goals });
}

export async function POST(req: Request) {
  const auth = await getAuthInfo();
  if (!auth) return bad("unauthorized", 401);
  const { uid, token } = auth;
  const body = await req.json().catch(() => ({}));
  if (!body.title) return bad("title 필요");
  const id = await addDoc(token, `users/${uid}/goals_v2`, {
    title:      body.title,
    target:     body.target     ?? null,
    current:    body.current    ?? 0,
    type:       body.type       ?? "pnl",
    deadline:   body.deadline   ?? null,
    completed:  false,
    created_at: new Date(),
  });
  return NextResponse.json({ ok: true, id });
}

export async function PATCH(req: Request) {
  const auth = await getAuthInfo();
  if (!auth) return bad("unauthorized", 401);
  const { uid, token } = auth;
  const body = await req.json().catch(() => ({}));
  const { id, ...update } = body;
  if (!id) return bad("id 필요");
  await setDoc(token, `users/${uid}/goals_v2/${id}`, update, true);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const auth = await getAuthInfo();
  if (!auth) return bad("unauthorized", 401);
  const { uid, token } = auth;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return bad("id 필요");
  await deleteDoc(token, `users/${uid}/goals_v2/${id}`);
  return NextResponse.json({ ok: true });
}
