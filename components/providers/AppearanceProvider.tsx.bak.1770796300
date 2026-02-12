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
