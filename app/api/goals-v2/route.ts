import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ok(data:any){ return NextResponse.json({ ok:true, ...data }); }
function bad(msg:string, status=400){ return NextResponse.json({ ok:false, error:msg }, { status }); }

async function sbFromCookies(){
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies:{
        getAll(){ return store.getAll(); },
        setAll(cs){ cs.forEach(({name,value,options})=>store.set(name,value,options)); }
      }
    }
  );
}

const n = (v:any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export async function GET(req:Request){
  const sbAuth = await sbFromCookies();
  const { data } = await sbAuth.auth.getUser();
  const uid = data.user?.id;
  if(!uid) return bad("unauthorized",401);

  const url = new URL(req.url);
  const includeArchived = url.searchParams.get("includeArchived")==="1";
  const includeCompleted = url.searchParams.get("includeCompleted")==="1";

  const sb = supabaseServer();

  // goals_v2: 기본은 active만. (Dashboard도 이걸로 active만 보이게)
  let q = sb.from("goals_v2").select("*").eq("user_id", uid);

  if(!includeArchived) q = q.neq("status","archived");
  if(!includeCompleted) q = q.neq("status","completed");

  const { data: goals, error: e1 } = await q.order("created_at",{ascending:false});
  if(e1) return bad(e1.message,500);

  // history: 컬럼이 확정이 아니라서 order를 강제하지 않음(안전)
  const { data: history, error: e2 } = await sb
    .from("goals_history")
    .select("*")
    .eq("user_id", uid);
  if(e2) return bad(e2.message,500);

  return ok({ goals: goals||[], history: history||[] });
}

export async function POST(req:Request){
  const sbAuth = await sbFromCookies();
  const { data } = await sbAuth.auth.getUser();
  const user = data.user;
  if(!user) return bad("unauthorized",401);

  const body = await req.json().catch(()=>null);
  if(!body) return bad("invalid json");

  const type = String(body.type || "pnl"); // pnl / withdrawal / counter / boolean
  const title = String(body.title || "").trim();

  if(!title) return bad("title required");

  const payload = {
    user_id: user.id,
    title,
    type,
    mode: (type==="pnl" || type==="withdrawal") ? "auto" : "manual",
    period: String(body.period || "monthly"),
    target_value: (type==="boolean") ? null : n(body.target_value),
    current_value: (type==="boolean") ? 0 : n(body.current_value ?? 0),
    unit: (type==="pnl" || type==="withdrawal") ? "usd" : "count",
    status: "active",
    meta: body.meta ?? {}
  };

  const { data: row, error } = await supabaseServer()
    .from("goals_v2")
    .insert(payload)
    .select("*")
    .single();

  if(error) return bad(error.message,500);

  return ok({ goal: row });
}

export async function PATCH(req:Request){
  const sbAuth = await sbFromCookies();
  const { data } = await sbAuth.auth.getUser();
  const user = data.user;
  if(!user) return bad("unauthorized",401);

  const body = await req.json().catch(()=>null);
  if(!body?.id) return bad("id required");

  const sb = supabaseServer();

  const { data: goal, error: e0 } = await sb
    .from("goals_v2")
    .select("*")
    .eq("id", body.id)
    .single();
  if(e0) return bad(e0.message,500);

  const updated = { ...goal, ...body };

  // 완료 처리 조건:
  // - boolean: current_value=1이면 완료
  // - 숫자 목표: target_value 있고 current>=target이면 완료
  const isBoolean = updated.type === "boolean";
  const hasTarget = updated.target_value != null && n(updated.target_value) > 0;
  const done =
    isBoolean ? n(updated.current_value) >= 1 :
    (hasTarget ? n(updated.current_value) >= n(updated.target_value) : false);

  if(done && updated.status !== "completed"){
    await sb.from("goals_history").insert({
      user_id: user.id,
      goal_id: updated.id,
      type: updated.type,
      title: updated.title,
      target_value: updated.target_value,
      unit: updated.unit,
    });
    updated.status = "completed";
  }

  const { error: e1 } = await sb.from("goals_v2").update({
    title: updated.title,
    type: updated.type,
    mode: updated.mode,
    period: updated.period,
    target_value: updated.target_value,
    current_value: updated.current_value,
    unit: updated.unit,
    status: updated.status,
    meta: updated.meta ?? {},
    updated_at: new Date().toISOString(),
  }).eq("id", updated.id);

  if(e1) return bad(e1.message,500);

  return ok({});
}

export async function DELETE(req:Request){
  const sbAuth = await sbFromCookies();
  const { data } = await sbAuth.auth.getUser();
  const uid = data.user?.id;
  if(!uid) return bad("unauthorized",401);

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const hard = url.searchParams.get("hard")==="1"; // 완전삭제

  if(!id) return bad("id required");

  const sb = supabaseServer();

  if(hard){
    // 목표 + 연결된 히스토리까지 제거 (정말 삭제)
    await sb.from("goals_history").delete().eq("user_id", uid).eq("goal_id", id);
    const { error } = await sb.from("goals_v2").delete().eq("user_id", uid).eq("id", id);
    if(error) return bad(error.message,500);
    return ok({});
  }

  // 기본은 아카이브(숨김)
  const { error } = await sb
    .from("goals_v2")
    .update({ status:"archived", updated_at: new Date().toISOString() })
    .eq("user_id", uid)
    .eq("id", id);

  if(error) return bad(error.message,500);
  return ok({});
}
