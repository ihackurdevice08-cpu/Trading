import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

async function authUid() {
  const store = await cookies();
  const sbAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return store.getAll(); },
        setAll(cs) { cs.forEach(({ name, value, options }) => store.set(name, value, options)); },
      },
    }
  );

  const { data, error } = await sbAuth.auth.getUser();
  if (error) return { uid: null, error: error.message };
  const uid = data.user?.id ?? null;
  return { uid, error: uid ? null : "unauthorized" };
}

export async function GET() {
  try {
    const { uid, error } = await authUid();
    if (!uid) return json(401, { ok: false, error });

    const sb = supabaseServer();
    const { data, error: qerr } = await sb
      .from("journal_entries")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(200);

    if (qerr) return json(500, { ok: false, error: qerr.message });
    return json(200, { ok: true, entries: data ?? [] });
  } catch (e: any) {
    return json(500, { ok: false, error: "journal GET failed", detail: e?.message || String(e) });
  }
}

export async function POST(req: Request) {
  try {
    const { uid, error } = await authUid();
    if (!uid) return json(401, { ok: false, error });

    const body = await req.json().catch(() => null);
    const content = (body?.content ?? "").toString().trim();
    if (!content) return json(400, { ok: false, error: "content required" });

    const sb = supabaseServer();
    const { data, error: ierr } = await sb
      .from("journal_entries")
      .insert({ user_id: uid, content })
      .select("*")
      .single();

    if (ierr) return json(500, { ok: false, error: ierr.message });
    return json(200, { ok: true, entry: data });
  } catch (e: any) {
    return json(500, { ok: false, error: "journal POST failed", detail: e?.message || String(e) });
  }
}
