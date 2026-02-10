"use client";

export default function AppLayout({ children }) {
  return (
    <div style={{
      display: "flex",
      minHeight: "100vh",
      background: "#0b0c10",
      color: "white"
    }}>
      <aside style={{
        width: 220,
        background: "#111",
        padding: 20
      }}>
        <h2>MAN CAVE</h2>
        <nav style={{ marginTop: 20 }}>
          <div>Dashboard</div>
          <div>Journal</div>
          <div>Goals</div>
          <div>Settings</div>
        </nav>
      </aside>

      <main style={{
        flex: 1,
        padding: 24
      }}>
        {children}
      </main>
    </div>
  );
}
