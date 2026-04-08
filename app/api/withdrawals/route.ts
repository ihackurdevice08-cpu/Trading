import { NextResponse } from "next/server";
import { getAuthInfo } from "@/lib/firebase/serverAuth";
import { listDocs, addDoc, deleteDoc, setDoc, getDoc } from "@/lib/firebase/firestoreRest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(m: string, s = 400) { return NextResponse.json({ ok: false, error: m }, { status: s }); }

function toDateStr(v: any): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "string") return v.slice(0, 10);
  return null;
}

export async function GET() {
  const auth = await getAuthInfo();
  if (!auth) return bad("unauthorized", 401);
  const { uid, token } = auth;

  const docs = await listDocs(token, `users/${uid}/withdrawals`);

  const withdrawals = docs.map(d => ({
    id:           d.__id,
    amount:       Number(d.amount || 0),
    source:       d.source ?? "profit",
    note:         d.note ?? null,
    withdrawn_at: toDateStr(d.withdrawn_at) ?? toDateStr(d.date) ?? toDateStr(d.created_at) ?? null,
    sort_order:   d.sort_order ?? null,  // 드래그앤드롭 정렬용
    created_at:   d.created_at instanceof Date ? d.created_at.toISOString() : String(d.created_at ?? ""),
  }));

  // 정렬: sort_order 있으면 우선, 없으면 날짜 오름차순 → created_at 오름차순
  withdrawals.sort((a, b) => {
    if (a.sort_order !== null && b.sort_order !== null) return a.sort_order - b.sort_order;
    if (a.sort_order !== null) return -1;
    if (b.sort_order !== null) return 1;
    const dateA = a.withdrawn_at ?? "";
    const dateB = b.withdrawn_at ?? "";
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return (a.created_at ?? "").localeCompare(b.created_at ?? "");
  });

  // 사이클 시작일 (risk_settings.pnl_from)
  const rsDoc = await getDoc(token, `users/${uid}/risk_settings/default`);
  const cycleFrom: string | null = rsDoc?.pnl_from ? String(rsDoc.pnl_from).slice(0, 10) : null;

  const totals = {
    total:  withdrawals.reduce((s, w) => s + w.amount, 0),
    profit: withdrawals.filter(w => w.source === "profit").reduce((s, w) => s + w.amount, 0),
    seed:   withdrawals.filter(w => w.source === "seed").reduce((s, w) => s + w.amount, 0),
    rebate: withdrawals.filter(w => w.source === "rebate").reduce((s, w) => s + w.amount, 0),
  };

  // 사이클 기준 합계 (cycleFrom 이후 출금만)
  const cycleItems = cycleFrom
    ? withdrawals.filter(w => (w.withdrawn_at ?? "") >= cycleFrom)
    : withdrawals;

  const cycleTotals = {
    total:  cycleItems.reduce((s, w) => s + w.amount, 0),
    profit: cycleItems.filter(w => w.source === "profit").reduce((s, w) => s + w.amount, 0),
    seed:   cycleItems.filter(w => w.source === "seed").reduce((s, w) => s + w.amount, 0),
    rebate: cycleItems.filter(w => w.source === "rebate").reduce((s, w) => s + w.amount, 0),
  };

  return NextResponse.json({ ok: true, withdrawals, totals, cycleTotals, cycleFrom });
}

export async function POST(req: Request) {
  const auth = await getAuthInfo();
  if (!auth) return bad("unauthorized", 401);
  const { uid, token } = auth;

  const body = await req.json().catch(() => ({}));
  if (!body.amount || Number(body.amount) <= 0) return bad("amount 필요");

  const dateStr = body.withdrawn_at || body.date
    ? (body.withdrawn_at || body.date)
    : new Date().toISOString().slice(0, 10);

  const id = await addDoc(token, `users/${uid}/withdrawals`, {
    amount:       Number(body.amount),
    source:       body.source ?? "profit",
    note:         body.note   ?? null,
    withdrawn_at: dateStr,
    sort_order:   null,  // 새 항목은 날짜 기준 자동 정렬
    created_at:   new Date(),
  });

  return NextResponse.json({ ok: true, id });
}

export async function PATCH(req: Request) {
  const auth = await getAuthInfo();
  if (!auth) return bad("unauthorized", 401);
  const { uid, token } = auth;

  const body = await req.json().catch(() => ({}));
  const { id, amount, note, sort_orders } = body;

  // sort_orders: { [id]: number } — 드래그앤드롭 순서 일괄 업데이트
  if (sort_orders && typeof sort_orders === "object") {
    await Promise.all(
      Object.entries(sort_orders).map(([wId, order]) =>
        setDoc(token, `users/${uid}/withdrawals/${wId}`, { sort_order: order }, true)
      )
    );
    return NextResponse.json({ ok: true, updated: Object.keys(sort_orders).length });
  }

  // 단일 항목 수정 (금액, 메모)
  if (!id) return bad("id 필요");
  const update: Record<string, any> = {};
  if (amount != null && Number(amount) > 0) update.amount = Number(amount);
  if (note   != null)                       update.note   = note;
  if (!Object.keys(update).length) return bad("수정할 필드 없음");

  await setDoc(token, `users/${uid}/withdrawals/${id}`, update, true);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const auth = await getAuthInfo();
  if (!auth) return bad("unauthorized", 401);
  const { uid, token } = auth;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return bad("id 필요");

  await deleteDoc(token, `users/${uid}/withdrawals/${id}`);
  return NextResponse.json({ ok: true });
}
