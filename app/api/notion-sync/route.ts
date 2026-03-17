import { NextResponse } from "next/server";
import { getAuthInfo } from "@/lib/firebase/serverAuth";
import { getDoc } from "@/lib/firebase/firestoreRest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(m: string, s = 400) { return NextResponse.json({ ok: false, error: m }, { status: s }); }

export async function POST() {
  const auth = await getAuthInfo();
  if (!auth) return bad("unauthorized", 401);
  const { uid, token } = auth;
  const settings = await getDoc(token, `users/${uid}/user_settings/default`) ?? {};
  if (!settings.notion_token || !settings.notion_db) return bad("Notion 설정 없음");
  return NextResponse.json({ ok: false, error: "Notion 동기화는 현재 비활성화되어 있습니다" });
}
