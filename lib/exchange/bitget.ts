/**
 * lib/exchange/bitget.ts
 * Bitget 실시간 선물 지갑 총 잔고 조회
 * - USDT-Futures 계정의 usdtEquity(총 자산 = 마진 + 미실현 손익 반영 총액)
 * - 여러 계정이 있으면 합산
 */
import { listDocs } from "@/lib/firebase/firestoreRest";
import { decryptText } from "@/lib/crypto/dec";
import { bitgetSign } from "@/lib/bitget/sign";

const BITGET_BASE = "https://api.bitget.com";

interface BitgetAccountAsset {
  marginCoin:    string;
  usdtEquity:    string; // 총 자산 (USDT 환산, 미실현 포함)
  available:     string;
  crossedRiskRate: string;
}

async function bitgetGet(
  path: string,
  params: Record<string, string>,
  creds: { apiKey: string; secret: string; pass: string }
): Promise<any | null> {
  const query     = new URLSearchParams(params).toString();
  const timestamp = String(Date.now());
  const sign      = bitgetSign({
    timestamp, method: "GET", requestPath: path,
    queryString: query, secret: creds.secret,
  });

  const ctrl = new AbortController();
  const t    = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(`${BITGET_BASE}${path}?${query}`, {
      method: "GET",
      signal: ctrl.signal,
      headers: {
        "ACCESS-KEY":        creds.apiKey,
        "ACCESS-SIGN":       sign,
        "ACCESS-PASSPHRASE": creds.pass,
        "ACCESS-TIMESTAMP":  timestamp,
        "Content-Type":      "application/json",
        "locale":            "en-US",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json().catch(() => null);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * 해당 유저의 모든 Bitget 계정 USDT-Futures 총 잔고 합산
 * @returns USDT 총 잔고 (usdtEquity 합산) 또는 null (계정 없거나 API 실패)
 */
export async function fetchBitgetEquity(
  uid: string,
  firestoreToken: string
): Promise<number | null> {
  const accounts = await listDocs(firestoreToken, `users/${uid}/exchange_accounts`);
  const bitgetAccs = accounts.filter((a: any) => a.exchange === "bitget");
  if (!bitgetAccs.length) return null;

  let total = 0;
  let found = false;

  await Promise.allSettled(bitgetAccs.map(async (acc: any) => {
    let apiKey: string, secret: string, pass: string;
    try {
      apiKey = decryptText(acc.api_key_enc);
      secret = decryptText(acc.api_secret_enc);
      pass   = decryptText(acc.passphrase_enc);
    } catch {
      return;
    }

    const creds = { apiKey, secret, pass };

    // USDT-Futures 계좌 자산 조회
    const j = await bitgetGet(
      "/api/v2/mix/account/accounts",
      { productType: "USDT-FUTURES" },
      creds
    );

    const list: BitgetAccountAsset[] = j?.data ?? [];
    for (const item of list) {
      const eq = Number(item.usdtEquity ?? 0);
      if (Number.isFinite(eq) && eq >= 0) {
        total += eq;
        found = true;
      }
    }
  }));

  return found ? Number(total.toFixed(4)) : null;
}
