import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/firebase/serverAuth";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(msg: string, status = 400) { return NextResponse.json({ ok: false, error: msg }, { status }); }

function docToTrade(d: FirebaseFirestore.DocumentSnapshot) {
  const data = d.data() ?? {};
  function tsToISO(v: any): string | null {
    if (!v) return null;
    if (typeof v.toDate === "function") return v.toDate().toISOString();
    if (v instanceof Date) return v.toISOString();
    return new Date(v).toISOString();
  }
  return {
    id:         d.id,
    symbol:     data.symbol    ?? null,
    side:       data.side      ?? null,
    opened_at:  tsToISO(data.opened_at),
    closed_at:  tsToISO(data.closed_at),
    pnl:        data.pnl       ?? null,
    tags:       data.tags      ?? [],
    notes:      data.notes     ?? null,
    group_id:   data.group_id  ?? null,
  };
}

export async function GET(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const url    = new URL(req.url);
  const from   = url.searchParams.get("from");
  const to     = url.searchParams.get("to");
  const symbol = url.searchParams.get("symbol");
  const limit  = Math.min(Number(url.searchParams.get("limit") || "5000"), 10000);

  const col = adminDb().collection("users").doc(uid).collection("manual_trades");

  let q: FirebaseFirestore.Query;

  if (from || to) {
    // range query — opened_at 단일 필드 index (Firestore 자동 생성)
    q = col;
    if (from) q = q.where("opened_at", ">=", new Date(from + "T00:00:00.000Z"));
    if (to)   q = q.where("opened_at", "<=", new Date(to   + "T23:59:59.999Z"));
    q = q.orderBy("opened_at", "desc");
  } else {
    // 전체: desc 정렬 + limit
    q = col.orderBy("opened_at", "desc").limit(limit);
  }

  const snap   = await q.get();
  let trades   = snap.docs.map(docToTrade);

  if (symbol) trades = trades.filter(t => t.symbol?.toLowerCase().includes(symbol.toLowerCase()));

  return NextResponse.json({ ok: true, trades, from: from || null, count: trades.length });
}

export async function POST(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const body   = await req.json().catch(() => ({}));
  const symbol = String(body.symbol || "").trim().toUpperCase();
  const side   = String(body.side   || "").trim().toLowerCase();
  if (!symbol)                             return bad("symbol 필요");
  if (side !== "long" && side !== "short") return bad("side는 long/short");
  if (!body.opened_at)                     return bad("opened_at 필요");

  const ref     = adminDb().collection("users").doc(uid).collection("manual_trades").doc();
  const payload = {
    symbol, side,
    opened_at:  new Date(body.opened_at),
    closed_at:  body.closed_at ? new Date(body.closed_at) : null,
    pnl:        body.pnl != null ? Number(body.pnl) : null,
    tags:       Array.isArray(body.tags) ? [...body.tags.map(String), "manual"] : ["manual"],
    notes:      body.notes   ?? null,
    group_id:   body.group_id ?? null,
    created_at: new Date(),
  };
  await ref.set(payload);
  return NextResponse.json({ ok: true, trade: {
    id: ref.id, ...payload,
    opened_at: payload.opened_at.toISOString(),
    closed_at: payload.closed_at?.toISOString() ?? null,
  }});
}

export async function DELETE(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return bad("id 필요");
  await adminDb().collection("users").doc(uid).collection("manual_trades").doc(id).delete();
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);
  const body = await req.json().catch(() => ({}));
  const { ids, group_id, notes, tags } = body;
  if (!Array.isArray(ids) || ids.length === 0) return bad("ids 필요");
  const update: Record<string, any> = {};
  if ("group_id" in body) update.group_id = group_id ?? null;
  if ("notes"    in body) update.notes    = notes    ?? null;
  if ("tags"     in body && Array.isArray(tags)) update.tags = tags;
  if (!Object.keys(update).length) return bad("업데이트할 필드 없음");
  const db    = adminDb();
  const batch = db.batch();
  for (const id of ids) {
    batch.update(db.collection("users").doc(uid).collection("manual_trades").doc(id), update);
  }
  await batch.commit();
  return NextResponse.json({ ok: true, updated: ids.length });
}
