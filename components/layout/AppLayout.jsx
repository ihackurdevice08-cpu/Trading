"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BackgroundLayer from "@/components/ui/BackgroundLayer";
import FuturesTicker from "@/components/widgets/FuturesTicker";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/journal", label: "Journal" },
  { href: "/manual-trades", label: "Trades" },
  { href: "/goals", label: "Goals" },
  { href: "/risk", label: "Risk" },
  { href: "/settings", label: "Settings" },
];

export default function AppLayout({ children }) {
  const pathname = usePathname();

  return (
    <div style={{ minHeight: "100vh", position: "relative" }}>
      {/* 배경 레이어 (테마 배경 이미지/영상) */}
      <BackgroundLayer />

      {/* 컨텐츠 레이어 */}
      <div style={{ position: "relative", zIndex: 2, minHeight: "100vh" }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 16px",
            borderBottom: "1px solid var(--line-soft, rgba(0,0,0,.08))",
            background: "var(--panel, white)",
            position: "sticky",
            top: 0,
            zIndex: 20,
          }}
        >
          <div style={{ display: "grid", gap: 1 }}>
            <div style={{ fontWeight: 900, fontSize: 15 }}>Man Cave OS</div>
            <div style={{ fontSize: 11, opacity: 0.55 }}>Private console</div>
          </div>

          <nav style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: 8 }}>
            {NAV.map((x) => {
              const active = pathname?.startsWith(x.href);
              return (
                <Link
                  key={x.href}
                  href={x.href}
                  style={{
                    padding: "7px 12px",
                    borderRadius: 10,
                    textDecoration: "none",
                    color: active ? "var(--accent, #111)" : "var(--text-primary, #111)",
                    border: active
                      ? "1px solid var(--accent, #111)"
                      : "1px solid var(--line-soft, rgba(0,0,0,.08))",
                    background: active ? "rgba(0,0,0,0.06)" : "transparent",
                    fontWeight: active ? 900 : 700,
                    fontSize: 14,
                    transition: "all 0.15s",
                  }}
                >
                  {x.label}
                </Link>
              );
            })}
          </nav>

          <div style={{ flex: 1 }} />

          <a
            href="/auth/signout"
            style={{
              padding: "7px 12px",
              borderRadius: 10,
              textDecoration: "none",
              color: "var(--panel, white)",
              background: "var(--text-primary, #111)",
              fontWeight: 800,
              fontSize: 14,
            }}
          >
            Logout
          </a>
        </header>

        <main style={{ padding: 16, paddingBottom: 80 }}>
          {children}
        </main>
      </div>

      {/* 하단 가격 티커 */}
      <FuturesTicker />
    </div>
  );
}
