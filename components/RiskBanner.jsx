"use client";
import { useEffect, useState } from "react";

// 30초 캐시 (RiskBanner는 모든 페이지에 마운트되어 API를 과다 호출함)
let _cache = null;
let _cacheAt = 0;
const CACHE_MS = 30_000;

export default function RiskBanner() {
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      // 30초 이내 캐시 있으면 재사용
      if (_cache && Date.now() - _cacheAt < CACHE_MS) {
        if (alive) setData(_cache);
        return;
      }
      try {
        const j = await fetch("/api/risk", { cache: "no-store" }).then((r) => r.json());
        _cache = j;
        _cacheAt = Date.now();
        if (alive) setData(j);
      } catch {}
    }

    load();
    return () => { alive = false; };
  }, []);

  if (!data?.ok) return null;
  if (data.state === "NORMAL") return null;

  const isStop = data.state === "STOP";
  const msg = isStop
    ? "지금은 리스크가 꽤 쌓였어요. 속도를 확 줄이고 기록을 남기면서 가면 됩니다."
    : "리스크 신호가 감지됐어요. 한 템포만 늦추고 더 안전하게 가면 됩니다.";

  const bg = isStop ? "#fff0f0" : "#fff7ed";
  const border = isStop ? "rgba(188,10,7,0.2)" : "#eee";

  return (
    <div style={{
      border: `1px solid ${border}`,
      background: bg,
      padding: "10px 14px",
      borderRadius: 12,
      marginBottom: 12,
    }}>
      <div style={{ fontWeight: 900, marginBottom: 4 }}>
        ⚠ Risk: {data.state}
        {data.reasons?.length ? ` · ${data.reasons.join(", ")}` : ""}
      </div>
      <div style={{ opacity: 0.9, fontSize: 14 }}>{msg}</div>
    </div>
  );
}
