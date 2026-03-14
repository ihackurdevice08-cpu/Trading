// deprecated — goals-v2/route.ts 로 이전 완료
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export async function GET()    { return NextResponse.json({ ok: false, error: "deprecated, use /api/goals-v2" }, { status: 410 }); }
export async function POST()   { return NextResponse.json({ ok: false, error: "deprecated, use /api/goals-v2" }, { status: 410 }); }
export async function PATCH()  { return NextResponse.json({ ok: false, error: "deprecated, use /api/goals-v2" }, { status: 410 }); }
export async function DELETE() { return NextResponse.json({ ok: false, error: "deprecated, use /api/goals-v2" }, { status: 410 }); }
