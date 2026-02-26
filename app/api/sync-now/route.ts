import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/supabase/serverAuth";
import { supabaseServer } from "@/lib/supabase/server";
import { decryptText } from "@/lib/crypto/dec";
import { bitgetSign } from "@/lib/bitget/sign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ok(data: any)  { return NextResponse.json({ ok: true, ...data }); }
function bad(msg: string, status = 400) { return NextResponse.json({ ok: false, error: msg }, { status }); }

// ─────────────────────────────────────────────────────────────────
// Bitget API 필드 매핑 (v2 실제 응답 기준)
// ─────────────────────────────────────────────────────────────────
//
// /api/v2/mix/order/fill-history 응답:
//   data.fillList[]:
//     tradeId      → 체결 ID                (우리: trade_id)
//     orderId      → 주문 ID                (우리: order_id)
//     symbol       → "ETHUSDT"              (우리: symbol)
//     price        → 체결 가격              (우리: price)
//     baseVolume   → 체결 수량              (우리: size)  ← it.size 가 아님!
//     profit       → 실현 PnL              (우리: pnl)   ← it.pnl 이 아님!
//     feeDetail[0].totalFee → 수수료       (우리: fee)   ← it.fee 가 아님!
//     tradeSide    → "open_long" | "close_long" | "open_short" | "close_short"
//                    | "buy_single" | "sell_single" | "open" | "close"
//     side         → "buy" | "sell"
//     cTime        → 체결 시각 (ms timestamp)
//
// 페이지네이션:
//   - data.endId 가 다음 페이지 커서
//   - 요청 params: idLessThan=<endId> (이전 코드의 endTime 방식은 동작 안함)
//
// ─────────────────────────────────────────────────────────────────

const BITGET_BASE = "https://api.bitget.com";

async function bitgetGet(
  path: string,
  params: Record<string, string>,
  creds: { apiKey: string; secret: string; pass: string }
) {
  const query = new URLSearchParams(params).toString();
  const timestamp = String(Date.now());
  const sign = bitgetSign({
    timestamp, method: "GET", requestPath: path,
    queryString: query, secret: creds.secret,
  });

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

// ─── tradeSide → long/short 판별 ───────────────────────────────
// Bitget tradeSide 값:
//   hedge mode: open_long, close_long, open_short, close_short
//   one-way:    buy_single(=롱진입 or 숏청산), sell_single(=숏진입 or 롱청산)
//   단순:       open, close
// side: buy | sell
function parseSide(tradeSide: string, side: string): "long" | "short" {
  const ts = String(tradeSide || "").toLowerCase();
  const s  = String(side     || "").toLowerCase();

  if (ts.includes("long"))  return "long";
  if (ts.includes("short")) return "short";

  // one-way mode: buy_single / sell_single
  // buy_single = 매수 (롱 오픈 or 숏 청산) → 포지션 방향 = long
  // sell_single = 매도 (숏 오픈 or 롱 청산) → 포지션 방향 = short
  if (ts.includes("buy"))  return "long";
  if (ts.includes("sell")) return "short";

  // fallback: side 기준
  return s === "buy" ? "long" : "short";
}

// ─── fill 한 건 → fills_raw row 변환 ───────────────────────────
function fillToRow(it: any, uid: string, accountId: string) {
  const tradeId = String(it.tradeId  ?? "");
  const orderId = String(it.orderId  ?? "");
  const ts      = Number(it.cTime    ?? 0);

  // 수수료: feeDetail 배열 → 합산
  let fee = 0;
  if (Array.isArray(it.feeDetail)) {
    for (const fd of it.feeDetail) {
      fee += Number(fd.totalFee ?? fd.fee ?? 0);
    }
  } else if (it.fee != null) {
    // 구버전 호환
    fee = Number(it.fee);
  }

  return {
    id:           `${uid}:${accountId}:${tradeId || orderId || ts}`,
    user_id:      uid,
    exchange:     "bitget",
    trade_id:     tradeId  || null,
    order_id:     orderId  || null,
    symbol:       String(it.symbol ?? ""),
    side:         it.side  ?? null,
    trade_side:   it.tradeSide ?? null,
    price:        it.price      != null ? Number(it.price)      : null,
    pnl:          it.profit     != null ? Number(it.profit)     : null,
    ts_ms:        ts || null,
    payload:      it,
  };
}

// ─── fills_raw → manual_trades 집계 ────────────────────────────
// 같은 orderId의 fills를 하나의 포지션으로 묶어 PnL 합산
// PnL은 API에서 직접 가져옴 (close 시점에만 존재)
// 내부 계산 값: 없음 (전부 API 값 그대로 집계)
async function aggregateFills(uid: string, accountId: string, fromMs: number) {
  const sb = supabaseServer();

  const { data: fills } = await sb
    .from("fills_raw")
    .select("id,user_id,exchange,trade_id,order_id,symbol,side,trade_side,price,pnl,ts_ms,payload")
    .eq("user_id", uid)
    .eq("exchange", "bitget")
    .gte("ts_ms", fromMs)
    .order("ts_ms", { ascending: true });

  if (!fills || fills.length === 0) return 0;

  // orderId 기준 그룹핑
  const groups: Record<string, any[]> = {};
  for (const f of fills) {
    const key = f.order_id || f.trade_id || String(f.ts_ms);
    if (!groups[key]) groups[key] = [];
    groups[key].push(f);
  }

  const rows: any[] = [];

  for (const [orderId, group] of Object.entries(groups)) {
    const first = group[0];
    const last  = group[group.length - 1];

    // API에서 받은 값 합산 (size는 payload.baseVolume에서)
    const totalPnl  = group.reduce((s, f) => s + (Number(f.pnl) || Number(f.payload?.profit) || 0), 0);
    const totalSize = group.reduce((s, f) => s + (Number(f.payload?.baseVolume) || 0), 0);
    // 가중평균 진입가 (내부 계산)
    const avgPrice  = totalSize > 0
      ? group.reduce((s, f) => s + (Number(f.price) || 0) * (Number(f.payload?.baseVolume) || 0), 0) / totalSize
      : 0;

    const side   = parseSide(first.trade_side, first.side);
    const symbol = String(first.symbol || "").replace(/_UMCBL|_DMCBL|_CMCBL/g, "");

    // PnL이 전혀 없는 pure open 포지션도 저장 (나중에 close fill이 오면 업데이트됨)
    rows.push({
      id:        `bitget:${accountId}:${orderId}`,
      user_id:   uid,
      symbol,
      side,
      opened_at: first.ts_ms ? new Date(Number(first.ts_ms)).toISOString() : new Date().toISOString(),
      closed_at: last.ts_ms  ? new Date(Number(last.ts_ms )).toISOString() : null,
      pnl:       Number(totalPnl.toFixed(4)),
      tags:      ["bitget", "auto-sync"],
      notes:     JSON.stringify({
        source:    "bitget",
        accountId,
        fills:     group.length,
        size:      Number(totalSize.toFixed(6)),
        avg_price: Number(avgPrice.toFixed(4)),
      }),
      source:    "bitget",
    });
  }

  if (rows.length === 0) return 0;

  const { error } = await sb.from("manual_trades").upsert(rows, { onConflict: "id" });
  if (error) {
    console.error("aggregate upsert error:", error.message);
    throw new Error("manual_trades upsert 실패: " + error.message);
  }
  return rows.length;
}

// ─────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  if (!process.env.ENCRYPTION_SECRET) return bad("ENCRYPTION_SECRET 환경변수 없음", 500);

  const body = await req.json().catch(() => ({}));
  const targetAccountId: string | null = body?.account_id || null;

  const fromDate: string = body?.from
    ? String(body.from)
    : new Date(Date.now() - 730 * 86400_000).toISOString().slice(0, 10);

  const fromMs = new Date(fromDate + "T00:00:00Z").getTime();
  const fromTimestamp = String(fromMs);

  const sb = supabaseServer();

  let q = sb
    .from("exchange_accounts")
    .select("id, exchange, alias, api_key_enc, api_secret_enc, passphrase_enc")
    .eq("user_id", uid)
    .eq("exchange", "bitget");

  if (targetAccountId) q = q.eq("id", targetAccountId);

  const { data: accounts, error: aErr } = await q;
  if (aErr) return bad(aErr.message, 500);
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

    const creds  = { apiKey, secret, pass };
    let rawInserted = 0;
    const errors: string[] = [];
    let debugSample: any = null; // 첫 응답 샘플 (디버깅용)

    // ── fill-history 페이지네이션 ──────────────────────────────
    // v2 fill-history 페이지네이션: idLessThan 커서 방식
    try {
      let idLessThan = "";
      let pageCount  = 0;
      const MAX_PAGES = 20;

      while (pageCount < MAX_PAGES) {
        const params: Record<string, string> = {
          productType: "USDT-FUTURES",
          pageSize:    "100",          // 최대 100
          startTime:   fromTimestamp,  // 시작 날짜 필터
        };
        if (idLessThan) params.idLessThan = idLessThan;

        const { ok: isOk, status: httpStatus, data: json } =
          await bitgetGet("/api/v2/mix/order/fill-history", params, creds);

        // HTTP 레벨 에러
        if (!isOk) {
          errors.push(`HTTP ${httpStatus}: ${json?.msg || "unknown"}`);
          break;
        }

        // Bitget 애플리케이션 에러
        if (json?.code !== "00000") {
          errors.push(`Bitget 오류 [${json?.code}]: ${json?.msg || "unknown"}`);
          break;
        }

        // 실제 리스트 파싱 (v2: data.fillList)
        const list: any[] = json?.data?.fillList ?? json?.data?.list ?? [];

        if (!Array.isArray(list) || list.length === 0) break;

        // 디버깅용: 첫 페이지 첫 레코드 저장
        if (pageCount === 0 && list.length > 0) {
          debugSample = {
            fields: Object.keys(list[0]),
            first:  list[0],
          };
        }

        // fills_raw upsert
        const rows = list.map(it => fillToRow(it, uid, acc.id));
        const { error: upErr } = await sb.from("fills_raw").upsert(rows, { onConflict: "id" });
        if (upErr) {
          errors.push(`DB 저장 실패: ${upErr.message}`);
          break;
        }
        rawInserted += rows.length;

        // 다음 페이지 커서 (endId → idLessThan)
        const endId = json?.data?.endId;
        if (!endId || list.length < 100) break; // 마지막 페이지

        // startTime 기준 이전 데이터인지 확인
        const minTs = Math.min(...list.map((x: any) => Number(x.cTime ?? Infinity)));
        if (minTs <= fromMs) break; // 시작 날짜 이전 도달

        idLessThan = String(endId);
        pageCount++;
      }
    } catch (e: any) {
      errors.push(`fetch 오류: ${e?.message}`);
    }

    // ── fills_raw → manual_trades 집계 ────────────────────────
    let aggregated = 0;
    try {
      aggregated = await aggregateFills(uid, acc.id, fromMs);
    } catch (e: any) {
      errors.push(`집계 오류: ${e?.message}`);
    }

    results.push({
      id:          acc.id,
      alias:       acc.alias,
      rawInserted,
      aggregated,
      errors:      errors.length ? errors : undefined,
      _debug:      debugSample,  // 첫 응답 샘플 (필드 확인용)
    });
  }

  const totalRaw = results.reduce((s, r) => s + (r.rawInserted || 0), 0);
  const totalAgg = results.reduce((s, r) => s + (r.aggregated  || 0), 0);

  return ok({
    note:    `${fromDate} 이후 동기화 완료 — fills ${totalRaw}건 저장, trades ${totalAgg}건 집계`,
    from:    fromDate,
    results,
  });
}
