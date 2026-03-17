import { NextResponse } from "next/server";
import { getAuthInfo } from "@/lib/firebase/serverAuth";
import { queryDocs, addDoc, setDoc } from "@/lib/firebase/firestoreRest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(m: string, s = 400) { return NextResponse.json({ ok: false, error: m }, { status: s }); }

export async function GET() {
  const auth = await getAuthInfo();
  if (!auth) return bad("unauthorized", 401);
  const { uid, token } = auth;
  const docs = await queryDocs(token, `users/${uid}/risk_cycles`, {
    orderBy: [{ field: { fieldPath: "started_at" }, direction: "DESCENDING" }],
    limit: 10,
  });
  return NextResponse.json({ ok: true, cycles: docs.map(d => ({ id: d.__id, ...d, __id: undefined })) });
}

export async function POST(req: Request) {
  const auth = await getAuthInfo();
  if (!auth) return bad("unauthorized", 401);
  const { uid, token } = auth;
  const body = await req.json().catch(() => ({}));
  const id = await addDoc(token, `users/${uid}/risk_cycles`, {
    started_at: new Date(),
    note: body.note ?? null,
  });
  // risk_settings의 pnl_from도 오늘로 업데이트
  await setDoc(token, `users/${uid}/risk_settings/default`, { pnl_from: new Date().toISOString().slice(0, 10) }, true);
  return NextResponse.json({ ok: true, id });
}
