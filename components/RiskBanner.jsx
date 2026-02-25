"use client";
import { useEffect, useState } from "react";

// 모듈 레벨 캐시 (30초)
let _cache = null;
let _cacheAt = 0;
const CACHE_MS = 30_000;

export default function RiskBanner() {
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      // 캐시 유효하면 재사용
      if (_cache && Date.now() - _cacheAt < CACHE_MS) {
        if (alive) setData(_cache);
        return;
      }
      try {
        const r = await fetch("/api/risk", { cache: "no-store" });
        if (!r.ok) return; // 401 등 에러는 조용히 무시
        const j = await r.json();
        if (!j?.ok) return; // unauthorized면 배너 안 보임
        _cache = j;
        _cacheAt = Date.now();
        if (alive) setData(j);
      } catch {
        // 네트워크 오류도 조용히 무시
      }
    }

    load();
    return () => { alive = false; };
  }, []);

  // 정상이거나 데이터 없으면 아무것도 안 보임
  if (!data?.ok || data.state === "NORMAL") return null;

  const isStop = data.state === "STOP";
  const bg = isStop ? "#fff0f0" : "#fff7ed";
  const border = isStop ? "rgba(188,10,7,0.2)" : "rgba(0,0,0,0.08)";
  const msg = isStop
    ? "지금은 리스크가 많이 쌓였어요. 잠깐 멈추고 기록을 남기면서 가면 됩니다."
    : "리스크 신호가 감지됐어요. 한 템포 늦추고 안전하게 가면 됩니다.";

  return (
    <div style={{
      border: `1px solid ${border}`,
      background: bg,
      padding: "10px 14px",
      borderRadius: 12,
      marginBottom: 12,
    }}>
      <div style={{ fontWeight: 900, marginBottom: 3, fontSize: 14 }}>
        ⚠ Risk: {data.state}
        {data.reasons?.length ? ` · ${data.reasons.join(", ")}` : ""}
      </div>
      <div style={{ fontSize: 13, opacity: 0.85 }}>{msg}</div>
    </div>
  );
}
