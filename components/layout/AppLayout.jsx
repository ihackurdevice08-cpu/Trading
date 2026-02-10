"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppearance } from "../providers/AppearanceProvider";
import BackgroundLayer from "../ui/BackgroundLayer";

function NavItem({ href, label }) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      style={{
        padding: "10px 12px",
        borderRadius: 10,
        color: active ? "var(--text-primary)" : "var(--text-secondary)",
        background: active ? "rgba(210,194,165,0.10)" : "transparent",
        border: active ? "1px solid var(--line-hard)" : "1px solid transparent",
        textDecoration: "none",
        fontWeight: 700,
        letterSpacing: 0.2,
      }}
    >
      {label}
    </Link>
  );
}

export default function AppLayout({ children }) {
  const { appearance } = useAppearance();
  const isTop = appearance.navLayout === "top";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-main)", color: "var(--text-primary)", position: "relative" }}>
      <BackgroundLayer />

      <div style={{ position: "relative", zIndex: 2 }}>
        {isTop ? (
          <>
            <header
              style={{
                position: "sticky",
                top: 0,
                zIndex: 10,
                background: "rgba(18,17,15,0.72)",
                backdropFilter: "blur(10px)",
                borderBottom: "1px solid var(--line-soft)",
              }}
            >
              <div style={{ maxWidth: 1200, margin: "0 auto", padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ fontWeight: 900, letterSpacing: 0.6, color: "var(--accent-main)" }}>Man Cave OS</div>
                <nav style={{ display: "flex", gap: 10 }}>
                  <NavItem href="/dashboard" label="Dashboard" />
                  <NavItem href="/goals" label="Goals" />
                  <NavItem href="/settings" label="Settings" />
                </nav>
              </div>
            </header>

            <main style={{ padding: 18 }}>
              <div style={{ maxWidth: 1200, margin: "0 auto" }}>{children}</div>
            </main>
          </>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "260px 1fr" }}>
            <aside
              style={{
                position: "sticky",
                top: 0,
                height: "100vh",
                borderRight: "1px solid var(--line-soft)",
                background: "rgba(27,25,22,0.72)",
                backdropFilter: "blur(10px)",
                padding: 16,
              }}
            >
              <div style={{ fontWeight: 900, letterSpacing: 0.6, color: "var(--accent-main)", marginBottom: 14 }}>Man Cave OS</div>
              <nav style={{ display: "grid", gap: 10 }}>
                <NavItem href="/dashboard" label="Dashboard" />
                <NavItem href="/goals" label="Goals" />
                <NavItem href="/settings" label="Settings" />
              </nav>
            </aside>

            <main style={{ padding: 18 }}>
              <div style={{ maxWidth: 1200, margin: "0 auto" }}>{children}</div>
            </main>
          </div>
        )}
      </div>

      <style jsx global>{`
        :root{
          --bg-main:#12110F;
          --bg-panel:#1B1916;
          --bg-card:#22201C;
          --line-soft:#2E2B26;
          --line-hard:#3B372F;

          --accent-main:#D2C2A5;
          --accent-soft:#BFAF95;
          --accent-dim:#9E917C;

          --text-primary:#F1ECE3;
          --text-secondary:#C8C1B6;
          --text-muted:#9C9589;

          --status-great:#D2C2A5;
          --status-good:#8FA3B8;
          --status-slow:#D1A95F;
          --status-stop:#C84B4B;
        }
        body{
          margin:0;
          background: var(--bg-main);
          color: var(--text-primary);
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
        }
      `}</style>
    </div>
  );
}
