/**
 * /api/cron/sync-recent
 * 
 * Vercel Cron: 매 1분마다 실행
 * 최근 15분 fills를 가져와서 새 거래 upsert
 * 
 * 빠르게 동작하도록 설계:
 * - startTime = 15분 전 (1~2페이지면 충분)
 * - 모든 등록된 Bitget 계정에 적용
 */

import { NextResponse } from "next/server";
import { listDocs, setDoc, queryDocs } from "@/lib/firebase/firestoreRest";
import { decryptText } from "@/lib/crypto/dec";
import { bitgetSign } from "@/lib/bitget/sign";
import { getAuthInfo } from "@/lib/firebase/serverAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BITGET_BASE = "https://api.bitget.com";

async function bitgetGet(
  path: string,
  params: Record<string, string>,
  creds: { apiKey: string; secret: string; pass: string }
) {
  const query     = new URLSearchParams(params).toString();
  const timestamp = String(Date.now());
  const sign      = bitgetSign({ timestamp, method: "GET", requestPath: path, queryString: query, secret: creds.secret });
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

function getFee(it: any): number {
  if (Array.isArray(it.feeDetail))
    return it.feeDetail.reduce((s: number, fd: any) => s + Number(fd.totalFee ?? fd.fee ?? 0), 0);
  return Number(it.fee ?? 0);
}

function parseSide(tradeSide: string, side: string): "long" | "short" {
  const ts = tradeSide.toLowerCase();
  if (ts.includes("long"))  return "long";
  if (ts.includes("short")) return "short";
  if (ts.includes("buy"))   return "long";
  if (ts.includes("sell"))  return "short";
  return side.toLowerCase() === "buy" ? "long" : "short";
}

// close fill만 orderId 기준 집계
function aggregateCloseFills(
  fills: any[],
  uid: string,
  accId: string,
  fromMs: number
): Array<{ path: string; data: Record<string, any> }> {
  const closeGroups: Record<string, any[]> = {};

  for (const it of fills) {
    const ts = String(it.tradeSide ?? "").toLowerCase();
    const isClose = ts === "close" || ts.includes("close");
    const isOneway = ts === "sell_single" || ts === "buy_single";
    if (!isClose && !isOneway) continue;
    if (isOneway && Number(it.profit ?? 0) === 0) continue;

    const key = String(it.orderId || it.tradeId || it.cTime);
    if (!closeGroups[key]) closeGroups[key] = [];
    closeGroups[key].push(it);
  }

  const rows: Array<{ path: string; data: Record<string, any> }> = [];

  for (const [orderId, group] of Object.entries(closeGroups)) {
    group.sort((a: any, b: any) => Number(a.cTime) - Number(b.cTime));
    const first = group[0];
    const last  = group[group.length - 1];
    if (Number(last.cTime) < fromMs) continue;

    const closePnl  = group.reduce((s: number, f: any) => s + Number(f.profit ?? 0), 0);
    const closeFee  = group.reduce((s: number, f: any) => s + getFee(f), 0);
    const totalSize = group.reduce((s: number, f: any) => s + Number(f.baseVolume ?? f.size ?? 0), 0);
    const avgPrice  = totalSize > 0 ? group.reduce((s: number, f: any) => s + Number(f.price ?? 0) * Number(f.baseVolume ?? f.size ?? 0), 0) / totalSize : 0;
    const realPnl   = closePnl + closeFee;
    const symbol    = String(first.symbol ?? "").replace(/_UMCBL|_DMCBL|_CMCBL/g, "");
    const safeId    = orderId.replace(/[:/]/g, "_");

    rows.push({
      path: `users/${uid}/manual_trades/bitget_${accId}_${safeId}`,
      data: {
        symbol,
        side:      parseSide(String(first.tradeSide ?? ""), String(first.side ?? "")),
        opened_at: new Date(Number(first.cTime)),
        closed_at: new Date(Number(last.cTime)),
        pnl:       Number(realPnl.toFixed(4)),
        tags:      ["bitget", "auto-sync"],
        notes:     JSON.stringify({
          fills: group.length,
          size:  Number(totalSize.toFixed(6)),
          close_fee: Number(closeFee.toFixed(4)),
          pnl_raw:   Number(closePnl.toFixed(4)),
          avg_price: Number(avgPrice.toFixed(4)),
          account: accId,
        }),
        group_id: null,
      },
    });
  }

  return rows;
}

export async function GET(request: Request) {
  // Vercel Cron 인증
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (!process.env.ENCRYPTION_SECRET)
    return NextResponse.json({ ok: false, error: "ENCRYPTION_SECRET 없음" });

  // 모든 유저의 exchange_accounts를 순회하는 것은 불가능
  // → 이 cron은 단일 고정 계정 방식으로 동작
  // → Firebase에서 특정 uid의 accounts 조회
  // → CRON_UID 환경변수로 uid 지정

  const uid = process.env.CRON_UID;
  if (!uid) return NextResponse.json({ ok: false, error: "CRON_UID 환경변수 없음" });

  // Firestore REST 호출에는 idToken이 필요한데
  // Cron은 유저 세션이 없음 → Firebase Admin SDK 없이 서비스 계정 토큰 필요
  // → 해결: CRON_FIREBASE_TOKEN 환경변수에 장기 서비스 계정 토큰 사용
  //   또는 Firebase Admin SDK로 커스텀 토큰 생성
  //
  // 더 간단한 방법: exchange_accounts를 환경변수에 저장하지 않고
  // 별도의 "cron용 Firestore 접근" 구조 사용
  //
  // 가장 현실적인 방법: Firebase Service Account로 access_token 획득

  // Google OAuth2 service account token 획득
  let firestoreToken: string;
  try {
    firestoreToken = await getServiceAccountToken();
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: "토큰 획득 실패: " + e?.message });
  }

  const fromMs = Date.now() - 15 * 60 * 1000; // 15분 전

  const accounts = await listDocs(firestoreToken, `users/${uid}/exchange_accounts`);
  const bitgetAccs = accounts.filter((a: any) => a.exchange === "bitget");

  if (!bitgetAccs.length)
    return NextResponse.json({ ok: true, note: "Bitget 계정 없음" });

  const results: any[] = [];

  for (const acc of bitgetAccs) {
    const accId = acc.__id;
    let apiKey: string, secret: string, pass: string;
    try {
      apiKey = decryptText(acc.api_key_enc);
      secret = decryptText(acc.api_secret_enc);
      pass   = decryptText(acc.passphrase_enc);
    } catch { continue; }

    const creds = { apiKey, secret, pass };
    const allFills: any[] = [];

    // 최근 15분 fills — 보통 1~3페이지면 충분
    let idLessThan = "";
    for (let page = 0; page < 5; page++) {
      const params: Record<string, string> = {
        productType: "USDT-FUTURES",
        pageSize: "100",
        startTime: String(fromMs),
      };
      if (idLessThan) params.idLessThan = idLessThan;

      const { ok, data } = await bitgetGet("/api/v2/mix/order/fill-history", params, creds);
      if (!ok || data?.code !== "00000") break;

      const list = data?.data?.fillList ?? data?.data?.list ?? [];
      if (!list.length) break;

      for (const it of list) allFills.push(it);

      const endId = data?.data?.endId;
      if (!endId || list.length < 100) break;

      const minTs = Math.min(...list.map((x: any) => Number(x.cTime)));
      if (minTs <= fromMs) break;

      idLessThan = String(endId);
    }

    const rows = aggregateCloseFills(allFills, uid, accId, fromMs);

    const settles = await Promise.allSettled(
      rows.map(r => setDoc(firestoreToken, r.path, r.data, false))
    );

    const saved = settles.filter(r => r.status === "fulfilled").length;
    results.push({ accId, fills: allFills.length, trades: rows.length, saved });
  }

  return NextResponse.json({ ok: true, results, ts: new Date().toISOString() });
}

// Google Service Account → access_token
async function getServiceAccountToken(): Promise<string> {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (!clientEmail || !privateKeyRaw)
    throw new Error("FIREBASE_CLIENT_EMAIL 또는 FIREBASE_PRIVATE_KEY 없음");

  let privateKey = privateKeyRaw.replace(/^["']|["']$/g, "");
  if (!privateKey.includes("\n")) privateKey = privateKey.replace(/\\n/g, "\n");

  // JWT 생성 (RS256)
  const now   = Math.floor(Date.now() / 1000);
  const claim = {
    iss:   clientEmail,
    scope: "https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/cloud-platform",
    aud:   "https://oauth2.googleapis.com/token",
    iat:   now,
    exp:   now + 3600,
  };

  const header  = { alg: "RS256", typ: "JWT" };
  const b64url  = (obj: any) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const signing = `${b64url(header)}.${b64url(claim)}`;

  // Node.js crypto로 RS256 서명
  const { createSign } = await import("crypto");
  const signer = createSign("RSA-SHA256");
  signer.update(signing);
  const sig = signer.sign(privateKey, "base64url");

  const jwt = `${signing}.${sig}`;

  // access_token 교환
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion:  jwt,
    }),
  });

  const j = await resp.json().catch(() => null);
  if (!j?.access_token) throw new Error(`토큰 교환 실패: ${JSON.stringify(j)}`);
  return j.access_token;
}
