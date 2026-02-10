import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// Account-bound settings fields (stored in public.user_settings)
const CORE_FIELDS = [
  "exchange_url",
  "ddari_url",
  "spotify_url",
  "docs_url",
  "sheets_url",
  "checklist",
  "emergency",
  "appearance",
] as const;

type CorePayload = {
  exchange_url?: string;
  ddari_url?: string;
  spotify_url?: string;
  docs_url?: string;
  sheets_url?: string;
  checklist?: string[];
  emergency?: { steps?: string[]; quotes?: string[] };
  appearance?: any; // appearance is managed by AppearanceProvider, but we accept it too
};

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sb = await supabaseServer();
    const { data: auth } = await sb.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    const { data, error } = await sb
      .from("user_settings")
      .select(CORE_FIELDS.join(","))
      .eq("user_id", uid)
      .maybeSingle();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    // If first time, create a row with sane defaults (account-bound persistence)
    if (!data) {
      const seed = {
        user_id: uid,
        exchange_url: "",
        ddari_url: "",
        spotify_url: "",
        docs_url: "",
        sheets_url: "",
        checklist: [],
        emergency: { steps: [], quotes: [] },
        appearance: null,
      };

      const { error: insErr } = await sb.from("user_settings").insert(seed);
      if (insErr) {
        // If row exists due to race, ignore
        // but still return empty defaults
      }
      return NextResponse.json({ ok: true, data: seed });
    }

    return NextResponse.json({ ok: true, data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const sb = await supabaseServer();
    const { data: auth } = await sb.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    const body = (await req.json().catch(() => ({}))) as CorePayload;

    const payload: any = { user_id: uid };

    if (typeof body.exchange_url === "string") payload.exchange_url = body.exchange_url;
    if (typeof body.ddari_url === "string") payload.ddari_url = body.ddari_url;
    if (typeof body.spotify_url === "string") payload.spotify_url = body.spotify_url;
    if (typeof body.docs_url === "string") payload.docs_url = body.docs_url;
    if (typeof body.sheets_url === "string") payload.sheets_url = body.sheets_url;

    if (Array.isArray(body.checklist)) payload.checklist = body.checklist;

    if (body.emergency && typeof body.emergency === "object") {
      const steps = Array.isArray(body.emergency.steps) ? body.emergency.steps : undefined;
      const quotes = Array.isArray(body.emergency.quotes) ? body.emergency.quotes : undefined;
      payload.emergency = { ...(steps ? { steps } : {}), ...(quotes ? { quotes } : {}) };
    }

    if (typeof body.appearance !== "undefined") payload.appearance = body.appearance;

    const { error } = await sb.from("user_settings").upsert(payload, { onConflict: "user_id" });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
