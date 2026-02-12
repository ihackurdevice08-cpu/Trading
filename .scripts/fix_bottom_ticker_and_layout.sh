#!/usr/bin/env bash
set -euo pipefail

# 1) AppLayout.jsx 통째로 정상화 + 하단 티커 고정(항상 보이게)
cat > components/layout/AppLayout.jsx <<'APP'
"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppearance } from "../providers/AppearanceProvider";
import { supabaseBrowser } from "../../lib/supabase/browser";
import FuturesTicker from "../widgets/FuturesTicker";

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
      setTimeout(() => setToast(""), 2500);
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
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          height: 56,
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
          <div style={{ color: "var(--text-muted)", fontSize: 12 }}>
            Private console for disciplined execution
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {showRefreshHere ? (
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
          ) : null}

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

      {/* Body */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: appearance.navLayout === "side" ? "240px 1fr" : "1fr" }}>
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

        <main style={{ padding: 16, paddingBottom: 84 }}>
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

      {/* ✅ Global Bottom Ticker (always visible, fixed) */}
      <FuturesTicker />
    </div>
  );
}
APP

# 2) FuturesTicker.jsx 통째로 재작성: 하단 고정(가로), 1초 갱신, 가격(좌) 퍼센트(우), 티커 클릭 -> TradingView(딥링크 시도 + 웹 fallback)
mkdir -p components/widgets
cat > components/widgets/FuturesTicker.jsx <<'TICK'
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];

function tvSymbol(sym) {
  // TradingView Perp 표기: BINANCE:BTCUSDT.P (대부분 이 심볼로 연결됨)
  return `BINANCE:${sym}.P`;
}

function openTradingView(sym) {
  const tv = tvSymbol(sym);
  const web = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tv)}`;

  // 모바일: 딥링크 시도 후 fallback
  // (TV 앱이 있으면 tradingview:// 가 먹히는 기기가 있음. 안 먹으면 웹으로 감.)
  const isMobile = typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isMobile) {
    const deep = `tradingview://chart?symbol=${encodeURIComponent(tv)}`;
    try {
      window.location.href = deep;
      setTimeout(() => {
        window.location.href = web;
      }, 650);
      return;
    } catch {
      window.location.href = web;
      return;
    }
  }

  window.open(web, "_blank", "noopener,noreferrer");
}

function fmtPrice(n) {
  if (typeof n !== "number" || !isFinite(n)) return "-";
  // 코인별 자릿수 자동 느낌
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
  if (n >= 100) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function fmtPct(n) {
  if (typeof n !== "number" || !isFinite(n)) return "-";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

export default function FuturesTicker() {
  const [data, setData] = useState({});
  const inflight = useRef(false);
  const timer = useRef(null);

  const rows = useMemo(() => {
    return SYMBOLS.map((s) => {
      const it = data[s] || {};
      const price = Number(it.price);
      const pct = Number(it.pct);
      const up = isFinite(pct) && pct >= 0;
      const color = !isFinite(pct) ? "var(--text-muted)" : up ? "rgba(139,226,139,0.95)" : "rgba(255,122,122,0.95)";
      return { symbol: s, price, pct, color };
    });
  }, [data]);

  async function tick() {
    if (inflight.current) return;
    inflight.current = true;
    try {
      const r = await fetch("/api/binance-tickers", { cache: "no-store" });
      const j = await r.json().catch(() => null);
      if (r.ok && j && j.ok && j.data) setData(j.data);
    } catch {
      // ignore
    } finally {
      inflight.current = false;
    }
  }

  useEffect(() => {
    tick();
    timer.current = setInterval(tick, 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        borderTop: "1px solid var(--line-soft)",
        background: "rgba(0,0,0,0.18)",
        backdropFilter: "blur(10px)",
        padding: "10px 12px",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 10,
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
        }}
      >
        {rows.map((r) => (
          <button
            key={r.symbol}
            type="button"
            onClick={() => openTradingView(r.symbol)}
            style={{
              all: "unset",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 14,
              border: "1px solid var(--line-soft)",
              background: "rgba(210,194,165,0.10)",
              minWidth: 210,
              justifyContent: "space-between",
            }}
            title="Open in TradingView"
          >
            <span style={{ fontWeight: 900, letterSpacing: 0.3 }}>
              {r.symbol.replace("USDT", "")}
            </span>

            {/* ✅ 요구: 가격(좌) / 퍼센트(우) */}
            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 900 }}>
              {fmtPrice(r.price)}
            </span>
            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 900, color: r.color }}>
              {fmtPct(r.pct)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
TICK

# 3) 빌드/커밋/푸시/배포
npm run build
git add components/layout/AppLayout.jsx components/widgets/FuturesTicker.jsx
git commit -m "fix: restore AppLayout + global bottom futures ticker (price-left pct-right, 1s refresh)" || true
git push
vercel --prod

echo "DONE"
