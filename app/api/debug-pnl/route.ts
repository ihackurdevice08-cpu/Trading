import { NextResponse } from "next/server";
import { getAuthInfo } from "@/lib/firebase/serverAuth";
import { queryDocs } from "@/lib/firebase/firestoreRest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await getAuthInfo();
  if (!auth) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { uid, token } = auth;
  const trades = await queryDocs(token, `users/${uid}/manual_trades`, {
    orderBy: [{ field: { fieldPath: "opened_at" }, direction: "DESCENDING" }],
    limit: 20,
  });
  return NextResponse.json({ ok: true, count: trades.length, sample: trades.slice(0, 3) });
}
