// deprecated — Firebase 마이그레이션 완료
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export async function GET()  { return NextResponse.json({ ok: false, error: "deprecated" }, { status: 410 }); }
export async function POST() { return NextResponse.json({ ok: false, error: "deprecated" }, { status: 410 }); }
