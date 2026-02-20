import { getAuthUserId } from "@/lib/supabase/serverAuth";
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";


function ok(payload:any){ return NextResponse.json({ ok:true, ...payload }); }
function bad(msg:string, status=400){ return NextResponse.json({ ok:false, error:msg }, { status }); }

export async function GET(){
  const uid = await getAuthUserId();
  if (!uid) return bad("unauthorized", 401);

  const sb = supabaseServer();
  const { data: rows, error } = await sb
    .from("risk_events")
    .select("*")
    .eq("user_id", uid)
    .order("created_at", { ascending:false })
    .limit(100);

  if(error) return bad(error.message,500);

  const events = rows || [];

  const stopCount = events.filter((e:any)=>e.state==="STOP").length;
  const slowdownCount = events.filter((e:any)=>e.state==="SLOWDOWN").length;

  const reasonMap: Record<string, number> = {};
  for(const e of events as any[]){
    for(const r of (e.reasons || []) as any[]){
      const k = String(r);
      reasonMap[k] = (reasonMap[k] || 0) + 1;
    }
  }

  return ok({
    events,
    stats:{
      total: events.length,
      stopCount,
      slowdownCount,
      reasons: reasonMap
    }
  });
}
