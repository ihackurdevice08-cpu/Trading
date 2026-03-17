import { NextResponse } from "next/server";
import { getAuthInfo } from "@/lib/firebase/serverAuth";
import { queryDocs } from "@/lib/firebase/firestoreRest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await getAuthInfo();
  if (!auth) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { uid, token } = auth;

  const url = new URL(req.url);
  const fromDate = url.searchParams.get("from") || "2026-03-15";
  const fromMs = new Date(fromDate + "T00:00:00Z").getTime();

  // fills_raw 최근 200건 샘플 - trade_side 분포 파악
  const fills = await queryDocs(token, `users/${uid}/fills_raw`, {
    where: {
      fieldFilter: {
        field: { fieldPath: "ts_ms" },
        op: "GREATER_THAN_OR_EQUAL",
        value: { integerValue: String(fromMs) },
      }
    },
    orderBy: [{ field: { fieldPath: "ts_ms" }, direction: "DESCENDING" }],
    limit: 200,
  });

  // trade_side 분포
  const tradeSideDist: Record<string, number> = {};
  const priceDist = { zero: 0, nonzero: 0 };
  const sizeDist  = { zero: 0, nonzero: 0 };

  const samples: any[] = [];

  for (const f of fills) {
    const payload = typeof f.payload === "string" ? JSON.parse(f.payload) : (f.payload ?? {});
    const ts = String(f.trade_side || payload?.tradeSide || "MISSING").toLowerCase();
    tradeSideDist[ts] = (tradeSideDist[ts] || 0) + 1;
    Number(f.price) === 0 ? priceDist.zero++ : priceDist.nonzero++;
    Number(f.size)  === 0 ? sizeDist.zero++  : sizeDist.nonzero++;

    if (samples.length < 10) {
      samples.push({
        trade_side: f.trade_side,
        payload_tradeSide: payload?.tradeSide,
        price: f.price,
        size: f.size,
        pnl: f.pnl,
        ts_ms: f.ts_ms,
        order_id: f.order_id,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    from: fromDate,
    totalFills: fills.length,
    tradeSideDist,
    priceDist,
    sizeDist,
    samples,
  });
}
