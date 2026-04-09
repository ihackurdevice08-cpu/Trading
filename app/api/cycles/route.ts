/**
 * /api/cycles
 * GET  — 사이클 목록 (최신순)
 * POST — 새 사이클 시작 (자산 스냅샷 + pnl_from 갱신)
 * PATCH — 사이클 종료 (end_date, end_equity 기록)
 */
import { NextResponse } from "next/server";
import { getAuthInfo } from "@/lib/firebase/serverAuth";
import { queryDocs, addDoc, setDoc } from "@/lib/firebase/firestoreRest";
import type { Cycle } from "@/types/dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bad(m: string, s = 400) {
  return NextResponse.json({ ok: false, error: m }, { status: s });
}

export async function GET() {
  const auth = await getAuthInfo();
  if (!auth) return bad("unauthorized", 401);
  const { uid, token } = auth;

  const docs = await queryDocs(token, `users/${uid}/cycles`, {
    orderBy: [{ field: { fieldPath: "start_date" }, direction: "DESCENDING" }],
    limit: 50,
  });

  const cycles: Cycle[] = docs.map(d => ({
    id:           d.__id,
    title:        String(d.title ?? "사이클"),
    start_date:   String(d.start_date ?? ""),
    end_date:     d.end_date ? String(d.end_date) : null,
    start_equity: Number(d.start_equity ?? 0),
    end_equity:   d.end_equity != null ? Number(d.end_equity) : null,
    note:         d.note ? String(d.note) : null,
  }));

  return NextResponse.json({ ok: true, cycles });
}

export async function POST(req: Request) {
  const auth = await getAuthInfo();
  if (!auth) return bad("unauthorized", 401);
  const { uid, token } = auth;

  const body = await req.json().catch(() => ({}));
  const { title, start_equity, note } = body;

  if (!title?.trim()) return bad("title 필요");
  if (!Number.isFinite(Number(start_equity))) return bad("start_equity 필요");

  const today = new Date().toISOString().slice(0, 10);

  // 진행 중인 이전 사이클 종료 처리
  const existing = await queryDocs(token, `users/${uid}/cycles`, {
    orderBy: [{ field: { fieldPath: "start_date" }, direction: "DESCENDING" }],
    limit: 1,
  });
  if (existing.length > 0 && !existing[0].end_date) {
    await setDoc(token, `users/${uid}/cycles/${existing[0].__id}`, { end_date: today }, true);
  }

  // 새 사이클 생성
  const id = await addDoc(token, `users/${uid}/cycles`, {
    title:        title.trim(),
    start_date:   today,
    end_date:     null,
    start_equity: Number(start_equity),
    end_equity:   null,
    note:         note ?? null,
    created_at:   new Date(),
  });

  // pnl_from 오늘로 갱신
  await setDoc(token, `users/${uid}/risk_settings/default`, { pnl_from: today }, true);

  return NextResponse.json({ ok: true, id, start_date: today });
}

export async function PATCH(req: Request) {
  const auth = await getAuthInfo();
  if (!auth) return bad("unauthorized", 401);
  const { uid, token } = auth;

  const body = await req.json().catch(() => ({}));
  if (!body.id) return bad("id 필요");

  await setDoc(token, `users/${uid}/cycles/${body.id}`, {
    end_date:   new Date().toISOString().slice(0, 10),
    end_equity: body.end_equity != null ? Number(body.end_equity) : null,
  }, true);

  return NextResponse.json({ ok: true });
}
