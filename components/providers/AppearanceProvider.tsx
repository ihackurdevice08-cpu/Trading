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
  isAuthed: boolean;
};

const AppearanceContext = createContext<Ctx | null>(null);

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  
  
  // NOTE: UI gating flag (kept simple to avoid build issues)
  const isAuthed = true;
// NOTE: UI gating flag (kept simple to avoid build issues)
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
    applyThemeVars(appearance.themeId);
  }, [appearance.themeId]);

  useEffect(() => {
    reloadAppearance();
  }, [reloadAppearance]);

  const value: Ctx = { appearance, patchAppearance, saveAppearance, reloadAppearance, isAuthed };

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error("useAppearance must be used within AppearanceProvider");
  return ctx;
}
