#!/usr/bin/env bash
set -euo pipefail

cd ~/Documents/GitHub/Trading || exit 1

echo "== Guard: disable history expansion inside this script =="
set +H 2>/dev/null || true

echo "== 1) lib/appearance/themes.ts =="
mkdir -p "lib/appearance"
cat > "lib/appearance/themes.ts" <<'TS'
export type ThemeId = "linen" | "resort" | "noir" | "oasis" | "pearl";

export type Theme = {
  id: ThemeId;
  label: string;
  desc: string;
  vars: Record<string, string>;
};

export const THEMES: Theme[] = [
  {
    id: "linen",
    label: "Linen Suite",
    desc: "밥알샴스 객실처럼 따뜻한 린넨/베이지 무드",
    vars: {
      "--bg": "#f4f1ea",
      "--panel": "rgba(255,255,255,0.72)",
      "--panel2": "rgba(255,255,255,0.60)",
      "--text-primary": "rgba(0,0,0,0.88)",
      "--text-muted": "rgba(0,0,0,0.55)",
      "--line-soft": "rgba(0,0,0,0.10)",
      "--line-hard": "rgba(0,0,0,0.18)",
      "--accent": "#b08a5a",
    },
  },
  {
    id: "resort",
    label: "Desert Resort",
    desc: "사막 리조트 톤(웜 샌드 + 딥 브라운)",
    vars: {
      "--bg": "#efe6d7",
      "--panel": "rgba(255,255,255,0.66)",
      "--panel2": "rgba(255,255,255,0.54)",
      "--text-primary": "rgba(0,0,0,0.88)",
      "--text-muted": "rgba(0,0,0,0.55)",
      "--line-soft": "rgba(0,0,0,0.10)",
      "--line-hard": "rgba(0,0,0,0.18)",
      "--accent": "#9d6f3a",
    },
  },
  {
    id: "noir",
    label: "Noir Lounge",
    desc: "다크 라운지(컨트롤룸 느낌)",
    vars: {
      "--bg": "#0b0c10",
      "--panel": "rgba(17,19,26,0.86)",
      "--panel2": "rgba(15,17,23,0.72)",
      "--text-primary": "rgba(233,236,241,0.92)",
      "--text-muted": "rgba(233,236,241,0.66)",
      "--line-soft": "rgba(233,236,241,0.12)",
      "--line-hard": "rgba(233,236,241,0.18)",
      "--accent": "#2dd4bf",
    },
  },
  {
    id: "oasis",
    label: "Oasis",
    desc: "부드러운 웜톤 + 은은한 그린 악센트",
    vars: {
      "--bg": "#f1ede4",
      "--panel": "rgba(255,255,255,0.70)",
      "--panel2": "rgba(255,255,255,0.58)",
      "--text-primary": "rgba(0,0,0,0.88)",
      "--text-muted": "rgba(0,0,0,0.55)",
      "--line-soft": "rgba(0,0,0,0.10)",
      "--line-hard": "rgba(0,0,0,0.18)",
      "--accent": "#3b7a57",
    },
  },
  {
    id: "pearl",
    label: "Pearl",
    desc: "화이트/펄 무드(깔끔한 호텔 로비)",
    vars: {
      "--bg": "#f7f7f5",
      "--panel": "rgba(255,255,255,0.78)",
      "--panel2": "rgba(255,255,255,0.64)",
      "--text-primary": "rgba(0,0,0,0.88)",
      "--text-muted": "rgba(0,0,0,0.55)",
      "--line-soft": "rgba(0,0,0,0.10)",
      "--line-hard": "rgba(0,0,0,0.18)",
      "--accent": "#7a6c5b",
    },
  },
];

export function getTheme(id: ThemeId) {
  return THEMES.find((t) => t.id === id) || THEMES[0];
}
TS

echo "== 2) lib/appearance/types.ts =="
cat > "lib/appearance/types.ts" <<'TS'
import type { ThemeId } from "./themes";

export type NavLayout = "top" | "side";
export type BgFit = "cover" | "contain";
export type BgType = "none" | "image" | "video";

export type OvertradeCountBasis = "close" | "open";

export type AppearanceSettings = {
  // Theme / layout
  themeId: ThemeId;
  navLayout: NavLayout;

  // Background media
  bg: {
    enabled: boolean;
    type: BgType;
    url: string | null;     // public URL
    fit: BgFit;             // cover/contain
    opacity: number;        // 0~1
    dim: number;            // 0~1
    blurPx: number;         // 0~30
  };

  // Dashboard rows
  showRow1Status: boolean;
  showRow2AssetPerf: boolean;
  showRow3Behavior: boolean;
  showRow4Overtrade: boolean;

  // Rules
  overtradeCountBasis: OvertradeCountBasis;
};

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  themeId: "linen",
  navLayout: "top",

  bg: {
    enabled: true,
    type: "none",
    url: null,
    fit: "cover",
    opacity: 0.22,
    dim: 0.45,
    blurPx: 10,
  },

  showRow1Status: false,
  showRow2AssetPerf: false,
  showRow3Behavior: false,
  showRow4Overtrade: true,

  overtradeCountBasis: "close",
};
TS

echo "== 3) components/providers/AppearanceProvider.tsx (account-bound load/save) =="
mkdir -p "components/providers"
cat > "components/providers/AppearanceProvider.tsx" <<'TSX'
"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { DEFAULT_APPEARANCE, type AppearanceSettings } from "@/lib/appearance/types";

type Ctx = {
  appearance: AppearanceSettings;
  patchAppearance: (patch: Partial<AppearanceSettings>) => void;
  patchBg: (patch: Partial<AppearanceSettings["bg"]>) => void;
  isAuthed: boolean;
  saveToCloud: () => Promise<void>;
};

const AppearanceContext = createContext<Ctx | null>(null);

async function ensureUserSettingsRow(sb: any, user_id: string) {
  const { data } = await sb.from("user_settings").select("user_id").eq("user_id", user_id).maybeSingle();
  if (!data?.user_id) {
    await sb.from("user_settings").insert({ user_id, appearance: DEFAULT_APPEARANCE });
  }
}

export function AppearanceProvider({ children }: { children: React.ReactNode }) {
  const [appearance, setAppearance] = useState<AppearanceSettings>(DEFAULT_APPEARANCE);
  const [isAuthed, setIsAuthed] = useState(false);

  const skipAutoSaveOnce = useRef(false);
  const debounceTimer = useRef<any>(null);

  useEffect(() => {
    const sb = supabaseBrowser();

    const load = async () => {
      const { data } = await sb.auth.getSession();
      const session = data.session;
      if (!session?.user?.id) {
        setIsAuthed(false);
        return;
      }

      setIsAuthed(true);
      await ensureUserSettingsRow(sb, session.user.id);

      const { data: row } = await sb
        .from("user_settings")
        .select("appearance")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (row?.appearance) {
        skipAutoSaveOnce.current = true;
        setAppearance({ ...DEFAULT_APPEARANCE, ...row.appearance, bg: { ...DEFAULT_APPEARANCE.bg, ...(row.appearance.bg || {}) } });
      }
    };

    load().catch(() => {});

    const { data: sub } = sb.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user?.id) {
        setIsAuthed(false);
        return;
      }

      setIsAuthed(true);
      await ensureUserSettingsRow(sb, session.user.id);

      const { data: row } = await sb
        .from("user_settings")
        .select("appearance")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (row?.appearance) {
        skipAutoSaveOnce.current = true;
        setAppearance({ ...DEFAULT_APPEARANCE, ...row.appearance, bg: { ...DEFAULT_APPEARANCE.bg, ...(row.appearance.bg || {}) } });
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const patchAppearance = (patch: Partial<AppearanceSettings>) =>
    setAppearance((prev) => ({ ...prev, ...patch, bg: { ...prev.bg, ...(patch as any).bg } }));

  const patchBg = (patch: Partial<AppearanceSettings["bg"]>) =>
    setAppearance((prev) => ({ ...prev, bg: { ...prev.bg, ...patch } }));

  const saveToCloud = async () => {
    const sb = supabaseBrowser();
    const { data } = await sb.auth.getSession();
    const uid = data.session?.user?.id;
    if (!uid) return;

    await ensureUserSettingsRow(sb, uid);
    const { error } = await sb.from("user_settings").upsert({ user_id: uid, appearance }, { onConflict: "user_id" });
    if (error) throw error;
  };

  useEffect(() => {
    if (!isAuthed) return;

    if (skipAutoSaveOnce.current) {
      skipAutoSaveOnce.current = false;
      return;
    }

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      saveToCloud().catch(() => {});
    }, 600);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appearance, isAuthed]);

  const value = useMemo(
    () => ({ appearance, patchAppearance, patchBg, isAuthed, saveToCloud }),
    [appearance, isAuthed]
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error("useAppearance must be used within AppearanceProvider");
  return ctx;
}
TSX

echo "== 4) components/layout/AppLayout.jsx (apply theme + global bg) =="
mkdir -p "components/layout"
cat > "components/layout/AppLayout.jsx" <<'JSX'
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useAppearance } from "@/components/providers/AppearanceProvider";
import { getTheme } from "@/lib/appearance/themes";
import FuturesTicker from "../widgets/FuturesTicker";

export default function AppLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { appearance, isAuthed } = useAppearance();

  const nav = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/goals", label: "Goals" },
    { href: "/settings", label: "Settings" },
  ];

  const theme = getTheme(appearance.themeId);

  const onLogout = async () => {
    try {
      const sb = supabaseBrowser();
      await sb.auth.signOut();
    } catch {}
    router.push("/login");
  };

  const onRefresh = () => {
    router.refresh();
  };

  const bg = appearance.bg || { enabled: false };

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: theme.vars["--bg"] || "#f4f1ea",
        color: theme.vars["--text-primary"] || "rgba(0,0,0,0.88)",
      }}
    >
      {/* Theme vars */}
      <style>{`:root{${Object.entries(theme.vars)
        .map(([k, v]) => `${k}:${v};`)
        .join("")}}`}</style>

      {/* Global Background Media */}
      {bg?.enabled && bg?.type !== "none" && bg?.url ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 0,
            pointerEvents: "none",
            overflow: "hidden",
          }}
        >
          {bg.type === "video" ? (
            <video
              src={bg.url}
              autoPlay
              muted
              loop
              playsInline
              style={{
                width: "100%",
                height: "100%",
                objectFit: bg.fit || "cover",
                opacity: bg.opacity ?? 0.22,
                filter: `blur(${bg.blurPx ?? 10}px)`,
              }}
            />
          ) : (
            <img
              src={bg.url}
              alt="background"
              style={{
                width: "100%",
                height: "100%",
                objectFit: bg.fit || "cover",
                opacity: bg.opacity ?? 0.22,
                filter: `blur(${bg.blurPx ?? 10}px)`,
              }}
            />
          )}
          {/* dim overlay */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `rgba(0,0,0,${bg.dim ?? 0.45})`,
            }}
          />
        </div>
      ) : null}

      {/* App shell */}
      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Top Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px",
            borderBottom: "1px solid var(--line-soft)",
            background: "rgba(0,0,0,0.06)",
            backdropFilter: "blur(10px)",
            position: "sticky",
            top: 0,
            zIndex: 20,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontWeight: 900, letterSpacing: 0.3 }}>Man Cave OS</div>
            <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Private console for disciplined execution</div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRefresh();
              }}
              style={{
                padding: "8px 10px",
                borderRadius: 12,
                border: "1px solid var(--line-soft)",
                background: "rgba(210,194,165,0.12)",
                color: "var(--text-primary)",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Refresh
            </button>

            {isAuthed ? (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onLogout();
                }}
                style={{
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: "1px solid var(--line-soft)",
                  background: "transparent",
                  color: "var(--text-primary)",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                Logout
              </button>
            ) : (
              <Link
                href="/login"
                style={{
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: "1px solid var(--line-soft)",
                  background: "transparent",
                  color: "var(--text-primary)",
                  fontWeight: 900,
                  textDecoration: "none",
                }}
              >
                Login
              </Link>
            )}
          </div>
        </div>

        <main style={{ padding: 16, paddingBottom: 84 }}>
          {/* Nav */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            {nav.map((x) => {
              const active = pathname?.startsWith(x.href);
              return (
                <Link
                  key={x.href}
                  href={x.href}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid var(--line-soft)",
                    background: active ? "rgba(210,194,165,0.14)" : "transparent",
                    color: "var(--text-primary)",
                    textDecoration: "none",
                    fontWeight: 900,
                  }}
                >
                  {x.label}
                </Link>
              );
            })}
          </div>

          {children}
        </main>

        {/* Global Bottom Ticker (always visible) */}
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 50,
            borderTop: "1px solid var(--line-soft)",
            background: "rgba(255,255,255,0.82)",
            backdropFilter: "blur(12px)",
          }}
        >
          <FuturesTicker />
        </div>
      </div>
    </div>
  );
}
JSX

echo "== 5) settings page: appearance card works + ko labels + upload/delete =="
mkdir -p "app/(app)/settings"
cat > "app/(app)/settings/page.tsx" <<'TSX'
"use client";

import React, { useMemo, useState } from "react";
import { useAppearance } from "@/components/providers/AppearanceProvider";
import { THEMES } from "@/lib/appearance/themes";
import { supabaseBrowser } from "@/lib/supabase/browser";

function Card({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid var(--line-soft)", borderRadius: 18, background: "var(--panel)", padding: 16 }}>
      <div style={{ fontWeight: 900, fontSize: 18 }}>{title}</div>
      {desc ? <div style={{ color: "var(--text-muted)", marginTop: 6, lineHeight: 1.55 }}>{desc}</div> : null}
      <div style={{ marginTop: 14 }}>{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const { appearance, patchAppearance, patchBg, isAuthed, saveToCloud } = useAppearance();
  const [msg, setMsg] = useState<string>("");

  const field = useMemo(
    () => ({
      display: "grid",
      gap: 6,
      padding: 12,
      borderRadius: 16,
      border: "1px solid var(--line-soft)",
      background: "var(--panel2)",
    }),
    []
  );

  const label = useMemo(() => ({ fontWeight: 900, fontSize: 13, color: "var(--text-muted)" }), []);
  const input = useMemo(
    () => ({
      width: "100%",
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid var(--line-hard)",
      background: "rgba(255,255,255,0.78)",
      color: "rgba(0,0,0,0.88)",
      fontWeight: 900,
      outline: "none",
    }),
    []
  );

  const saveNow = async () => {
    try {
      setMsg("저장 중…");
      await saveToCloud();
      setMsg("저장 완료. (계정에 귀속)");
    } catch (e: any) {
      setMsg(`저장 실패: ${e?.message || e}`);
    }
  };

  const uploadMedia = async (file: File) => {
    try {
      setMsg("업로드 중…");
      const sb = supabaseBrowser();
      const { data: sess } = await sb.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) {
        setMsg("로그인이 필요합니다.");
        return;
      }

      const ext = (file.name.split(".").pop() || "").toLowerCase();
      const isVideo = file.type.startsWith("video/");
      const type = isVideo ? "video" : "image";

      const path = `${uid}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext || (isVideo ? "mp4" : "jpg")}`;

      const { error: upErr } = await sb.storage.from("mancave-media").upload(path, file, {
        upsert: true,
        cacheControl: "3600",
        contentType: file.type || undefined,
      });
      if (upErr) throw upErr;

      const { data: pub } = sb.storage.from("mancave-media").getPublicUrl(path);
      const url = pub.publicUrl;

      patchBg({ enabled: true, type: type as any, url });
      setMsg("업로드 완료. 저장 중…");
      await saveToCloud();
      setMsg("적용 완료. (계정에 귀속)");
    } catch (e: any) {
      setMsg(`업로드 실패: ${e?.message || e}`);
    }
  };

  const deleteMedia = async () => {
    try {
      setMsg("배경 제거 중…");
      patchBg({ type: "none" as any, url: null });
      await saveToCloud();
      setMsg("배경 제거 완료.");
    } catch (e: any) {
      setMsg(`배경 제거 실패: ${e?.message || e}`);
    }
  };

  const koThemeDesc = "테마/배경/레이아웃 등 취향 설정은 로그인한 계정에 귀속됩니다. 다른 기기에서 로그인해도 그대로 유지됩니다.";

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 0.2 }}>설정</div>
          <div style={{ color: "var(--text-muted)", marginTop: 6 }}>
            필요한 것만 천천히 조정하시면 됩니다. {isAuthed ? "현재 계정에 연결되어 있습니다." : "로그인 전입니다."}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button type="button" onClick={saveNow} style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid var(--line-soft)", background: "rgba(210,194,165,0.14)", fontWeight: 900 }}>
            저장
          </button>
        </div>
      </div>

      <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{msg || " "}</div>

      <Card title="Appearance & Atmosphere" desc={koThemeDesc}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
          <label style={field}>
            <div style={label}>테마</div>
            <select
              value={appearance.themeId}
              onChange={(e) => patchAppearance({ themeId: e.target.value as any })}
              style={input as any}
            >
              {THEMES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
              {THEMES.find((t) => t.id === appearance.themeId)?.desc || ""}
            </div>
          </label>

          <label style={field}>
            <div style={label}>네비게이션 레이아웃</div>
            <select
              value={appearance.navLayout}
              onChange={(e) => patchAppearance({ navLayout: e.target.value as any })}
              style={input as any}
            >
              <option value="top">Top (가로)</option>
              <option value="side">Side (세로)</option>
            </select>
            <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
              상단 가로/좌측 세로 메뉴를 선택합니다.
            </div>
          </label>

          <label style={field}>
            <div style={label}>커버 모드</div>
            <select
              value={(appearance.bg?.fit || "cover") as any}
              onChange={(e) => patchBg({ fit: e.target.value as any })}
              style={input as any}
            >
              <option value="cover">Cover (화면 채움)</option>
              <option value="contain">Contain (원본 비율 유지)</option>
            </select>
            <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
              원본 그대로 보이게 하려면 Contain 을 권장합니다.
            </div>
          </label>
        </div>

        <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <label style={field}>
              <div style={label}>불투명도(Opacity)</div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={appearance.bg.opacity}
                onChange={(e) => patchBg({ opacity: Number(e.target.value) })}
              />
              <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{appearance.bg.opacity.toFixed(2)}</div>
            </label>

            <label style={field}>
              <div style={label}>Dim (어둡게)</div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={appearance.bg.dim}
                onChange={(e) => patchBg({ dim: Number(e.target.value) })}
              />
              <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{appearance.bg.dim.toFixed(2)}</div>
            </label>

            <label style={field}>
              <div style={label}>Blur (흐림)</div>
              <input
                type="range"
                min={0}
                max={30}
                step={1}
                value={appearance.bg.blurPx}
                onChange={(e) => patchBg({ blurPx: Number(e.target.value) })}
              />
              <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{appearance.bg.blurPx}px</div>
            </label>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <label style={{ display: "inline-flex", gap: 10, alignItems: "center", fontWeight: 900 }}>
              <input
                type="checkbox"
                checked={appearance.bg.enabled}
                onChange={(e) => patchBg({ enabled: e.target.checked })}
              />
              배경 활성화
            </label>

            <div style={{ flex: 1 }} />

            <button
              type="button"
              onClick={deleteMedia}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid var(--line-soft)",
                background: "transparent",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              배경 제거
            </button>

            <label
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid var(--line-soft)",
                background: "rgba(210,194,165,0.14)",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              배경 업로드 (이미지/영상)
              <input
                type="file"
                accept="image/*,video/*"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadMedia(f);
                }}
              />
            </label>
          </div>

          <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
            업로드는 Supabase Storage bucket <b>mancave-media</b> 가 필요합니다. (아래 SQL을 실행하면 됩니다)
          </div>
        </div>
      </Card>
    </div>
  );
}
TSX

echo "== 6) build check =="
rm -rf .next 2>/dev/null || true
npm run build

echo "== 7) commit + deploy =="
git add \
  "lib/appearance/themes.ts" \
  "lib/appearance/types.ts" \
  "components/providers/AppearanceProvider.tsx" \
  "components/layout/AppLayout.jsx" \
  "app/(app)/settings/page.tsx" || true

git commit -m "fix: make appearance controls actually work (account-bound) + bg upload/delete + ko + remove dup header" || true
git push
vercel --prod

echo ""
echo "DONE."
echo "NEXT: create Supabase Storage bucket 'mancave-media' (public) and policies."
