import { NextResponse } from "next/server";
import { getAuthInfo } from "@/lib/firebase/serverAuth";
import { listDocs, queryDocs, setDoc } from "@/lib/firebase/firestoreRest";
import { decryptText } from "@/lib/crypto/dec";
import { bitgetSign } from "@/lib/bitget/sign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 55;

const BITGET_BASE = "https://api.bitget.com";

async function bitgetGet(path: string, params: Record<string, string>, creds: any) {
  const query = new URLSearchParams(params).toString();
  const timestamp = String(Date.now());
  const sign = bitgetSign({ timestamp, method: "GET", requestPath: path, queryString: query, secret: creds.secret });
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

export async function GET(req: Request) {
  const auth = await getAuthInfo();
  if (!auth) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { uid, token } = auth;

  const url = new URL(req.url);
  const doSync = url.searchParams.get("sync") === "1"; // ?sync=1 이면 실제 저장까지

  // ── DB 현황 ─────────────────────────────────────────────────────────
  const [newestDocs, oldestDocs] = await Promise.all([
    queryDocs(token, `users/${uid}/manual_trades`, {
      orderBy: [{ field: { fieldPath: "opened_at" }, direction: "DESCENDING" }],
      limit: 5,
    }),
    queryDocs(token, `users/${uid}/manual_trades`, {
      orderBy: [{ field: { fieldPath: "opened_at" }, direction: "ASCENDING" }],
      limit: 3,
    }),
  ]);

  const toIso = (v: any) => v instanceof Date ? v.toISOString() : String(v ?? "");
  const db = {
    newest_5: newestDocs.map(d => ({ id: d.__id, symbol: d.symbol, pnl: d.pnl, opened_at: toIso(d.opened_at) })),
    oldest_3: oldestDocs.map(d => ({ id: d.__id, symbol: d.symbol, pnl: d.pnl, opened_at: toIso(d.opened_at) })),
  };

  // ── Bitget 계정 ──────────────────────────────────────────────────────
  const accounts = await listDocs(token, `users/${uid}/exchange_accounts`);
  const acc = accounts.find((a: any) => a.exchange === "bitget");
  if (!acc) return NextResponse.json({ ok: true, db, error: "Bitget 계정 없음" });

  let apiKey: string, secret: string, pass: string;
  try {
    apiKey = decryptText(acc.api_key_enc);
    secret = decryptText(acc.api_secret_enc);
    pass   = decryptText(acc.passphrase_enc);
  } catch (e: any) {
    return NextResponse.json({ ok: true, db, error: "복호화 실패: " + e?.message });
  }

  const creds = { apiKey, secret, pass };
  const accId = acc.__id;

  // ── Bitget fills 전체 수집 (2026-03-17 이후) ─────────────────────────
  const startMs = new Date("2026-03-17T00:00:00Z").getTime();
  const allFills: any[] = [];
  const pages: any[] = [];
  let idLessThan = "";
  let pageCount = 0;

  while (pageCount < 10) {
    const params: Record<string, string> = {
      productType: "USDT-FUTURES",
      pageSize: "100",
      startTime: String(startMs),
    };
    if (idLessThan) params.idLessThan = idLessThan;

    const { ok, status, data } = await bitgetGet("/api/v2/mix/order/fill-history", params, creds);
    const list = data?.data?.fillList ?? data?.data?.list ?? [];
    const endId = data?.data?.endId;

    pages.push({
      page: pageCount,
      http_ok: ok, code: data?.code, fill_count: list.length,
      endId, idLessThan,
      oldest_in_page: list.length ? new Date(Number(list[list.length - 1].cTime)).toISOString().slice(0, 16) : null,
      newest_in_page: list.length ? new Date(Number(list[0].cTime)).toISOString().slice(0, 16) : null,
    });

    if (!ok || data?.code !== "00000" || !list.length) break;
    for (const it of list) allFills.push(it);

    if (!endId || list.length < 100) break;
    const minTs = Math.min(...list.map((x: any) => Number(x.cTime)));
    if (minTs <= startMs) break;

    idLessThan = String(endId);
    pageCount++;
  }

  // tradeSide 분포 및 날짜별 분포
  const dist: Record<string, number> = {};
  const byDate: Record<string, number> = {};
  const byDateClose: Record<string, number> = {};
  for (const it of allFills) {
    const ts = String(it.tradeSide ?? "?");
    dist[ts] = (dist[ts] || 0) + 1;
    const d = new Date(Number(it.cTime)).toISOString().slice(0, 10);
    byDate[d] = (byDate[d] || 0) + 1;
    if (ts === "close" || ts.includes("close")) byDateClose[d] = (byDateClose[d] || 0) + 1;
  }

  // close fill 집계 (orderId 기준)
  const closeGroups: Record<string, any[]> = {};
  for (const it of allFills) {
    const ts = String(it.tradeSide ?? "").toLowerCase();
    const isClose = ts === "close" || ts.includes("close");
    const isOneway = ts === "sell_single" || ts === "buy_single";
    if (!isClose && !isOneway) continue;
    if (isOneway && Number(it.profit ?? 0) === 0) continue;

    const key = String(it.orderId || it.tradeId || it.cTime);
    if (!closeGroups[key]) closeGroups[key] = [];
    closeGroups[key].push(it);
  }

  const tradeRows: any[] = [];
  for (const [orderId, group] of Object.entries(closeGroups)) {
    group.sort((a: any, b: any) => Number(a.cTime) - Number(b.cTime));
    const first = group[0];
    const last = group[group.length - 1];
    const closePnl = group.reduce((s: number, f: any) => s + Number(f.profit ?? 0), 0);
    const closeFee = group.reduce((s: number, f: any) => s + getFee(f), 0);
    const realPnl = closePnl + closeFee;
    const safeId = orderId.replace(/[:/]/g, "_");
    const path = `users/${uid}/manual_trades/bitget_${accId}_${safeId}`;

    tradeRows.push({
      orderId, path, fills: group.length,
      symbol: String(first.symbol ?? "").replace(/_UMCBL|_DMCBL/g, ""),
      tradeSide: first.tradeSide,
      closePnl: Number(closePnl.toFixed(4)),
      closeFee: Number(closeFee.toFixed(4)),
      realPnl: Number(realPnl.toFixed(4)),
      opened_at: new Date(Number(first.cTime)).toISOString(),
      closed_at: new Date(Number(last.cTime)).toISOString(),
    });
  }

  // ── 실제 저장 (doSync=true일 때만) ───────────────────────────────────
  let saveResult: any = null;
  if (doSync) {
    let saved = 0;
    const saveErrors: string[] = [];
    for (const row of tradeRows) {
      try {
        await setDoc(token, row.path, {
          symbol: row.symbol,
          side: parseSide(row.tradeSide, ""),
          opened_at: new Date(row.opened_at),
          closed_at: new Date(row.closed_at),
          pnl: row.realPnl,
          tags: ["bitget", "auto-sync"],
          notes: JSON.stringify({ fills: row.fills, close_fee: row.closeFee, pnl_raw: row.closePnl, account: accId }),
          group_id: null,
        }, false);
        saved++;
      } catch (e: any) {
        saveErrors.push(`${row.orderId}: ${e?.message}`);
      }
    }
    saveResult = { total: tradeRows.length, saved, errors: saveErrors.slice(0, 10) };
  }

  return NextResponse.json({
    ok: true,
    db,
    bitget: {
      fills_total: allFills.length,
      pages,
      tradeSide_dist: dist,
      fills_by_date: byDate,
      close_fills_by_date: byDateClose,
      trade_rows_generated: tradeRows.length,
      trade_rows_sample: tradeRows.slice(0, 5),
    },
    save: saveResult,
  });
}
