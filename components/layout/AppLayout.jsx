"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppearance } from "../providers/AppearanceProvider";
import FuturesTicker from "../widgets/FuturesTicker";
import { supabaseBrowser } from "../../lib/supabase/browser";

export default function AppLayout({ children }) {
  const pathname = usePathname();
  const { appearance, isAuthed } = useAppearance();
  const [toast, setToast] = useState("");

  const nav = useMemo(
    () => [
      { href: "/dashboard", label: "Dashboard" },
      { href: "/goals", label: "Goals" },
      { href: "/settings", label: "Settings" },
    ],
    []
  );

  const showRefreshHere =
    appearance.refreshPlacement === "global" ||
    (appearance.refreshPlacement === "dashboard" && pathname?.startsWith("/dashboard"));

  async function onRefresh() {
    if (!isAuthed) {
      setToast("로그인 후 Refresh를 이용하실 수 있습니다.");
      return;
    }
    try {
      setToast("동기화를 호출했습니다. 잠시만 기다려 주세요.");
      const res = await fetch("/api/sync-now", { method: "POST" });
      if (!res.ok) throw new Error("sync endpoint not ready");
      setToast("요청이 접수되었습니다. 데이터는 곧 반영됩니다.");
    } catch {
      setToast("동기화 엔드포인트는 다음 단계에서 연결됩니다. (UI는 준비 완료)");
    }
    setTimeout(() => setToast(""), 3000);
  }

  async function onLogout() {
    const sb = supabaseBrowser();
    await sb.auth.signOut();
    setToast("안전하게 로그아웃되었습니다.");
    setTimeout(() => setToast(""), 2500);
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-main)",
        color: "var(--text-primary)",
        display: "grid",
        gridTemplateRows: "56px 1fr",
      }}
    >
      {/* Top Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          borderBottom: "1px solid var(--line-soft)",
          background: "rgba(0,0,0,0.10)",
          backdropFilter: "blur(10px)",
          position: "sticky",
          top: 0,
          zIndex: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontWeight: 900, letterSpacing: 0.3 }}>Man Cave OS</div>
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <FuturesTicker />
        </div>

          <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Private console for disciplined execution</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {showRefreshHere ? (
            <button
              type="button" onClick={(e)=>{e.preventDefault();e.stopPropagation();onRefresh();}}
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
          ) : null}

          {isAuthed ? (
            <button
              type="button" onClick={(e)=>{e.preventDefault();e.stopPropagation();onLogout();}}
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

      {/* Body */}
      <div style={{ display: "grid", gridTemplateColumns: appearance.navLayout === "side" ? "240px 1fr" : "1fr" }}>
        {appearance.navLayout === "side" ? (
          <aside style={{ borderRight: "1px solid var(--line-soft)", padding: 12 }}>
            <div style={{ fontWeight: 900, marginBottom: 10 }}>Navigation</div>
            <div style={{ display: "grid", gap: 8 }}>
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
          </aside>
        ) : null}

        <main style={{ padding: 16 }}>
          {appearance.navLayout === "top" ? (
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
          ) : null}

          {toast ? (
            <div
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid var(--line-soft)",
                color: "var(--text-secondary)",
                marginBottom: 12,
              }}
            >
              {toast}
            </div>
          ) : null}

          {children}
        </main>
      </div>
    </div>
  );
}
