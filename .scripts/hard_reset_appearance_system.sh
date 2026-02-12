#!/usr/bin/env bash
set -euo pipefail

# -----------------------------
# 1) Appearance 타입/기본값 표준화
# -----------------------------
mkdir -p lib/appearance

cat > lib/appearance/types.ts <<'TS'
export type NavLayout = "top" | "side";
export type BgType = "none" | "image" | "video";
export type BgFit = "cover" | "contain";

export type AppearanceSettings = {
  themeId: "linen" | "resort" | "noir" | "vault" | "dune";
  navLayout: NavLayout;

  // global background media (account-bound)
  bgType: BgType;
  bgUrl: string;          // public URL (Supabase storage publicUrl or pasted URL)
  bgFit: BgFit;
  bgOpacity: number;      // 0..1
  bgBlurPx: number;       // 0..24
  bgDim: number;          // 0..0.9

  // for future: ticker toggles etc.
};

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  themeId: "linen",
  navLayout: "top",

  bgType: "none",
  bgUrl: "",
  bgFit: "cover",
  bgOpacity: 0.22,
  bgBlurPx: 0,
  bgDim: 0.45,
};
TS

cat > lib/appearance/themes.ts <<'TS'
export type ThemeTokens = {
  bg: string;
  panel: string;
  text: string;
  muted: string;
  lineSoft: string;
  lineHard: string;
  accent: string;
};

export const THEMES: Record<string, { name: string; tokens: ThemeTokens }> = {
  linen: {
    name: "Linen Suite",
    tokens: {
      bg: "#F4F0E6",
      panel: "rgba(255,255,255,0.72)",
      text: "rgba(0,0,0,0.88)",
      muted: "rgba(0,0,0,0.55)",
      lineSoft: "rgba(0,0,0,0.10)",
      lineHard: "rgba(0,0,0,0.18)",
      accent: "#B89A5A",
    },
  },
  resort: {
    name: "Desert Resort",
    tokens: {
      bg: "#EFE6D6",
      panel: "rgba(255,255,255,0.70)",
      text: "rgba(0,0,0,0.88)",
      muted: "rgba(0,0,0,0.55)",
      lineSoft: "rgba(0,0,0,0.10)",
      lineHard: "rgba(0,0,0,0.18)",
      accent: "#C2A66B",
    },
  },
  noir: {
    name: "Noir Lobby",
    tokens: {
      bg: "#0F0F12",
      panel: "rgba(255,255,255,0.06)",
      text: "rgba(255,255,255,0.92)",
      muted: "rgba(255,255,255,0.60)",
      lineSoft: "rgba(255,255,255,0.10)",
      lineHard: "rgba(255,255,255,0.18)",
      accent: "#D6B56E",
    },
  },
  vault: {
    name: "Gold Vault",
    tokens: {
      bg: "#15130E",
      panel: "rgba(255,255,255,0.06)",
      text: "rgba(255,255,255,0.92)",
      muted: "rgba(255,255,255,0.60)",
      lineSoft: "rgba(255,255,255,0.10)",
      lineHard: "rgba(255,255,255,0.18)",
      accent: "#C8A24A",
    },
  },
  dune: {
    name: "Dune Beige",
    tokens: {
      bg: "#EDE2CF",
      panel: "rgba(255,255,255,0.68)",
      text: "rgba(0,0,0,0.88)",
      muted: "rgba(0,0,0,0.55)",
      lineSoft: "rgba(0,0,0,0.10)",
      lineHard: "rgba(0,0,0,0.18)",
      accent: "#B58B4D",
    },
  },
};
TS

# -----------------------------
# 2) /api/settings: 단일 저장 경로(appearance JSON만)로 고정
#    -> dashboard_rows 같은 컬럼 의존 제거
# -----------------------------
mkdir -p app/api/settings

cat > app/api/settings/route.ts <<'TS'
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function sbFromCookies() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return store.getAll(); },
        setAll(cs) { cs.forEach(({ name, value, options }) => store.set(name, value, options)); },
      },
    }
  );
}

export async function GET() {
  const sbAuth = await sbFromCookies();
  const { data } = await sbAuth.auth.getUser();
  const uid = data.user?.id;
  if (!uid) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const sb = supabaseServer();
  const { data: row, error } = await sb.from("user_settings").select("appearance").eq("user_id", uid).maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, appearance: row?.appearance || {} });
}

export async function POST(req: Request) {
  try {
    const sbAuth = await sbFromCookies();
    const { data } = await sbAuth.auth.getUser();
    const uid = data.user?.id;
    if (!uid) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const appearance = body?.appearance ?? body ?? {};

    const sb = supabaseServer();
    const { error } = await sb.from("user_settings").upsert({ user_id: uid, appearance }, { onConflict: "user_id" });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, note: "Saved. (account-bound)" });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
TS

# -----------------------------
# 3) AppearanceProvider: 로딩/저장은 /api/settings로만 (단일 경로)
# -----------------------------
mkdir -p components/providers

cat > components/providers/AppearanceProvider.tsx <<'TSX'
"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { DEFAULT_APPEARANCE, type AppearanceSettings } from "@/lib/appearance/types";
import { ensureUserSettings } from "@/lib/db/ensureUserSettings";

type Ctx = {
  appearance: AppearanceSettings;
  patchAppearance: (patch: Partial<AppearanceSettings>) => void;
  isAuthed: boolean;
  saveToCloud: () => Promise<void>;
};

const AppearanceContext = createContext<Ctx | null>(null);

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [appearance, setAppearance] = useState<AppearanceSettings>(DEFAULT_APPEARANCE);
  const [isAuthed, setIsAuthed] = useState(false);

  const skipAutoSaveOnce = useRef(false);
  const debounceTimer = useRef<any>(null);

  useEffect(() => {
    const sb = supabaseBrowser();

    const boot = async () => {
      const { data } = await sb.auth.getSession();
      const session = data.session;

      if (!session?.user?.id) {
        setIsAuthed(false);
        return;
      }
      setIsAuthed(true);

      await ensureUserSettings(sb, session.user.id);

      const r = await fetch("/api/settings", { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j?.appearance) {
        skipAutoSaveOnce.current = true;
        setAppearance({ ...DEFAULT_APPEARANCE, ...j.appearance });
      }
    };

    boot().catch(() => {});

    const { data: sub } = sb.auth.onAuthStateChange(async (_evt, session) => {
      if (!session?.user?.id) {
        setIsAuthed(false);
        return;
      }
      setIsAuthed(true);
      await ensureUserSettings(sb, session.user.id);
      const r = await fetch("/api/settings", { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j?.appearance) {
        skipAutoSaveOnce.current = true;
        setAppearance({ ...DEFAULT_APPEARANCE, ...j.appearance });
      }
    });

    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  const patchAppearance = (patch: Partial<AppearanceSettings>) => {
    setAppearance((prev) => ({ ...prev, ...patch }));
  };

  const saveToCloud = async () => {
    if (!isAuthed) return;
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appearance }),
    });
  };

  useEffect(() => {
    if (!isAuthed) return;
    if (skipAutoSaveOnce.current) {
      skipAutoSaveOnce.current = false;
      return;
    }
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => saveToCloud().catch(() => {}), 600);
  }, [appearance, isAuthed]);

  const value = useMemo(() => ({ appearance, patchAppearance, isAuthed, saveToCloud }), [appearance, isAuthed]);

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error("useAppearance must be used within AppearanceProvider");
  return ctx;
}
TSX

# -----------------------------
# 4) AppLayout: 테마 토큰 적용 + 전역 배경(이미지/영상) 적용
# -----------------------------
test -f components/layout/AppLayout.jsx || { echo "ERROR: components/layout/AppLayout.jsx not found"; exit 1; }

node - <<'NODE'
const fs = require("fs");
const file = "components/layout/AppLayout.jsx";
let s = fs.readFileSync(file, "utf8");

if (!s.includes('from "@/lib/appearance/themes"')) {
  s = s.replace(
    'import { useAppearance } from "../providers/AppearanceProvider";',
    'import { useAppearance } from "../providers/AppearanceProvider";\nimport { THEMES } from "@/lib/appearance/themes";'
  );
}

if (!s.includes("Global Background Media (account-bound)")) {
  const ret = s.indexOf("return (");
  const rootDiv = s.indexOf("<div", ret);
  const gt = s.indexOf(">", rootDiv);

  const inject = `
      {/* =====================================================
          Global Background Media (account-bound)
          ===================================================== */}
      {appearance?.bgType !== "none" && appearance?.bgUrl ? (
        <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
          {appearance.bgType === "video" ? (
            <video
              src={appearance.bgUrl}
              autoPlay
              muted
              loop
              playsInline
              style={{
                width: "100%",
                height: "100%",
                objectFit: appearance.bgFit || "cover",
                opacity: typeof appearance.bgOpacity === "number" ? appearance.bgOpacity : 0.22,
                filter: \`blur(\${appearance.bgBlurPx || 0}px)\`,
                transform: "scale(1.02)",
              }}
            />
          ) : (
            <img
              src={appearance.bgUrl}
              alt="background"
              style={{
                width: "100%",
                height: "100%",
                objectFit: appearance.bgFit || "cover",
                opacity: typeof appearance.bgOpacity === "number" ? appearance.bgOpacity : 0.22,
                filter: \`blur(\${appearance.bgBlurPx || 0}px)\`,
                transform: "scale(1.02)",
              }}
            />
          )}
          <div style={{ position: "absolute", inset: 0, background: "black", opacity: typeof appearance.bgDim === "number" ? appearance.bgDim : 0.45 }} />
        </div>
      ) : null}

`;
  s = s.slice(0, gt + 1) + inject + s.slice(gt + 1);
}

if (!s.includes("const themeTokens")) {
  // themeTokens + CSS vars 적용
  s = s.replace(
    "const { appearance, isAuthed } = useAppearance();",
    'const { appearance, isAuthed } = useAppearance();\n  const themeTokens = (THEMES?.[appearance?.themeId]?.tokens) || THEMES.linen.tokens;'
  );

  // 최상위 래퍼 div style에 CSS vars 주입: 가장 첫 style={{ ... }} 블록에 붙인다
  s = s.replace(
    /<div\s+style=\{\{\s*/m,
    `<div style={{ 
        position: "relative",
        zIndex: 1,
        ["--bg"]: themeTokens.bg,
        ["--panel"]: themeTokens.panel,
        ["--text-primary"]: themeTokens.text,
        ["--text-muted"]: themeTokens.muted,
        ["--line-soft"]: themeTokens.lineSoft,
        ["--line-hard"]: themeTokens.lineHard,
        ["--accent"]: themeTokens.accent,
        `
  );
}

fs.writeFileSync(file, s, "utf8");
console.log("OK: AppLayout updated (theme + global bg)");
NODE

# -----------------------------
# 5) Settings UI: 테마/메뉴/배경 + 업로드 복구
#    (기존 파일이 꼬여있을 수 있어서 통째로 안정 버전으로 교체)
# -----------------------------
test -f app/(app)/settings/page.tsx || { echo "ERROR: settings page not found"; exit 1; }

cat > app/(app)/settings/page.tsx <<'TSX'
"use client";

import { useState } from "react";
import { useAppearance } from "@/components/providers/AppearanceProvider";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { THEMES } from "@/lib/appearance/themes";

function Card({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid var(--line-soft)", borderRadius: 16, padding: 16, background: "var(--panel)" }}>
      <div style={{ display: "grid", gap: 4, marginBottom: 12 }}>
        <div style={{ fontWeight: 900, fontSize: 16 }}>{title}</div>
        {desc ? <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{desc}</div> : null}
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const { appearance, patchAppearance, isAuthed, saveToCloud } = useAppearance();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function saveNow() {
    setBusy(true);
    setMsg("Saving…");
    try {
      await saveToCloud();
      setMsg("Saved. (account-bound)");
    } catch (e: any) {
      setMsg(`Save failed: ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 0.2 }}>Settings</div>
          <div style={{ color: "var(--text-muted)", marginTop: 6 }}>
            모든 설정은 기기/브라우저가 아닌 <b>로그인 계정</b>에 귀속됩니다. 다른 기기에서 로그인해도 그대로 유지됩니다.
            {" "}
            {isAuthed ? "현재 계정에 연결되어 있습니다." : "로그인 전입니다."}
          </div>
        </div>

        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); saveNow(); }}
          disabled={busy}
          style={{
            padding: "10px 12px",
            borderRadius: 12,
            border: "1px solid var(--line-hard)",
            background: "rgba(210,194,165,0.22)",
            color: "var(--text-primary)",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Save
        </button>
      </div>

      <Card
        title="Appearance & Atmosphere"
        desc="테마/메뉴 레이아웃은 ‘호텔 룸 옵션’처럼 취향에 맞게 선택하세요."
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
          <label style={{ display: "grid", gap: 6, padding: "10px 12px", borderRadius: 14, border: "1px solid var(--line-soft)", background: "rgba(210,194,165,0.10)" }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "var(--text-muted)" }}>Theme</div>
            <select
              value={appearance.themeId}
              onChange={(e) => patchAppearance({ themeId: e.target.value as any })}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid var(--line-hard)",
                background: "rgba(255,255,255,0.75)",
                color: "rgba(0,0,0,0.88)",
                fontWeight: 900,
              }}
            >
              {Object.entries(THEMES).map(([id, t]) => (
                <option key={id} value={id}>{t.name}</option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6, padding: "10px 12px", borderRadius: 14, border: "1px solid var(--line-soft)", background: "rgba(210,194,165,0.10)" }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "var(--text-muted)" }}>Navigation Layout</div>
            <select
              value={appearance.navLayout}
              onChange={(e) => patchAppearance({ navLayout: e.target.value as any })}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid var(--line-hard)",
                background: "rgba(255,255,255,0.75)",
                color: "rgba(0,0,0,0.88)",
                fontWeight: 900,
              }}
            >
              <option value="top">Top bar</option>
              <option value="side">Side bar</option>
            </select>
          </label>
        </div>
      </Card>

      <Card
        title="Background Media"
        desc="이미지/영상 배경을 업로드하거나 URL로 지정합니다. 전체 화면에 ‘원본 그대로’ 표출되며, 표시 방식은 Cover/Contain으로 조절합니다."
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
          <label style={{ display: "grid", gap: 6, padding: "10px 12px", borderRadius: 14, border: "1px solid var(--line-soft)", background: "rgba(210,194,165,0.10)" }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "var(--text-muted)" }}>Type</div>
            <select
              value={appearance.bgType}
              onChange={(e) => patchAppearance({ bgType: e.target.value as any })}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid var(--line-hard)",
                background: "rgba(255,255,255,0.75)",
                color: "rgba(0,0,0,0.88)",
                fontWeight: 900,
              }}
            >
              <option value="none">None</option>
              <option value="image">Image</option>
              <option value="video">Video</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 6, padding: "10px 12px", borderRadius: 14, border: "1px solid var(--line-soft)", background: "rgba(210,194,165,0.10)" }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "var(--text-muted)" }}>Fit</div>
            <select
              value={appearance.bgFit}
              onChange={(e) => patchAppearance({ bgFit: e.target.value as any })}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid var(--line-hard)",
                background: "rgba(255,255,255,0.75)",
                color: "rgba(0,0,0,0.88)",
                fontWeight: 900,
              }}
            >
              <option value="cover">Cover</option>
              <option value="contain">Contain</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 6, padding: "10px 12px", borderRadius: 14, border: "1px solid var(--line-soft)", background: "rgba(210,194,165,0.10)" }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "var(--text-muted)" }}>Opacity</div>
            <input type="range" min="0" max="1" step="0.01" value={appearance.bgOpacity} onChange={(e) => patchAppearance({ bgOpacity: Number(e.target.value) })} />
          </label>

          <label style={{ display: "grid", gap: 6, padding: "10px 12px", borderRadius: 14, border: "1px solid var(--line-soft)", background: "rgba(210,194,165,0.10)" }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "var(--text-muted)" }}>Blur(px)</div>
            <input type="range" min="0" max="24" step="1" value={appearance.bgBlurPx} onChange={(e) => patchAppearance({ bgBlurPx: Number(e.target.value) })} />
          </label>

          <label style={{ display: "grid", gap: 6, padding: "10px 12px", borderRadius: 14, border: "1px solid var(--line-soft)", background: "rgba(210,194,165,0.10)" }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "var(--text-muted)" }}>Dim</div>
            <input type="range" min="0" max="0.9" step="0.01" value={appearance.bgDim} onChange={(e) => patchAppearance({ bgDim: Number(e.target.value) })} />
          </label>
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 900, color: "var(--text-muted)" }}>Upload (Supabase Storage: mancave-media)</div>
          <input
            type="file"
            accept="image/*,video/*"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const sb = supabaseBrowser();
                const { data } = await sb.auth.getSession();
                const uid = data.session?.user?.id;
                if (!uid) { alert("Login required"); return; }

                const ext = (f.name.split(".").pop() || "bin").toLowerCase();
                const path = `${uid}/bg.${ext}`;

                const up = await sb.storage.from("mancave-media").upload(path, f, { upsert: true });
                if (up.error) { alert(up.error.message); return; }

                const pub = sb.storage.from("mancave-media").getPublicUrl(path);
                const url = pub.data.publicUrl;

                const isVideo = f.type.startsWith("video/");
                patchAppearance({ bgUrl: url, bgType: isVideo ? "video" : "image" });
                alert("Uploaded");
              } catch (err: any) {
                alert(err?.message || String(err));
              }
            }}
          />

          <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
            업로드한 배경은 즉시 전체 화면에 적용되며, Save로 계정에 고정됩니다.
          </div>

          <label style={{ display: "grid", gap: 6 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: "var(--text-muted)" }}>Or paste URL</div>
            <input
              type="text"
              value={appearance.bgUrl || ""}
              onChange={(e) => patchAppearance({ bgUrl: e.target.value })}
              placeholder="https://..."
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid var(--line-hard)",
                background: "rgba(255,255,255,0.75)",
                color: "rgba(0,0,0,0.88)",
                fontWeight: 900,
                outline: "none",
              }}
            />
          </label>
        </div>
      </Card>

      <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
        {msg || " "}
      </div>
    </div>
  );
}
TSX

npm run build
git add \
  lib/appearance/types.ts \
  lib/appearance/themes.ts \
  app/api/settings/route.ts \
  components/providers/AppearanceProvider.tsx \
  components/layout/AppLayout.jsx \
  app/(app)/settings/page.tsx

git commit -m "chore: hard-reset appearance system (themes/nav/bg upload, account-bound save)" || true
git push
vercel --prod

echo ""
echo "DONE."
echo "NOTE: Supabase Storage bucket must exist: mancave-media (public)."
