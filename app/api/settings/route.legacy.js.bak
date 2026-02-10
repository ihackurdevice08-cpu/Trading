import { NextResponse } from "next/server";
import { supabaseRouteClient } from "@/lib/supabase/route";

export async function POST(request) {
  const { supabase, response } = supabaseRouteClient(request);

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();

  const payload = {
    user_id: user.id,
    exchange_url: body.exchange_url || "",
    ddari_url: body.ddari_url || "",
    spotify_url: body.spotify_url || "",
    docs_url: body.docs_url || "",
    sheets_url: body.sheets_url || "",
    checklist: Array.isArray(body.checklist) ? body.checklist : [],
    emergency: body.emergency && typeof body.emergency === "object" ? body.emergency : {},
  };

  const { error } = await supabase
    .from("user_settings")
    .upsert(payload, { onConflict: "user_id" });

  if (error) return NextResponse.json({ error: "db_error" }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200, headers: response.headers });
}
