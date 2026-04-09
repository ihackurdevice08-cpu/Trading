/**
 * /api/cycles
 * GET  — 사이클 목록 (최신순)
 * POST — 새 사이클 시작 (서버에서 Bitget 잔고 직접 스냅샷)
 * PATCH — 사이클 종료 (end_date, end_equity 기록)
 */
import { NextResponse } from "next/server";
import { getAuthInfo }         from "@/lib/firebase/serverAuth";
import { queryDocs, addDoc, setDoc } from "@/lib/firebase/firestoreRest";
import { fetchBitgetEquity }   from "@/lib/exchange/bitget";
import type { Cycle }          from "@/types/dashboard";

export const runtime     = "nodejs";
export const dynamic     = "force-dynamic";
export const maxDuration = 20; // Bitget API 호출 포함

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

  const body  = await req.json().catch(() => ({}));
  const title = String(body.title ?? "").trim();
  const note  = body.note ?? null;

  if (!title) return bad("title 필요");

  // ── 핵심: 서버에서 직접 Bitget 잔고 조회 (클라이언트 값 무시) ──
  let realEquity: number | null = await fetchBitgetEquity(uid, token);

  // Bitget API 실패 시 클라이언트 전송값 fallback (graceful degradation)
  if (realEquity === null && Number.isFinite(Number(body.start_equity))) {
    realEquity = Number(body.start_equity);
  }
  if (realEquity === null) return bad("잔고 조회 실패 — Bitget API 연결을 확인하세요");

  const today = new Date().toISOString().slice(0, 10);

  // 진행 중인 이전 사이클 → end_equity도 현재 실제 잔고로 기록
  const existing = await queryDocs(token, `users/${uid}/cycles`, {
    orderBy: [{ field: { fieldPath: "start_date" }, direction: "DESCENDING" }],
    limit: 1,
  });
  if (existing.length > 0 && !existing[0].end_date) {
    await setDoc(token, `users/${uid}/cycles/${existing[0].__id}`, {
      end_date:   today,
      end_equity: realEquity, // 현재 시점의 실제 잔고로 종료
    }, true);
  }

  // 새 사이클 생성 — start_equity = 실제 거래소 잔고
  const id = await addDoc(token, `users/${uid}/cycles`, {
    title,
    start_date:   today,
    end_date:     null,
    start_equity: realEquity,
    end_equity:   null,
    note,
    created_at:   new Date(),
  });

  // risk_settings.pnl_from 오늘로 갱신
  await setDoc(
    token,
    `users/${uid}/risk_settings/default`,
    { pnl_from: today },
    true
  );

  return NextResponse.json({ ok: true, id, start_date: today, start_equity: realEquity });
}

export async function PATCH(req: Request) {
  const auth = await getAuthInfo();
  if (!auth) return bad("unauthorized", 401);
  const { uid, token } = auth;

  const body = await req.json().catch(() => ({}));
  if (!body.id) return bad("id 필요");

  // end_equity: 클라이언트가 보낸 값이 있으면 사용, 없으면 서버에서 직접 조회
  let endEquity: number | null = null;
  if (Number.isFinite(Number(body.end_equity))) {
    endEquity = Number(body.end_equity);
  } else {
    endEquity = await fetchBitgetEquity(uid, token);
  }

  await setDoc(token, `users/${uid}/cycles/${body.id}`, {
    end_date:   new Date().toISOString().slice(0, 10),
    end_equity: endEquity,
  }, true);

  return NextResponse.json({ ok: true, end_equity: endEquity });
}
