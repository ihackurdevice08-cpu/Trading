import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/supabase/serverAuth";
import { supabaseServer } from "@/lib/supabase/server";
import { decryptText } from "@/lib/crypto/dec";
import { bitgetSign } from "@/lib/bitget/sign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ok(data: any)  { return NextResponse.json({ ok: true, ...data }); }
function bad(msg: string, status = 400) { return NextResponse.json({ ok: false, error: msg }, { status }); }

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
  const s  = String(side     || "").toLowerCase();
  if (ts.includes("long"))  return "long";
  if (ts.includes("short")) return "short";
  if (ts.includes("buy"))   return "long";
  if (ts.includes("sell"))  return "short";
  return s === "buy" ? "long" : "short";
}

// fills_raw에 저장 — 컬럼 에러 시 payload만으로 재시도
async function saveFillsRaw(sb: any, rows: any[]): Promise<{ saved: number; error?: string }> {
  // 시도 1: 전체 컬럼
  const { error: e1 } = await sb.from("fills_raw").upsert(rows, { onConflict: "id" });
  if (!e1) return { saved: rows.length };

  // 에러가 없는 컬럼만 남기기 — payload + 최소 필드만
  const minRows = rows.map(r => ({
    id:       r.id,
    user_id:  r.user_id,
    payload:  r.payload,
  }));
  const { error: e2 } = await sb.from("fills_raw").upsert(minRows, { onConflict: "id" });
  if (!e2) return { saved: rows.length };

  return { saved: 0, error: e1.message };
}

// fills_raw → manual_trades 집계
// manual_trades 실제 컬럼: id, user_id, symbol, side, opened_at, closed_at, pnl, tags, notes
async function aggregateFills(uid: string, accountId: string, fromMs: number): Promise<number> {
  const sb = supabaseServer();

  // fills_raw에서 읽기 — payload에 원본 데이터 있음
  const { data: fills, error: fErr } = await sb
    .from("fills_raw")
    .select("id, user_id, payload")
    .eq("user_id", uid)
    .order("id", { ascending: true });

  if (fErr) throw new Error("fills_raw 조회 실패: " + fErr.message);
  if (!fills || fills.length === 0) return 0;

  // payload에서 필요한 값 추출 + accountId 기준 필터
  const myFills = fills.filter(f => {
    const p = f.payload || {};
    return String(f.id).includes(accountId);
  });

  if (myFills.length === 0) return 0;

  // orderId 기준 그룹핑
  const groups: Record<string, any[]> = {};
  for (const f of myFills) {
    const p = f.payload || {};
    const key = String(p.orderId || p.tradeId || f.id);
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  }

  const rows: any[] = [];

  for (const [orderId, group] of Object.entries(groups)) {
    const first = group[0];
    const last  = group[group.length - 1];

    const firstTs = Number(first.cTime || 0);
    const lastTs  = Number(last.cTime  || 0);

    // fromMs 필터
    if (lastTs > 0 && lastTs < fromMs) continue;

    const totalPnl  = group.reduce((s, p) => s + (Number(p.profit) || 0), 0);
    const totalSize = group.reduce((s, p) => s + (Number(p.baseVolume) || 0), 0);
    const avgPrice  = totalSize > 0
      ? group.reduce((s, p) => s + (Number(p.price) || 0) * (Number(p.baseVolume) || 0), 0) / totalSize
      : 0;

    const side   = parseSide(String(first.tradeSide || ""), String(first.side || ""));
    const symbol = String(first.symbol || "").replace(/_UMCBL|_DMCBL|_CMCBL/g, "");

    rows.push({
      id:        `bitget:${accountId}:${orderId}`,
      user_id:   uid,
      symbol,
      side,
      opened_at: firstTs ? new Date(firstTs).toISOString() : new Date().toISOString(),
      closed_at: lastTs  ? new Date(lastTs).toISOString()  : null,
      pnl:       Number(totalPnl.toFixed(4)),
      tags:      ["bitget", "auto-sync"],
      notes:     JSON.stringify({
        fills:     group.length,
        size:      Number(totalSize.toFixed(6)),
        avg_price: Number(avgPrice.toFixed(4)),
        account:   accountId,
      }),
    });
  }

  if (rows.length === 0) return 0;

  const { error } = await sb.from("manual_trades").upsert(rows, { onConflict: "id" });
  if (error) throw new Error("manual_trades upsert 실패: " + error.message);
  return rows.length;
}

export async function POST(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  if (!process.env.ENCRYPTION_SECRET) return bad("ENCRYPTION_SECRET 환경변수 없음", 500);

  const body = await req.json().catch(() => ({}));
  const targetAccountId: string | null = body?.account_id || null;

  const fromDate: string = body?.from
    ? String(body.from)
    : new Date(Date.now() - 730 * 86400_000).toISOString().slice(0, 10);

  const fromMs        = new Date(fromDate + "T00:00:00Z").getTime();
  const fromTimestamp = String(fromMs);

  const sb = supabaseServer();

  let q = sb
    .from("exchange_accounts")
    .select("id, exchange, alias, api_key_enc, api_secret_enc, passphrase_enc")
    .eq("user_id", uid)
    .eq("exchange", "bitget");

  if (targetAccountId) q = q.eq("id", targetAccountId);

  const { data: accounts, error: aErr } = await q;
  if (aErr)           return bad(aErr.message, 500);
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

    const creds      = { apiKey, secret, pass };
    let   rawSaved   = 0;
    const errors: string[] = [];
    let   debugSample: any = null;

    // ── Bitget fill-history 수집 ───────────────────────────────
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

        if (!isOk) {
          errors.push(`HTTP ${httpStatus}: ${json?.msg || "unknown"}`);
          break;
        }
        if (json?.code !== "00000") {
          errors.push(`Bitget 오류 [${json?.code}]: ${json?.msg || "unknown"}`);
          break;
        }

        const list: any[] = json?.data?.fillList ?? json?.data?.list ?? [];
        if (!Array.isArray(list) || list.length === 0) break;

        if (pageCount === 0) {
          debugSample = { fields: Object.keys(list[0]), first: list[0] };
        }

        // fills_raw 저장 — id만 확실, 나머지는 payload에 보존
        const rows = list.map(it => ({
          id:      `${uid}:${acc.id}:${it.tradeId || it.orderId || it.cTime}`,
          user_id: uid,
          payload: it,
        }));

        const { saved, error: saveErr } = await saveFillsRaw(sb, rows);
        if (saveErr) { errors.push(`fills_raw 저장 실패: ${saveErr}`); break; }
        rawSaved += saved;

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
      rawSaved,
      aggregated,
      errors:      errors.length ? errors : undefined,
      _debug:      debugSample,
    });
  }

  const totalRaw = results.reduce((s, r) => s + (r.rawSaved    || 0), 0);
  const totalAgg = results.reduce((s, r) => s + (r.aggregated  || 0), 0);

  return ok({
    note:    `${fromDate} 이후 동기화 — fills ${totalRaw}건, trades ${totalAgg}건`,
    from:    fromDate,
    results,
  });
}
