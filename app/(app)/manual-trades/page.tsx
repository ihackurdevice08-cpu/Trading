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
  const [err, setErr] = useState("");

  const [symbol, setSymbol] = useState("BTCUSDT");
  const [side, setSide] = useState<"long" | "short">("long");
  const [openedAt, setOpenedAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [pnl, setPnl] = useState("");
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [formOpen, setFormOpen] = useState(false);

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
          opened_at: new Date(openedAt).toISOString(),
          pnl: pnl === "" ? null : Number(pnl),
          tags: tagArr,
          notes: notes || null,
        }),
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "저장 실패");
      await load();
      setPnl(""); setTags(""); setNotes("");
      setFormOpen(false);
      window.dispatchEvent(new Event("trades-updated"));
    } catch (e: any) {
      setErr(e?.message || "오류");
    }
  }

  async function deleteTrade(id: string) {
    if (!window.confirm("이 거래기록을 삭제할까요?")) return;
    try {
      const res = await fetch(`/api/manual-trades?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "삭제 실패");
      await load();
      window.dispatchEvent(new Event("trades-updated"));
    } catch (e: any) {
      setErr(e?.message || "오류");
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>수동 거래기록</h1>
        <button
          onClick={() => setFormOpen((v) => !v)}
          style={{ padding: "8px 14px", borderRadius: 10, border: "1px solid var(--line-hard,rgba(0,0,0,.18))", background: "var(--panel,white)", fontWeight: 800, fontSize: 13 }}
        >
          {formOpen ? "닫기" : "+ 새 기록"}
        </button>
      </div>

      {err && (
        <div style={{ padding: 12, border: "1px solid rgba(188,10,7,.3)", borderRadius: 10, marginBottom: 12, color: "#bc0a07", fontSize: 13 }}>
          {err}
        </div>
      )}

      {/* 입력 폼 — 접었다 펼침 */}
      {formOpen && (
        <div style={{ padding: 14, border: "1px solid var(--line-soft,rgba(0,0,0,.1))", borderRadius: 12, marginBottom: 16, background: "var(--panel,white)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
            <label style={{ display: "grid", gap: 5 }}>
              <span style={{ fontSize: 12, opacity: 0.7 }}>심볼</span>
              <input value={symbol} onChange={(e) => setSymbol(e.target.value)} style={iStyle} />
            </label>
            <label style={{ display: "grid", gap: 5 }}>
              <span style={{ fontSize: 12, opacity: 0.7 }}>방향</span>
              <select value={side} onChange={(e) => setSide(e.target.value as any)} style={iStyle}>
                <option value="long">LONG</option>
                <option value="short">SHORT</option>
              </select>
            </label>
            <label style={{ display: "grid", gap: 5 }}>
              <span style={{ fontSize: 12, opacity: 0.7 }}>진입시간</span>
              <input type="datetime-local" value={openedAt} onChange={(e) => setOpenedAt(e.target.value)} style={iStyle} />
            </label>
            <label style={{ display: "grid", gap: 5 }}>
              <span style={{ fontSize: 12, opacity: 0.7 }}>실현 PnL</span>
              <input value={pnl} onChange={(e) => setPnl(e.target.value)} placeholder="예: 120.5" style={iStyle} />
            </label>
            <label style={{ display: "grid", gap: 5, gridColumn: "1 / -1" }}>
              <span style={{ fontSize: 12, opacity: 0.7 }}>태그 (콤마)</span>
              <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="breakout, revenge, clean" style={iStyle} />
            </label>
            <label style={{ display: "grid", gap: 5, gridColumn: "1 / -1" }}>
              <span style={{ fontSize: 12, opacity: 0.7 }}>메모</span>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} style={{ ...iStyle, minHeight: 60, resize: "vertical" }} />
            </label>
          </div>
          <div style={{ marginTop: 12 }}>
            <button onClick={addTrade} style={btnPrimary}>저장</button>
          </div>
        </div>
      )}

      {/* 요약 */}
      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
        <Pill>총 {trades.length}건</Pill>
        <Pill>PnL 합계: {fmt(pnlSum)}</Pill>
      </div>

      {/* 목록 */}
      <div style={{ border: "1px solid var(--line-soft,rgba(0,0,0,.1))", borderRadius: 12, overflow: "hidden", background: "var(--panel,white)" }}>
        {loading ? (
          <div style={{ padding: 16, opacity: 0.6, fontSize: 14 }}>불러오는 중...</div>
        ) : trades.length === 0 ? (
          <div style={{ padding: 16, opacity: 0.6, fontSize: 14 }}>아직 기록이 없습니다.</div>
        ) : trades.map((t, i) => (
          <div key={t.id} style={{
            padding: "12px 14px",
            borderTop: i > 0 ? "1px solid var(--line-soft,rgba(0,0,0,.07))" : "none",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
              <div>
                <span style={{ fontWeight: 800, fontSize: 14 }}>{t.symbol}</span>
                <span style={{
                  marginLeft: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "2px 7px",
                  borderRadius: 6,
                  background: t.side === "long" ? "rgba(11,121,73,0.12)" : "rgba(188,10,7,0.12)",
                  color: t.side === "long" ? "#0b7949" : "#bc0a07",
                }}>
                  {t.side.toUpperCase()}
                </span>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>
                  {t.pnl != null ? (
                    <span style={{ color: Number(t.pnl) >= 0 ? "#0b7949" : "#bc0a07" }}>
                      {Number(t.pnl) > 0 ? "+" : ""}{fmt(t.pnl)}
                    </span>
                  ) : "-"}
                </span>
                <button onClick={() => deleteTrade(t.id)} style={btnDanger}>삭제</button>
              </div>
            </div>
            <div style={{ marginTop: 4, fontSize: 11, opacity: 0.55 }}>
              {new Date(t.opened_at).toLocaleString("ko-KR")}
            </div>
            {t.tags?.length ? (
              <div style={{ marginTop: 5, display: "flex", gap: 4, flexWrap: "wrap" }}>
                {t.tags.map((tag) => (
                  <span key={tag} style={{ fontSize: 11, padding: "2px 7px", borderRadius: 6, background: "rgba(0,0,0,0.06)" }}>
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
            {t.notes ? <div style={{ marginTop: 5, fontSize: 12, opacity: 0.75 }}>{t.notes}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "6px 12px", borderRadius: 999, border: "1px solid var(--line-soft,rgba(0,0,0,.1))", fontSize: 13, background: "var(--panel,white)" }}>
      {children}
    </div>
  );
}

const iStyle: React.CSSProperties = {
  padding: "9px 11px",
  borderRadius: 10,
  border: "1px solid var(--line-soft, rgba(0,0,0,.12))",
  background: "rgba(0,0,0,.04)",
  color: "inherit",
  outline: "none",
  width: "100%",
};

const btnPrimary: React.CSSProperties = {
  padding: "10px 18px",
  borderRadius: 10,
  border: "1px solid var(--line-hard, rgba(0,0,0,.18))",
  background: "var(--text-primary, #111)",
  color: "white",
  fontWeight: 800,
  fontSize: 14,
  cursor: "pointer",
};

const btnDanger: React.CSSProperties = {
  padding: "5px 10px",
  borderRadius: 8,
  border: "1px solid rgba(188,10,7,.25)",
  background: "rgba(188,10,7,.08)",
  color: "#bc0a07",
  fontWeight: 700,
  fontSize: 12,
  cursor: "pointer",
};
