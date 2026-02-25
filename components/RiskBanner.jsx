"use client";
import { useEffect, useState } from "react";

let _cache = null;
let _cacheAt = 0;
const CACHE_MS = 30_000;

const STATE_META = {
  STOP:     { icon: "◬", color: "#c0392b", bg: "rgba(192,57,43,0.07)", border: "rgba(192,57,43,0.2)",  label: "거래 중단", msg: "리스크 한도에 도달했습니다. 잠시 멈추고 기록을 남긴 뒤 다음 기회를 노리세요." },
  SLOWDOWN: { icon: "◬", color: "#d97706", bg: "rgba(217,119,6,0.07)",  border: "rgba(217,119,6,0.2)", label: "주의",      msg: "리스크 신호가 감지됐습니다. 한 템포 늦추고 신중하게 접근하세요." },
};

export default function RiskBanner() {
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      if (_cache && Date.now() - _cacheAt < CACHE_MS) { if (alive) setData(_cache); return; }
      try {
        const r = await fetch("/api/risk", { cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        if (!j?.ok) return;
        _cache = j; _cacheAt = Date.now();
        if (alive) setData(j);
      } catch {}
    }
    load();
    return () => { alive = false; };
  }, []);

  if (!data?.ok || data.state === "NORMAL" || !STATE_META[data.state]) return null;

  const m = STATE_META[data.state];
  return (
    <div style={{ border: `1px solid ${m.border}`, background: m.bg,
      padding: "10px 14px", borderRadius: 12, marginBottom: 12,
      display: "flex", gap: 10, alignItems: "flex-start" }}>
      <span style={{ color: m.color, fontSize: 16, flexShrink: 0, lineHeight: 1.4 }}>{m.icon}</span>
      <div>
        <div style={{ fontWeight: 900, fontSize: 13, color: m.color, marginBottom: 2 }}>
          {m.label}
          {data.reasons?.length > 0 && (
            <span style={{ fontWeight: 600, marginLeft: 6, opacity: 0.8 }}>· {data.reasons.join(", ")}</span>
          )}
        </div>
        <div style={{ fontSize: 12, opacity: 0.8 }}>{m.msg}</div>
      </div>
    </div>
  );
}
