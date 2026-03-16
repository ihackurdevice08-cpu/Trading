import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/firebase/serverAuth";
import { adminDb } from "@/lib/firebase/admin";
import { decryptText } from "@/lib/crypto/dec";
import { bitgetSign } from "@/lib/bitget/sign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ok(data: any)  { return NextResponse.json({ ok: true,  ...data }); }
function bad(msg: string, status = 400) { return NextResponse.json({ ok: false, error: msg }, { status }); }

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
  if (ts.includes("long"))  return "long";
  if (ts.includes("short")) return "short";
  if (ts.includes("buy"))   return "long";
  if (ts.includes("sell"))  return "short";
  const s = String(side || "").toLowerCase();
  return s === "buy" ? "long" : "short";
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
    id:           `${uid}:${accountId}:${tradeId || orderId || ts}`,
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
    payload:      it,
  };
}

async function aggregateFills(uid: string, accountId: string, fromMs: number): Promise<{ count: number; debug: any }> {
  const db = adminDb();
  const fillsSnap = await db.collection("users").doc(uid).collection("fills_raw")
    .where("account_id", "==", accountId)
    .where("ts_ms", ">=", fromMs)
    .orderBy("ts_ms", "asc")
    .get();

  if (fillsSnap.empty) return { count: 0, debug: { reason: "fills 없음", fromMs, accountId } };

  const fills = fillsSnap.docs.map(d => ({ ...d.data(), id: d.id }));

  const closeFills:   any[] = [];
  const feeFills:     any[] = [];
  const fundingFills: any[] = [];

  for (const f of fills) {
    const ts = Number(f.ts_ms || 0);
    if (ts > 0 && ts < fromMs) continue;
    const tradeSide = String(f.trade_side || f.payload?.tradeSide || "").toLowerCase();
    const size  = Number(f.size  || 0);
    const price = Number(f.price || 0);
    if (tradeSide === "funding_fee" || tradeSide === "settle") {
      fundingFills.push(f);
    } else if (tradeSide.includes("close") && size > 0 && price > 0) {
      closeFills.push(f);
    } else if (tradeSide.includes("open") && size > 0 && price > 0) {
      feeFills.push(f);
    }
  }

  if (closeFills.length === 0 && fundingFills.length === 0)
    return { count: 0, debug: { fills_total: fills.length, reason: "청산 fill 없음", fromMs } };

  const openFeeByOrder: Record<string, number> = {};
  for (const f of feeFills) {
    const key = String(f.order_id || f.trade_id || "");
    if (key) openFeeByOrder[key] = (openFeeByOrder[key] || 0) + Number(f.fee || 0);
  }

  const closeGroups: Record<string, any[]> = {};
  for (const f of closeFills) {
    const key = String(f.order_id || f.trade_id || f.id);
    if (!closeGroups[key]) closeGroups[key] = [];
    closeGroups[key].push(f);
  }

  const rows: any[] = [];

  for (const [orderId, group] of Object.entries(closeGroups)) {
    const first     = group[0];
    const last      = group[group.length - 1];
    const closePnl  = group.reduce((s, f) => s + (Number(f.pnl) || 0), 0);
    const closeFee  = group.reduce((s, f) => s + (Number(f.fee) || 0), 0);
    const openFee   = openFeeByOrder[orderId] || 0;
    const totalSize = group.reduce((s, f) => s + (Number(f.size) || 0), 0);
    const avgPrice  = totalSize > 0
      ? group.reduce((s, f) => s + (Number(f.price) || 0) * (Number(f.size) || 0), 0) / totalSize
      : 0;
    const realPnl = closePnl + closeFee + openFee;
    const posSide = String(first.payload?.posSide || "").toLowerCase();
    const side = posSide === "long" || posSide === "short"
      ? posSide as "long" | "short"
      : parseSide(String(first.trade_side || ""), String(first.side || ""));
    const symbol = String(first.symbol || "").replace(/_UMCBL|_DMCBL|_CMCBL/g, "");
    rows.push({
      docId:     `bitget:${accountId}:${orderId}`,
      symbol, side,
      opened_at: first.ts_ms ? new Date(Number(first.ts_ms)) : new Date(),
      closed_at: last.ts_ms  ? new Date(Number(last.ts_ms))  : null,
      pnl:       Number(realPnl.toFixed(4)),
      tags:      ["bitget", "auto-sync"],
      notes:     JSON.stringify({
        fills: group.length, size: Number(totalSize.toFixed(6)),
        close_fee: Number(closeFee.toFixed(4)), open_fee: Number(openFee.toFixed(4)),
        pnl_raw: Number(closePnl.toFixed(4)), avg_price: Number(avgPrice.toFixed(4)), account: accountId,
      }),
      group_id: null,
    });
  }

  const fundingByDay: Record<string, { pnl: number; ts: number }> = {};
  for (const f of fundingFills) {
    const ts  = Number(f.ts_ms || 0);
    const day = new Date(ts).toISOString().slice(0, 10);
    if (!fundingByDay[day]) fundingByDay[day] = { pnl: 0, ts };
    fundingByDay[day].pnl += Number(f.fee || f.pnl || 0);
  }
  for (const [day, { pnl, ts }] of Object.entries(fundingByDay)) {
    if (pnl === 0) continue;
    rows.push({
      docId:     `bitget:${accountId}:funding:${day}`,
      symbol:    "FUNDING", side: "long",
      opened_at: new Date(ts), closed_at: new Date(ts),
      pnl:       Number(pnl.toFixed(4)),
      tags:      ["bitget", "funding-fee"],
      notes:     JSON.stringify({ type: "funding_fee", day, account: accountId }),
      group_id:  null,
    });
  }

  if (rows.length === 0) return { count: 0, debug: { reason: "집계 결과 없음" } };

  // Firestore batch upsert (set merge)
  const BATCH_SIZE = 500;
  const tradesRef = db.collection("users").doc(uid).collection("manual_trades");
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = db.batch();
    for (const row of rows.slice(i, i + BATCH_SIZE)) {
      const { docId, ...data } = row;
      batch.set(tradesRef.doc(docId), data, { merge: true });
    }
    await batch.commit();
  }

  return {
    count: rows.length,
    debug: {
      close_fills: closeFills.length, open_fills: feeFills.length,
      funding_fills: fundingFills.length,
      positions: Object.keys(closeGroups).length,
      funding_rows: Object.keys(fundingByDay).length,
      sample_row: rows[0],
    }
  };
}

export async function POST(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);
  if (!process.env.ENCRYPTION_SECRET) return bad("ENCRYPTION_SECRET 환경변수 없음", 500);

  const body            = await req.json().catch(() => ({}));
  const targetAccountId = body?.account_id || null;
  const fromDate        = body?.from
    ? String(body.from)
    : new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10);
  const fromMs        = new Date(fromDate + "T00:00:00Z").getTime() - 9 * 3600_000;
  const fromTimestamp = String(fromMs);

  const db = adminDb();
  let accountsSnap = db.collection("users").doc(uid).collection("exchange_accounts")
    .where("exchange", "==", "bitget");

  const snap = await (targetAccountId
    ? db.collection("users").doc(uid).collection("exchange_accounts").where("exchange", "==", "bitget").get()
    : accountsSnap.get());

  const accounts = snap.docs
    .filter(d => !targetAccountId || d.id === targetAccountId)
    .map(d => ({ id: d.id, ...d.data() }));

  if (!accounts.length) return bad("등록된 Bitget 계정 없음. Settings에서 API Key를 등록하세요.", 404);

  const results: any[] = [];

  for (const acc of accounts) {
    let apiKey: string, secret: string, pass: string;
    try {
      apiKey = decryptText((acc as any).api_key_enc);
      secret = decryptText((acc as any).api_secret_enc);
      pass   = decryptText((acc as any).passphrase_enc);
    } catch {
      results.push({ id: acc.id, alias: (acc as any).alias, error: "복호화 실패" });
      continue;
    }

    const creds       = { apiKey, secret, pass };
    let   rawInserted = 0;
    const errors: string[] = [];
    let   debugSample: any = null;

    try {
      let idLessThan = "";
      let pageCount  = 0;
      const MAX_PAGES = 200;
      const fillsRef = db.collection("users").doc(uid).collection("fills_raw");

      while (pageCount < MAX_PAGES) {
        const params: Record<string, string> = {
          productType: "USDT-FUTURES", pageSize: "100", startTime: fromTimestamp,
        };
        if (idLessThan) params.idLessThan = idLessThan;

        const { ok: isOk, status: httpStatus, data: json } =
          await bitgetGet("/api/v2/mix/order/fill-history", params, creds);

        if (!isOk)             { errors.push(`HTTP ${httpStatus}: ${json?.msg || "unknown"}`); break; }
        if (json?.code !== "00000") { errors.push(`Bitget 오류 [${json?.code}]: ${json?.msg || "unknown"}`); break; }

        const list: any[] = json?.data?.fillList ?? json?.data?.list ?? [];
        if (!Array.isArray(list) || list.length === 0) break;

        if (pageCount === 0) debugSample = { fields: Object.keys(list[0]), first: list[0] };

        const BATCH = 500;
        for (let i = 0; i < list.length; i += BATCH) {
          const batch = db.batch();
          for (const it of list.slice(i, i + BATCH)) {
            const row = fillToRow(it, uid, acc.id);
            batch.set(fillsRef.doc(row.id), { ...row }, { merge: true });
          }
          await batch.commit();
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
      const ar = await aggregateFills(uid, acc.id, fromMs);
      aggregated = ar.count; aggDebug = ar.debug;
    } catch (e: any) {
      errors.push(`집계 오류: ${e?.message}`);
    }

    results.push({ id: acc.id, alias: (acc as any).alias, rawInserted, aggregated,
      errors: errors.length ? errors : undefined, _debug: debugSample, _aggDebug: aggDebug });
  }

  const totalRaw = results.reduce((s, r) => s + (r.rawInserted || 0), 0);
  const totalAgg = results.reduce((s, r) => s + (r.aggregated  || 0), 0);

  return ok({ note: `${fromDate} 이후 동기화 — fills ${totalRaw}건, trades ${totalAgg}건`, from: fromDate, results });
}
