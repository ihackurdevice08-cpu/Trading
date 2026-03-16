"use client";
import { useEffect, useState, useCallback } from "react";

const fmt  = (v: any, d = 2) => { const n = Number(v); return Number.isFinite(n) ? n.toLocaleString("ko-KR", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—"; };
const toN  = (v: any) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const pnlColor = (v: number) => v > 0 ? "var(--green,#0b7949)" : v < 0 ? "var(--red,#c0392b)" : "inherit";

// ── 포지션 사이징 계산기 ────────────────────────────────────
function PositionCalculator({ equity }: { equity: number | null }) {
  const [accountSize, setAccountSize] = useState("");
  const [riskPct,     setRiskPct]     = useState("1");
  const [slPct,       setSlPct]       = useState("2");
  const [leverage,    setLeverage]    = useState("10");
  const [entryPrice,  setEntryPrice]  = useState("");
  const [loaded,      setLoaded]      = useState(false);

  useEffect(() => {
    if (equity != null && !loaded) {
      setAccountSize(String(Math.round(equity * 100) / 100));
      setLoaded(true);
    }
  }, [equity, loaded]);

  const acct  = toN(accountSize);
  const rPct  = toN(riskPct) / 100;
  const sl    = toN(slPct) / 100;
  const lev   = Math.max(1, toN(leverage));
  const entry = toN(entryPrice);

  // 리스크 금액
  const riskUSD = acct * rPct;
  // 손절 1% 당 실제 PnL% = 레버리지 × SL%
  // 진입 포지션 크기 (USDT 기준) = 리스크금액 / SL%
  const positionUSD = sl > 0 ? riskUSD / sl : 0;
  // 필요 증거금 = 포지션 / 레버리지
  const marginUSD   = positionUSD / lev;
  const marginPct   = acct > 0 ? (marginUSD / acct) * 100 : 0;
  // 코인 수량
  const qty = entry > 0 ? positionUSD / entry : 0;
  // 손절가 (롱 기준)
  const slPriceLong  = entry > 0 ? entry * (1 - sl) : 0;
  const slPriceShort = entry > 0 ? entry * (1 + sl) : 0;

  const dangerMargin = marginPct > 20;

  return (
    <div style={panel}>
      <div style={sectionTitle}>⚡ 포지션 사이징 계산기</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 16 }}>
        <div style={fieldCol}>
          <label style={lbl}>계좌 자산 (USDT)</label>
          <div style={{ position: "relative" as const }}>
            <input value={accountSize} onChange={e => setAccountSize(e.target.value)} style={inp} placeholder="자동 로드됨" />
            {equity != null && (
              <button onClick={() => setAccountSize(String(Math.round(equity * 100) / 100))}
                style={{ position: "absolute" as const, right: 6, top: "50%", transform: "translateY(-50%)",
                  fontSize: 10, padding: "2px 6px", borderRadius: 5, cursor: "pointer",
                  border: "1px solid var(--line-soft,rgba(0,0,0,.1))", background: "transparent", opacity: .6 }}>
                자산 불러오기
              </button>
            )}
          </div>
        </div>

        <div style={fieldCol}>
          <label style={lbl}>리스크 비율 (%)</label>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input value={riskPct} onChange={e => setRiskPct(e.target.value)} style={{ ...inp, flex: 1 }} />
            <div style={{ display: "flex", gap: 4 }}>
              {["0.5","1","2","3"].map(v => (
                <button key={v} onClick={() => setRiskPct(v)} style={{ ...chip, background: riskPct === v ? "rgba(240,180,41,0.15)" : "transparent", fontWeight: riskPct === v ? 800 : 600 }}>{v}%</button>
              ))}
            </div>
          </div>
        </div>

        <div style={fieldCol}>
          <label style={lbl}>손절 % (SL)</label>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input value={slPct} onChange={e => setSlPct(e.target.value)} style={{ ...inp, flex: 1 }} />
            <div style={{ display: "flex", gap: 4 }}>
              {["1","2","3","5"].map(v => (
                <button key={v} onClick={() => setSlPct(v)} style={{ ...chip, background: slPct === v ? "rgba(240,180,41,0.15)" : "transparent", fontWeight: slPct === v ? 800 : 600 }}>{v}%</button>
              ))}
            </div>
          </div>
        </div>

        <div style={fieldCol}>
          <label style={lbl}>레버리지 (×)</label>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input value={leverage} onChange={e => setLeverage(e.target.value)} style={{ ...inp, flex: 1 }} />
            <div style={{ display: "flex", gap: 4 }}>
              {["5","10","20","50"].map(v => (
                <button key={v} onClick={() => setLeverage(v)} style={{ ...chip, background: leverage === v ? "rgba(240,180,41,0.15)" : "transparent", fontWeight: leverage === v ? 800 : 600 }}>×{v}</button>
              ))}
            </div>
          </div>
        </div>

        <div style={fieldCol}>
          <label style={lbl}>진입가 (선택)</label>
          <input value={entryPrice} onChange={e => setEntryPrice(e.target.value)} style={inp} placeholder="입력 시 수량 계산" />
        </div>
      </div>

      {/* 결과 */}
      {acct > 0 && sl > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 8 }}>
          <ResultCard label="리스크 금액" value={`${fmt(riskUSD)} USDT`} sub={`계좌의 ${fmt(rPct*100,1)}%`} />
          <ResultCard label="포지션 크기" value={`${fmt(positionUSD)} USDT`} highlight />
          <ResultCard label="필요 증거금" value={`${fmt(marginUSD)} USDT`}
            sub={`계좌의 ${fmt(marginPct,1)}%`}
            warn={dangerMargin} />
          {entry > 0 && <ResultCard label="진입 수량" value={`${fmt(qty, 4)}`} sub="코인" />}
          {entry > 0 && (
            <ResultCard label="손절가" value={`롱 ${fmt(slPriceLong,2)} / 숏 ${fmt(slPriceShort,2)}`} sub="USDT" />
          )}
          <ResultCard label="레버리지" value={`×${lev}`} sub={`실효 리스크 ${fmt(sl*lev*100,1)}%`} />
        </div>
      )}
    </div>
  );
}

function ResultCard({ label, value, sub, highlight, warn }: { label: string; value: string; sub?: string; highlight?: boolean; warn?: boolean }) {
  return (
    <div style={{
      padding: "10px 12px", borderRadius: 10,
      border: `1px solid ${warn ? "rgba(192,57,43,0.3)" : highlight ? "rgba(184,154,90,0.35)" : "var(--line-soft,rgba(0,0,0,.1))"}`,
      background: warn ? "rgba(255,77,77,0.08)" : highlight ? "rgba(240,180,41,0.08)" : "var(--panel)",
    }}>
      <div style={{ fontSize: 10, opacity: .55, fontWeight: 700, marginBottom: 3 }}>{label}</div>
      <div style={{ fontWeight: 900, fontSize: 14, color: warn ? "var(--red,#c0392b)" : highlight ? "var(--accent,#B89A5A)" : "inherit" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, opacity: .45, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ── 일간 마감 리포트 ──────────────────────────────────────
function DailyReport() {
  const [report,        setReport]        = useState<any>(null);
  const [loading,       setLoading]       = useState(false);
  const [copied,        setCopied]        = useState(false);
  const [err,           setErr]           = useState("");
  const [notionSaving,  setNotionSaving]  = useState(false);
  const [notionMsg,     setNotionMsg]     = useState("");
  const [notionUrl,     setNotionUrl]     = useState("");

  async function saveToNotion() {
    if (!report) return;
    setNotionSaving(true); setNotionMsg(""); setNotionUrl("");
    try {
      const r = await fetch("/api/notion-sync", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date: report.date,
          trades: report.trades,
          stats: {
            totalPnl:    report.totalPnl,
            fundingPnl:  report.fundingPnl,
            wins:        report.wins.length,
            losses:      report.losses.length,
            wr:          report.wr,
            avgW:        report.avgW,
            avgL:        report.avgL,
            bestTrade:   report.bestTrade,
            worstTrade:  report.worstTrade,
            symbols:     report.symbols,
            mistakeCount: report.mistakeCount,
          },
        }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      setNotionMsg("✅ 노션에 저장됨");
      setNotionUrl(j.page_url ?? "");
    } catch (e: any) {
      const msg = e?.message ?? "저장 실패";
      if (msg.includes("Token") || msg.includes("database_id") || msg.includes("설정")) {
        setNotionMsg("❌ 설정 → 노션 연동에서 토큰/DB ID를 먼저 입력하세요");
      } else {
        setNotionMsg("❌ " + msg);
      }
    } finally { setNotionSaving(false); }
  }

  async function loadReport() {
    setLoading(true); setErr(""); setReport(null);
    try {
      const todayKST = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
      const r = await fetch(`/api/manual-trades?from=${todayKST}&limit=1000`, { cache: "no-store" });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);

      const trades: any[] = (j.trades || []).filter((t: any) => t.symbol !== "FUNDING");
      const funding = (j.trades || []).filter((t: any) => t.symbol === "FUNDING");

      const hasPnl  = trades.filter((t: any) => t.pnl != null);
      const wins    = hasPnl.filter((t: any) => t.pnl > 0);
      const losses  = hasPnl.filter((t: any) => t.pnl < 0);
      const totalPnl   = hasPnl.reduce((s: number, t: any) => s + t.pnl, 0);
      const fundingPnl = funding.reduce((s: number, t: any) => s + (t.pnl ?? 0), 0);
      const bestTrade  = hasPnl.length ? hasPnl.reduce((a: any, b: any) => b.pnl > a.pnl ? b : a) : null;
      const worstTrade = hasPnl.length ? hasPnl.reduce((a: any, b: any) => b.pnl < a.pnl ? b : a) : null;
      const wr = hasPnl.length ? (wins.length / hasPnl.length) * 100 : null;
      const avgW = wins.length   ? wins.reduce((s: number,t: any)=>s+t.pnl,0)   / wins.length   : null;
      const avgL = losses.length ? losses.reduce((s: number,t: any)=>s+t.pnl,0) / losses.length : null;

      // 심볼별 집계
      const symMap: Record<string, { pnl: number; count: number; wins: number }> = {};
      for (const t of hasPnl) {
        if (!symMap[t.symbol]) symMap[t.symbol] = { pnl: 0, count: 0, wins: 0 };
        symMap[t.symbol].pnl += t.pnl;
        symMap[t.symbol].count++;
        if (t.pnl > 0) symMap[t.symbol].wins++;
      }
      const symbols = Object.entries(symMap)
        .sort((a, b) => Math.abs(b[1].pnl) - Math.abs(a[1].pnl))
        .map(([sym, d]) => ({ sym, ...d, wr: Math.round(d.wins/d.count*100) }));

      // 실수 태그 집계
      const mistakeCount: Record<string, number> = {};
      for (const t of trades) {
        for (const tag of (t.tags ?? [])) {
          if (!["bitget","manual","auto-sync"].includes(tag)) {
            mistakeCount[tag] = (mistakeCount[tag] || 0) + 1;
          }
        }
      }

      setReport({ date: todayKST, trades, hasPnl, wins, losses, totalPnl, fundingPnl, bestTrade, worstTrade, wr, avgW, avgL, symbols, mistakeCount });
    } catch (e: any) { setErr(e?.message ?? "불러오기 실패"); }
    finally { setLoading(false); }
  }

  function copyNotion() {
    if (!report) return;
    const r = report;
    const s = (n: number | null) => n != null ? (n >= 0 ? "+" : "") + fmt(n) : "—";
    const lines = [
      `# 📊 일간 마감 리포트 — ${r.date}`,
      ``,
      `## 📈 요약`,
      `| 항목 | 값 |`,
      `|---|---|`,
      `| 총 PnL | **${s(r.totalPnl)} USDT** |`,
      r.fundingPnl !== 0 ? `| 펀딩피 | ${s(r.fundingPnl)} USDT |` : null,
      `| 거래 수 | ${r.hasPnl.length}건 (${r.wins.length}승 ${r.losses.length}패) |`,
      r.wr != null ? `| 승률 | ${fmt(r.wr, 1)}% |` : null,
      r.avgW != null ? `| 평균 익절 | +${fmt(r.avgW)} USDT |` : null,
      r.avgL != null ? `| 평균 손절 | ${fmt(r.avgL)} USDT |` : null,
      r.bestTrade  ? `| 최고 거래 | ${r.bestTrade.symbol} +${fmt(r.bestTrade.pnl)} USDT |` : null,
      r.worstTrade ? `| 최악 거래 | ${r.worstTrade.symbol} ${fmt(r.worstTrade.pnl)} USDT |` : null,
      ``,
      r.symbols.length > 0 ? `## 💹 심볼별` : null,
      r.symbols.length > 0 ? `| 심볼 | PnL | 건수 | 승률 |` : null,
      r.symbols.length > 0 ? `|---|---|---|---|` : null,
      ...r.symbols.map((s: any) => `| ${s.sym} | ${s.pnl >= 0 ? "+" : ""}${fmt(s.pnl)} | ${s.count} | ${s.wr}% |`),
      ``,
      Object.keys(r.mistakeCount).length > 0 ? `## ⚠️ 실수/평가 태그` : null,
      ...Object.entries(r.mistakeCount).map(([tag, cnt]) => `- ${tag}: ${cnt}회`),
      ``,
      `## 📝 오늘의 반성`,
      `- `,
      ``,
      `## 🎯 내일 계획`,
      `- `,
    ].filter(l => l !== null).join("\n");

    navigator.clipboard.writeText(lines).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <div style={panel}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={sectionTitle}>📋 일간 마감 리포트</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {report && (
            <>
              <button onClick={copyNotion} style={{ ...btn2,
                background: copied ? "rgba(11,121,73,0.08)" : "transparent",
                borderColor: copied ? "rgba(11,121,73,0.3)" : undefined,
                color: copied ? "var(--green,#0b7949)" : "inherit" }}>
                {copied ? "✅ 복사됨" : "📋 마크다운 복사"}
              </button>
              <button onClick={saveToNotion} disabled={notionSaving} style={{ ...btn1,
                background: notionSaving ? "rgba(255,255,255,0.1)" : "var(--accent,#F0B429)" }}>
                {notionSaving ? "저장 중…" : "📓 노션에 저장"}
              </button>
            </>
          )}
          <button onClick={loadReport} disabled={loading} style={btn1}>
            {loading ? "불러오는 중…" : "오늘 리포트 생성"}
          </button>
        </div>
      </div>

      {err && <div style={{ fontSize: 13, color: "var(--red,#c0392b)", marginBottom: 10 }}>❌ {err}</div>}
      {notionMsg && (
        <div style={{ fontSize: 12, marginBottom: 10, padding: "8px 12px", borderRadius: 8,
          background: notionMsg.startsWith("✅") ? "rgba(11,121,73,0.06)" : "rgba(192,57,43,0.06)",
          border: `1px solid ${notionMsg.startsWith("✅") ? "rgba(11,121,73,0.2)" : "rgba(192,57,43,0.2)"}`,
          display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span>{notionMsg}</span>
          {notionUrl && (
            <a href={notionUrl} target="_blank" rel="noreferrer"
              style={{ color: "var(--accent,#B89A5A)", fontWeight: 700, fontSize: 12 }}>
              노션에서 보기 →
            </a>
          )}
        </div>
      )}

      {!report && !loading && (
        <div style={{ padding: "24px", textAlign: "center" as const, opacity: .4, fontSize: 13 }}>
          "오늘 리포트 생성" 버튼을 눌러 오늘 거래를 분석합니다
        </div>
      )}

      {report && (
        <div>
          {/* 요약 카드 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8, marginBottom: 14 }}>
            <div style={{ ...statCard, border: `1px solid ${report.totalPnl >= 0 ? "rgba(11,121,73,0.25)" : "rgba(192,57,43,0.25)"}`, background: report.totalPnl >= 0 ? "rgba(11,121,73,0.04)" : "rgba(192,57,43,0.04)" }}>
              <div style={sLbl}>오늘 PnL</div>
              <div style={{ fontWeight: 900, fontSize: 22, color: pnlColor(report.totalPnl) }}>
                {report.totalPnl >= 0 ? "+" : ""}{fmt(report.totalPnl)}
              </div>
              <div style={{ fontSize: 11, opacity: .45 }}>USDT</div>
            </div>
            <div style={statCard}>
              <div style={sLbl}>거래 수</div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{report.hasPnl.length}건</div>
              <div style={{ fontSize: 11, opacity: .5 }}>{report.wins.length}승 {report.losses.length}패</div>
            </div>
            <div style={statCard}>
              <div style={sLbl}>승률</div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{report.wr != null ? fmt(report.wr, 1) + "%" : "—"}</div>
            </div>
            {report.avgW != null && (
              <div style={statCard}>
                <div style={sLbl}>평균 익절</div>
                <div style={{ fontWeight: 800, fontSize: 16, color: "var(--green,#0b7949)" }}>+{fmt(report.avgW)}</div>
              </div>
            )}
            {report.avgL != null && (
              <div style={statCard}>
                <div style={sLbl}>평균 손절</div>
                <div style={{ fontWeight: 800, fontSize: 16, color: "var(--red,#c0392b)" }}>{fmt(report.avgL)}</div>
              </div>
            )}
            {report.fundingPnl !== 0 && (
              <div style={statCard}>
                <div style={sLbl}>펀딩피</div>
                <div style={{ fontWeight: 800, fontSize: 16, color: pnlColor(report.fundingPnl) }}>
                  {report.fundingPnl >= 0 ? "+" : ""}{fmt(report.fundingPnl)}
                </div>
              </div>
            )}
          </div>

          {/* 최고 / 최악 거래 */}
          {(report.bestTrade || report.worstTrade) && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              {report.bestTrade && (
                <div style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(11,121,73,0.2)", background: "rgba(11,121,73,0.04)" }}>
                  <div style={{ fontSize: 10, opacity: .55, fontWeight: 700, marginBottom: 4 }}>🏆 최고 거래</div>
                  <div style={{ fontWeight: 800 }}>{report.bestTrade.symbol}</div>
                  <div style={{ fontWeight: 900, color: "var(--green,#0b7949)", fontSize: 15 }}>+{fmt(report.bestTrade.pnl)} USDT</div>
                  <div style={{ fontSize: 10, opacity: .4 }}>{report.bestTrade.opened_at?.slice(11,16)} · {report.bestTrade.side?.toUpperCase()}</div>
                </div>
              )}
              {report.worstTrade && report.worstTrade.pnl < 0 && (
                <div style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(192,57,43,0.2)", background: "rgba(192,57,43,0.04)" }}>
                  <div style={{ fontSize: 10, opacity: .55, fontWeight: 700, marginBottom: 4 }}>💀 최악 거래</div>
                  <div style={{ fontWeight: 800 }}>{report.worstTrade.symbol}</div>
                  <div style={{ fontWeight: 900, color: "var(--red,#c0392b)", fontSize: 15 }}>{fmt(report.worstTrade.pnl)} USDT</div>
                  <div style={{ fontSize: 10, opacity: .4 }}>{report.worstTrade.opened_at?.slice(11,16)} · {report.worstTrade.side?.toUpperCase()}</div>
                </div>
              )}
            </div>
          )}

          {/* 심볼별 */}
          {report.symbols.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, opacity: .5, fontWeight: 700, marginBottom: 8 }}>심볼별 성과</div>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 4 }}>
                {report.symbols.map((s: any) => (
                  <div key={s.sym} style={{ display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 12px", borderRadius: 9,
                    border: "1px solid var(--line-soft)",
                    background: "var(--panel)" }}>
                    <span style={{ fontWeight: 800, minWidth: 80 }}>{s.sym}</span>
                    <span style={{ flex: 1, height: 5, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                      <span style={{ display: "block", height: "100%", width: `${s.wr}%`, borderRadius: 999,
                        background: s.wr >= 60 ? "var(--green,#0b7949)" : s.wr < 40 ? "var(--red,#c0392b)" : "var(--accent,#B89A5A)" }} />
                    </span>
                    <span style={{ fontSize: 11, opacity: .5, minWidth: 40, textAlign: "right" as const }}>{s.wr}%</span>
                    <span style={{ fontWeight: 800, fontSize: 13, color: pnlColor(s.pnl), minWidth: 80, textAlign: "right" as const }}>
                      {s.pnl >= 0 ? "+" : ""}{fmt(s.pnl)}
                    </span>
                    <span style={{ fontSize: 11, opacity: .4, minWidth: 30 }}>{s.count}건</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 실수 태그 */}
          {Object.keys(report.mistakeCount).length > 0 && (
            <div>
              <div style={{ fontSize: 11, opacity: .5, fontWeight: 700, marginBottom: 8 }}>오늘의 패턴</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {Object.entries(report.mistakeCount).map(([tag, cnt]) => (
                  <span key={tag} style={{ padding: "4px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700,
                    border: "1px solid var(--line-soft,rgba(0,0,0,.1))",
                    background: "rgba(255,255,255,0.04)" }}>
                    {tag} <span style={{ opacity: .5 }}>×{cnt as number}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {report.hasPnl.length === 0 && (
            <div style={{ padding: "20px", textAlign: "center" as const, opacity: .4, fontSize: 13 }}>오늘 청산된 거래 없음</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ToolsPage() {
  const [equity, setEquity] = useState<number | null>(null);

  // 대시보드에서 자산 가져오기
  useEffect(() => {
    fetch("/api/dashboard", { cache: "no-store" })
      .then(r => r.json())
      .then(j => { if (j.ok) setEquity(j.stats?.equityNow ?? null); })
      .catch(() => {});
  }, []);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>실전 도구</h1>
        <div style={{ fontSize: 12, opacity: .45, marginTop: 2 }}>포지션 계산 · 일간 리포트</div>
      </div>

      <PositionCalculator equity={equity} />
      <DailyReport />
    </div>
  );
}

const panel: React.CSSProperties = {
  padding: "16px 18px", borderRadius: 14, marginBottom: 16,
  border: "1px solid var(--line-soft,rgba(0,0,0,.1))",
  background: "var(--panel)",
};
const sectionTitle: React.CSSProperties = { fontSize: 13, fontWeight: 900, marginBottom: 0, opacity: 0.8 };
const fieldCol: React.CSSProperties = { display: "grid", gap: 5 };
const lbl: React.CSSProperties = { fontSize: 11, opacity: .6, fontWeight: 700 };
const inp: React.CSSProperties = {
  padding: "8px 11px", borderRadius: 9, fontSize: 14,
  border: "1px solid var(--line-soft,rgba(0,0,0,.12))",
  background: "rgba(255,255,255,0.06)", outline: "none", width: "100%", color: "inherit", boxSizing: "border-box" as const,
};
const chip: React.CSSProperties = {
  padding: "4px 8px", borderRadius: 7, cursor: "pointer", fontSize: 11,
  border: "1px solid var(--line-soft,rgba(0,0,0,.1))", background: "transparent", whiteSpace: "nowrap" as const,
};
const btn1: React.CSSProperties = {
  padding: "8px 14px", borderRadius: 9, cursor: "pointer", whiteSpace: "nowrap" as const,
  border: "1px solid var(--line-hard,rgba(0,0,0,.18))",
  background: "var(--accent,#F0B429)", color: "#0a0a0a", fontWeight: 800, fontSize: 13,
};
const btn2: React.CSSProperties = {
  padding: "8px 14px", borderRadius: 9, cursor: "pointer", whiteSpace: "nowrap" as const,
  border: "1px solid var(--line-soft,rgba(0,0,0,.1))",
  background: "transparent", fontWeight: 700, fontSize: 13,
};
const statCard: React.CSSProperties = {
  padding: "10px 12px", borderRadius: 10,
  border: "1px solid var(--line-soft,rgba(0,0,0,.1))",
  background: "var(--panel)",
};
const sLbl: React.CSSProperties = { fontSize: 10, opacity: .55, fontWeight: 700, marginBottom: 3 };
