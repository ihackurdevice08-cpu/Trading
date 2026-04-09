import { NextResponse } from "next/server";
import { getAuthInfo } from "@/lib/firebase/serverAuth";
import { queryDocs, deleteDoc, getDoc } from "@/lib/firebase/firestoreRest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 55;

function bad(m: string, s = 400) { return NextResponse.json({ ok: false, error: m }, { status: s }); }

export async function GET() {
  const auth = await getAuthInfo();
  if (!auth) return bad("unauthorized", 401);
  const { uid, token } = auth;

  const rsDoc = await getDoc(token, `users/${uid}/risk_settings/default`);
  const pnlFrom: string | null = rsDoc?.pnl_from ? String(rsDoc.pnl_from) : null;
  if (!pnlFrom) return NextResponse.json({ ok: true, count: 0, note: "사이클 시작일 없음" });

  const cutoff = new Date(pnlFrom).toISOString();
  const oldDocs = await queryDocs(token, `users/${uid}/manual_trades`, {
    where: {
      fieldFilter: {
        field: { fieldPath: "opened_at" },
        op: "LESS_THAN",
        value: { timestampValue: cutoff },
      },
    },
    limit: 10000,
  });

  return NextResponse.json({ ok: true, count: oldDocs.length, cutoff: pnlFrom });
}

export async function DELETE(req: Request) {
  const auth = await getAuthInfo();
  if (!auth) return bad("unauthorized", 401);
  const { uid, token } = auth;

  const body = await req.json().catch(() => ({}));
  if (body.confirm !== "삭제") return bad("confirm === '삭제' 필요");

  const rsDoc = await getDoc(token, `users/${uid}/risk_settings/default`);
  const pnlFrom: string | null = rsDoc?.pnl_from ? String(rsDoc.pnl_from) : null;
  if (!pnlFrom) return bad("사이클 시작일 없음 — 삭제 불가");

  const cutoff = new Date(pnlFrom).toISOString();
  const oldDocs = await queryDocs(token, `users/${uid}/manual_trades`, {
    where: {
      fieldFilter: {
        field: { fieldPath: "opened_at" },
        op: "LESS_THAN",
        value: { timestampValue: cutoff },
      },
    },
    limit: 10000,
  });

  let deleted = 0;
  const errors: string[] = [];
  for (let i = 0; i < oldDocs.length; i += 50) {
    const results = await Promise.allSettled(
      oldDocs.slice(i, i + 50).map(d =>
        deleteDoc(token, `users/${uid}/manual_trades/${d.__id}`)
      )
    );
    for (const r of results) {
      if (r.status === "fulfilled") deleted++;
      else errors.push(String((r as PromiseRejectedResult).reason?.message ?? "err"));
    }
  }

  return NextResponse.json({ ok: true, deleted, errors: errors.slice(0, 5), cutoff: pnlFrom });
}
