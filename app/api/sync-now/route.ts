import { NextResponse } from "next/server";
import { getAuthInfo } from "@/lib/firebase/serverAuth";
import { listDocs, setDoc } from "@/lib/firebase/firestoreRest";
import { decryptText } from "@/lib/crypto/dec";
import { bitgetSign } from "@/lib/bitget/sign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function ok(d: any)  { return NextResponse.json({ ok: true, ...d }); }
function bad(m: string, s = 400) { return NextResponse.json({ ok: false, error: m }, { status: s }); }

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
      "ACCESS-KEY": creds.apiKey,
      "ACCESS-SIGN": sign,
      "ACCESS-PASSPHRASE": creds.pass,
      "ACCESS-TIMESTAMP": timestamp,
      "Content-Type": "application/json",
      "locale": "en-US",
    },
    cache: "no-store",
  });
  const j = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data: j };
}

function parseSide(tradeSide: string, side: string): "long" | "short" {
  const ts = String(tradeSide || "").toLowerCase();
  if (ts.includes("long"))  return "long";
  if (ts.includes("short")) return "short";
  if (ts.includes("buy"))   return "long";
  if (ts.includes("sell"))  return "short";
  return String(side || "").toLowerCase() === "buy" ? "long" : "short";
}

// Bitget fill 한 건을 정규화
function normalizeFill(it: any, accountId: string, uid: string) {
  const tradeId = String(it.tradeId  ?? "");
  const orderId = String(it.orderId  ?? "");
  const ts      = Number(it.cTime    ?? 0);

  let fee = 0;
  if (Array.isArray(it.feeDetail)) {
    for (const fd of it.feeDetail) fee += Number(fd.totalFee ?? fd.fee ?? 0);
  } else if (it.fee != null) {
    fee = Number(it.fee);
  }

  return {
    tradeId,
    orderId,
    ts,
    accountId,
    uid,
    symbol:    String(it.symbol ?? ""),
    side:      it.side      ?? null,
    tradeSide: String(it.tradeSide ?? it.trade_side ?? "").toLowerCase(),
    price:     it.price      != null ? Number(it.price)      : 0,
    size:      it.baseVolume != null ? Number(it.baseVolume) : 0,
    fee,
    pnl:       it.profit     != null ? Number(it.profit)     : 0,
    posSide:   String(it.posSide ?? "").toLowerCase(),
  };
}

// 메모리에서 fills → trades 집계
function aggregateInMemory(
  fills: ReturnType<typeof normalizeFill>[],
  accountId: string,
  uid: string
): Array<{ path: string; data: Record<string, any> }> {

  // tradeSide 분류
  const closeFills:   typeof fills = [];
  const feeFills:     typeof fills = [];
  const fundingFills: typeof fills = [];

  for (const f of fills) {
    const ts = f.tradeSide;
    if (ts === "funding_fee" || ts === "settle") {
      fundingFills.push(f);
    } else if (
      ts.includes("close") ||
      ts === "sell_single" ||
      ts === "buy_single"
    ) {
      closeFills.push(f);
    } else if (ts.includes("open")) {
      feeFills.push(f);
    } else {
      // tradeSide 값을 모를 때: pnl이 있으면 close, 없으면 open
      if (f.pnl !== 0) closeFills.push(f);
      else             feeFills.push(f);
    }
  }

  if (!closeFills.length && !fundingFills.length) return [];

  // open fill의 수수료를 orderId 기준으로 합산
  const openFeeByOrder: Record<string, number> = {};
  for (const f of feeFills) {
    const key = f.orderId || f.tradeId;
    if (key) openFeeByOrder[key] = (openFeeByOrder[key] || 0) + f.fee;
  }

  // close fill을 orderId 기준으로 그룹핑
  const closeGroups: Record<string, typeof fills> = {};
  for (const f of closeFills) {
    const key = f.orderId || f.tradeId || String(f.ts);
    if (!closeGroups[key]) closeGroups[key] = [];
    closeGroups[key].push(f);
  }

  const rows: Array<{ path: string; data: Record<string, any> }> = [];

  for (const [orderId, group] of Object.entries(closeGroups)) {
    const first = group[0];
    const last  = group[group.length - 1];

    const closePnl  = group.reduce((s, f) => s + f.pnl,  0);
    const closeFee  = group.reduce((s, f) => s + f.fee,  0);
    const openFee   = openFeeByOrder[orderId] || 0;
    const totalSize = group.reduce((s, f) => s + f.size, 0);
    const avgPrice  = totalSize > 0
      ? group.reduce((s, f) => s + f.price * f.size, 0) / totalSize : 0;

    const realPnl = closePnl + closeFee + openFee;

    const side = first.posSide === "long" || first.posSide === "short"
      ? first.posSide as "long" | "short"
      : parseSide(first.tradeSide, first.side ?? "");

    const symbol = first.symbol.replace(/_UMCBL|_DMCBL|_CMCBL/g, "");

    // path에 콜론 없이 저장
    const safeOrderId = orderId.replace(/:/g, "_");
    rows.push({
      path: `users/${uid}/manual_trades/bitget_${accountId}_${safeOrderId}`,
      data: {
        symbol,
        side,
        opened_at: new Date(Number(first.ts)),
        closed_at: new Date(Number(last.ts)),
        pnl:       Number(realPnl.toFixed(4)),
        tags:      ["bitget", "auto-sync"],
        notes:     JSON.stringify({
          fills: group.length,
          size:      Number(totalSize.toFixed(6)),
          close_fee: Number(closeFee.toFixed(4)),
          open_fee:  Number(openFee.toFixed(4)),
          pnl_raw:   Number(closePnl.toFixed(4)),
          avg_price: Number(avgPrice.toFixed(4)),
          account:   accountId,
        }),
        group_id: null,
      },
    });
  }

  // 펀딩피 일별 집계
  const fundingByDay: Record<string, { pnl: number; ts: number }> = {};
  for (const f of fundingFills) {
    const day = new Date(f.ts).toISOString().slice(0, 10);
    if (!fundingByDay[day]) fundingByDay[day] = { pnl: 0, ts: f.ts };
    fundingByDay[day].pnl += f.fee || f.pnl;
  }
  for (const [day, { pnl, ts }] of Object.entries(fundingByDay)) {
    if (pnl === 0) continue;
    rows.push({
      path: `users/${uid}/manual_trades/bitget_${accountId}_funding_${day}`,
      data: {
        symbol:    "FUNDING",
        side:      "long",
        opened_at: new Date(ts),
        closed_at: new Date(ts),
        pnl:       Number(pnl.toFixed(4)),
        tags:      ["bitget", "funding-fee"],
        notes:     JSON.stringify({ type: "funding_fee", day, account: accountId }),
        group_id:  null,
      },
    });
  }

  return rows;
}

export async function POST(req: Request) {
  const auth = await getAuthInfo();
  if (!auth) return bad("unauthorized", 401);
  const { uid, token } = auth;

  if (!process.env.ENCRYPTION_SECRET) return bad("ENCRYPTION_SECRET 환경변수 없음", 500);

  const body            = await req.json().catch(() => ({}));
  const targetAccountId = body?.account_id || null;
  const fromDate        = body?.from ? String(body.from) : "2026-02-24";
  const fromMs          = new Date(fromDate + "T00:00:00Z").getTime();
  // Bitget은 90일 이내만 지원
  const bitgetFromMs    = Math.max(fromMs, Date.now() - 89 * 86400_000);
  const fromTimestamp   = String(bitgetFromMs);

  const allAccounts = await listDocs(token, `users/${uid}/exchange_accounts`);
  const accounts = allAccounts
    .filter(a => a.exchange === "bitget")
    .filter(a => !targetAccountId || a.__id === targetAccountId);

  if (!accounts.length) return bad("등록된 Bitget 계정 없음. Settings에서 API Key를 등록하세요.", 404);

  const results: any[] = [];

  for (const acc of accounts) {
    const accId = acc.__id;
    let apiKey: string, secret: string, pass: string;
    try {
      apiKey = decryptText(acc.api_key_enc);
      secret = decryptText(acc.api_secret_enc);
      pass   = decryptText(acc.passphrase_enc);
    } catch {
      results.push({ id: accId, alias: acc.alias, error: "복호화 실패" });
      continue;
    }

    const creds   = { apiKey, secret, pass };
    const errors: string[] = [];

    // ── 1. Bitget API에서 모든 fills 수집 (메모리) ──────────────────
    const allFills: ReturnType<typeof normalizeFill>[] = [];

    try {
      let idLessThan = "";
      let pageCount  = 0;
      const MAX_PAGES = 20;

      while (pageCount < MAX_PAGES) {
        const params: Record<string, string> = {
          productType: "USDT-FUTURES",
          pageSize:    "100",
          startTime:   fromTimestamp,
        };
        if (idLessThan) params.idLessThan = idLessThan;

        const { ok: isOk, status: httpStatus, data: json } =
          await bitgetGet("/api/v2/mix/order/fill-history", params, creds);

        if (!isOk)              { errors.push(`HTTP ${httpStatus}: ${json?.msg || "unknown"}`); break; }
        if (json?.code !== "00000") { errors.push(`Bitget [${json?.code}]: ${json?.msg || "unknown"}`); break; }

        const list: any[] = json?.data?.fillList ?? json?.data?.list ?? [];
        if (!Array.isArray(list) || !list.length) break;

        for (const it of list) {
          const f = normalizeFill(it, accId, uid);
          allFills.push(f);
        }

        const endId = json?.data?.endId;
        if (!endId || list.length < 100) break;
        const minTs = Math.min(...list.map((x: any) => Number(x.cTime ?? Infinity)));
        if (minTs <= bitgetFromMs) break;
        idLessThan = String(endId);
        pageCount++;
      }
    } catch (e: any) {
      errors.push(`Bitget fetch 오류: ${e?.message}`);
    }

    // ── 2. 메모리에서 직접 집계 ──────────────────────────────────────
    const rows = aggregateInMemory(allFills, accId, uid);

    // ── 3. manual_trades에만 저장 (30건씩 병렬) ─────────────────────
    let saved = 0;
    const saveErrors: string[] = [];

    for (let i = 0; i < rows.length; i += 30) {
      const chunk = rows.slice(i, i + 30);
      const results_chunk = await Promise.allSettled(
        chunk.map(r => setDoc(token, r.path, r.data, false))
      );
      for (const res of results_chunk) {
        if (res.status === "fulfilled") saved++;
        else saveErrors.push(String((res as any).reason?.message ?? "unknown"));
      }
    }

    results.push({
      id: accId,
      alias: acc.alias,
      fills_fetched: allFills.length,
      trades_aggregated: rows.length,
      trades_saved: saved,
      errors: [...errors, ...saveErrors].length ? [...errors, ...saveErrors] : undefined,
      debug: {
        close_fills: allFills.filter(f =>
          f.tradeSide.includes("close") || f.tradeSide === "sell_single" || f.tradeSide === "buy_single" || (f.pnl !== 0 && !f.tradeSide.includes("open"))
        ).length,
        tradeSide_dist: allFills.reduce((m: Record<string,number>, f) => {
          m[f.tradeSide] = (m[f.tradeSide] || 0) + 1;
          return m;
        }, {}),
      },
    });
  }

  const totalFills  = results.reduce((s, r) => s + (r.fills_fetched       || 0), 0);
  const totalTrades = results.reduce((s, r) => s + (r.trades_saved        || 0), 0);

  return ok({
    note: `${fromDate} 이후 동기화 — fills ${totalFills}건 수집, trades ${totalTrades}건 저장`,
    from: fromDate,
    results,
  });
}

// rebuilt: 20260317153912
