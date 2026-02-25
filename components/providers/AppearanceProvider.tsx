"use client";

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { AppearanceSettings } from "@/lib/appearance/types";
import { applyThemeVars } from "@/lib/appearance/themes";

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
  isAuthed: boolean;
};

const AppearanceContext = createContext<Ctx | null>(null);

export function useAppearance(): Ctx {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error("useAppearance must be used within AppearanceProvider");
  return ctx;
}

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [isAuthed, setIsAuthed] = useState(false);
  const [appearance, setAppearance] = useState<AppearanceSettings>(DEFAULT_APPEARANCE);

  const sb = useMemo(() => supabaseBrowser(), []);

  const reloadAppearance = useCallback(async () => {
    try {
      const { data } = await sb.auth.getUser();
      const uid = data?.user?.id || null;
      setIsAuthed(!!uid);
      if (!uid) return;

      const r = await fetch("/api/settings", { cache: "no-store" });
      if (!r.ok) return; // 401 등 조용히 무시

      const j = await r.json().catch(() => null);
      if (!j?.ok) return;

      const ap = j?.appearance || j?.data?.appearance || null;
      if (!ap) return;

      const merged: AppearanceSettings = {
        ...DEFAULT_APPEARANCE,
        ...ap,
        bg: { ...(DEFAULT_APPEARANCE.bg || {}), ...(ap?.bg || {}) },
      };
      setAppearance(merged);
    } catch {
      // 조용히 실패 - 기본값 유지
    }
  }, [sb]);

  const patchAppearance = useCallback((patch: Partial<AppearanceSettings>) => {
    setAppearance((p) => ({
      ...p,
      ...patch,
      bg: patch.bg ? { ...(p.bg || {}), ...patch.bg } : p.bg,
    }));
  }, []);

  const saveAppearance = useCallback(async () => {
    const { data } = await sb.auth.getUser();
    if (!data?.user?.id) throw new Error("unauthorized");

    const r = await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ appearance }),
    });

    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.ok) throw new Error(j?.error || "request error");
  }, [appearance, sb]);

  // 테마 CSS 변수 적용
  useEffect(() => {
    applyThemeVars(appearance.themeId);
  }, [appearance.themeId]);

  useEffect(() => {
    reloadAppearance();
  }, [reloadAppearance]);

  const value: Ctx = { appearance, patchAppearance, saveAppearance, reloadAppearance, isAuthed };

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}
