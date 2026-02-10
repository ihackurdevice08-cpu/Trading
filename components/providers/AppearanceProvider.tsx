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

  // 1) Auth/session 감지 + user_settings row 보장 + cloud load
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

      // ✅ 핵심: 항상 row 보장 (없으면 생성)
      await ensureUserSettings(sb, session.user.id);

      // cloud 로드
      const { data: row } = await sb
        .from("user_settings")
        .select("appearance")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (row?.appearance) {
        skipAutoSaveOnce.current = true;
        setAppearance({ ...DEFAULT_APPEARANCE, ...row.appearance });
      }
    };

    boot().catch(() => {});

    const { data: sub } = sb.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user?.id) {
        setIsAuthed(false);
        return;
      }

      setIsAuthed(true);

      await ensureUserSettings(sb, session.user.id);

      const { data: row } = await sb
        .from("user_settings")
        .select("appearance")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (row?.appearance) {
        skipAutoSaveOnce.current = true;
        setAppearance({ ...DEFAULT_APPEARANCE, ...row.appearance });
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const patchAppearance = (patch: Partial<AppearanceSettings>) =>
    setAppearance((prev) => ({ ...prev, ...patch }));

  const saveToCloud = async () => {
    const sb = supabaseBrowser();
    const { data } = await sb.auth.getSession();
    const uid = data.session?.user?.id;
    if (!uid) return;

    // ✅ row 보장 후 upsert (절대 안 깨짐)
    await ensureUserSettings(sb, uid);
    await sb.from("user_settings").upsert({ user_id: uid, appearance }, { onConflict: "user_id" });
  };

  // 2) Authed 상태면 autosave (debounced)
  useEffect(() => {
    if (!isAuthed) return;

    if (skipAutoSaveOnce.current) {
      skipAutoSaveOnce.current = false;
      return;
    }

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      saveToCloud().catch(() => {});
    }, 800);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appearance, isAuthed]);

  const value = useMemo(
    () => ({ appearance, patchAppearance, isAuthed, saveToCloud }),
    [appearance, isAuthed]
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error("useAppearance must be used within AppearanceProvider");
  return ctx;
}
