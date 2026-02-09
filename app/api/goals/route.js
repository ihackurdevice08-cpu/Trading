import { NextResponse } from "next/server";
import { supabaseRouteClient } from "@/lib/supabase/route";

export async function POST(request) {
  const { supabase, response } = supabaseRouteClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();

  const payload = {
    user_id: user.id,
    y: body.y && typeof body.y === "object" ? body.y : {},
    m: body.m && typeof body.m === "object" ? body.m : {},
    w: body.w && typeof body.w === "object" ? body.w : {},
    d: body.d && typeof body.d === "object" ? body.d : {},
  };

  const { error } = await supabase
    .from("goals")
    .upsert(payload, { onConflict: "user_id" });

  if (error) return NextResponse.json({ error: "db_error" }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200, headers: response.headers });
}
