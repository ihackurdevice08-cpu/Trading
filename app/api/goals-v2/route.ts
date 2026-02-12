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

// ---------------- GET ----------------
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
    .eq("status","active")
    .order("created_at",{ascending:false});

  if(error) return bad(error.message,500);

  return ok({ goals: goals || [] });
}

// ---------------- POST ----------------
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

// ---------------- PATCH ----------------
export async function PATCH(req:Request){
  const sbAuth = await sbFromCookies();
  const { data } = await sbAuth.auth.getUser();
  const user = data.user;
  if(!user) return bad("unauthorized",401);

  const body = await req.json().catch(()=>null);
  if(!body || !body.id) return bad("id required");

  const updates:any = {};
  if(body.current_value !== undefined) updates.current_value = body.current_value;
  if(body.status) updates.status = body.status;

  const { error } = await supabaseServer()
    .from("goals_v2")
    .update(updates)
    .eq("id", body.id)
    .eq("user_id", user.id);

  if(error) return bad(error.message,500);

  return ok({});
}

// ---------------- DELETE (archive) ----------------
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
