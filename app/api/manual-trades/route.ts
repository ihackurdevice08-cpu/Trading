import { NextResponse } from "next/server";
import { getAuthInfo } from "@/lib/firebase/serverAuth";
import { listDocs, queryDocs, addDoc, deleteDoc, batchWrite, toFireValue } from "@/lib/firebase/firestoreRest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(msg: string, s = 400) { return NextResponse.json({ ok: false, error: msg }, { status: s }); }

function toISO(v: any): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") return v;
  return null;
}

function mapTrade(doc: Record<string, any>) {
  return {
    id:        doc.__id,
    symbol:    doc.symbol    ?? null,
    side:      doc.side      ?? null,
    opened_at: toISO(doc.opened_at),
    closed_at: toISO(doc.closed_at),
    pnl:       doc.pnl       ?? null,
    tags:      doc.tags      ?? [],
    notes:     doc.notes     ?? null,
    group_id:  doc.group_id  ?? null,
  };
}

export async function GET(req: Request) {
  const auth = await getAuthInfo();
  if (!auth) return bad("unauthorized", 401);
  const { uid, token } = auth;

  const url    = new URL(req.url);
  const from   = url.searchParams.get("from");
  const to     = url.searchParams.get("to");
  const symbol = url.searchParams.get("symbol");
  const limit  = Math.min(Number(url.searchParams.get("limit") || "5000"), 10000);

  const colPath = `users/${uid}/manual_trades`;

  let docs: Record<string, any>[];

  if (from || to) {
    // 날짜 필터 — Firestore structured query
    const filters: any[] = [];
    if (from) filters.push({
      fieldFilter: {
        field: { fieldPath: "opened_at" },
        op: "GREATER_THAN_OR_EQUAL",
        value: { timestampValue: new Date(from + "T00:00:00.000Z").toISOString() },
      }
    });
    if (to) filters.push({
      fieldFilter: {
        field: { fieldPath: "opened_at" },
        op: "LESS_THAN_OR_EQUAL",
        value: { timestampValue: new Date(to + "T23:59:59.999Z").toISOString() },
      }
    });

    const queryBody: any = {
      orderBy: [{ field: { fieldPath: "opened_at" }, direction: "DESCENDING" }],
      limit,
    };
    if (filters.length === 1) {
      queryBody.where = filters[0];
    } else if (filters.length > 1) {
      queryBody.where = { compositeFilter: { op: "AND", filters } };
    }

    docs = await queryDocs(token, colPath, queryBody);
  } else {
    // 전체 조회
    docs = await queryDocs(token, colPath, {
      orderBy: [{ field: { fieldPath: "opened_at" }, direction: "DESCENDING" }],
      limit,
    });
  }

  let trades = docs.map(mapTrade);
  if (symbol) trades = trades.filter(t => t.symbol?.toLowerCase().includes(symbol.toLowerCase()));

  return NextResponse.json({ ok: true, trades, count: trades.length, from: from || null });
}

export async function POST(req: Request) {
  const auth = await getAuthInfo();
  if (!auth) return bad("unauthorized", 401);
  const { uid, token } = auth;

  const body   = await req.json().catch(() => ({}));
  const symbol = String(body.symbol || "").trim().toUpperCase();
  const side   = String(body.side   || "").trim().toLowerCase();
  if (!symbol)                             return bad("symbol 필요");
  if (side !== "long" && side !== "short") return bad("side는 long/short");
  if (!body.opened_at)                     return bad("opened_at 필요");

  const data = {
    symbol, side,
    opened_at:  new Date(body.opened_at),
    closed_at:  body.closed_at ? new Date(body.closed_at) : null,
    pnl:        body.pnl != null ? Number(body.pnl) : null,
    tags:       Array.isArray(body.tags) ? [...body.tags.map(String), "manual"] : ["manual"],
    notes:      body.notes    ?? null,
    group_id:   body.group_id ?? null,
    created_at: new Date(),
  };

  const id = await addDoc(token, `users/${uid}/manual_trades`, data);
  return NextResponse.json({ ok: true, trade: { id, ...data,
    opened_at: data.opened_at.toISOString(),
    closed_at: data.closed_at?.toISOString() ?? null,
  }});
}

export async function DELETE(req: Request) {
  const auth = await getAuthInfo();
  if (!auth) return bad("unauthorized", 401);
  const { uid, token } = auth;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return bad("id 필요");

  await deleteDoc(token, `users/${uid}/manual_trades/${id}`);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const auth = await getAuthInfo();
  if (!auth) return bad("unauthorized", 401);
  const { uid, token } = auth;

  const body = await req.json().catch(() => ({}));
  const { ids, group_id, notes, tags } = body;
  if (!Array.isArray(ids) || ids.length === 0) return bad("ids 필요");

  const update: Record<string, any> = {};
  if ("group_id" in body) update.group_id = group_id ?? null;
  if ("notes"    in body) update.notes    = notes    ?? null;
  if ("tags"     in body && Array.isArray(tags)) update.tags = tags;
  if (!Object.keys(update).length) return bad("업데이트할 필드 없음");

  const writes = ids.map(id => ({
    type: "set" as const,
    path: `users/${uid}/manual_trades/${id}`,
    data: update,
    merge: true,
  }));

  await batchWrite(token, writes);
  return NextResponse.json({ ok: true, updated: ids.length });
}
