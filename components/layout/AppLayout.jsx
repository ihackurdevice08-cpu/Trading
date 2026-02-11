"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useAppearance } from "../providers/AppearanceProvider";
import { THEMES } from "@/lib/appearance/themes";
import { supabaseBrowser } from "@/lib/supabase/browser";

import FuturesTicker from "../widgets/FuturesTicker";
import BackgroundLayer from "../ui/BackgroundLayer";

export default function AppLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();

  const { appearance, refreshAppearance } = useAppearance();
  const themeTokens = useMemo(() => {
    const id = appearance?.themeId || "linen";
    return (THEMES[id] && THEMES[id].tokens) ? THEMES[id].tokens : THEMES.linen.tokens;
  }, [appearance?.themeId]);

  const [toast, setToast] = useState("");

  const nav = useMemo(
    () => [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/goals", label: "Goals" },
      { href: "/settings", label: "Settings" },
    ],
    []
  );

  const onRefresh = async () => {
    try {
      setToast("동기화 요청 중…");
      const res = await fetch("/api/sync-now", { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j?.ok) throw new Error(j?.error || "request error");
      setToast("동기화 요청 완료 (UTC 기준 반영될 수 있음)");
      setTimeout(() => setToast(""), 2500);
    } catch (e) {
      setToast(`동기화 실패: ${e?.message || e}`);
      setTimeout(() => setToast(""), 3500);
    }
  };

  const onLogout = async () => {
    try {
      const sb = supabaseBrowser();
      await sb.auth.signOut();
    } catch {}
    router.push("/login");
  };

  // 상단 네비가 Top일 때 하단 티커 공간 확보
  const bottomSpace = 72;

  return (
    <div
      style={{
        minHeight: "100vh",
        position: "relative",
        display: "flex",
        flexDirection: "column",

        // theme tokens -> css vars
        ["--bg"]: themeTokens.bg,
        ["--panel"]: themeTokens.panel,
        ["--panel-2"]: themeTokens.panel2,
        ["--text"]: themeTokens.text,
        ["--text-muted"]: themeTokens.muted,
        ["--line-soft"]: themeTokens.lineSoft,
        ["--line-hard"]: themeTokens.lineHard,
        ["--accent"]: themeTokens.accent,
      }}
    >
      {/* Global Background (account-bound via appearance.bg) */}
      <BackgroundLayer />

      {/* Top bar */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid var(--line-soft)",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <div style={{ fontWeight: 950, letterSpacing: -0.3 }}>Man Cave OS</div>
            <div style={{ color: "rgba(0,0,0,0.55)", fontSize: 12 }}>
              Private console for disciplined execution
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => refreshAppearance?.()}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid var(--line-soft)",
                background: "rgba(210,194,165,0.12)",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Refresh
            </button>

            <button
              type="button"
              onClick={onRefresh}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid var(--line-soft)",
                background: "rgba(210,194,165,0.18)",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Sync
            </button>

            <button
              type="button"
              onClick={onLogout}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid var(--line-soft)",
                background: "rgba(255,255,255,0.75)",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Logout
            </button>
          </div>
        </div>

        {/* Nav */}
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 14px 10px" }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {nav.map((it) => {
              const active = pathname === it.href || pathname?.startsWith(it.href + "/");
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px",
                    borderRadius: 12,
                    border: "1px solid var(--line-soft)",
                    background: active ? "rgba(0,0,0,0.10)" : "rgba(255,255,255,0.55)",
                    fontWeight: 950,
                    color: "rgba(0,0,0,0.92)",
                    textDecoration: "none",
                  }}
                >
                  {it.label}
                </Link>
              );
            })}
          </div>
          {toast ? (
            <div style={{ marginTop: 8, fontSize: 12, color: "rgba(0,0,0,0.60)" }}>{toast}</div>
          ) : null}
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, paddingBottom: bottomSpace }}>
        {children}
      </div>

      {/* Global Bottom Ticker (always visible) */}
      <FuturesTicker />
    </div>
  );
}
