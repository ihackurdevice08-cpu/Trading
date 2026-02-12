"use client";

import Link from "next/link";

export default function AppLayout({ children }) {
  const nav = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/journal", label: "Journal" },
    { href: "/goals", label: "Goals" },
    { href: "/manual-trades", label: "Trades" },
    { href: "/settings", label: "Settings" },
  ];

  return (
    <div style={S.shell}>
      <header style={S.header}>
        <div style={S.brand}>
          <div style={{ fontWeight: 900 }}>Man Cave OS</div>
          <div style={{ fontSize: 12, opacity: 0.75 }}>Private console for disciplined execution</div>
        </div>

        <nav style={S.nav}>
          {nav.map((x) => (
            <Link key={x.href} href={x.href} style={S.navItem}>
              {x.label}
            </Link>
          ))}
        </nav>

        <div style={{ flex: 1 }} />

        <div style={S.actions}>
          <a href="/auth/signout" style={S.actionBtn}>Logout</a>
        </div>
      </header>

      <main style={S.main}>{children}</main>
    </div>
  );
}

const S = {
  shell: { minHeight: "100vh" },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 16px",
    borderBottom: "1px solid rgba(0,0,0,.08)",
    background: "white",
    position: "sticky",
    top: 0,
    zIndex: 20,
  },
  brand: { display: "grid", gap: 2 },
  nav: { display: "flex", gap: 10, alignItems: "center" },
  navItem: {
    padding: "8px 12px",
    borderRadius: 10,
    textDecoration: "none",
    color: "#111",
    border: "1px solid rgba(0,0,0,.08)",
    background: "white",
    fontWeight: 700,
    fontSize: 14,
  },
  actions: { display: "flex", gap: 8, alignItems: "center" },
  actionBtn: {
    padding: "8px 12px",
    borderRadius: 10,
    textDecoration: "none",
    color: "white",
    background: "#111",
    fontWeight: 800,
    fontSize: 14,
  },
  main: { padding: 16 },
};
