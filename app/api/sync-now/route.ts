import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";
import { decryptText } from "@/lib/crypto/dec";
import { bitgetSign } from "@/lib/bitget/sign";

function supabaseAnon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anon, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  // 1) verify user via Bearer token (client sends supabase access_token)
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return NextResponse.json({ ok: false, error: "missing bearer token" }, { status: 401 });

  const sbAnon = supabaseAnon();
  const { data: u, error: uErr } = await sbAnon.auth.getUser(token);
  if (uErr || !u?.user?.id) return NextResponse.json({ ok: false, error: "invalid token" }, { status: 401 });

  const user_id = u.user.id;

  // 2) load exchange accounts (bitget only for now)
  const sb = supabaseServer();
  const { data: accounts, error: aErr } = await sb
    .from("exchange_accounts")
    .select("id, exchange, alias, api_key_enc, api_secret_enc, passphrase_enc")
    .eq("user_id", user_id)
    .eq("exchange", "bitget")
    .order("created_at", { ascending: false });

  if (aErr) return NextResponse.json({ ok: false, error: aErr.message }, { status: 500 });
  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ ok: true, note: "No Bitget accounts registered yet." });
  }

  // 3) fetch fill-history per account, store raw fills
  let totalUpserts = 0;

  for (const acc of accounts) {
    const apiKey = decryptText(acc.api_key_enc);
    const secret = decryptText(acc.api_secret_enc);
    const pass = decryptText(acc.passphrase_enc);

    const requestPath = "/api/v2/mix/order/fill-history";
    const query = new URLSearchParams({ productType: "usdt-futures" }).toString();
    const timestamp = String(Date.now());
    const sign = bitgetSign({
      timestamp,
      method: "GET",
      requestPath,
      queryString: query,
      secret,
    });

    const url = `https://api.bitget.com${requestPath}?${query}`;
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        "ACCESS-KEY": apiKey,
        "ACCESS-SIGN": sign,
        "ACCESS-PASSPHRASE": pass,
        "ACCESS-TIMESTAMP": timestamp,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    const json = await resp.json().catch(() => null);

    if (!resp.ok) {
      // store nothing, but continue other accounts
      continue;
    }

    const list = json?.data || json?.data?.list || [];
    if (!Array.isArray(list) || list.length === 0) continue;

    const rows = list.map((it: any) => {
      const tradeId = String(it.tradeId ?? it.fillId ?? it.id ?? "");
      const orderId = String(it.orderId ?? "");
      const symbol = String(it.symbol ?? it.symbolName ?? "");
      const ts = Number(it.cTime ?? it.fillTime ?? it.ts ?? it.uTime ?? 0) || 0;

      const id = `${user_id}:${acc.id}:${tradeId || orderId || ts}`;

      return {
        id,
        user_id,
        account_id: acc.id,
        exchange: "bitget",
        product_type: "usdt-futures",
        trade_id: tradeId || null,
        order_id: orderId || null,
        symbol: symbol || null,
        side: it.side ?? null,
        trade_side: it.tradeSide ?? null,
        price: it.price ? Number(it.price) : null,
        size: it.size ? Number(it.size) : null,
        fee: it.fee ? Number(it.fee) : null,
        pnl: it.pnl ? Number(it.pnl) : null,
        ts_ms: ts || null,
        payload: it,
      };
    });

    const { error: upErr } = await sb.from("fills_raw").upsert(rows, { onConflict: "id" });
    if (!upErr) totalUpserts += rows.length;
  }

  return NextResponse.json({ ok: true, note: `Sync done. upserted=${totalUpserts}` });
}
