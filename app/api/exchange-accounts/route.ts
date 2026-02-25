import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/supabase/serverAuth";
import { supabaseServer } from "@/lib/supabase/server";
import { encryptText } from "@/lib/crypto/enc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ok(data: any) { return NextResponse.json({ ok: true, ...data }); }
function bad(msg: string, status = 400) { return NextResponse.json({ ok: false, error: msg }, { status }); }

// 등록된 계정 목록 (민감 정보 제외)
export async function GET() {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const { data, error } = await supabaseServer()
    .from("exchange_accounts")
    .select("id, exchange, alias, created_at, updated_at")
    .eq("user_id", uid)
    .order("created_at", { ascending: false });

  if (error) return bad(error.message, 500);
  return ok({ accounts: data || [] });
}

// 계정 등록
export async function POST(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const { exchange, alias, apiKey, apiSecret, passphrase } = body || {};

  if (!exchange || !alias || !apiKey || !apiSecret || !passphrase) {
    return bad("exchange / alias / apiKey / apiSecret / passphrase 모두 필요합니다.");
  }

  // ENCRYPTION_SECRET 없으면 명확한 에러
  if (!process.env.ENCRYPTION_SECRET) {
    return bad("서버 설정 오류: ENCRYPTION_SECRET 환경변수가 없습니다. Vercel 환경변수에 추가하세요.", 500);
  }

  const payload = {
    user_id: uid,
    exchange: String(exchange),
    alias: String(alias),
    api_key_enc: encryptText(String(apiKey)),
    api_secret_enc: encryptText(String(apiSecret)),
    passphrase_enc: encryptText(String(passphrase)),
  };

  const { data, error } = await supabaseServer()
    .from("exchange_accounts")
    .insert(payload)
    .select("id, exchange, alias, created_at")
    .single();

  if (error) return bad(error.message, 500);
  return ok({ account: data });
}

// 계정 삭제
export async function DELETE(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return bad("id 필요");

  const { error } = await supabaseServer()
    .from("exchange_accounts")
    .delete()
    .eq("id", id)
    .eq("user_id", uid); // 본인 계정만 삭제 가능

  if (error) return bad(error.message, 500);
  return ok({});
}
