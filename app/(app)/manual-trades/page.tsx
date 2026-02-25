"use client";

import { useEffect, useMemo, useState, useCallback } from "react";

// ─────────────────────────── types ───────────────────────────
type Trade = {
  id: string;
  symbol: string;
  side: "long" | "short";
  opened_at: string;
  closed_at: string | null;
  pnl: number | null;
  fee: number | null;
  size: number | null;
  tags: string[];
  notes: string | null;
  source?: string;
};

// ─────────────────────────── utils ───────────────────────────
function thisMonthStart() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function fmt(n: any, d = 2) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return v.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
}
function pnlColor(v: number | null) {
  if (v == null || v === 0) return "inherit";
  return v > 0 ? "var(--green, #0b7949)" : "var(--red, #c0392b)";
}

// ─────────────────────────── page ───────────────────────────
export default function TradeRecordsPage() {
  // ── 날짜/필터 상태
  const [from, setFrom]               = useState(thisMonthStart);
  const [to,   setTo]                 = useState("");
  const [symFilter, setSymFilter]     = useState("");
  const [sideFilter, setSideFilter]   = useState<""|"long"|"short">("");
  const [srcFilter, setSrcFilter]     = useState<""|"bitget"|"manual">("");

  // ── 데이터
  const [trades, setTrades]   = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchedFrom, setFetchedFrom] = useState("");

  // ── 동기화
  const [syncing, setSyncing] = useState(false);
  const [syncLog, setSyncLog] = useState("");

  // ── 수동 입력 폼
  const [formOpen, setFormOpen]   = useState(false);
  const [fSymbol, setFSymbol]     = useState("BTCUSDT");
  const [fSide,   setFSide]       = useState<"long"|"short">("long");
  const [fTime,   setFTime]       = useState(() => new Date().toISOString().slice(0,16));
  const [fPnl,    setFPnl]        = useState("");
  const [fFee,    setFFee]        = useState("");
  const [fTags,   setFTags]       = useState("");
  const [fNotes,  setFNotes]      = useState("");
  const [formErr, setFormErr]     = useState("");

  // ── 불러오기
  const load = useCallback(async (overrideFrom?: string) => {
    setLoading(true);
    try {
      const f = overrideFrom ?? from;
      const params = new URLSearchParams({ from: f, limit: "1000" });
      if (to)        params.set("to", to);
      if (symFilter) params.set("symbol", symFilter);
      const r = await fetch(`/api/manual-trades?${params}`, { cache: "no-store" });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      setTrades(j.trades ?? []);
      setFetchedFrom(f);
    } catch (e: any) {
      setSyncLog("❌ " + (e?.message ?? "불러오기 실패"));
    } finally {
      setLoading(false);
    }
  }, [from, to, symFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const handler = () => load();
    window.addEventListener("trades-updated", handler);
    return () => window.removeEventListener("trades-updated", handler);
  }, [load]);

  // ── Bitget 동기화
  async function syncBitget() {
    setSyncing(true);
    setSyncLog(`⏳ ${from} 이후 Bitget 동기화 중…`);
    try {
      const r = await fetch("/api/sync-now", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ from }),
      });
      const j = await r.json();
      setSyncLog(j.ok ? `✅ ${j.note}` : `❌ ${j.error}`);
      if (j.ok) {
        window.dispatchEvent(new Event("trades-updated"));
        await load();
      }
    } catch (e: any) {
      setSyncLog("❌ " + e?.message);
    } finally {
      setSyncing(false);
    }
  }

  // ── 수동 입력
  async function addTrade() {
    setFormErr("");
    if (!fSymbol.trim()) { setFormErr("심볼 입력"); return; }
    try {
      const r = await fetch("/api/manual-trades", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          symbol:    fSymbol.trim().toUpperCase(),
          side:      fSide,
          opened_at: new Date(fTime).toISOString(),
          pnl:       fPnl  !== "" ? Number(fPnl)  : null,
          fee:       fFee  !== "" ? Number(fFee)  : null,
          tags:      fTags.split(",").map(s => s.trim()).filter(Boolean),
          notes:     fNotes || null,
        }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      setFPnl(""); setFFee(""); setFTags(""); setFNotes(""); setFormOpen(false);
      window.dispatchEvent(new Event("trades-updated"));
      await load();
    } catch (e: any) { setFormErr(e?.message ?? "저장 실패"); }
  }

  // ── 삭제
  async function del(id: string) {
    if (!confirm("삭제할까요?")) return;
    const r = await fetch(`/api/manual-trades?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const j = await r.json();
    if (j.ok) { window.dispatchEvent(new Event("trades-updated")); await load(); }
    else setSyncLog("❌ " + j.error);
  }

  // ── 클라이언트 필터
  const filtered = useMemo(() => trades.filter(t => {
    if (sideFilter && t.side !== sideFilter) return false;
    if (srcFilter === "bitget"  && t.source !== "bitget") return false;
    if (srcFilter === "manual"  && t.source === "bitget") return false;
    return true;
  }), [trades, sideFilter, srcFilter]);

  // ── 통계
  const stats = useMemo(() => {
    const hasPnl = filtered.filter(t => t.pnl != null);
    const wins   = hasPnl.filter(t => (t.pnl ?? 0) > 0);
    const losses = hasPnl.filter(t => (t.pnl ?? 0) < 0);
    const totalPnl = hasPnl.reduce((s, t) => s + (t.pnl ?? 0), 0);
    const totalFee = filtered.reduce((s, t) => s + (t.fee ?? 0), 0);
    const avgW = wins.length   ? wins.reduce((s,t)=>s+(t.pnl??0),0)   / wins.length   : null;
    const avgL = losses.length ? losses.reduce((s,t)=>s+(t.pnl??0),0) / losses.length : null;
    const wr   = hasPnl.length ? wins.length / hasPnl.length * 100 : null;
    const rr   = avgW && avgL  ? Math.abs(avgW / avgL) : null;
    return { totalPnl, totalFee, wins: wins.length, losses: losses.length, wr, rr, n: filtered.length };
  }, [filtered]);

  // ─────────────── render ───────────────
  return (
    <div style={{ maxWidth: 1040, margin: "0 auto" }}>

      {/* ── 타이틀 */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>Trade Records</h1>
        <div style={{ fontSize: 12, opacity: .55, marginTop: 2 }}>
          Bitget 자동동기화 + 수동 입력 · {fetchedFrom ? `${fetchedFrom} 이후` : ""}
        </div>
      </div>

      {/* ── 날짜 범위 + 동기화 패널 */}
      <div style={panel}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>

          <div style={col}>
            <span style={lbl}>집계 시작일</span>
            <input type="date" value={from} max={today()}
              onChange={e => setFrom(e.target.value)} style={inp} />
          </div>

          <div style={col}>
            <span style={lbl}>종료일 <span style={{ opacity:.5 }}>(선택)</span></span>
            <input type="date" value={to} min={from} max={today()}
              onChange={e => setTo(e.target.value)} style={inp} />
          </div>

          <div style={col}>
            <span style={lbl}>심볼</span>
            <input value={symFilter} placeholder="BTC, ETH…"
              onChange={e => setSymFilter(e.target.value)} style={{ ...inp, width: 100 }} />
          </div>

          {/* 빠른 범위 버튼 */}
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            {[
              { label: "이번 달", fn: () => { setFrom(thisMonthStart()); setTo(""); } },
              { label: "이번 주", fn: () => {
                  const d = new Date();
                  const day = d.getDay() || 7;
                  const mon = new Date(d); mon.setDate(d.getDate() - day + 1);
                  setFrom(mon.toISOString().slice(0,10)); setTo("");
                }},
              { label: "오늘",    fn: () => { setFrom(today()); setTo(""); } },
              { label: "3개월",   fn: () => {
                  const d = new Date(); d.setMonth(d.getMonth() - 3);
                  setFrom(d.toISOString().slice(0,10)); setTo("");
                }},
            ].map(({ label, fn }) => (
              <button key={label} onClick={fn} style={chip}>{label}</button>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => load()} disabled={loading} style={btn2}>
              {loading ? "로딩…" : "🔍 조회"}
            </button>
            <button onClick={syncBitget} disabled={syncing} style={btn1}>
              {syncing ? "동기화 중…" : "⚡ Bitget 동기화"}
            </button>
          </div>
        </div>

        {syncLog && (
          <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8,
            background: "rgba(0,0,0,0.04)", border: "1px solid var(--line-soft,rgba(0,0,0,.08))",
            fontSize: 13 }}>
            {syncLog}
          </div>
        )}
      </div>

      {/* ── 통계 카드 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8, marginBottom: 12 }}>
        {([
          ["거래",   `${stats.n}건`                                              ],
          ["PnL",    `${stats.totalPnl >= 0 ? "+" : ""}${fmt(stats.totalPnl)} USDT`, stats.totalPnl],
          ["수수료", `-${fmt(Math.abs(stats.totalFee))} USDT`                   ],
          ["순수익", `${(stats.totalPnl + stats.totalFee) >= 0 ? "+" : ""}${fmt(stats.totalPnl + stats.totalFee)} USDT`, stats.totalPnl + stats.totalFee],
          ["승률",   stats.wr  != null ? `${fmt(stats.wr, 1)}%` : "—"          ],
          ["승/패",  `${stats.wins}W / ${stats.losses}L`                        ],
          ["손익비", stats.rr  != null ? `1 : ${fmt(stats.rr, 2)}` : "—"       ],
        ] as [string, string, number?][]).map(([label, value, colorVal]) => (
          <div key={label} style={{ padding: "10px 12px", border: "1px solid var(--line-soft,rgba(0,0,0,.1))", borderRadius: 10, background: "var(--panel,white)" }}>
            <div style={{ fontSize: 10, opacity: .55, marginBottom: 3, fontWeight: 700 }}>{label}</div>
            <div style={{ fontWeight: 800, fontSize: 13, color: colorVal !== undefined ? pnlColor(colorVal) : "inherit" }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* ── 필터 바 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 12, opacity: .5, marginRight: 2 }}>방향</span>
        {(["", "long", "short"] as const).map(v => (
          <button key={v} onClick={() => setSideFilter(v)} style={{
            ...chip,
            fontWeight: sideFilter === v ? 900 : 600,
            background: sideFilter === v ? "rgba(0,0,0,0.10)" : "transparent",
            color: v === "long" && sideFilter === v ? "var(--green, #0b7949)" : v === "short" && sideFilter === v ? "var(--red, #c0392b)" : "inherit",
          }}>
            {v === "" ? "전체" : v.toUpperCase()}
          </button>
        ))}

        <span style={{ fontSize: 12, opacity: .5, marginLeft: 6, marginRight: 2 }}>소스</span>
        {(["", "bitget", "manual"] as const).map(v => (
          <button key={v} onClick={() => setSrcFilter(v)} style={{
            ...chip,
            fontWeight: srcFilter === v ? 900 : 600,
            background: srcFilter === v ? "rgba(0,0,0,0.10)" : "transparent",
          }}>
            {v === "" ? "전체" : v === "bitget" ? "⚡ 자동" : "✏️ 수동"}
          </button>
        ))}

        <div style={{ flex: 1 }} />
        <button onClick={() => setFormOpen(v => !v)} style={btn1}>
          {formOpen ? "닫기" : "+ 수동 입력"}
        </button>
      </div>

      {/* ── 수동 입력 폼 */}
      {formOpen && (
        <div style={{ ...panel, marginBottom: 12 }}>
          <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 10 }}>새 거래 직접 입력</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
            <div style={col}>
              <span style={lbl}>심볼</span>
              <input value={fSymbol} onChange={e => setFSymbol(e.target.value)} style={inp} />
            </div>
            <div style={col}>
              <span style={lbl}>방향</span>
              <select value={fSide} onChange={e => setFSide(e.target.value as any)} style={inp}>
                <option value="long">LONG</option>
                <option value="short">SHORT</option>
              </select>
            </div>
            <div style={col}>
              <span style={lbl}>진입 시간</span>
              <input type="datetime-local" value={fTime} onChange={e => setFTime(e.target.value)} style={inp} />
            </div>
            <div style={col}>
              <span style={lbl}>실현 PnL</span>
              <input value={fPnl} onChange={e => setFPnl(e.target.value)} placeholder="예: 120.5" style={inp} />
            </div>
            <div style={col}>
              <span style={lbl}>수수료</span>
              <input value={fFee} onChange={e => setFFee(e.target.value)} placeholder="예: -2.4" style={inp} />
            </div>
            <div style={{ ...col, gridColumn: "1 / -1" }}>
              <span style={lbl}>태그 (콤마 구분)</span>
              <input value={fTags} onChange={e => setFTags(e.target.value)} placeholder="breakout, revenge, clean" style={inp} />
            </div>
            <div style={{ ...col, gridColumn: "1 / -1" }}>
              <span style={lbl}>메모</span>
              <textarea value={fNotes} onChange={e => setFNotes(e.target.value)} rows={2}
                style={{ ...inp, resize: "vertical" }} />
            </div>
          </div>
          {formErr && <div style={{ marginTop: 8, fontSize: 13, color: "var(--red, #c0392b)" }}>{formErr}</div>}
          <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
            <button onClick={addTrade} style={btn1}>저장</button>
            <button onClick={() => setFormOpen(false)} style={btn2}>취소</button>
          </div>
        </div>
      )}

      {/* ── 테이블 */}
      <div style={{ border: "1px solid var(--line-soft,rgba(0,0,0,.1))", borderRadius: 12, overflow: "hidden", background: "var(--panel,white)" }}>

        {/* 헤더 */}
        <div style={{ display: "grid", gridTemplateColumns: COLS, gap: 8, padding: "9px 14px",
          borderBottom: "1px solid var(--line-soft,rgba(0,0,0,.08))",
          fontSize: 11, fontWeight: 700, opacity: .5 }} className="th-row">
          <span>심볼 / 시간</span>
          <span>방향</span>
          <span style={{ textAlign: "right" }}>PnL</span>
          <span style={{ textAlign: "right" }}>수수료</span>
          <span>태그</span>
          <span></span>
        </div>

        {loading ? (
          <div style={{ padding: 24, textAlign: "center", opacity: .55, fontSize: 14 }}>불러오는 중…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", opacity: .55, fontSize: 14 }}>
            {from ? `${from} 이후 기록 없음` : "기록 없음"}
          </div>
        ) : filtered.map((t, i) => {
          const isAuto = t.source === "bitget";
          const cleanTags = (t.tags ?? []).filter(tag => !["auto-sync","bitget"].includes(tag));
          return (
            <div key={t.id} style={{
              display: "grid", gridTemplateColumns: COLS, gap: 8,
              padding: "11px 14px", alignItems: "center",
              borderTop: i > 0 ? "1px solid var(--line-soft,rgba(0,0,0,.06))" : "none",
            }} className="tr-row">

              {/* 심볼 + 시간 */}
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontWeight: 800, fontSize: 14 }}>{t.symbol}</span>
                  {isAuto && (
                    <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 4,
                      background: "rgba(255,165,0,0.15)", color: "#b8860b", fontWeight: 700 }}>
                      ⚡
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11, opacity: .5, marginTop: 1 }}>
                  {t.opened_at?.slice(0,16).replace("T"," ")}
                </div>
                {t.notes && (
                  <div style={{ fontSize: 11, opacity: .6, marginTop: 2,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 }}>
                    {t.notes}
                  </div>
                )}
              </div>

              {/* 방향 */}
              <div>
                <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 6,
                  background: t.side === "long" ? "rgba(11,121,73,0.12)" : "rgba(192,57,43,0.12)",
                  color: t.side === "long" ? "var(--green, #0b7949)" : "var(--red, #c0392b)" }}>
                  {t.side.toUpperCase()}
                </span>
              </div>

              {/* PnL */}
              <div style={{ textAlign: "right", fontWeight: 800, fontSize: 14,
                color: pnlColor(t.pnl) }}>
                {t.pnl == null ? "—" : `${t.pnl > 0 ? "+" : ""}${fmt(t.pnl)}`}
              </div>

              {/* 수수료 */}
              <div style={{ textAlign: "right", fontSize: 12, opacity: .6 }}>
                {t.fee != null ? fmt(t.fee) : "—"}
              </div>

              {/* 태그 */}
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {cleanTags.map(tag => (
                  <span key={tag} style={{ fontSize: 10, padding: "1px 6px", borderRadius: 5,
                    background: "rgba(0,0,0,0.07)" }}>
                    {tag}
                  </span>
                ))}
              </div>

              {/* 삭제 */}
              <button onClick={() => del(t.id)} style={danger}>삭제</button>
            </div>
          );
        })}

        {/* 하단 합계 */}
        {filtered.length > 0 && (
          <div style={{ padding: "9px 14px", borderTop: "1px solid var(--line-soft,rgba(0,0,0,.08))",
            fontSize: 12, opacity: .65, display: "flex", gap: 16, flexWrap: "wrap" }}>
            <span>{filtered.length}건 표시</span>
            <span>합계 PnL: <b style={{ color: pnlColor(stats.totalPnl) }}>{stats.totalPnl >= 0 ? "+" : ""}{fmt(stats.totalPnl)}</b> USDT</span>
            {stats.totalFee !== 0 && <span>수수료: {fmt(Math.abs(stats.totalFee))} USDT</span>}
          </div>
        )}
      </div>

      {/* 반응형 */}
      <style>{`
        .th-row { display: grid; }
        @media (max-width: 640px) {
          .th-row { display: none !important; }
          .tr-row { grid-template-columns: 1fr auto !important; }
          .tr-row > *:nth-child(3),
          .tr-row > *:nth-child(4),
          .tr-row > *:nth-child(5) { display: none; }
        }
      `}</style>
    </div>
  );
}

// ── 레이아웃 상수
const COLS = "1fr 80px 90px 90px 1fr 52px";

// ── 스타일 상수
const inp: React.CSSProperties = {
  padding: "8px 11px", borderRadius: 9, fontSize: 14,
  border: "1px solid var(--line-soft,rgba(0,0,0,.12))",
  background: "rgba(0,0,0,0.05)", outline: "none",
  width: "100%", color: "inherit",
};
const lbl: React.CSSProperties  = { fontSize: 11, opacity: .65, fontWeight: 700 };
const col: React.CSSProperties  = { display: "grid", gap: 4 };
const panel: React.CSSProperties = {
  padding: "12px 14px", border: "1px solid var(--line-soft,rgba(0,0,0,.1))",
  borderRadius: 12, marginBottom: 12, background: "var(--panel,white)",
};
const btn1: React.CSSProperties = {
  padding: "9px 14px", borderRadius: 9, cursor: "pointer", whiteSpace: "nowrap",
  border: "1px solid var(--line-hard,rgba(0,0,0,.18))",
  background: "var(--text-primary,#111)", color: "white",
  fontWeight: 800, fontSize: 13,
};
const btn2: React.CSSProperties = {
  padding: "9px 14px", borderRadius: 9, cursor: "pointer", whiteSpace: "nowrap",
  border: "1px solid var(--line-soft,rgba(0,0,0,.1))",
  background: "transparent", fontWeight: 700, fontSize: 13,
};
const chip: React.CSSProperties = {
  padding: "5px 11px", borderRadius: 8, cursor: "pointer", fontSize: 12,
  border: "1px solid var(--line-soft,rgba(0,0,0,.1))", background: "transparent",
};
const danger: React.CSSProperties = {
  padding: "5px 9px", borderRadius: 7, cursor: "pointer", fontSize: 11,
  border: "1px solid rgba(192,57,43,.25)",
  background: "rgba(192,57,43,.07)", color: "var(--red, #c0392b)", fontWeight: 700,
};
