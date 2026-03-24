import { NextResponse } from "next/server";
import { getAuthInfo } from "@/lib/firebase/serverAuth";
import { listDocs, queryDocs } from "@/lib/firebase/firestoreRest";
import { decryptText } from "@/lib/crypto/dec";
import { bitgetSign } from "@/lib/bitget/sign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BITGET_BASE = "https://api.bitget.com";

async function bitgetGet(path: string, params: Record<string, string>, creds: any) {
  const query = new URLSearchParams(params).toString();
  const timestamp = String(Date.now());
  const sign = bitgetSign({ timestamp, method: "GET", requestPath: path, queryString: query, secret: creds.secret });
  const res = await fetch(`${BITGET_BASE}${path}?${query}`, {
    method: "GET",
    headers: {
      "ACCESS-KEY": creds.apiKey, "ACCESS-SIGN": sign,
      "ACCESS-PASSPHRASE": creds.pass, "ACCESS-TIMESTAMP": timestamp,
      "Content-Type": "application/json", "locale": "en-US",
    },
    cache: "no-store",
  });
  const j = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data: j };
}

export async function GET(req: Request) {
  const auth = await getAuthInfo();
  if (!auth) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { uid, token } = auth;

  // 1. Firebase에 저장된 거래 최신 / 가장 오래된 / 총 갯수
  const [newestDocs, oldestDocs] = await Promise.all([
    queryDocs(token, `users/${uid}/manual_trades`, {
      orderBy: [{ field: { fieldPath: "opened_at" }, direction: "DESCENDING" }],
      limit: 5,
    }),
    queryDocs(token, `users/${uid}/manual_trades`, {
      orderBy: [{ field: { fieldPath: "opened_at" }, direction: "ASCENDING" }],
      limit: 5,
    }),
  ]);

  const toIso = (v: any) => v instanceof Date ? v.toISOString() : String(v ?? "");

  const db = {
    newest_5: newestDocs.map(d => ({ id: d.__id, symbol: d.symbol, pnl: d.pnl, opened_at: toIso(d.opened_at) })),
    oldest_5: oldestDocs.map(d => ({ id: d.__id, symbol: d.symbol, pnl: d.pnl, opened_at: toIso(d.opened_at) })),
  };

  // 2. Bitget API — 3월 17일 이후 fills 실제 확인
  const accounts = await listDocs(token, `users/${uid}/exchange_accounts`);
  const acc = accounts.find((a: any) => a.exchange === "bitget");
  if (!acc) return NextResponse.json({ ok: true, db, bitget: { error: "계정 없음" } });

  let apiKey: string, secret: string, pass: string;
  try {
    apiKey = decryptText(acc.api_key_enc);
    secret = decryptText(acc.api_secret_enc);
    pass   = decryptText(acc.passphrase_enc);
  } catch (e: any) {
    return NextResponse.json({ ok: true, db, bitget: { error: "복호화 실패: " + e?.message } });
  }

  const creds = { apiKey, secret, pass };

  // 3월 17일부터 가져오기
  const startMs = new Date("2026-03-17T00:00:00Z").getTime();
  const { ok: bOk, status: bStatus, data: bData } =
    await bitgetGet("/api/v2/mix/order/fill-history", {
      productType: "USDT-FUTURES",
      pageSize: "100",
      startTime: String(startMs),
    }, creds);

  const list = bData?.data?.fillList ?? bData?.data?.list ?? [];
  const dist: Record<string, number> = {};
  for (const it of list) {
    dist[String(it.tradeSide ?? "?")] = (dist[String(it.tradeSide ?? "?")] || 0) + 1;
  }

  const bitget = {
    http_ok: bOk,
    http_status: bStatus,
    code: bData?.code,
    msg: bData?.msg,
    endId: bData?.data?.endId,
    fill_count: list.length,
    tradeSide_dist: dist,
    sample_fills: list.slice(0, 10).map((it: any) => ({
      tradeId: it.tradeId,
      orderId: it.orderId,
      symbol: it.symbol,
      tradeSide: it.tradeSide,
      profit: it.profit,
      cTime: it.cTime,
      cTime_date: it.cTime ? new Date(Number(it.cTime)).toISOString().slice(0, 10) : null,
    })),
  };

  return NextResponse.json({ ok: true, db, bitget });
}
