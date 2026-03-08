import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/firebase/serverAuth";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(msg: string, status = 400) { return NextResponse.json({ ok: false, error: msg }, { status }); }

export async function GET() {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);
  const snap = await adminDb().collection("users").doc(uid).collection("user_settings").doc("default").get();
  return NextResponse.json({ ok: true, notion: snap.data()?.notion ?? {} });
}

export async function POST(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);
  const { token, database_id } = await req.json().catch(() => ({}));
  const update: any = {};
  if (token       !== undefined) update["notion.token"]       = token;
  if (database_id !== undefined) update["notion.database_id"] = database_id;
  await adminDb().collection("users").doc(uid).collection("user_settings").doc("default")
    .set(update, { merge: true });
  return NextResponse.json({ ok: true });
}
