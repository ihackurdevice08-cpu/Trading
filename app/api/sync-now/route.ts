import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/supabase/serverAuth";
import { supabaseServer } from "@/lib/supabase/server";
import { decryptText } from "@/lib/crypto/dec";
import { bitgetSign } from "@/lib/bitget/sign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ok(data: any) { return NextResponse.json({ ok: true, ...data }); }
function bad(msg: string, status = 400) { return NextResponse.json({ ok: false, error: msg }, { status }); }

const BITGET_BASE = "https://api.bitget.com";

// Bitget API 호출 유틸
async function bitgetGet(
  path: string,
  params: Record<string, string>,
  creds: { apiKey: string; secret: string; pass: string }
) {
  const query = new URLSearchParams(params).toString();
  const timestamp = String(Date.now());
  const sign = bitgetSign({
    timestamp,
    method: "GET",
    requestPath: path,
    queryString: query,
    secret: creds.secret,
  });

  const url = `${BITGET_BASE}${path}?${query}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "ACCESS-KEY": creds.apiKey,
      "ACCESS-SIGN": sign,
      "ACCESS-PASSPHRASE": creds.pass,
      "ACCESS-TIMESTAMP": timestamp,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const j = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data: j };
}

// fills_raw → manual_trades 집계
// 같은 orderId의 fills를 포지션 단위로 묶어서 PnL 합산
async function aggregateFillsToTrades(uid: string, accountId: string) {
  const sb = supabaseServer();

  // 아직 manual_trades에 없는 fills 가져오기
  const { data: fills } = await sb
    .from("fills_raw")
    .select("*")
    .eq("user_id", uid)
    .eq("account_id", accountId)
    .order("ts_ms", { ascending: true });

  if (!fills || fills.length === 0) return 0;

  // order_id 기준으로 그룹핑
  const groups: Record<string, any[]> = {};
  for (const f of fills) {
    const key = f.order_id || f.trade_id || String(f.ts_ms);
    if (!groups[key]) groups[key] = [];
    groups[key].push(f);
  }

  let upserted = 0;
  const rows: any[] = [];

  for (const [orderId, group] of Object.entries(groups)) {
    const first = group[0];
    const totalPnl = group.reduce((s, f) => s + (Number(f.pnl) || 0), 0);
    const totalFee = group.reduce((s, f) => s + (Number(f.fee) || 0), 0);
    const totalSize = group.reduce((s, f) => s + (Number(f.size) || 0), 0);
    const avgPrice = group.reduce((s, f) => s + (Number(f.price) || 0), 0) / group.length;

    // side 정규화: buy/sell → long/short
    const rawSide = String(first.trade_side || first.side || "").toLowerCase();
    const side = rawSide.includes("open") || rawSide === "buy" || rawSide.includes("long")
      ? "long" : "short";

    rows.push({
      id: `bitget:${accountId}:${orderId}`,
      user_id: uid,
      symbol: String(first.symbol || "").replace("_UMCBL", "").replace("USDT", "USDT"),
      side,
      opened_at: first.ts_ms ? new Date(Number(first.ts_ms)).toISOString() : new Date().toISOString(),
      closed_at: group[group.length - 1].ts_ms
        ? new Date(Number(group[group.length - 1].ts_ms)).toISOString()
        : null,
      pnl: Number(totalPnl.toFixed(4)),
      fee: Number(totalFee.toFixed(4)),
      size: Number(totalSize.toFixed(6)),
      avg_price: Number(avgPrice.toFixed(4)),
      tags: ["bitget", "auto-sync"],
      notes: `Bitget auto-sync | fills: ${group.length}`,
      source: "bitget",
      account_id: accountId,
    });
  }

  if (rows.length > 0) {
    const { error } = await sb
      .from("manual_trades")
      .upsert(rows, { onConflict: "id" });
    if (!error) upserted = rows.length;
  }

  return upserted;
}

export async function POST(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  if (!process.env.ENCRYPTION_SECRET) {
    return bad("서버 설정 오류: ENCRYPTION_SECRET 환경변수 없음", 500);
  }

  const body = await req.json().catch(() => ({}));
  // 특정 account_id만 동기화하거나 전체 동기화
  const targetAccountId = body?.account_id || null;

  const sb = supabaseServer();

  let query = sb
    .from("exchange_accounts")
    .select("id, exchange, alias, api_key_enc, api_secret_enc, passphrase_enc")
    .eq("user_id", uid)
    .eq("exchange", "bitget");

  if (targetAccountId) {
    query = query.eq("id", targetAccountId);
  }

  const { data: accounts, error: aErr } = await query;
  if (aErr) return bad(aErr.message, 500);
  if (!accounts || accounts.length === 0) {
    return bad("등록된 Bitget 계정이 없습니다. Settings에서 API Key를 등록하세요.", 404);
  }

  const results: any[] = [];

  for (const acc of accounts) {
    let apiKey: string, secret: string, pass: string;
    try {
      apiKey = decryptText(acc.api_key_enc);
      secret = decryptText(acc.api_secret_enc);
      pass = decryptText(acc.passphrase_enc);
    } catch {
      results.push({ id: acc.id, alias: acc.alias, error: "복호화 실패 (ENCRYPTION_SECRET 불일치)" });
      continue;
    }

    const creds = { apiKey, secret, pass };
    let rawInserted = 0;
    let errors: string[] = [];

    // 1) USDT-M Futures fill history (페이지네이션)
    try {
      let endTime = "";
      let pageCount = 0;
      const MAX_PAGES = 10; // 최대 10페이지 (500건)

      while (pageCount < MAX_PAGES) {
        const params: Record<string, string> = {
          productType: "USDT-FUTURES",
          pageSize: "50",
        };
        if (endTime) params.endTime = endTime;

        const { ok: isOk, data: json } = await bitgetGet(
          "/api/v2/mix/order/fill-history",
          params,
          creds
        );

        if (!isOk || json?.code !== "00000") {
          errors.push(`fill-history API 오류: ${json?.msg || "unknown"}`);
          break;
        }

        const list: any[] = json?.data?.fillList ?? json?.data?.list ?? json?.data ?? [];
        if (!Array.isArray(list) || list.length === 0) break;

        const rows = list.map((it: any) => {
          const tradeId = String(it.tradeId ?? it.fillId ?? "");
          const orderId = String(it.orderId ?? "");
          const ts = Number(it.cTime ?? it.fillTime ?? it.ts ?? 0);
          return {
            id: `${uid}:${acc.id}:${tradeId || orderId || ts}`,
            user_id: uid,
            account_id: acc.id,
            exchange: "bitget",
            product_type: "usdt-futures",
            trade_id: tradeId || null,
            order_id: orderId || null,
            symbol: String(it.symbol ?? ""),
            side: it.side ?? null,
            trade_side: it.tradeSide ?? null,
            price: it.price ? Number(it.price) : null,
            size: it.size ? Number(it.size) : null,
            fee: it.fee ? Number(it.fee) : null,
            pnl: it.pnl != null ? Number(it.pnl) : null,
            ts_ms: ts || null,
            payload: it,
          };
        });

        const { error: upErr } = await sb.from("fills_raw").upsert(rows, { onConflict: "id" });
        if (!upErr) rawInserted += rows.length;

        // 다음 페이지: 가장 오래된 ts로 endTime 설정
        const minTs = Math.min(...list.map((x: any) => Number(x.cTime ?? x.fillTime ?? x.ts ?? Infinity)));
        if (minTs === Infinity || list.length < 50) break;
        endTime = String(minTs - 1);
        pageCount++;
      }
    } catch (e: any) {
      errors.push(`fetch 오류: ${e?.message}`);
    }

    // 2) fills_raw → manual_trades 집계
    let aggregated = 0;
    try {
      aggregated = await aggregateFillsToTrades(uid, acc.id);
    } catch (e: any) {
      errors.push(`집계 오류: ${e?.message}`);
    }

    results.push({
      id: acc.id,
      alias: acc.alias,
      rawInserted,
      aggregated,
      errors: errors.length > 0 ? errors : undefined,
    });
  }

  const totalRaw = results.reduce((s, r) => s + (r.rawInserted || 0), 0);
  const totalAgg = results.reduce((s, r) => s + (r.aggregated || 0), 0);

  // 대시보드 갱신 트리거
  return ok({
    note: `동기화 완료. fills: ${totalRaw}건 저장, trades: ${totalAgg}건 집계`,
    results,
  });
}
