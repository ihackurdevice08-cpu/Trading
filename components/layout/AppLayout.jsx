"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import BackgroundLayer from "@/components/ui/BackgroundLayer";
import FuturesTicker from "@/components/widgets/FuturesTicker";
import RiskBanner from "@/components/RiskBanner";

const NAV = [
  { href: "/dashboard",     label: "대시보드",  icon: "◈" },
  { href: "/journal",       label: "저널",      icon: "✦" },
  { href: "/manual-trades", label: "거래기록",  icon: "◉" },
  { href: "/goals",         label: "목표",      icon: "◎" },
  { href: "/risk",          label: "리스크",    icon: "◬" },
  { href: "/withdrawals",   label: "출금",      icon: "◇" },
  { href: "/settings",      label: "설정",      icon: "◐" },
];

export default function AppLayout({ children }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div style={{ minHeight: "100vh", position: "relative" }}>
      <BackgroundLayer />

      <div style={{ position: "relative", zIndex: 2, minHeight: "100vh", display: "flex", flexDirection: "column" }}>

        {/* ─── 헤더 ─── */}
        <header style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "0 16px", height: 54,
          borderBottom: "1px solid var(--line-soft, rgba(0,0,0,.08))",
          background: "var(--panel, rgba(255,255,255,0.94))",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          position: "sticky", top: 0, zIndex: 50, flexShrink: 0,
        }}>
          {/* 브랜드 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 1, flexShrink: 0, userSelect: "none" }}>
            <div style={{ fontWeight: 900, fontSize: 13, letterSpacing: 0.5, lineHeight: 1 }}>Man Cave OS</div>
            <div style={{ fontSize: 9, opacity: 0.4, lineHeight: 1, letterSpacing: 0.3 }}>PRIVATE CONSOLE</div>
          </div>

          {/* 데스크탑 네비 */}
          <nav className="desk-nav" style={{ display: "flex", gap: 3, alignItems: "center", marginLeft: 12 }}>
            {NAV.map(({ href, label, icon }) => {
              const active = pathname?.startsWith(href);
              return (
                <Link key={href} href={href} style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "6px 10px", borderRadius: 8, textDecoration: "none",
                  color: active ? "var(--accent, #B89A5A)" : "var(--text-secondary, rgba(0,0,0,0.65))",
                  border: active ? "1px solid rgba(184,154,90,0.35)" : "1px solid transparent",
                  background: active ? "rgba(184,154,90,0.09)" : "transparent",
                  fontWeight: active ? 800 : 600, fontSize: 13,
                  transition: "all 0.12s",
                  whiteSpace: "nowrap",
                }}>
                  <span style={{ fontSize: 12, opacity: active ? 1 : 0.6 }}>{icon}</span>
                  {label}
                </Link>
              );
            })}
          </nav>

          <div style={{ flex: 1 }} />

          {/* 데스크탑 로그아웃 */}
          <a href="/auth/signout" className="desk-logout" style={{
            padding: "6px 12px", borderRadius: 8, textDecoration: "none",
            color: "var(--text-primary, #111)",
            border: "1px solid var(--line-soft, rgba(0,0,0,.1))",
            fontWeight: 700, fontSize: 12, whiteSpace: "nowrap",
            transition: "all 0.12s",
          }}>
            로그아웃
          </a>

          {/* 모바일 햄버거 */}
          <button onClick={() => setMenuOpen(v => !v)} className="mob-btn"
            style={{ all: "unset", cursor: "pointer", display: "none",
              padding: 8, borderRadius: 8, border: "1px solid var(--line-soft, rgba(0,0,0,.1))" }}
            aria-label="메뉴 열기">
            <div style={{ width: 18, display: "grid", gap: 4 }}>
              {[0,1,2].map(i => (
                <span key={i} style={{ display: "block", height: 2,
                  background: "var(--text-primary, #111)", borderRadius: 2,
                  width: i === 1 ? "70%" : "100%", transition: "all 0.2s" }} />
              ))}
            </div>
          </button>
        </header>

        {/* ─── 모바일 슬라이드 메뉴 ─── */}
        {menuOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 100,
            background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
            onClick={() => setMenuOpen(false)}>
            <nav style={{
              position: "absolute", top: 0, right: 0,
              width: "min(260px, 80vw)", height: "100%",
              background: "var(--panel, rgba(255,255,255,0.97))",
              boxShadow: "-8px 0 32px rgba(0,0,0,0.12)",
              display: "flex", flexDirection: "column",
              padding: "20px 14px", gap: 4, overflowY: "auto",
            }} onClick={e => e.stopPropagation()}>
              <div style={{ fontWeight: 900, fontSize: 14, letterSpacing: 0.5,
                paddingBottom: 14, borderBottom: "1px solid var(--line-soft, rgba(0,0,0,.08))",
                marginBottom: 8 }}>
                Man Cave OS
              </div>
              {NAV.map(({ href, label, icon }) => {
                const active = pathname?.startsWith(href);
                return (
                  <Link key={href} href={href} onClick={() => setMenuOpen(false)} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 14px", borderRadius: 10, textDecoration: "none",
                    color: active ? "var(--accent, #B89A5A)" : "var(--text-primary, #111)",
                    background: active ? "rgba(184,154,90,0.09)" : "transparent",
                    border: active ? "1px solid rgba(184,154,90,0.2)" : "1px solid transparent",
                    fontWeight: active ? 800 : 600, fontSize: 15,
                  }}>
                    <span style={{ fontSize: 16, width: 20, textAlign: "center" }}>{icon}</span>
                    {label}
                  </Link>
                );
              })}
              <div style={{ flex: 1 }} />
              <a href="/auth/signout" style={{
                display: "block", padding: "12px 14px", borderRadius: 10,
                textDecoration: "none", color: "var(--text-secondary, rgba(0,0,0,0.65))",
                border: "1px solid var(--line-soft, rgba(0,0,0,.08))",
                fontWeight: 700, fontSize: 14, textAlign: "center", marginTop: 8,
              }}>
                로그아웃
              </a>
            </nav>
          </div>
        )}

        {/* ─── 메인 컨텐츠 ─── */}
        <main style={{ flex: 1, padding: "16px 16px", paddingBottom: 72, overflowX: "hidden" }}>
          <RiskBanner />
          {children}
        </main>
      </div>

      {/* ─── 하단 Binance 티커 ─── */}
      <FuturesTicker />

      <style>{`
        @media (max-width: 768px) {
          .desk-nav    { display: none !important; }
          .desk-logout { display: none !important; }
          .mob-btn     { display: block !important; }
        }
        @media (min-width: 769px) {
          .mob-btn { display: none !important; }
        }
      `}</style>
    </div>
  );
}
