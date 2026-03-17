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

export async function POST(req: Request) {
  const auth = await getAuthInfo();
  if (!auth) return bad("unauthorized", 401);
  const { uid, token } = auth;

  if (!process.env.ENCRYPTION_SECRET) return bad("ENCRYPTION_SECRET 환경변수 없음", 500);

  const body            = await req.json().catch(() => ({}));
  const targetAccountId = body?.account_id || null;
  const fromDate        = body?.from ? String(body.from) : "2026-02-24";
  const fromMs          = new Date(fromDate + "T00:00:00Z").getTime();
  const fromTimestamp   = String(fromMs);

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
    const positions: any[] = [];

    // ── history-position 페이지네이션 ──────────────────────────────
    try {
      let idLessThan = "";
      let pageCount  = 0;
      const MAX_PAGES = 20; // 최대 20 × 100 = 2000 포지션

      while (pageCount < MAX_PAGES) {
        const params: Record<string, string> = {
          productType: "USDT-FUTURES",
          pageSize:    "100",
          startTime:   fromTimestamp,
        };
        if (idLessThan) params.idLessThan = idLessThan;

        const { ok: isOk, status: httpStatus, data: json } =
          await bitgetGet("/api/v2/mix/position/history-position", params, creds);

        if (!isOk)               { errors.push(`HTTP ${httpStatus}: ${json?.msg || "unknown"}`); break; }
        if (json?.code !== "00000") { errors.push(`Bitget [${json?.code}]: ${json?.msg || "unknown"}`); break; }

        const list: any[] = json?.data?.list ?? [];
        if (!Array.isArray(list) || !list.length) break;

        for (const pos of list) {
          const closeTime = Number(pos.utime ?? pos.ctime ?? 0);
          // fromMs 이전 포지션 제외
          if (closeTime > 0 && closeTime < fromMs) continue;
          positions.push(pos);
        }

        // 페이지네이션: endId 커서
        const endId = json?.data?.endId;
        if (!endId || list.length < 100) break;

        // 가장 오래된 항목이 fromMs 이전이면 종료
        const minTime = Math.min(...list.map((x: any) => Number(x.utime ?? x.ctime ?? Infinity)));
        if (minTime <= fromMs) break;

        idLessThan = String(endId);
        pageCount++;
      }
    } catch (e: any) {
      errors.push(`Bitget fetch 오류: ${e?.message}`);
    }

    // ── manual_trades에 저장 (30건씩 병렬) ─────────────────────────
    let saved = 0;
    const saveErrors: string[] = [];

    for (let i = 0; i < positions.length; i += 30) {
      const chunk = positions.slice(i, i + 30);
      const settles = await Promise.allSettled(
        chunk.map(pos => {
          const posId    = String(pos.positionId ?? "");
          const symbol   = String(pos.symbol ?? "").replace(/_UMCBL|_DMCBL|_CMCBL/g, "");
          const side     = String(pos.holdSide ?? "long").toLowerCase();
          const openTime = Number(pos.ctime ?? 0);
          const closeTime = Number(pos.utime ?? pos.ctime ?? 0);

          // netProfit = 수수료·펀딩피 포함 최종 손익 (Bitget 앱 "Position PnL"과 동일)
          const netProfit  = Number(pos.netProfit  ?? pos.pnl ?? 0);
          const openFee    = Number(pos.openFee    ?? 0);
          const closeFee   = Number(pos.closeFee   ?? 0);
          const funding    = Number(pos.totalFunding ?? 0);
          const rawPnl     = Number(pos.pnl        ?? 0);

          const safeId = posId.replace(/:/g, "_");
          const path   = `users/${uid}/manual_trades/bitget_${accId}_${safeId}`;

          const data = {
            symbol,
            side,
            opened_at: new Date(openTime),
            closed_at: new Date(closeTime),
            pnl:       Number(netProfit.toFixed(4)),   // ← 핵심: netProfit 사용
            tags:      ["bitget", "auto-sync"],
            notes:     JSON.stringify({
              positionId:  posId,
              pnl_raw:     Number(rawPnl.toFixed(4)),
              open_fee:    Number(openFee.toFixed(4)),
              close_fee:   Number(closeFee.toFixed(4)),
              funding:     Number(funding.toFixed(4)),
              open_price:  pos.openAvgPrice  ?? null,
              close_price: pos.closeAvgPrice ?? null,
              size:        pos.openTotalPos  ?? null,
              account:     accId,
            }),
            group_id: null,
          };

          return setDoc(token, path, data, false);
        })
      );

      for (const res of settles) {
        if (res.status === "fulfilled") saved++;
        else saveErrors.push(String((res as any).reason?.message ?? "unknown"));
      }
    }

    results.push({
      id:                 accId,
      alias:              acc.alias,
      positions_fetched:  positions.length,
      trades_saved:       saved,
      errors:             [...errors, ...saveErrors].length
                          ? [...errors, ...saveErrors]
                          : undefined,
    });
  }

  const totalPositions = results.reduce((s, r) => s + (r.positions_fetched || 0), 0);
  const totalSaved     = results.reduce((s, r) => s + (r.trades_saved      || 0), 0);

  return ok({
    note: `${fromDate} 이후 동기화 — 포지션 ${totalPositions}건 수집, ${totalSaved}건 저장`,
    from: fromDate,
    results,
  });
}

// v_history_position_20260317154821
