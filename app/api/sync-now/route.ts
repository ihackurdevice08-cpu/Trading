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

function parseSide(tradeSide: string, side: string): "long" | "short" {
  const ts = tradeSide.toLowerCase();
  const s  = side.toLowerCase();
  if (ts.includes("long"))  return "long";
  if (ts.includes("short")) return "short";
  if (ts.includes("buy"))   return "long";
  if (ts.includes("sell"))  return "short";
  return s === "buy" ? "long" : "short";
}

function getFee(it: any): number {
  if (Array.isArray(it.feeDetail)) {
    return it.feeDetail.reduce((s: number, fd: any) =>
      s + Number(fd.totalFee ?? fd.fee ?? 0), 0);
  }
  return Number(it.fee ?? 0);
}

interface Fill {
  tradeId:   string;
  orderId:   string;
  symbol:    string;
  side:      string;
  tradeSide: string;
  price:     number;
  size:      number;
  fee:       number;
  profit:    number;
  ts:        number;
}

function normalizeFill(it: any): Fill {
  return {
    tradeId:   String(it.tradeId   ?? ""),
    orderId:   String(it.orderId   ?? ""),
    symbol:    String(it.symbol    ?? ""),
    side:      String(it.side      ?? ""),
    tradeSide: String(it.tradeSide ?? ""),
    price:     Number(it.price     ?? 0),
    size:      Number(it.baseVolume ?? it.size ?? 0),
    fee:       getFee(it),
    profit:    Number(it.profit    ?? 0),
    ts:        Number(it.cTime     ?? 0),
  };
}

// ────────────────────────────────────────────────────────────────────────
// 핵심 집계 로직
//
// Bitget hedge mode에서 open fill과 close fill은 서로 다른 orderId를 가짐.
// 기존 코드의 문제: 모든 fills를 orderId로 그룹핑하면
//   open fill 그룹 → profit=0 → pnl=0인 쓰레기 거래 대량 생성
//
// 수정: close fill만 그룹핑, open fill은 fee 수집용으로만 사용
// ────────────────────────────────────────────────────────────────────────
function aggregateToTrades(
  fills: Fill[],
  uid: string,
  accId: string,
  fromMs: number
): Array<{ path: string; data: Record<string, any> }> {

  // 1단계: open fill의 수수료를 orderId 기준으로 집계 (나중에 close와 매칭)
  //        open fill orderId와 close fill orderId가 다르므로 매칭은 불가능하지만
  //        그냥 close의 fee에 통합 (이미 feeDetail에 포함돼 있음)
  //
  // 2단계: close fill만 orderId 기준으로 그룹핑
  const closeGroups: Record<string, Fill[]> = {};

  for (const f of fills) {
    const ts = f.tradeSide.toLowerCase();

    // close 판별: tradeSide에 "close" 포함 또는 one-way mode
    const isClose =
      ts.includes("close") ||   // close_long, close_short, close
      ts === "sell_single" ||    // one-way: 숏오픈 or 롱청산 (profit이 있으면 청산)
      ts === "buy_single";       // one-way: 롱오픈 or 숏청산 (profit이 있으면 청산)

    if (!isClose) continue;  // open fill은 건너뜀

    // one-way mode에서 buy_single/sell_single은 open일 때도 있음
    // → profit=0이고 fee만 있으면 open, profit≠0이면 close
    if ((ts === "sell_single" || ts === "buy_single") && f.profit === 0) {
      continue;  // open fill로 판단, 건너뜀
    }

    const key = f.orderId || f.tradeId || String(f.ts);
    if (!closeGroups[key]) closeGroups[key] = [];
    closeGroups[key].push(f);
  }

  const rows: Array<{ path: string; data: Record<string, any> }> = [];

  for (const [orderId, group] of Object.entries(closeGroups)) {
    group.sort((a, b) => a.ts - b.ts);

    const first = group[0];
    const last  = group[group.length - 1];

    // fromMs 이전 거래 제외
    if (last.ts > 0 && last.ts < fromMs) continue;

    const closePnl  = group.reduce((s, f) => s + f.profit, 0);
    const closeFee  = group.reduce((s, f) => s + f.fee,    0);
    const totalSize = group.reduce((s, f) => s + f.size,   0);
    const avgPrice  = totalSize > 0
      ? group.reduce((s, f) => s + f.price * f.size, 0) / totalSize : 0;

    // 최종 pnl = profit (이미 수수료 차감된 값) + closeFee 합산
    // Bitget의 profit 필드는 수수료 미차감 gross PnL
    // feeDetail의 totalFee가 음수(차감)이므로 더하면 net PnL
    const realPnl = closePnl + closeFee;

    const side   = parseSide(first.tradeSide, first.side);
    const symbol = first.symbol.replace(/_UMCBL|_DMCBL|_CMCBL/g, "");

    const safeId = orderId.replace(/[:/]/g, "_");
    rows.push({
      path: `users/${uid}/manual_trades/bitget_${accId}_${safeId}`,
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
          close_fee: Number(closeFee.toFixed(4)),
          pnl_raw:   Number(closePnl.toFixed(4)),
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
  const bitgetFromMs    = Math.max(fromMs, Date.now() - 89 * 86400_000);
  const fromTimestamp   = String(bitgetFromMs);

  const allAccounts = await listDocs(token, `users/${uid}/exchange_accounts`);
  const accounts = allAccounts
    .filter(a => a.exchange === "bitget")
    .filter(a => !targetAccountId || a.__id === targetAccountId);

  if (!accounts.length)
    return bad("등록된 Bitget 계정 없음. Settings에서 API Key를 등록하세요.", 404);

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
    const allFills: Fill[] = [];

    // ── Bitget fill-history 수집 ─────────────────────────────────────
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

        if (!isOk)               { errors.push(`HTTP ${httpStatus}: ${json?.msg || "unknown"}`); break; }
        if (json?.code !== "00000") { errors.push(`Bitget [${json?.code}]: ${json?.msg || "unknown"}`); break; }

        const list: any[] = json?.data?.fillList ?? json?.data?.list ?? [];
        if (!Array.isArray(list) || !list.length) break;

        for (const it of list) allFills.push(normalizeFill(it));

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

    // tradeSide 분포 (디버그용)
    const dist: Record<string, number> = {};
    for (const f of allFills) dist[f.tradeSide] = (dist[f.tradeSide] || 0) + 1;

    // ── close fill 기준 집계 ─────────────────────────────────────────
    const rows = aggregateToTrades(allFills, uid, accId, fromMs);

    // ── 저장 (30건씩 병렬 setDoc) ────────────────────────────────────
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
      id:            accId,
      alias:         acc.alias,
      fills_fetched: allFills.length,
      trades_saved:  saved,
      errors:        [...errors, ...saveErrors].length ? [...errors, ...saveErrors] : undefined,
      debug: {
        fills_total:      allFills.length,
        trades_generated: rows.length,
        tradeSide_dist:   dist,
        from:             fromDate,
        from_actual:      new Date(bitgetFromMs).toISOString().slice(0, 10),
      },
    });
  }

  const totalFills = results.reduce((s, r) => s + (r.fills_fetched || 0), 0);
  const totalSaved = results.reduce((s, r) => s + (r.trades_saved  || 0), 0);

  return ok({
    note: `${fromDate} 이후 동기화 — fills ${totalFills}건, trades ${totalSaved}건 저장`,
    from: fromDate,
    results,
  });
}
// v3_close_fill_only_$(date -u +%Y%m%d)
