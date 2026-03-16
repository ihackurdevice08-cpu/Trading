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
  const data       = snap.exists ? (snap.data() ?? {}) : {};
  const appearance     = data.appearance     ?? {};
  const sync_from_date = data.sync_from_date ?? "";

  return NextResponse.json({ ok: true, appearance, sync_from_date });
}

export async function POST(req: Request) {
  try {
    const uid = await getAuthUserId();
    if (!uid) return bad("unauthorized", 401);
    const body = await req.json().catch(() => ({}));

    const update: Record<string, any> = {};
    if ("appearance"     in body) update.appearance     = body.appearance;
    if ("sync_from_date" in body) update.sync_from_date = body.sync_from_date ?? "";

    // 하위 호환: body 자체가 appearance 객체로 넘어오는 경우
    if (!("appearance" in body) && !("sync_from_date" in body)) {
      update.appearance = body;
    }

    await adminDb().collection("users").doc(uid).collection("user_settings").doc("default")
      .set(update, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (e: any) { return bad(String(e?.message || e), 500); }
}
