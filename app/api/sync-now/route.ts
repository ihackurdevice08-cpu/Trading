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

// ─── Bitget v2 fill-history 필드 매핑 ───────────────────────────────────
// tradeSide: open_long | close_long | open_short | close_short
//            buy_single | sell_single | open | close
// profit: 실현 PnL (close fill에만 존재)
// feeDetail[].totalFee: 수수료
// baseVolume: 체결 수량 (it.size 아님)
// cTime: 체결 시각 ms
// ────────────────────────────────────────────────────────────────────────

function parseSide(tradeSide: string, side: string): "long" | "short" {
  const ts = String(tradeSide || "").toLowerCase();
  const s  = String(side     || "").toLowerCase();
  if (ts.includes("long"))  return "long";
  if (ts.includes("short")) return "short";
  if (ts.includes("buy"))   return "long";
  if (ts.includes("sell"))  return "short";
  return s === "buy" ? "long" : "short";
}

function getFee(it: any): number {
  if (Array.isArray(it.feeDetail)) {
    return it.feeDetail.reduce((s: number, fd: any) => s + Number(fd.totalFee ?? fd.fee ?? 0), 0);
  }
  return Number(it.fee ?? 0);
}

// fill 한 건 → 정규화된 row
function normalizeFill(it: any) {
  return {
    tradeId:   String(it.tradeId  ?? ""),
    orderId:   String(it.orderId  ?? ""),
    symbol:    String(it.symbol   ?? ""),
    side:      String(it.side     ?? ""),
    tradeSide: String(it.tradeSide ?? ""),
    price:     Number(it.price    ?? 0),
    size:      Number(it.baseVolume ?? it.size ?? 0),  // baseVolume이 실제 수량
    fee:       getFee(it),
    profit:    Number(it.profit   ?? 0),               // profit이 실현 PnL
    ts:        Number(it.cTime    ?? 0),
    raw:       it,
  };
}

// fills → manual_trades 집계 (메모리 내 orderId 그룹핑)
function aggregateToTrades(
  fills: ReturnType<typeof normalizeFill>[],
  uid: string,
  accId: string,
  fromMs: number
): Array<{ path: string; data: Record<string, any> }> {

  // orderId 기준 그룹핑
  const groups: Record<string, ReturnType<typeof normalizeFill>[]> = {};
  for (const f of fills) {
    const key = f.orderId || f.tradeId || String(f.ts);
    if (!groups[key]) groups[key] = [];
    groups[key].push(f);
  }

  const rows: Array<{ path: string; data: Record<string, any> }> = [];

  for (const [orderId, group] of Object.entries(groups)) {
    // 시간순 정렬
    group.sort((a, b) => a.ts - b.ts);

    const first = group[0];
    const last  = group[group.length - 1];

    // fromMs 이전 거래 제외
    if (last.ts > 0 && last.ts < fromMs) continue;

    // profit 합산 (close fill에만 있음, open fill은 0)
    const totalPnl  = group.reduce((s, f) => s + f.profit, 0);
    const totalFee  = group.reduce((s, f) => s + f.fee,    0);
    const totalSize = group.reduce((s, f) => s + f.size,   0);
    const avgPrice  = totalSize > 0
      ? group.reduce((s, f) => s + f.price * f.size, 0) / totalSize : 0;

    // pnl = profit + fee (Supabase 시절과 동일한 방식)
    const realPnl = totalPnl + totalFee;

    const side   = parseSide(first.tradeSide, first.side);
    const symbol = first.symbol.replace(/_UMCBL|_DMCBL|_CMCBL/g, "");

    const safeOrderId = orderId.replace(/:/g, "_");
    rows.push({
      path: `users/${uid}/manual_trades/bitget_${accId}_${safeOrderId}`,
      data: {
        symbol,
        side,
        opened_at: new Date(first.ts),
        closed_at: new Date(last.ts),
        pnl:       Number(realPnl.toFixed(4)),
        tags:      ["bitget", "auto-sync"],
        notes:     JSON.stringify({
          fills:     group.length,
          size:      Number(totalSize.toFixed(6)),
          close_fee: Number(totalFee.toFixed(4)),
          pnl_raw:   Number(totalPnl.toFixed(4)),
          avg_price: Number(avgPrice.toFixed(4)),
          account:   accId,
        }),
        group_id: null,
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
  // Bitget fill-history는 90일 이내만 지원
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

    const creds  = { apiKey, secret, pass };
    const errors: string[] = [];
    const allFills: ReturnType<typeof normalizeFill>[] = [];

    // ── fill-history 페이지네이션 수집 ──────────────────────────────
    try {
      let idLessThan = "";
      let pageCount  = 0;
      const MAX_PAGES = 20;  // 최대 100 × 20 = 2000건

      while (pageCount < MAX_PAGES) {
        const params: Record<string, string> = {
          productType: "USDT-FUTURES",
          pageSize:    "100",
          startTime:   fromTimestamp,
        };
        if (idLessThan) params.idLessThan = idLessThan;

        const { ok: isOk, status: httpStatus, data: json } =
          await bitgetGet("/api/v2/mix/order/fill-history", params, creds);

        if (!isOk)               { errors.push(`HTTP ${httpStatus}: ${json?.msg || "unknown"}`); break; }
        if (json?.code !== "00000") { errors.push(`Bitget [${json?.code}]: ${json?.msg || "unknown"}`); break; }

        const list: any[] = json?.data?.fillList ?? json?.data?.list ?? [];
        if (!Array.isArray(list) || !list.length) break;

        for (const it of list) allFills.push(normalizeFill(it));

        // 페이지네이션: endId 커서
        const endId = json?.data?.endId;
        if (!endId || list.length < 100) break;

        // startTime 이전 도달하면 종료
        const minTs = Math.min(...list.map((x: any) => Number(x.cTime ?? Infinity)));
        if (minTs <= bitgetFromMs) break;

        idLessThan = String(endId);
        pageCount++;
      }
    } catch (e: any) {
      errors.push(`Bitget fetch 오류: ${e?.message}`);
    }

    // ── 메모리에서 집계 ──────────────────────────────────────────────
    const rows = aggregateToTrades(allFills, uid, accId, fromMs);

    // ── manual_trades 저장 (30건씩 병렬 setDoc) ─────────────────────
    let saved = 0;
    const saveErrors: string[] = [];

    for (let i = 0; i < rows.length; i += 30) {
      const settles = await Promise.allSettled(
        rows.slice(i, i + 30).map(r => setDoc(token, r.path, r.data, false))
      );
      for (const res of settles) {
        if (res.status === "fulfilled") saved++;
        else saveErrors.push(String((res as any).reason?.message ?? "unknown"));
      }
    }

    results.push({
      id:               accId,
      alias:            acc.alias,
      fills_fetched:    allFills.length,
      trades_saved:     saved,
      errors:           [...errors, ...saveErrors].length ? [...errors, ...saveErrors] : undefined,
      debug: {
        fill_count:   allFills.length,
        trade_count:  rows.length,
        from:         fromDate,
        from_actual:  new Date(bitgetFromMs).toISOString().slice(0, 10),
      },
    });
  }

  const totalFills  = results.reduce((s, r) => s + (r.fills_fetched || 0), 0);
  const totalSaved  = results.reduce((s, r) => s + (r.trades_saved  || 0), 0);

  return ok({
    note: `${fromDate} 이후 동기화 — fills ${totalFills}건, trades ${totalSaved}건 저장`,
    from: fromDate,
    results,
  });
}
// rebuilt: sync_fill_history_v2

// built: 20260319132532
