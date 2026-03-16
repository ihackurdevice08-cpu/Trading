import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/firebase/serverAuth";
import { adminDb } from "@/lib/firebase/admin";
import { encryptText } from "@/lib/crypto/enc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ok(data: any) { return NextResponse.json({ ok: true, ...data }); }
function bad(msg: string, status = 400) { return NextResponse.json({ ok: false, error: msg }, { status }); }

export async function GET() {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const snap = await adminDb().collection("users").doc(uid).collection("exchange_accounts")
    .orderBy("created_at", "desc").get();

  const accounts = snap.docs.map(d => ({
    id: d.id,
    exchange: d.data().exchange,
    alias: d.data().alias,
    created_at: d.data().created_at?.toDate?.()?.toISOString() ?? null,
    updated_at: d.data().updated_at?.toDate?.()?.toISOString() ?? null,
  }));
  return ok({ accounts });
}

export async function POST(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const { exchange, alias, passphrase, apiKey: _ak, api_key: _ak2, apiSecret: _as, api_secret: _as2 } = body || {};
  const apiKey    = _ak    || _ak2;
  const apiSecret = _as    || _as2;

  if (!exchange || !alias || !apiKey || !apiSecret || !passphrase)
    return bad("exchange / alias / apiKey / apiSecret / passphrase 모두 필요합니다.");
  if (!process.env.ENCRYPTION_SECRET)
    return bad("서버 설정 오류: ENCRYPTION_SECRET 환경변수가 없습니다.", 500);

  const ref = adminDb().collection("users").doc(uid).collection("exchange_accounts").doc();
  const now = new Date();
  await ref.set({
    exchange: String(exchange), alias: String(alias),
    api_key_enc:    encryptText(String(apiKey)),
    api_secret_enc: encryptText(String(apiSecret)),
    passphrase_enc: encryptText(String(passphrase)),
    created_at: now, updated_at: now,
  });
  return ok({ account: { id: ref.id, exchange, alias } });
}

export async function DELETE(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return bad("id 필요");

  await adminDb().collection("users").doc(uid).collection("exchange_accounts").doc(id).delete();
  return ok({});
}
