import { getAuthUserId } from "@/lib/supabase/serverAuth";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ok(payload: any) {
  return NextResponse.json({ ok: true, ...payload });
}
function bad(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}


function toObj(v: any) {
  return v && typeof v === "object" ? v : {};
}
function numOrNull(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function pickTarget(obj: any) {
  if (!obj || typeof obj !== "object") return null;
  return obj.target ?? obj.pnlTarget ?? null;
}

export async function GET() {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const sb = supabaseServer();
  const { data: row, error } = await sb
    .from("goals")
    .select("y,m,w,d")
    .eq("user_id", uid)
    .maybeSingle();

  if (error) return bad(error.message, 500);

  return ok({
    goals: row ?? { y: {}, m: {}, w: {}, d: {} },
  });
}

export async function POST(req: Request) {
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body) return bad("invalid json");

  const nextGoals = {
    y: toObj(body.y),
    m: toObj(body.m),
    w: toObj(body.w),
    d: toObj(body.d),
  };

  const sb = supabaseServer();

  // prev 읽기
  const { data: prev } = await sb
    .from("goals")
    .select("y,m,w,d")
    .eq("user_id", uid)
    .maybeSingle();

  // upsert
  const { error: upErr } = await sb
    .from("goals")
    .upsert({ user_id: uid, ...nextGoals }, { onConflict: "user_id" });

  if (upErr) return bad(upErr.message, 500);

  // history(바뀐 target만 기록) — 테이블이 없으면 그냥 무시
  try {
    const prevSafe = prev ?? { y: {}, m: {}, w: {}, d: {} };
    const scopes: Array<"d" | "w" | "m" | "y"> = ["d", "w", "m", "y"];
    const inserts: any[] = [];

    for (const s of scopes) {
      const prevT = numOrNull(pickTarget((prevSafe as any)[s]));
      const nextT = numOrNull(pickTarget((nextGoals as any)[s]));
      if (nextT === null) continue;
      if (prevT === nextT) continue;
      inserts.push({
        user_id: uid,
        scope: s,
        target: nextT,
        meta: { prev: prevT, by: "manual" },
      });
    }

    if (inserts.length) {
      await sb.from("goals_history").insert(inserts);
    }
  } catch (_) {}

  return ok({});
}
