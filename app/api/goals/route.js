import { NextResponse } from "next/server";
import { supabaseRouteClient } from "@/lib/supabase/route";

function numOrNull(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function pickTarget(obj){
  if (!obj || typeof obj !== "object") return null;
  // target or pnlTarget 둘 다 허용 (호환)
  return obj.target ?? obj.pnlTarget ?? null;
}

export async function GET(request) {
  const { supabase, response } = supabaseRouteClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("goals")
    .select("y,m,w,d")
    .eq("user_id", user.id)
    .single();

  if (error && error.code !== "PGRST116") { // no rows
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, goals: data || { y:{}, m:{}, w:{}, d:{} } }, { status: 200, headers: response.headers });
}

export async function POST(request) {
  const { supabase, response } = supabaseRouteClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();

  // 들어온 goals 구조를 기존 형태(y/m/w/d 객체)로 강제
  const nextGoals = {
    y: body.y && typeof body.y === "object" ? body.y : {},
    m: body.m && typeof body.m === "object" ? body.m : {},
    w: body.w && typeof body.w === "object" ? body.w : {},
    d: body.d && typeof body.d === "object" ? body.d : {},
  };

  // 기존 목표 읽기(히스토리 비교용)
  const { data: prev } = await supabase
    .from("goals")
    .select("y,m,w,d")
    .eq("user_id", user.id)
    .single();

  const payload = {
    user_id: user.id,
    ...nextGoals,
  };

  const { error } = await supabase
    .from("goals")
    .upsert(payload, { onConflict: "user_id" });

  if (error) return NextResponse.json({ error: "db_error" }, { status: 500 });

  // 히스토리 기록(바뀐 항목만)
  // d/w/m/y 의 target 값이 바뀌면 goals_history에 insert
  const scopes = ["d","w","m","y"];
  const prevSafe = prev || { d:{}, w:{}, m:{}, y:{} };

  const inserts = [];
  for (const s of scopes) {
    const prevT = numOrNull(pickTarget(prevSafe[s]));
    const nextT = numOrNull(pickTarget(nextGoals[s]));
    if (nextT === null) continue; // 목표값이 없으면 기록 안 함
    if (prevT === nextT) continue;
    inserts.push({
      user_id: user.id,
      scope: s,
      target: nextT,
      meta: { prev: prevT, by: "manual" },
    });
  }

  if (inserts.length) {
    await supabase.from("goals_history").insert(inserts);
  }

  return NextResponse.json({ ok: true }, { status: 200, headers: response.headers });
}
