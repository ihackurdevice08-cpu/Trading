"use client";

import React, {
  createContext, useContext, useEffect, useMemo,
  useState, useCallback, useRef,
} from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { AppearanceSettings } from "@/lib/appearance/types";
import { applyThemeVars } from "@/lib/appearance/themes";

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

  const sb = useMemo(() => supabaseBrowser(), []);

  const reloadAppearance = useCallback(async () => {
    try {
      // getSession: 로컬 캐시에서 즉시 읽음 (서버 왕복 없음)
      const { data } = await sb.auth.getSession();
      const uid = data?.session?.user?.id || null;
      setIsAuthed(!!uid);
      if (!uid) return;

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
  }, [sb]);

  // patchAppearance: 즉시 상태 반영 + 800ms debounce로 자동 저장
  const patchAppearance = useCallback((patch: Partial<AppearanceSettings>) => {
    setAppearance(prev => {
      const next: AppearanceSettings = {
        ...prev,
        ...patch,
        riskWidget: patch.riskWidget ? { ...(prev.riskWidget ?? DEFAULT_APPEARANCE.riskWidget), ...patch.riskWidget } : prev.riskWidget,
        bg: patch.bg ? { ...(prev.bg || {}), ...patch.bg } : prev.bg,
      };

      // debounce 자동 저장 (800ms)
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
    const { data } = await sb.auth.getSession();
    if (!data?.session?.user?.id) throw new Error("unauthorized");
    const r = await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ appearance }),
    });
    const j = await r.json().catch(() => null);
    if (!r.ok || !j?.ok) throw new Error(j?.error || "저장 실패");
  }, [appearance, sb]);

  useEffect(() => { applyThemeVars(appearance.themeId); }, [appearance.themeId]);
  useEffect(() => { reloadAppearance(); }, [reloadAppearance]);

  const value: Ctx = { appearance, patchAppearance, saveAppearance, reloadAppearance, isAuthed };
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}
