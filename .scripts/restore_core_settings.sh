#!/usr/bin/env bash
set -euo pipefail
set +H 2>/dev/null || true  # bash history expansion off (fixes: event not found)

cd ~/Documents/GitHub/Trading || exit 1

echo "== 0) Backup legacy route.js if exists =="
if [[ -f "app/api/settings/route.js" ]]; then
  mv "app/api/settings/route.js" "app/api/settings/route.legacy.js.bak"
  echo "OK: moved app/api/settings/route.js -> route.legacy.js.bak"
else
  echo "SKIP: no legacy route.js"
fi

echo "== 1) Patch: app/api/settings/route.ts (single API for core+appearance) =="
mkdir -p "app/api/settings"

cat > "app/api/settings/route.ts" <<'TS'
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
TS

echo "== 2) Patch: Settings page - restore CORE settings cards (keep Appearance section as-is) =="
# We do an "add-only" insert: if core section marker exists, skip.
node <<'NODE'
const fs = require("fs");

const file = "app/(app)/settings/page.tsx";
let s = fs.readFileSync(file, "utf8");

if (!s.includes("/*__CORE_SETTINGS_RESTORED__*/")) {
  // Find a safe insertion point near top of component return.
  // We insert after the first <div style={{ display: "grid"... }} wrapper if present, else after first <Card
  const marker = "<div style={{ display: \"grid\"";
  let idx = s.indexOf(marker);
  if (idx === -1) {
    // fallback: after first occurrence of "return ("
    idx = s.indexOf("return (");
    if (idx === -1) throw new Error("Cannot find return( in settings/page.tsx");
  }

  const insert = `
  /*__CORE_SETTINGS_RESTORED__*/
  // =========================
  // Core Settings (account-bound)
  // =========================
  const [core, setCore] = React.useState({
    exchange_url: "",
    ddari_url: "",
    spotify_url: "",
    docs_url: "",
    sheets_url: "",
    checklistText: "1H/4H 존 확인\\n리스크% 확인\\n진입 근거 2개 이상",
    emergencySteps: "",
    emergencyQuotes: "",
  });

  const loadCore = React.useCallback(async () => {
    try {
      const r = await fetch("/api/settings", { cache: "no-store" });
      const j = await r.json();
      if (!j?.ok) return;
      const d = j.data || {};
      const checklist = Array.isArray(d.checklist) ? d.checklist : [];
      const emergency = d.emergency || {};
      const steps = Array.isArray(emergency.steps) ? emergency.steps : [];
      const quotes = Array.isArray(emergency.quotes) ? emergency.quotes : [];

      setCore((p) => ({
        ...p,
        exchange_url: d.exchange_url || "",
        ddari_url: d.ddari_url || "",
        spotify_url: d.spotify_url || "",
        docs_url: d.docs_url || "",
        sheets_url: d.sheets_url || "",
        checklistText: checklist.length ? checklist.join("\\n") : p.checklistText,
        emergencySteps: steps.join("\\n"),
        emergencyQuotes: quotes.join("\\n"),
      }));
    } catch {}
  }, []);

  const saveCore = React.useCallback(async () => {
    setMsg("Saving…");
    try {
      const checklist = core.checklistText.split("\\n").map((x) => x.trim()).filter(Boolean);
      const steps = core.emergencySteps.split("\\n").map((x) => x.trim()).filter(Boolean);
      const quotes = core.emergencyQuotes.split("\\n").map((x) => x.trim()).filter(Boolean);

      const r = await fetch("/api/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          exchange_url: core.exchange_url,
          ddari_url: core.ddari_url,
          spotify_url: core.spotify_url,
          docs_url: core.docs_url,
          sheets_url: core.sheets_url,
          checklist,
          emergency: { steps, quotes },
        }),
      });

      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "request error");
      setMsg("Saved. (account-bound)");
    } catch (e) {
      setMsg(\`Save failed: \${e?.message || e}\`);
    }
  }, [core]);

  React.useEffect(() => {
    loadCore();
  }, [loadCore]);

`;

  // We need React namespace; ensure import exists
  if (!s.includes("import React")) {
    s = s.replace(/^(["']use client["'];\s*\n)/m, `$1import React from "react";\n`);
  }

  // Insert after function SettingsPage() { line
  const fnIdx = s.indexOf("export default function SettingsPage()");
  if (fnIdx === -1) throw new Error("Cannot find SettingsPage() in settings/page.tsx");

  const braceIdx = s.indexOf("{", fnIdx);
  if (braceIdx === -1) throw new Error("Cannot find { after SettingsPage()");

  s = s.slice(0, braceIdx + 1) + "\n" + insert + "\n" + s.slice(braceIdx + 1);

  // Now inject UI Cards near top of JSX return: put before Appearance card header if found
  const appearanceTitleNeedle = "Appearance & Atmosphere";
  let rpos = s.indexOf(appearanceTitleNeedle);
  if (rpos === -1) rpos = s.indexOf("Appearance");
  if (rpos === -1) throw new Error("Cannot find Appearance section area to insert core cards");

  // Find previous "<Card" before appearance section and insert before it
  const beforeCard = s.lastIndexOf("<Card", rpos);
  if (beforeCard === -1) throw new Error("Cannot find <Card before appearance section");

  const cards = `
      <Card title="핵심 설정 (계정 귀속)" desc="모든 설정은 기기/브라우저가 아니라 로그인한 계정에 저장됩니다. 다른 기기에서 로그인해도 그대로 유지됩니다.">
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "var(--text-muted)" }}>거래소 URL</div>
              <input value={core.exchange_url} onChange={(e)=>setCore(p=>({ ...p, exchange_url: e.target.value }))} style={{ width:"100%", padding:"10px 12px", borderRadius:12, border:"1px solid var(--line-hard)", background:"rgba(255,255,255,0.75)", color:"rgba(0,0,0,0.88)", fontWeight:900, outline:"none" }} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "var(--text-muted)" }}>따리 URL</div>
              <input value={core.ddari_url} onChange={(e)=>setCore(p=>({ ...p, ddari_url: e.target.value }))} style={{ width:"100%", padding:"10px 12px", borderRadius:12, border:"1px solid var(--line-hard)", background:"rgba(255,255,255,0.75)", color:"rgba(0,0,0,0.88)", fontWeight:900, outline:"none" }} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "var(--text-muted)" }}>Spotify URL</div>
              <input value={core.spotify_url} onChange={(e)=>setCore(p=>({ ...p, spotify_url: e.target.value }))} style={{ width:"100%", padding:"10px 12px", borderRadius:12, border:"1px solid var(--line-hard)", background:"rgba(255,255,255,0.75)", color:"rgba(0,0,0,0.88)", fontWeight:900, outline:"none" }} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "var(--text-muted)" }}>Google Docs URL</div>
              <input value={core.docs_url} onChange={(e)=>setCore(p=>({ ...p, docs_url: e.target.value }))} style={{ width:"100%", padding:"10px 12px", borderRadius:12, border:"1px solid var(--line-hard)", background:"rgba(255,255,255,0.75)", color:"rgba(0,0,0,0.88)", fontWeight:900, outline:"none" }} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "var(--text-muted)" }}>Google Sheets URL</div>
              <input value={core.sheets_url} onChange={(e)=>setCore(p=>({ ...p, sheets_url: e.target.value }))} style={{ width:"100%", padding:"10px 12px", borderRadius:12, border:"1px solid var(--line-hard)", background:"rgba(255,255,255,0.75)", color:"rgba(0,0,0,0.88)", fontWeight:900, outline:"none" }} />
            </label>
          </div>

          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "var(--text-muted)" }}>Trade Gate 체크리스트 (줄바꿈=항목)</div>
            <textarea value={core.checklistText} onChange={(e)=>setCore(p=>({ ...p, checklistText: e.target.value }))} style={{ minHeight: 110, padding:"10px 12px", borderRadius:12, border:"1px solid var(--line-hard)", background:"rgba(255,255,255,0.75)", color:"rgba(0,0,0,0.88)", fontWeight:700, outline:"none", resize:"vertical" }} />
          </label>

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "var(--text-muted)" }}>비상버튼 프로토콜 Steps (줄바꿈)</div>
              <textarea value={core.emergencySteps} onChange={(e)=>setCore(p=>({ ...p, emergencySteps: e.target.value }))} style={{ minHeight: 110, padding:"10px 12px", borderRadius:12, border:"1px solid var(--line-hard)", background:"rgba(255,255,255,0.75)", color:"rgba(0,0,0,0.88)", fontWeight:700, outline:"none", resize:"vertical" }} />
            </label>
            <label style={{ display: "grid", gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "var(--text-muted)" }}>비상버튼 Quotes (줄바꿈)</div>
              <textarea value={core.emergencyQuotes} onChange={(e)=>setCore(p=>({ ...p, emergencyQuotes: e.target.value }))} style={{ minHeight: 110, padding:"10px 12px", borderRadius:12, border:"1px solid var(--line-hard)", background:"rgba(255,255,255,0.75)", color:"rgba(0,0,0,0.88)", fontWeight:700, outline:"none", resize:"vertical" }} />
            </label>
          </div>

          <div style={{ display:"flex", gap: 10, flexWrap:"wrap", alignItems:"center", justifyContent:"space-between" }}>
            <button type="button" onClick={saveCore} style={{ padding:"10px 12px", borderRadius:12, border:"1px solid var(--line-soft)", background:"rgba(210,194,165,0.14)", fontWeight:900 }}>
              Core 설정 저장
            </button>
            <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
              {msg || " "}
            </div>
          </div>
        </div>
      </Card>

`;

  s = s.slice(0, beforeCard) + cards + s.slice(beforeCard);

  fs.writeFileSync(file, s, "utf8");
  console.log("OK: core settings inserted into settings/page.tsx");
} else {
  console.log("SKIP: core settings already restored");
}
NODE

echo "== 3) Build =="
rm -rf .next 2>/dev/null || true
npm run build

echo "== 4) Commit + Deploy =="
git add \
  "app/api/settings/route.ts" \
  "app/(app)/settings/page.tsx" \
  "app/api/settings/route.legacy.js.bak" 2>/dev/null || true

git commit -m "feat: restore core settings (links/checklist/emergency) + unify /api/settings (account-bound)" || true
git push
vercel --prod

echo ""
echo "DONE."
echo ""
echo "NEXT (DB): Supabase user_settings 테이블에 아래 컬럼들이 있어야 합니다:"
echo "exchange_url text, ddari_url text, spotify_url text, docs_url text, sheets_url text, checklist jsonb, emergency jsonb, appearance jsonb"
echo "없으면 Supabase SQL Editor에서 추가하세요."
