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

function startOfPeriod(period:string){
  const now = new Date();
  if(period==="daily"){
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  }
  if(period==="weekly"){
    const day = now.getDay();
    const diff = now.getDate() - day + (day===0?-6:1);
    return new Date(now.getFullYear(), now.getMonth(), diff).toISOString();
  }
  if(period==="monthly"){
    return new Date(now.getFullYear(), now.getMonth(),1).toISOString();
  }
  return null;
}

export async function GET(){
  const sbAuth = await sbFromCookies();
  const { data } = await sbAuth.auth.getUser();
  const uid = data.user?.id;
  if(!uid) return bad("unauthorized",401);

  const sb = supabaseServer();

  const { data: goals, error } = await sb
    .from("goals_v2")
    .select("*")
    .eq("user_id", uid)
    .eq("status","active");

  if(error) return bad(error.message,500);

  const enriched = [];

  for(const g of goals||[]){
    let current = g.current_value ?? 0;

    if(g.type==="pnl" && g.mode==="auto"){
      const from = startOfPeriod(g.period);
      if(from){
        const { data: rows } = await sb
          .from("manual_trades")
          .select("pnl")
          .eq("user_id", uid)
          .gte("opened_at", from);

        current = (rows||[]).reduce((acc:any,r:any)=>acc+(Number(r.pnl)||0),0);
      }
    }

    enriched.push({ ...g, current_value: current });
  }

  return ok({ goals: enriched });
}

export async function POST(req:Request){
  const sbAuth = await sbFromCookies();
  const { data } = await sbAuth.auth.getUser();
  const user = data.user;
  if(!user) return bad("unauthorized",401);

  const body = await req.json().catch(()=>null);
  if(!body) return bad("invalid json");

  const payload = {
    user_id: user.id,
    title: body.title,
    type: body.type,
    mode: body.mode,
    period: body.period,
    target_value: body.target_value ?? null,
    current_value: body.current_value ?? 0,
    unit: body.unit,
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

  const { error } = await supabaseServer()
    .from("goals_v2")
    .update(body)
    .eq("id", body.id)
    .eq("user_id", user.id);

  if(error) return bad(error.message,500);

  return ok({});
}

export async function DELETE(req:Request){
  const sbAuth = await sbFromCookies();
  const { data } = await sbAuth.auth.getUser();
  const uid = data.user?.id;
  if(!uid) return bad("unauthorized",401);

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if(!id) return bad("id required");

  const { error } = await supabaseServer()
    .from("goals_v2")
    .update({ status:"archived" })
    .eq("id", id)
    .eq("user_id", uid);

  if(error) return bad(error.message,500);

  return ok({});
}
