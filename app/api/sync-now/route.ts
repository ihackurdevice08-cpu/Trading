import { NextResponse } from "next/server";
import { getAuthInfo } from "@/lib/firebase/serverAuth";
import { queryDocs, listDocs, batchWrite, setDoc } from "@/lib/firebase/firestoreRest";
import { decryptText } from "@/lib/crypto/dec";
import { bitgetSign } from "@/lib/bitget/sign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function ok(d: any)  { return NextResponse.json({ ok: true, ...d }); }
function bad(m: string, s = 400) { return NextResponse.json({ ok: false, error: m }, { status: s }); }

const BITGET_BASE = "https://api.bitget.com";

async function bitgetGet(path: string, params: Record<string, string>, creds: { apiKey: string; secret: string; pass: string }) {
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

function parseSide(tradeSide: string, side: string): "long" | "short" {
  const ts = String(tradeSide || "").toLowerCase();
  if (ts.includes("long") || ts.includes("buy"))  return "long";
  if (ts.includes("short") || ts.includes("sell")) return "short";
  return String(side || "").toLowerCase() === "buy" ? "long" : "short";
}

function fillToRow(it: any, uid: string, accountId: string) {
  const tradeId = String(it.tradeId ?? "");
  const orderId = String(it.orderId ?? "");
  const ts      = Number(it.cTime   ?? 0);
  let fee = 0;
  if (Array.isArray(it.feeDetail)) {
    for (const fd of it.feeDetail) fee += Number(fd.totalFee ?? fd.fee ?? 0);
  } else if (it.fee != null) {
    fee = Number(it.fee);
  }
  return {
    id:           `${uid}_${accountId}_${tradeId || orderId || ts}`.replace(/:/g, "_"),
    account_id:   accountId,
    exchange:     "bitget",
    product_type: "usdt-futures",
    trade_id:     tradeId || null,
    order_id:     orderId || null,
    symbol:       String(it.symbol ?? ""),
    side:         it.side      ?? null,
    trade_side:   it.tradeSide ?? null,
    price:        it.price      != null ? Number(it.price)      : null,
    size:         it.baseVolume != null ? Number(it.baseVolume) : null,
    fee:          fee !== 0 ? fee : null,
    pnl:          it.profit     != null ? Number(it.profit)     : null,
    ts_ms:        ts || null,
    payload:      JSON.stringify(it),
  };
}

async function aggregateFills(
  token: string, uid: string, accountId: string, fromMs: number
): Promise<{ count: number; debug: any }> {

  const fills = await queryDocs(token, `users/${uid}/fills_raw`, {
    where: {
      compositeFilter: {
        op: "AND",
        filters: [
          { fieldFilter: { field: { fieldPath: "account_id" }, op: "EQUAL", value: { stringValue: accountId } } },
          { fieldFilter: { field: { fieldPath: "ts_ms" }, op: "GREATER_THAN_OR_EQUAL", value: { integerValue: String(fromMs) } } },
        ],
      },
    },
    orderBy: [{ field: { fieldPath: "ts_ms" }, direction: "ASCENDING" }],
    limit: 10000,
  });

  if (!fills.length) return { count: 0, debug: { reason: "fills 없음", fromMs } };

  const closeFills: any[] = [], feeFills: any[] = [], fundingFills: any[] = [];
  for (const f of fills) {
    const ts = Number(f.ts_ms || 0);
    if (ts > 0 && ts < fromMs) continue;
    const payload = typeof f.payload === "string" ? JSON.parse(f.payload) : (f.payload ?? {});
    const tradeSide = String(f.trade_side || payload?.tradeSide || "").toLowerCase();
    const size = Number(f.size || 0), price = Number(f.price || 0);
    if (tradeSide === "funding_fee" || tradeSide === "settle") {
      fundingFills.push({...f, payload});
    } else if ((tradeSide.includes("close") || tradeSide === "sell_single" || tradeSide === "buy_single") && size > 0 && price > 0) {
      // close_long, close_short, close, sell_single(롱청산), buy_single(숏청산) 모두 포함
      closeFills.push({...f, payload});
    } else if (tradeSide.includes("open") && size > 0 && price > 0) {
      feeFills.push({...f, payload});
    }
  }

  if (!closeFills.length && !fundingFills.length)
    return { count: 0, debug: { fills_total: fills.length, reason: "청산 fill 없음" } };

  const openFeeByOrder: Record<string, number> = {};
  for (const f of feeFills) {
    const key = String(f.order_id || f.trade_id || "");
    if (key) openFeeByOrder[key] = (openFeeByOrder[key] || 0) + Number(f.fee || 0);
  }

  const closeGroups: Record<string, any[]> = {};
  for (const f of closeFills) {
    const key = String(f.order_id || f.trade_id || f.__id || "");
    if (!closeGroups[key]) closeGroups[key] = [];
    closeGroups[key].push(f);
  }

  const rows: Array<{ path: string; data: Record<string, any> }> = [];

  for (const [orderId, group] of Object.entries(closeGroups)) {
    const first = group[0], last = group[group.length - 1];
    const closePnl = group.reduce((s, f) => s + (Number(f.pnl) || 0), 0);
    const closeFee = group.reduce((s, f) => s + (Number(f.fee) || 0), 0);
    const openFee  = openFeeByOrder[orderId] || 0;
    const totalSize = group.reduce((s, f) => s + (Number(f.size) || 0), 0);
    const avgPrice  = totalSize > 0
      ? group.reduce((s, f) => s + (Number(f.price) || 0) * (Number(f.size) || 0), 0) / totalSize : 0;
    const realPnl = closePnl + closeFee + openFee;
    const posSide = String(first.payload?.posSide || "").toLowerCase();
    const side = posSide === "long" || posSide === "short"
      ? posSide as "long"|"short"
      : parseSide(String(first.trade_side || ""), String(first.side || ""));
    const symbol = String(first.symbol || "").replace(/_UMCBL|_DMCBL|_CMCBL/g, "");
    rows.push({
      path: `users/${uid}/manual_trades/bitget_${accountId}_${orderId}`.replace(/:/g, "_"),
      data: {
        symbol, side,
        opened_at: new Date(Number(first.ts_ms)),
        closed_at: new Date(Number(last.ts_ms)),
        pnl:       Number(realPnl.toFixed(4)),
        tags:      ["bitget", "auto-sync"],
        notes:     JSON.stringify({ fills: group.length, size: Number(totalSize.toFixed(6)),
          close_fee: Number(closeFee.toFixed(4)), open_fee: Number(openFee.toFixed(4)),
          pnl_raw: Number(closePnl.toFixed(4)), avg_price: Number(avgPrice.toFixed(4)), account: accountId }),
        group_id:  null,
      },
    });
  }

  const fundingByDay: Record<string, { pnl: number; ts: number }> = {};
  for (const f of fundingFills) {
    const ts = Number(f.ts_ms || 0);
    const day = new Date(ts).toISOString().slice(0, 10);
    if (!fundingByDay[day]) fundingByDay[day] = { pnl: 0, ts };
    fundingByDay[day].pnl += Number(f.fee || f.pnl || 0);
  }
  for (const [day, { pnl, ts }] of Object.entries(fundingByDay)) {
    if (pnl === 0) continue;
    rows.push({
      path: `users/${uid}/manual_trades/bitget_${accountId}_funding_${day}`,
      data: {
        symbol: "FUNDING", side: "long",
        opened_at: new Date(ts), closed_at: new Date(ts),
        pnl: Number(pnl.toFixed(4)),
        tags: ["bitget", "funding-fee"],
        notes: JSON.stringify({ type: "funding_fee", day, account: accountId }),
        group_id: null,
      },
    });
  }

  if (!rows.length) return { count: 0, debug: { reason: "집계 결과 없음" } };

  // batchWrite로 일괄 저장
  const tradeWrites = rows.map(r => ({ type: "set" as const, path: r.path, data: r.data, merge: false }));
  for (let i = 0; i < tradeWrites.length; i += 500) {
    await batchWrite(token, tradeWrites.slice(i, i + 500));
  }

  return {
    count: rows.length,
    debug: { close_fills: closeFills.length, funding_fills: fundingFills.length,
      positions: Object.keys(closeGroups).length, sample_row: rows[0]?.data },
  };
}

export async function POST(req: Request) {
  const auth = await getAuthInfo();
  if (!auth) return bad("unauthorized", 401);
  const { uid, token } = auth;

  if (!process.env.ENCRYPTION_SECRET) return bad("ENCRYPTION_SECRET 환경변수 없음", 500);

  const body            = await req.json().catch(() => ({}));
  const targetAccountId = body?.account_id || null;
  const fromDate        = body?.from ? String(body.from) : "2018-01-01";
  const fromMs          = new Date(fromDate + "T00:00:00Z").getTime() - 9 * 3600_000;
  // Bitget API는 너무 오래된 startTime을 거부 → 최근 90일로 제한
  const bitgetFromMs    = Math.max(fromMs, Date.now() - 90 * 86400_000);
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

    const creds = { apiKey, secret, pass };
    let rawInserted = 0;
    const errors: string[] = [];

    try {
      let idLessThan = "", pageCount = 0;
      const MAX_PAGES = 20;

      while (pageCount < MAX_PAGES) {
        const params: Record<string, string> = {
          productType: "USDT-FUTURES", pageSize: "100", startTime: fromTimestamp,
        };
        if (idLessThan) params.idLessThan = idLessThan;

        const { ok: isOk, status: httpStatus, data: json } =
          await bitgetGet("/api/v2/mix/order/fill-history", params, creds);

        if (!isOk)              { errors.push(`HTTP ${httpStatus}: ${json?.msg||"unknown"}`); break; }
        if (json?.code !== "00000") { errors.push(`Bitget [${json?.code}]: ${json?.msg||"unknown"}`); break; }

        const list: any[] = json?.data?.fillList ?? json?.data?.list ?? [];
        if (!Array.isArray(list) || !list.length) break;

        // batchWrite로 일괄 저장 (timeout 방지)
        const fillWrites = list.map(it => {
          const row = fillToRow(it, uid, accId);
          return { type: "set" as const, path: `users/${uid}/fills_raw/${row.id}`, data: row, merge: false };
        });
        for (let i = 0; i < fillWrites.length; i += 500) {
          await batchWrite(token, fillWrites.slice(i, i + 500));
        }
        rawInserted += list.length;

        const endId = json?.data?.endId;
        if (!endId || list.length < 100) break;
        const minTs = Math.min(...list.map((x: any) => Number(x.cTime ?? Infinity)));
        if (minTs <= fromMs) break;
        idLessThan = String(endId);
        pageCount++;
      }
    } catch (e: any) {
      errors.push(`fetch 오류: ${e?.message}`);
    }

    let aggregated = 0, aggDebug: any = null;
    try {
      const ar = await aggregateFills(token, uid, accId, fromMs);
      aggregated = ar.count; aggDebug = ar.debug;
    } catch (e: any) {
      errors.push(`집계 오류: ${e?.message}`);
    }

    results.push({ id: accId, alias: acc.alias, rawInserted, aggregated,
      errors: errors.length ? errors : undefined, _aggDebug: aggDebug });
  }

  const totalRaw = results.reduce((s, r) => s + (r.rawInserted || 0), 0);
  const totalAgg = results.reduce((s, r) => s + (r.aggregated  || 0), 0);
  return ok({ note: `${fromDate} 이후 동기화 — fills ${totalRaw}건, trades ${totalAgg}건`, from: fromDate, results });
}
