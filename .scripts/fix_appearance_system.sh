#!/usr/bin/env bash
set -euo pipefail
set +H 2>/dev/null || true

cd "$HOME/Documents/GitHub/Trading" || exit 1

echo "== 0) backup =="
cp "lib/appearance/types.ts" "lib/appearance/types.ts.bak.$(date +%s)" 2>/dev/null || true
cp "components/providers/AppearanceProvider.tsx" "components/providers/AppearanceProvider.tsx.bak.$(date +%s)" 2>/dev/null || true
cp "components/ui/BackgroundLayer.tsx" "components/ui/BackgroundLayer.tsx.bak.$(date +%s)" 2>/dev/null || true
cp "lib/appearance/themes.ts" "lib/appearance/themes.ts.bak.$(date +%s)" 2>/dev/null || true

echo "== 1) write types (single source of truth: appearance.bg object) =="
cat > "lib/appearance/types.ts" <<'TS'
export type ThemeId = "linen" | "resort" | "cafe" | "noir" | "royal";
export type NavLayout = "top" | "side";

export type BackgroundFit = "cover" | "contain";
export type BackgroundType = "none" | "image" | "video";

export type AppearanceSettings = {
  themeId: ThemeId;
  navLayout: NavLayout;

  // Dashboard toggles (optional)
  showRow1Status?: boolean;
  showRow2AssetPerf?: boolean;
  showRow3Behavior?: boolean;
  showRow4Overtrade?: boolean;

  // Overtrade options (optional)
  overtradeWindowMin?: number;
  overtradeMaxTrades?: number;
  overtradeCountBasis?: "close" | "fills";

  // Background (account-bound)
  bg?: {
    enabled?: boolean;
    type?: BackgroundType;       // image|video|none
    url?: string | null;         // public url
    fit?: BackgroundFit;         // cover|contain
    opacity?: number;            // 0~1
    dim?: number;                // 0~1
    blurPx?: number;             // px
  };
};
TS

echo "== 2) themes + apply helper =="
cat > "lib/appearance/themes.ts" <<'TS'
import type { ThemeId } from "./types";

export type ThemeDef = {
  id: ThemeId;
  name: string;
  desc: string;
  vars: Record<string, string>;
};

// NOTE: 전체 UI는 CSS 변수(var(--...))로 구동됩니다.
// 여기 vars 값이 실제로 documentElement에 apply 되어야 테마가 바뀝니다.
export const THEMES: ThemeDef[] = [
  {
    id: "linen",
    name: "Linen Suite",
    desc: "밝은 베이지 + 고급 호텔 라운지 톤",
    vars: {
      "--bg-main": "#f6f0e6",
      "--panel": "rgba(255,255,255,0.70)",
      "--panel-2": "rgba(255,255,255,0.62)",
      "--line-soft": "rgba(0,0,0,0.08)",
      "--line-hard": "rgba(0,0,0,0.14)",
      "--text-primary": "rgba(0,0,0,0.88)",
      "--text-muted": "rgba(0,0,0,0.55)",
      "--accent": "#b08a5a",
    },
  },
  {
    id: "resort",
    name: "Desert Resort",
    desc: "두바이 리조트: 따뜻한 샌드 톤",
    vars: {
      "--bg-main": "#f3eadc",
      "--panel": "rgba(255,255,255,0.68)",
      "--panel-2": "rgba(255,255,255,0.58)",
      "--line-soft": "rgba(0,0,0,0.08)",
      "--line-hard": "rgba(0,0,0,0.14)",
      "--text-primary": "rgba(0,0,0,0.88)",
      "--text-muted": "rgba(0,0,0,0.55)",
      "--accent": "#c28b45",
    },
  },
  {
    id: "cafe",
    name: "Café Marble",
    desc: "마블 테이블 + 커피 브라운",
    vars: {
      "--bg-main": "#efe7dd",
      "--panel": "rgba(255,255,255,0.66)",
      "--panel-2": "rgba(255,255,255,0.56)",
      "--line-soft": "rgba(0,0,0,0.08)",
      "--line-hard": "rgba(0,0,0,0.14)",
      "--text-primary": "rgba(0,0,0,0.88)",
      "--text-muted": "rgba(0,0,0,0.55)",
      "--accent": "#8b6b4a",
    },
  },
  {
    id: "noir",
    name: "Noir Penthouse",
    desc: "다크 펜트하우스: 명암 강하게",
    vars: {
      "--bg-main": "#0b0c10",
      "--panel": "rgba(17,19,26,0.85)",
      "--panel-2": "rgba(15,17,23,0.85)",
      "--line-soft": "rgba(233,236,241,0.10)",
      "--line-hard": "rgba(233,236,241,0.18)",
      "--text-primary": "rgba(233,236,241,0.92)",
      "--text-muted": "rgba(233,236,241,0.62)",
      "--accent": "#2dd4bf",
    },
  },
  {
    id: "royal",
    name: "Royal Console",
    desc: "로열 딥톤 + 골드 악센트",
    vars: {
      "--bg-main": "#0f1117",
      "--panel": "rgba(22,25,34,0.86)",
      "--panel-2": "rgba(16,18,24,0.86)",
      "--line-soft": "rgba(233,236,241,0.10)",
      "--line-hard": "rgba(233,236,241,0.18)",
      "--text-primary": "rgba(233,236,241,0.92)",
      "--text-muted": "rgba(233,236,241,0.62)",
      "--accent": "#d4af37",
    },
  },
];

export function getTheme(id: ThemeId) {
  return THEMES.find((t) => t.id === id) || THEMES[0];
}

export function applyThemeVars(vars: Record<string, string>) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  for (const [k, v] of Object.entries(vars)) el.style.setProperty(k, v);
}
TS

echo "== 3) BackgroundLayer reads appearance.bg (NOT flat fields) =="
cat > "components/ui/BackgroundLayer.tsx" <<'TSX'
"use client";

import React from "react";
import { useAppearance } from "@/components/providers/AppearanceProvider";

export default function BackgroundLayer() {
  const { appearance } = useAppearance();
  const bg = appearance.bg || {};

  if (!bg.enabled) return null;
  if (!bg.url) return null;
  if (!bg.type || bg.type === "none") return null;

  const fit = bg.fit || "cover";
  const opacity = typeof bg.opacity === "number" ? bg.opacity : 0.22;
  const dim = typeof bg.dim === "number" ? bg.dim : 0.45;
  const blurPx = typeof bg.blurPx === "number" ? bg.blurPx : 10;

  const common: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 0,
    pointerEvents: "none",
    opacity,
    filter: blurPx ? `blur(${blurPx}px)` : undefined,
    transform: "scale(1.02)",
  };

  return (
    <>
      {bg.type === "image" ? (
        <div
          style={{
            ...common,
            backgroundImage: `url(${bg.url})`,
            backgroundSize: fit,
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        />
      ) : (
        <video
          autoPlay
          muted
          loop
          playsInline
          style={{ ...common, width: "100%", height: "100%", objectFit: fit }}
          src={bg.url}
        />
      )}

      {/* dim overlay */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1,
          pointerEvents: "none",
          background: `rgba(0,0,0,${dim})`,
        }}
      />
    </>
  );
}
TSX

echo "== 4) AppearanceProvider: load/save account-bound appearance + APPLY theme vars =="
cat > "components/providers/AppearanceProvider.tsx" <<'TSX'
"use client";

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { AppearanceSettings } from "@/lib/appearance/types";
import { applyThemeVars, getTheme } from "@/lib/appearance/themes";

const DEFAULT_APPEARANCE: AppearanceSettings = {
  themeId: "linen",
  navLayout: "top",
  bg: { enabled: false, type: "none", url: null, fit: "cover", opacity: 0.22, dim: 0.45, blurPx: 10 },
};

type Ctx = {
  appearance: AppearanceSettings;
  patchAppearance: (patch: Partial<AppearanceSettings>) => void;
  saveAppearance: () => Promise<void>;
  reloadAppearance: () => Promise<void>;
};

const AppearanceContext = createContext<Ctx | null>(null);

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [appearance, setAppearance] = useState<AppearanceSettings>(DEFAULT_APPEARANCE);
  const [uid, setUid] = useState<string | null>(null);

  const sb = useMemo(() => supabaseBrowser(), []);

  const ensureAuth = useCallback(async () => {
    const { data } = await sb.auth.getUser();
    const id = data?.user?.id || null;
    setUid(id);
    return id;
  }, [sb]);

  const reloadAppearance = useCallback(async () => {
    const id = await ensureAuth();
    if (!id) return;

    const r = await fetch("/api/settings", { cache: "no-store" });
    const j = await r.json().catch(() => null);
    if (!j?.ok) return;

    const ap = j?.data?.appearance || null;
    const merged = {
      ...DEFAULT_APPEARANCE,
      ...(ap || {}),
      bg: { ...(DEFAULT_APPEARANCE.bg || {}), ...(ap?.bg || {}) },
    } as AppearanceSettings;

    setAppearance(merged);
  }, [ensureAuth]);

  const patchAppearance = useCallback((patch: Partial<AppearanceSettings>) => {
    setAppearance((p) => {
      const next = {
        ...p,
        ...patch,
        bg: patch.bg ? { ...(p.bg || {}), ...(patch.bg || {}) } : p.bg,
      } as AppearanceSettings;
      return next;
    });
  }, []);

  const saveAppearance = useCallback(async () => {
    const id = await ensureAuth();
    if (!id) throw new Error("unauthorized");

    const payload = { appearance };

    const r = await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.ok) throw new Error(j?.error || "request error");
  }, [appearance, ensureAuth]);

  // APPLY THEME VARS whenever theme changes
  useEffect(() => {
    const t = getTheme(appearance.themeId);
    applyThemeVars(t.vars);
  }, [appearance.themeId]);

  useEffect(() => {
    reloadAppearance();
  }, [reloadAppearance]);

  const value: Ctx = { appearance, patchAppearance, saveAppearance, reloadAppearance };

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error("useAppearance must be used within AppearanceProvider");
  return ctx;
}
TSX

echo "== 5) build =="
rm -rf .next >/dev/null 2>&1 || true
npm run build

echo "== 6) commit+deploy =="
git add "lib/appearance/types.ts" "lib/appearance/themes.ts" "components/ui/BackgroundLayer.tsx" "components/providers/AppearanceProvider.tsx"
git commit -m "fix: wire appearance (theme apply + bg schema unified) and make it real" || true
git push
vercel --prod

echo ""
echo "DONE."
