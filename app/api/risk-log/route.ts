import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function ok(data:any){ return NextResponse.json({ ok:true, ...data }); }
function bad(msg:string, status=400){ return NextResponse.json({ ok:false, error:msg }, { status }); }

export async function POST(req:Request){
  const sbAuth = await sbFromCookies();
  const { data } = await sbAuth.auth.getUser();
  const uid = data.user?.id;
  if(!uid) return bad("unauthorized",401);

  const body = await req.json().catch(()=>null);
  if(!body) return bad("invalid json");

  const kind = String(body.kind || "warning"); // warning | breach | note
  const state = String(body.state || "NORMAL"); // NORMAL | SLOWDOWN | STOP
  const reasons = Array.isArray(body.reasons) ? body.reasons.map(String) : [];
  const trade_id = body.trade_id ? String(body.trade_id) : null;
  const message = body.message ? String(body.message) : null;
  const meta = (body.meta && typeof body.meta === "object") ? body.meta : {};

  const sb = supabaseServer();
  const { error } = await sb.from("risk_events").insert({
    user_id: uid,
    kind,
    state,
    reasons,
    trade_id,
    message,
    meta
  });

  if(error) return bad(error.message,500);
  return ok({});
}
