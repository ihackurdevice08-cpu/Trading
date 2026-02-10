import { NextResponse } from "next/server";

export async function POST() {
  // 다음 단계에서: Bitget fetch -> trade_raw upsert -> trades upsert
  return NextResponse.json({ ok: true, note: "sync-now stub (next step will connect Bitget)" });
}
