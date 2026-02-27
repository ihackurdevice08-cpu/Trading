import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/supabase/serverAuth";
import { supabaseServer } from "@/lib/supabase/server";
import { decryptText } from "@/lib/crypto/dec";
import { bitgetSign } from "@/lib/bitget/sign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ok(data: any)  { return NextResponse.json({ ok: true,  ...data }); }
function bad(msg: string, status = 400) { return NextResponse.json({ ok: false, error: msg }, { status }); }

const BITGET_BASE = "https://api.bitget.com";

async function bitgetGet(
  path: string,
  params: Record<string, string>,
  creds: { apiKey: string; secret: string; pass: string }
) {
  const query     = new URLSearchParams(params).toString();
  const timestamp = String(Date.now());
  const sign      = bitgetSign({
    timestamp, method: "GET", requestPath: path,
    queryString: query, secret: creds.secret,
  });
  const res = await fetch(`${BITGET_BASE}${path}?${query}`, {
    method: "GET",
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
  const j = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data: j };
}

function parseSide(tradeSide: string, side: string): "long" | "short" {
  const ts = String(tradeSide || "").toLowerCase();
  const s  = String(side      || "").toLowerCase();
  // hedge mode: open_long, close_long, open_short, close_short
  if (ts.includes("long"))  return "long";
  if (ts.includes("short")) return "short";
  // one-way mode: buy_single, sell_single
  if (ts.includes("buy"))   return "long";
  if (ts.includes("sell"))  return "short";
  // Bitget one-way: trade_side = "open"/"close", side = "buy"/"sell"
  // open + buy = 롱 진입, open + sell = 숏 진입
  // close + buy = 숏 청산(롱), close + sell = 롱 청산(숏)  ← 실제 포지션 방향
  // side만으로는 방향 확실하지 않으므로 payload.posSide 우선 사용
  return s === "buy" ? "long" : "short";
}

// fills_raw 실제 컬럼에 맞춰 row 생성
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
    user_id:      uid,
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

// fills_raw → manual_trades 집계
// manual_trades 실제 컬럼: id, user_id, symbol, side, opened_at, closed_at, pnl, tags, notes
async function aggregateFills(uid: string, accountId: string, fromMs: number): Promise<{ count: number; debug: any }> {
  const sb = supabaseServer();

  // ts_ms가 text 타입일 수 있어 JS에서 필터링
  const { data: fills, error: fErr } = await sb
    .from("fills_raw")
    .select("id, order_id, trade_id, symbol, side, trade_side, price, size, fee, pnl, ts_ms, payload")
    .eq("user_id", uid)
    .eq("account_id", accountId)
    .order("ts_ms", { ascending: true });

  if (fErr) throw new Error("fills_raw 조회 실패: " + fErr.message);
  if (!fills || fills.length === 0) return { count: 0, debug: { reason: "fills 없음 (account_id 불일치?)", fromMs, accountId } };

  // 실제 거래 fill만 필터 (펀딩피/리베이트/이자 제외)
  // 실제 거래: size > 0 이고 trade_side가 open/close/open_long 등
  // 펀딩피: symbol 없음 or trade_side = "funding_fee" or size = 0 or price = 0
  const tradeFills = fills.filter(f => {
    const ts = Number(f.ts_ms);
    if (ts > 0 && ts < fromMs) return false;              // 날짜 필터
    const size     = Number(f.size);
    const price    = Number(f.price);
    const tradeSide = String(f.trade_side || f.payload?.tradeSide || "").toLowerCase();
    if (size  <= 0) return false;                          // 펀딩피/리베이트
    if (price <= 0) return false;                          // 가격 없는 행
    if (tradeSide === "funding_fee") return false;
    if (tradeSide === "settle")      return false;
    // ★ close fill만 집계 (open = 진입, close = 청산)
    const isClose = tradeSide.includes("close");
    if (!isClose) return false;
    return true;
  });

  if (tradeFills.length === 0) return { count: 0, debug: {
    fills_total: fills.length,
    reason: "실제 거래 fill 없음 (전부 펀딩피/리베이트?)",
    sample: tradeFills[0] || fills[0],
    fromMs,
  }};

  // order_id 기준 그룹핑
  const groups: Record<string, any[]> = {};
  for (const f of tradeFills) {
    const key = String(f.order_id || f.trade_id || f.id);
    if (!groups[key]) groups[key] = [];
    groups[key].push(f);
  }

  const rows: any[] = [];
  for (const [orderId, group] of Object.entries(groups)) {
    const first = group[0];
    const last  = group[group.length - 1];

    const totalPnl  = group.reduce((s, f) => s + (Number(f.pnl)  || 0), 0);
    const totalSize = group.reduce((s, f) => s + (Number(f.size) || 0), 0);
    const totalFee  = group.reduce((s, f) => s + (Number(f.fee)  || 0), 0);
    const avgPrice  = totalSize > 0
      ? group.reduce((s, f) => s + (Number(f.price) || 0) * (Number(f.size) || 0), 0) / totalSize
      : 0;

    // posSide 있으면 우선 사용 (long/short 명시)
    const posSide = String(first.payload?.posSide || "").toLowerCase();
    const side    = posSide === "long" || posSide === "short"
      ? posSide as "long" | "short"
      : parseSide(String(first.trade_side || ""), String(first.side || ""));
    const symbol = String(first.symbol || "").replace(/_UMCBL|_DMCBL|_CMCBL/g, "");

    rows.push({
      id:        `bitget:${accountId}:${orderId}`,
      user_id:   uid,
      symbol,
      side,
      opened_at: first.ts_ms ? new Date(Number(first.ts_ms)).toISOString() : new Date().toISOString(),
      closed_at: last.ts_ms  ? new Date(Number(last.ts_ms)).toISOString()  : null,
      pnl:       Number(totalPnl.toFixed(4)),
      tags:      ["bitget", "auto-sync"],
      notes:     JSON.stringify({
        fills:     group.length,
        size:      Number(totalSize.toFixed(6)),
        fee:       Number(totalFee.toFixed(4)),
        avg_price: Number(avgPrice.toFixed(4)),
        account:   accountId,
      }),
      group_id:  null,
    });
  }

  if (rows.length === 0) return { count: 0, debug: {
    fills_total: fills.length, trade_fills: tradeFills.length,
    sample: tradeFills[0] || fills[0],
    reason: "rows 없음 — order_id/trade_id 확인 필요"
  }};

  const { error } = await sb.from("manual_trades").upsert(rows, { onConflict: "id" });
  if (error) throw new Error("manual_trades upsert 실패: " + error.message);
  return { count: rows.length, debug: { fills_count: fills.length, groups: Object.keys(groups).length, sample_row: rows[0] } };
}

export async function POST(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);
  if (!process.env.ENCRYPTION_SECRET) return bad("ENCRYPTION_SECRET 환경변수 없음", 500);

  const body            = await req.json().catch(() => ({}));
  const targetAccountId = body?.account_id || null;
  const fromDate        = body?.from
    ? String(body.from)
    : new Date(Date.now() - 730 * 86400_000).toISOString().slice(0, 10);
  const fromMs          = new Date(fromDate + "T00:00:00Z").getTime();
  const fromTimestamp   = String(fromMs);

  const sb = supabaseServer();

  let q = sb
    .from("exchange_accounts")
    .select("id, exchange, alias, api_key_enc, api_secret_enc, passphrase_enc")
    .eq("user_id", uid)
    .eq("exchange", "bitget");
  if (targetAccountId) q = q.eq("id", targetAccountId);

  const { data: accounts, error: aErr } = await q;
  if (aErr)              return bad(aErr.message, 500);
  if (!accounts?.length) return bad("등록된 Bitget 계정 없음. Settings에서 API Key를 등록하세요.", 404);

  const results: any[] = [];

  for (const acc of accounts) {
    let apiKey: string, secret: string, pass: string;
    try {
      apiKey = decryptText(acc.api_key_enc);
      secret = decryptText(acc.api_secret_enc);
      pass   = decryptText(acc.passphrase_enc);
    } catch {
      results.push({ id: acc.id, alias: acc.alias, error: "복호화 실패" });
      continue;
    }

    const creds        = { apiKey, secret, pass };
    let   rawInserted  = 0;
    const errors: string[] = [];

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

        if (!isOk) { errors.push(`HTTP ${httpStatus}: ${json?.msg || "unknown"}`); break; }
        if (json?.code !== "00000") { errors.push(`Bitget 오류 [${json?.code}]: ${json?.msg || "unknown"}`); break; }

        const list: any[] = json?.data?.fillList ?? json?.data?.list ?? [];
        if (!Array.isArray(list) || list.length === 0) break;

        const rows = list.map(it => fillToRow(it, uid, acc.id));
        const { error: upErr } = await sb.from("fills_raw").upsert(rows, { onConflict: "id" });
        if (upErr) { errors.push(`fills_raw 저장 실패: ${upErr.message}`); break; }
        rawInserted += rows.length;

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

    let aggregated = 0;
    try {
      const ar = await aggregateFills(uid, acc.id, fromMs);
      aggregated = ar.count;
    } catch (e: any) {
      errors.push(`집계 오류: ${e?.message}`);
    }

    results.push({
      id: acc.id, alias: acc.alias,
      rawInserted, aggregated,
      errors: errors.length ? errors : undefined,
    });
  }

  const totalRaw = results.reduce((s, r) => s + (r.rawInserted || 0), 0);
  const totalAgg = results.reduce((s, r) => s + (r.aggregated  || 0), 0);

  return ok({
    note:    `${fromDate} 이후 동기화 — fills ${totalRaw}건, trades ${totalAgg}건`,
    from:    fromDate,
    results,
  });
}
