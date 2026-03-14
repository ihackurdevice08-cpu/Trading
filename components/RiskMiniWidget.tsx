"use client";

import { useEffect, useRef, useState } from "react";

let _cache: any = null;
let _cacheAt = 0;
const CACHE_MS = 30_000;

function fmt(v: any, d = 1) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("ko-KR", { maximumFractionDigits: d }) : "—";
}

const STATE_META = {
  NORMAL:   { color: "var(--green,#00C076)", icon: "◈", label: "정상"     },
  SLOWDOWN: { color: "var(--amber,#F0B429)", icon: "◬", label: "주의"     },
  STOP:     { color: "var(--red,#FF4D4D)", icon: "◬", label: "거래 중단" },
} as const;

export default function RiskMiniWidget() {
  const [data, setData] = useState<any>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    async function load() {
      if (_cache && Date.now() - _cacheAt < CACHE_MS) {
        if (alive.current) setData(_cache);
        return;
      }
      try {
        const r = await fetch("/api/risk", { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        if (!j?.ok) return;
        _cache = j; _cacheAt = Date.now();
        if (alive.current) setData(j);
      } catch {}
    }
    load();
    const id = setInterval(load, CACHE_MS);
    return () => { alive.current = false; clearInterval(id); };
  }, []);

  if (!data?.ok) return (
    <div style={wrap}>
      <div style={head}><span style={{ opacity: .4 }}>◬</span> <span style={headTxt}>리스크 현황</span></div>
      <div style={{ fontSize: 12, opacity: .4, padding: "8px 0" }}>불러오는 중…</div>
    </div>
  );

  const s  = data.stats || {};
  const mt = STATE_META[data.state as keyof typeof STATE_META] || STATE_META.NORMAL;

  const metrics: [string, string][] = [
    ["누적 PnL",   `${s.cumPnl >= 0 ? "+" : ""}${fmt(s.cumPnl)} (${fmt(s.pnlPct)}%)`],
    ["최대 낙폭",  `${fmt(s.maxDdUsd)} USDT (${fmt(s.ddPct)}%)`                       ],
    ["오늘 PnL",   `${s.todayPnl >= 0 ? "+" : ""}${fmt(s.todayPnl)} USDT`            ],
    ["오늘 거래",  `${fmt(s.tradesToday, 0)}건`                                         ],
    ["연속 손실",  `${fmt(s.maxConsecLoss, 0)}연패`                                    ],
  ];

  return (
    <div style={wrap}>
      {/* 헤더 */}
      <div style={{ ...head, marginBottom: 10 }}>
        <span style={{ color: mt.color, fontSize: 14 }}>{mt.icon}</span>
        <span style={headTxt}>리스크 현황</span>
        <span style={{ fontWeight: 900, fontSize: 13, color: mt.color }}>{mt.label}</span>
        {data.reasons?.length > 0 && (
          <span style={{ fontSize: 11, opacity: .6 }}>· {data.reasons.join(", ")}</span>
        )}
      </div>

      {/* 지표 그리드 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 6 }}>
        {metrics.map(([label, value]) => (
          <div key={label} style={metricBox}>
            <div style={{ fontSize: 10, fontWeight: 700, opacity: .5, marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 800 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* 드로다운 바 */}
      {s.peakEquity > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 10, opacity: .5, marginBottom: 4, fontWeight: 700 }}>
            드로다운  {fmt(s.ddPct)}%
            <span style={{ opacity: .5 }}> / 한도 {fmt(s.seed > 0 ? (data.settings?.max_dd_usd / s.seed * 100) : 0)}%</span>
          </div>
          <div style={{ height: 4, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 999,
              width: `${Math.min(100, s.ddPct ?? 0)}%`,
              background: s.ddPct > 3 ? "var(--red, #c0392b)" : s.ddPct > 1.5 ? "var(--amber, #d97706)" : "var(--green, #0b7949)",
              transition: "width 0.4s",
            }} />
          </div>
        </div>
      )}
    </div>
  );
}

const wrap: React.CSSProperties = {
  border: "1px solid var(--line-soft)",
  borderRadius: 12, padding: "12px 14px",
  background: "var(--panel)",
  marginBottom: 16,
};
const head: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 7,
};
const headTxt: React.CSSProperties = {
  fontSize: 12, fontWeight: 800, opacity: .55, letterSpacing: .3, flex: 1,
};
const metricBox: React.CSSProperties = {
  padding: "8px 10px", borderRadius: 8,
  border: "1px solid var(--line-soft)",
  background: "rgba(255,255,255,0.04)",
};
