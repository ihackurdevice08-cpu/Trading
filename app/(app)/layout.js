import Link from "next/link";

export default function AppLayout({ children }) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, fontFamily: "system-ui" }}>
        <div style={S.shell}>
          {/* Left Sidebar (Plasmic로 교체 예정) */}
          <aside style={S.side}>
            <div style={S.brand}>Man Cave</div>

            <nav style={S.nav}>
              <Link style={S.navItem} href="/dashboard">Dashboard</Link>
              <Link style={S.navItem} href="/journal">Journal</Link>
              <Link style={S.navItem} href="/goals">Goals</Link>
              <Link style={S.navItem} href="/settings">Settings</Link>
            </nav>

            <div style={{ flex: 1 }} />

            <a style={S.logout} href="/auth/signout">Logout</a>
          </aside>

          {/* Main */}
          <main style={S.main}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

const S = {
  shell: { display: "flex", minHeight: "100vh", background: "#fafafa" },
  side: {
    width: 220,
    padding: 16,
    borderRight: "1px solid #eee",
    background: "white",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  brand: { fontWeight: 900, fontSize: 18 },
  nav: { display: "grid", gap: 8, marginTop: 8 },
  navItem: {
    padding: "10px 12px",
    borderRadius: 10,
    textDecoration: "none",
    color: "black",
    border: "1px solid #eee",
    background: "white",
  },
  logout: {
    padding: "10px 12px",
    borderRadius: 10,
    textDecoration: "none",
    color: "white",
    border: "1px solid #111",
    background: "#111",
    textAlign: "center",
  },
  main: { flex: 1, padding: 24 },
};
