"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_APPEARANCE, type AppearanceSettings } from "../../lib/appearance/types";
import { THEMES } from "../../lib/appearance/themes";
import { supabaseBrowser } from "../../lib/supabase/browser";

type Ctx = {
  appearance: AppearanceSettings;
  patchAppearance: (patch: Partial<AppearanceSettings>) => void;
  isAuthed: boolean;
  saveToCloud: () => Promise<void>;
};

const AppearanceContext = createContext<Ctx | null>(null);

function applyTokens(appearance: AppearanceSettings) {
  const t = THEMES[appearance.themeId].tokens;
  const r = document.documentElement.style;

  r.setProperty("--bg-main", t.bgMain);
  r.setProperty("--bg-panel", t.bgPanel);
  r.setProperty("--bg-card", t.bgCard);
  r.setProperty("--line-soft", t.lineSoft);
  r.setProperty("--line-hard", t.lineHard);

  r.setProperty("--accent-main", t.accentMain);
  r.setProperty("--accent-soft", t.accentSoft);
  r.setProperty("--accent-dim", t.accentDim);

  r.setProperty("--text-primary", t.textPrimary);
  r.setProperty("--text-secondary", t.textSecondary);
  r.setProperty("--text-muted", t.textMuted);

  r.setProperty("--status-great", t.statusGreat);
  r.setProperty("--status-good", t.statusGood);
  r.setProperty("--status-slow", t.statusSlow);
  r.setProperty("--status-stop", t.statusStop);
}

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [appearance, setAppearance] = useState<AppearanceSettings>(DEFAULT_APPEARANCE);
  const [isAuthed, setIsAuthed] = useState(false);

  const debounceTimer = useRef<any>(null);
  const skipAutoSaveOnce = useRef(false); // prevents autosave when we just loaded from cloud

  // local load
  useEffect(() => {
    try {
      const raw = localStorage.getItem("manCaveAppearance");
      if (raw) setAppearance({ ...DEFAULT_APPEARANCE, ...JSON.parse(raw) });
    } catch {}
  }, []);

  // apply + local save
  useEffect(() => {
    applyTokens(appearance);
    try {
      localStorage.setItem("manCaveAppearance", JSON.stringify(appearance));
    } catch {}
  }, [appearance]);

  async function loadFromCloud() {
    const sb = supabaseBrowser();
    const { data } = await sb.auth.getSession();
    const uid = data.session?.user?.id;
    setIsAuthed(Boolean(uid));
    if (!uid) return;

    const { data: row } = await sb
      .from("user_settings")
      .select("appearance")
      .eq("user_id", uid)
      .maybeSingle();

    if (row?.appearance) {
      skipAutoSaveOnce.current = true;
      setAppearance({ ...DEFAULT_APPEARANCE, ...row.appearance });
    }
  }

  // auth + cloud load
  useEffect(() => {
    const sb = supabaseBrowser();

    loadFromCloud();

    const { data: sub } = sb.auth.onAuthStateChange(async (_evt, session) => {
      const uid = session?.user?.id;
      setIsAuthed(Boolean(uid));
      if (uid) await loadFromCloud();
    });

    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patchAppearance = (patch: Partial<AppearanceSettings>) =>
    setAppearance((prev) => ({ ...prev, ...patch }));

  const saveToCloud = async () => {
    const sb = supabaseBrowser();
    const { data } = await sb.auth.getSession();
    const uid = data.session?.user?.id;
    if (!uid) return;

    await sb.from("user_settings").upsert({ user_id: uid, appearance }, { onConflict: "user_id" });
  };

  // AUTO SAVE (debounced)
  useEffect(() => {
    if (!isAuthed) return;

    // if we just loaded from cloud, don't immediately write back
    if (skipAutoSaveOnce.current) {
      skipAutoSaveOnce.current = false;
      return;
    }

    // debounce
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      saveToCloud().catch(() => {});
    }, 800);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appearance, isAuthed]);

  const value = useMemo(() => ({ appearance, patchAppearance, isAuthed, saveToCloud }), [appearance, isAuthed]);

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error("useAppearance must be used within AppearanceProvider");
  return ctx;
}
