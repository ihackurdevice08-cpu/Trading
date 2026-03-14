"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import BackgroundLayer from "@/components/ui/BackgroundLayer";
import FuturesTicker from "@/components/widgets/FuturesTicker";
import RiskBanner from "@/components/RiskBanner";

const Icons = {
  dashboard: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>),
  trades:    (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><rect x="9" y="3" width="6" height="4" rx="1"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>),
  goals:     (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>),
  risk:      (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>),
  tools:     (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>),
  withdrawals:(<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="8 12 12 8 16 12"/><line x1="12" y1="16" x2="12" y2="8"/></svg>),
  settings:  (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>),
  logout:    (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>),
  menu:      (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/></svg>),
};

const NAV = [
  { href: "/dashboard",     label: "대시보드",  icon: Icons.dashboard    },
  { href: "/manual-trades", label: "거래기록",  icon: Icons.trades       },
  { href: "/goals",         label: "목표",      icon: Icons.goals        },
  { href: "/risk",          label: "리스크",    icon: Icons.risk         },
  { href: "/tools",         label: "도구",      icon: Icons.tools        },
  { href: "/withdrawals",   label: "출금",      icon: Icons.withdrawals  },
  { href: "/settings",      label: "설정",      icon: Icons.settings     },
];

export default function AppLayout({ children }) {
  const pathname  = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div style={{ minHeight: "100vh", position: "relative" }}>
      <BackgroundLayer />
      <div style={{ position: "relative", zIndex: 2, minHeight: "100vh", display: "flex", flexDirection: "column" }}>

        {/* ─── 헤더 ─── */}
        <header style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "0 20px", height: 56,
          borderBottom: "1px solid var(--line-soft, rgba(255,255,255,.08))",
          background: "rgba(13,15,20,0.88)",
          backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
          position: "sticky", top: 0, zIndex: 50, flexShrink: 0,
        }}>

          {/* 브랜드 */}
          <div style={{ display: "flex", alignItems: "center", gap: 9, flexShrink: 0, userSelect: "none" }}>
            <div style={{
              width: 7, height: 7, borderRadius: "50%",
              background: "var(--accent, #F0B429)",
              boxShadow: "0 0 10px var(--accent, #F0B429)",
              flexShrink: 0,
            }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              <div style={{ fontWeight: 800, fontSize: 12.5, letterSpacing: 1.8, lineHeight: 1 }}>
                MAN CAVE OS
              </div>
              <div style={{ fontSize: 8, opacity: 0.3, lineHeight: 1, letterSpacing: 2.5, fontFamily: "var(--font-mono, monospace)" }}>
                PRIVATE CONSOLE
              </div>
            </div>
          </div>

          <div style={{ width: 1, height: 22, background: "var(--line-soft, rgba(255,255,255,.08))", margin: "0 10px", flexShrink: 0 }} />

          {/* 데스크탑 네비 */}
          <nav className="desk-nav" style={{ display: "flex", gap: 2, alignItems: "center" }}>
            {NAV.map(({ href, label, icon }) => {
              const active = pathname?.startsWith(href);
              return (
                <Link key={href} href={href} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "5px 11px", borderRadius: 7, textDecoration: "none",
                  color: active ? "var(--accent, #F0B429)" : "var(--text-secondary, rgba(255,255,255,0.5))",
                  border: active ? "1px solid rgba(240,180,41,0.25)" : "1px solid transparent",
                  background: active ? "rgba(240,180,41,0.08)" : "transparent",
                  fontWeight: active ? 700 : 500, fontSize: 12.5, letterSpacing: 0.1,
                  transition: "all 0.12s", whiteSpace: "nowrap",
                }}>
                  <span style={{ opacity: active ? 1 : 0.5, display: "flex", alignItems: "center" }}>{icon}</span>
                  {label}
                </Link>
              );
            })}
          </nav>

          <div style={{ flex: 1 }} />

          {/* 데스크탑 로그아웃 */}
          <a href="/auth/signout" className="desk-logout" style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "5px 12px", borderRadius: 7, textDecoration: "none",
            color: "var(--text-secondary, rgba(255,255,255,.45))",
            border: "1px solid var(--line-soft, rgba(255,255,255,.08))",
            fontWeight: 500, fontSize: 12, whiteSpace: "nowrap", transition: "all 0.12s",
          }}>
            {Icons.logout}
            로그아웃
          </a>

          {/* 모바일 햄버거 */}
          <button onClick={() => setMenuOpen(v => !v)} className="mob-btn"
            style={{
              all: "unset", cursor: "pointer", display: "none",
              padding: "7px 8px", borderRadius: 8,
              border: "1px solid var(--line-soft, rgba(255,255,255,.1))",
              color: "var(--text-primary, rgba(255,255,255,.9))",
              alignItems: "center",
            }}
            aria-label="메뉴 열기">
            {Icons.menu}
          </button>
        </header>

        {/* ─── 모바일 슬라이드 메뉴 ─── */}
        {menuOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
            onClick={() => setMenuOpen(false)}>
            <nav style={{
              position: "absolute", top: 0, right: 0,
              width: "min(280px, 82vw)", height: "100%",
              background: "rgba(15,17,23,0.98)",
              borderLeft: "1px solid var(--line-soft, rgba(255,255,255,.08))",
              boxShadow: "-24px 0 80px rgba(0,0,0,0.6)",
              display: "flex", flexDirection: "column",
              padding: "20px 14px", gap: 4, overflowY: "auto",
            }} onClick={e => e.stopPropagation()}>
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                paddingBottom: 16, borderBottom: "1px solid var(--line-soft, rgba(255,255,255,.08))", marginBottom: 8,
              }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent, #F0B429)", boxShadow: "0 0 8px var(--accent, #F0B429)" }} />
                <div style={{ fontWeight: 800, fontSize: 12.5, letterSpacing: 1.8 }}>MAN CAVE OS</div>
              </div>

              {NAV.map(({ href, label, icon }) => {
                const active = pathname?.startsWith(href);
                return (
                  <Link key={href} href={href} onClick={() => setMenuOpen(false)} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "11px 14px", borderRadius: 10, textDecoration: "none",
                    color: active ? "var(--accent, #F0B429)" : "var(--text-primary, rgba(255,255,255,.85))",
                    background: active ? "rgba(240,180,41,0.08)" : "transparent",
                    border: active ? "1px solid rgba(240,180,41,0.2)" : "1px solid transparent",
                    fontWeight: active ? 700 : 500, fontSize: 14, transition: "all 0.12s",
                  }}>
                    <span style={{ opacity: active ? 1 : 0.45, display: "flex", alignItems: "center" }}>{icon}</span>
                    {label}
                  </Link>
                );
              })}

              <div style={{ flex: 1 }} />

              <a href="/auth/signout" style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "11px 14px", borderRadius: 10, textDecoration: "none",
                color: "var(--text-secondary, rgba(255,255,255,.4))",
                border: "1px solid var(--line-soft, rgba(255,255,255,.08))",
                fontWeight: 500, fontSize: 13, marginTop: 8,
              }}>
                {Icons.logout} 로그아웃
              </a>
            </nav>
          </div>
        )}

        {/* ─── 메인 ─── */}
        <main style={{ flex: 1, padding: "20px 20px", paddingBottom: 80, overflowX: "hidden" }}>
          <RiskBanner />
          {children}
        </main>
      </div>

      <FuturesTicker />

      <style>{`
        @media (max-width: 768px) {
          .desk-nav    { display: none !important; }
          .desk-logout { display: none !important; }
          .mob-btn     { display: flex !important; }
        }
        @media (min-width: 769px) {
          .mob-btn { display: none !important; }
        }
      `}</style>
    </div>
  );
}
