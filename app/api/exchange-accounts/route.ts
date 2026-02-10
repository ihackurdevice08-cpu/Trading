import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { encryptText } from "@/lib/crypto/enc";

export async function GET(req: Request) {
  const sb = supabaseServer();

  // client가 보낸 user_id로만 조회(일단 간단 버전)
  // 다음 단계에서 supabase auth jwt 검증으로 강화 가능
  const url = new URL(req.url);
  const user_id = url.searchParams.get("user_id");
  if (!user_id) return NextResponse.json({ error: "missing user_id" }, { status: 400 });

  const { data, error } = await sb
    .from("exchange_accounts")
    .select("id, exchange, alias, created_at, updated_at")
    .eq("user_id", user_id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, accounts: data || [] });
}

export async function POST(req: Request) {
  const sb = supabaseServer();
  const body = await req.json().catch(() => ({}));

  const { user_id, exchange, alias, apiKey, apiSecret, passphrase } = body || {};
  if (!user_id || !exchange || !alias || !apiKey || !apiSecret || !passphrase) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const payload = {
    user_id,
    exchange,
    alias,
    api_key_enc: encryptText(String(apiKey)),
    api_secret_enc: encryptText(String(apiSecret)),
    passphrase_enc: encryptText(String(passphrase)),
  };

  const { data, error } = await sb.from("exchange_accounts").insert(payload).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: data.id });
}
