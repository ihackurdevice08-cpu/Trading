import { NextResponse } from "next/server";
import { getAuthInfo } from "@/lib/firebase/serverAuth";
import { getDoc, setDoc } from "@/lib/firebase/firestoreRest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(m: string, s = 400) { return NextResponse.json({ ok: false, error: m }, { status: s }); }

export async function GET() {
  const auth = await getAuthInfo();
  if (!auth) return bad("unauthorized", 401);
  const { uid, token } = auth;
  const settings = await getDoc(token, `users/${uid}/user_settings/default`) ?? {};
  return NextResponse.json({ ok: true, settings: { notion_token: settings.notion_token ?? null, notion_db: settings.notion_db ?? null } });
}

export async function POST(req: Request) {
  const auth = await getAuthInfo();
  if (!auth) return bad("unauthorized", 401);
  const { uid, token } = auth;
  const body = await req.json().catch(() => ({}));
  await setDoc(token, `users/${uid}/user_settings/default`, { notion_token: body.notion_token ?? null, notion_db: body.notion_db ?? null }, true);
  return NextResponse.json({ ok: true });
}
