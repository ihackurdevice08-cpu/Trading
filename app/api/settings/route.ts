import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseServer } from "@/lib/supabase/server";

function supabaseAnon() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anon, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return NextResponse.json({ ok: false, error: "missing bearer token" }, { status: 401 });

  const sbAnon = supabaseAnon();
  const { data: u, error: uErr } = await sbAnon.auth.getUser(token);
  if (uErr || !u?.user?.id) return NextResponse.json({ ok: false, error: "invalid token" }, { status: 401 });

  const user_id = u.user.id;
  const body = await req.json().catch(() => ({}));
  const appearance = body?.appearance ?? body ?? {};

  const sb = supabaseServer();
  const { error } = await sb.from("user_settings").upsert(
    { user_id, appearance },
    { onConflict: "user_id" }
  );

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, note: "Saved. (cloud synced)" });
}
