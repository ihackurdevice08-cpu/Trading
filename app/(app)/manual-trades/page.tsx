"use client";

import { useEffect, useMemo, useState } from "react";

type Trade = {
  id: string;
  symbol: string;
  side: "long" | "short";
  opened_at: string;
  closed_at: string | null;
  pnl: number | null;
  tags: string[];
  notes: string | null;
};

function fmt(n: any) {
  if (n === null || n === undefined || n === "") return "-";
  const v = Number(n);
  return Number.isFinite(v) ? v.toLocaleString() : String(n);
}

export default function ManualTradesPage() {
  const [loading, setLoading] = useState(true);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [err, setErr] = useState<string>("");

  const [symbol, setSymbol] = useState("BTCUSDT");
  const [side, setSide] = useState<"long" | "short">("long");
  const [openedAt, setOpenedAt] = useState(() => new Date().toISOString());
  const [pnl, setPnl] = useState<string>("");
  const [tags, setTags] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const pnlSum = useMemo(() => trades.reduce((acc, t) => acc + (t.pnl ?? 0), 0), [trades]);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/manual-trades", { cache: "no-store" });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "불러오기 실패");
      setTrades(j.trades || []);
    } catch (e: any) {
      setErr(e?.message || "오류");
    } finally {
      setLoading(false);
    }
  }

  async function addTrade() {
    setErr("");
    try {
      const tagArr = tags.split(",").map((s) => s.trim()).filter(Boolean);

      const res = await fetch("/api/manual-trades", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          symbol,
          side,
          opened_at: openedAt,
          pnl: pnl === "" ? null : Number(pnl),
          tags: tagArr,
          notes: notes || null,
        }),
      });

      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "저장 실패");

      await load();
      setPnl("");
      setTags("");
      setNotes("");
    } catch (e: any) {
      setErr(e?.message || "오류");
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 20 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>수동 거래기록</h1>
      <div style={{ opacity: 0.75, marginBottom: 16 }}>
        Dashboard/Goals/Risk의 “기초 데이터”를 여기서부터 쌓습니다.
      </div>

      {err ? (
        <div style={{ padding: 12, border: "1px solid rgba(255,0,0,.35)", borderRadius: 10, marginBottom: 14 }}>
          {err}
        </div>
      ) : null}

      <div style={{ padding: 14, border: "1px solid rgba(255,255,255,.12)", borderRadius: 12, marginBottom: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ opacity: 0.8 }}>심볼</span>
            <input value={symbol} onChange={(e) => setSymbol(e.target.value)} style={inputStyle} />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ opacity: 0.8 }}>방향</span>
            <select value={side} onChange={(e) => setSide(e.target.value as any)} style={inputStyle}>
              <option value="long">LONG</option>
              <option value="short">SHORT</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ opacity: 0.8 }}>진입시간 (ISO)</span>
            <input value={openedAt} onChange={(e) => setOpenedAt(e.target.value)} style={inputStyle} />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span style={{ opacity: 0.8 }}>실현 PnL (선택)</span>
            <input value={pnl} onChange={(e) => setPnl(e.target.value)} style={inputStyle} placeholder="예: 120.5" />
          </label>

          <label style={{ display: "grid", gap: 6, gridColumn: "1 / -1" }}>
            <span style={{ opacity: 0.8 }}>태그 (콤마로 구분)</span>
            <input value={tags} onChange={(e) => setTags(e.target.value)} style={inputStyle} placeholder="breakout, revenge, clean" />
          </label>

          <label style={{ display: "grid", gap: 6, gridColumn: "1 / -1" }}>
            <span style={{ opacity: 0.8 }}>메모 (선택)</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} style={{ ...inputStyle, minHeight: 70 }} />
          </label>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
          <button onClick={addTrade} style={btnStyle}>저장</button>
          <button onClick={load} style={btnStyle2}>새로고침</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 14, marginBottom: 10 }}>
        <div style={pillStyle}>총 기록: {trades.length}개</div>
        <div style={pillStyle}>PnL 합계: {fmt(pnlSum)}</div>
      </div>

      <div style={{ border: "1px solid rgba(255,255,255,.12)", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: 12, borderBottom: "1px solid rgba(255,255,255,.08)", opacity: 0.85 }}>
          최근 거래
        </div>

        {loading ? (
          <div style={{ padding: 14, opacity: 0.7 }}>불러오는 중...</div>
        ) : trades.length === 0 ? (
          <div style={{ padding: 14, opacity: 0.7 }}>아직 기록이 없습니다.</div>
        ) : (
          trades.map((t) => (
            <div key={t.id} style={{ padding: 12, borderTop: "1px solid rgba(255,255,255,.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontWeight: 800 }}>{t.symbol} · {t.side.toUpperCase()}</div>
                <div style={{ opacity: 0.75 }}>PnL: {fmt(t.pnl)}</div>
              </div>
              <div style={{ opacity: 0.75, marginTop: 6 }}>opened: {t.opened_at}</div>
              {t.tags?.length ? <div style={{ marginTop: 6, opacity: 0.8 }}>tags: {t.tags.join(", ")}</div> : null}
              {t.notes ? <div style={{ marginTop: 6, opacity: 0.85 }}>note: {t.notes}</div> : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,.14)",
  background: "rgba(0,0,0,.25)",
  color: "inherit",
  outline: "none",
};

const btnStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,.18)",
  background: "rgba(255,255,255,.10)",
  cursor: "pointer",
};

const btnStyle2: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,.18)",
  background: "transparent",
  cursor: "pointer",
  opacity: 0.9,
};

const pillStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,.12)",
  opacity: 0.9,
};
