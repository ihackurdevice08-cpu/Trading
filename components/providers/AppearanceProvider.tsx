"use client";

import React, {
  createContext, useContext, useEffect,
  useState, useCallback, useRef,
} from "react";
import type { AppearanceSettings } from "@/lib/appearance/types";
import { applyThemeVars, applyFontScheme } from "@/lib/appearance/themes";
import { firebaseAuth } from "@/lib/firebase/client";

const DEFAULT_APPEARANCE: AppearanceSettings = {
  themeId:    "linen",
  navLayout:  "top",
  riskWidget: { dashboard: true, trades: true },
  bg: { enabled: false, type: "none", url: null, fit: "cover", opacity: 0.22, dim: 0.45, blurPx: 10 },
};

type Ctx = {
  appearance:      AppearanceSettings;
  patchAppearance: (patch: Partial<AppearanceSettings>) => void;
  saveAppearance:  () => Promise<void>;
  reloadAppearance:() => Promise<void>;
  isAuthed: boolean;
};

const AppearanceContext = createContext<Ctx | null>(null);

export function useAppearance(): Ctx {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error("useAppearance must be used within AppearanceProvider");
  return ctx;
}

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [isAuthed,   setIsAuthed]   = useState(false);
  const [appearance, setAppearance] = useState<AppearanceSettings>(DEFAULT_APPEARANCE);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reloadAppearance = useCallback(async () => {
    try {
      const user = firebaseAuth().currentUser;
      setIsAuthed(!!user);
      if (!user) return;

      const r = await fetch("/api/settings", { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json().catch(() => null);
      if (!j?.ok) return;

      const ap = j?.appearance || j?.data?.appearance || null;
      if (!ap) return;

      setAppearance({
        ...DEFAULT_APPEARANCE,
        ...ap,
        riskWidget: { ...DEFAULT_APPEARANCE.riskWidget, ...(ap.riskWidget || {}) },
        bg: { ...(DEFAULT_APPEARANCE.bg || {}), ...(ap.bg || {}) },
      });
    } catch { /* 기본값 유지 */ }
  }, []);

  const patchAppearance = useCallback((patch: Partial<AppearanceSettings>) => {
    setAppearance(prev => {
      const next: AppearanceSettings = {
        ...prev,
        ...patch,
        riskWidget: patch.riskWidget ? { ...(prev.riskWidget ?? DEFAULT_APPEARANCE.riskWidget), ...patch.riskWidget } : prev.riskWidget,
        bg: patch.bg ? { ...(prev.bg || {}), ...patch.bg } : prev.bg,
      };

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          await fetch("/api/settings", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ appearance: next }),
          });
        } catch {}
      }, 800);

      return next;
    });
  }, []);

  const saveAppearance = useCallback(async () => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    if (!firebaseAuth().currentUser) throw new Error("unauthorized");
    const r = await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ appearance }),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.ok) throw new Error(j?.error || "저장 실패");
  }, [appearance]);

  useEffect(() => {
    applyThemeVars(appearance.themeId);
    applyFontScheme(appearance.themeId);
  }, [appearance.themeId]);

  useEffect(() => { reloadAppearance(); }, [reloadAppearance]);

  const value: Ctx = { appearance, patchAppearance, saveAppearance, reloadAppearance, isAuthed };
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}
