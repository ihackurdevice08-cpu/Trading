import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/supabase/serverAuth";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(status: number, body: any) {
  return NextResponse.json(body, { status });
}

async function authUid() {
  try {
    const uid = await getAuthUserId();
    return { uid, error: uid ? null : "unauthorized" };
  } catch (e: any) {
    return { uid: null as any, error: e?.message || String(e) };
  }
}

export async function GET(req: Request) {
  try {
    const { uid, error } = await authUid();
    if (!uid) return json(401, { ok: false, error });

    const sb = supabaseServer();
    const { data, error: qerr } = await sb
      .from("journal_entries")
      .select("id, content, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(200);

    if (qerr) return json(500, { ok: false, error: qerr.message });
    return json(200, { ok: true, entries: data || [] });
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
      .select("id, content, created_at")
      .single();

    if (ierr) return json(500, { ok: false, error: ierr.message });
    return json(200, { ok: true, entry: data });
  } catch (e: any) {
    return json(500, { ok: false, error: "journal POST failed", detail: e?.message || String(e) });
  }
}

export async function DELETE(req: Request) {
  try {
    const { uid, error } = await authUid();
    if (!uid) return json(401, { ok: false, error });

    // 1) query ?id=
    let id: string | null = null;
    try {
      const u = new URL(req.url);
      id = u.searchParams.get("id");
    } catch {}

    // 2) body {id}
    if (!id) {
      const body = await req.json().catch(() => null);
      id = body?.id ? String(body.id) : null;
    }

    if (!id) return json(400, { ok: false, error: "id required" });

    const sb = supabaseServer();
    const { error: derr } = await sb
      .from("journal_entries")
      .delete()
      .eq("user_id", uid)
      .eq("id", id);

    if (derr) return json(500, { ok: false, error: derr.message });
    return json(200, { ok: true, id });
  } catch (e: any) {
    return json(500, { ok: false, error: "journal DELETE failed", detail: e?.message || String(e) });
  }
}
