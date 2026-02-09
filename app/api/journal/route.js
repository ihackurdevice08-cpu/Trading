import { NextResponse } from "next/server";
import { supabaseRouteClient } from "@/lib/supabase/route";

export async function POST(request) {
  const { supabase, response } = supabaseRouteClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { content } = await request.json();
  const text = String(content || "").trim();
  if (!text) return NextResponse.json({ error: "empty" }, { status: 400 });

  const { data, error } = await supabase
    .from("journal_entries")
    .insert({ user_id: user.id, content: text })
    .select("id, content, created_at")
    .single();

  if (error) return NextResponse.json({ error: "db_error" }, { status: 500 });

  return NextResponse.json(data, { status: 200, headers: response.headers });
}

export async function DELETE(request) {
  const { supabase, response } = supabaseRouteClient(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });

  const { error } = await supabase
    .from("journal_entries")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: "db_error" }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 200, headers: response.headers });
}
