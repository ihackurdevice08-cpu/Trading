"use client";
import React, { useState } from "react";
import { toast } from "sonner";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      border: "1px solid var(--line-soft,rgba(255,255,255,.08))",
      borderRadius: 14, padding: "20px 22px", marginBottom: 12,
      background: "var(--panel,rgba(255,255,255,0.04))",
    }}>{children}</div>
  );
}

export function DataManagementSection() {
  const [exporting,  setExporting]  = useState(false);
  const [purgeInfo,  setPurgeInfo]  = useState<{ count: number; cutoff: string } | null>(null);
  const [checking,   setChecking]   = useState(false);
  const [confirmVal, setConfirmVal] = useState("");
  const [purging,    setPurging]    = useState(false);
  const [showDanger, setShowDanger] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const [tradeRes, cycleRes] = await Promise.all([
        fetch("/api/manual-trades", { cache: "no-store" }).then(r => r.json()),
        fetch("/api/cycles",        { cache: "no-store" }).then(r => r.json()),
      ]);
      const trades = tradeRes.trades ?? [];
      const cycles = cycleRes.cycles ?? [];
      const BOM = "\uFEFF";
      const toCSV = (headers: string[], rows: unknown[][]) =>
        [headers, ...rows]
          .map(row => row.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
          .join("\n");
      const tradeRows = trades.map((t: any) => [
        t.id, t.symbol, t.side,
        t.opened_at?.slice(0,16).replace("T"," ") ?? "",
        t.closed_at?.slice(0,16).replace("T"," ") ?? "",
        t.pnl != null ? Number(t.pnl).toFixed(4) : "",
        (t.tags ?? []).join("|"),
        (t.notes ?? "").replace(/"/g,"'"),
      ]);
      const cycleRows = cycles.map((c: any) => [
        c.id, c.title, c.start_date, c.end_date ?? "",
        c.start_equity, c.end_equity ?? "", c.note ?? "",
      ]);
      const csv = BOM
        + "=== 거래 내역 ===\n"
        + toCSV(["ID","심볼","방향","진입일시","청산일시","손익(USDT)","태그","메모"], tradeRows)
        + "\n\n=== 사이클 ===\n"
        + toCSV(["ID","이름","시작일","종료일","시작자산","종료자산","메모"], cycleRows);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url;
      a.download = `mancave_backup_${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${trades.length}건 거래 + ${cycles.length}개 사이클 백업 완료`);
    } catch (e: any) { toast.error("내보내기 실패: " + (e?.message ?? "오류")); }
    finally { setExporting(false); }
  }

  async function handleCheck() {
    setChecking(true);
    try {
      const j = await fetch("/api/admin/purge-trades").then(r => r.json());
      if (!j.ok) throw new Error(j.error);
      setPurgeInfo({ count: j.count, cutoff: j.cutoff ?? "" });
    } catch (e: any) { toast.error(e?.message ?? "확인 실패"); }
    finally { setChecking(false); }
  }

  async function handlePurge() {
    if (confirmVal !== "삭제") { toast.error("'삭제'를 정확히 입력하세요"); return; }
    setPurging(true);
    try {
      const j = await fetch("/api/admin/purge-trades", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: "삭제" }),
      }).then(r => r.json());
      if (!j.ok) throw new Error(j.error);
      toast.success(`${j.deleted}건 삭제 완료`);
      setPurgeInfo(null); setConfirmVal(""); setShowDanger(false);
    } catch (e: any) { toast.error(e?.message ?? "삭제 실패"); }
    finally { setPurging(false); }
  }

  const btnBase: React.CSSProperties = {
    padding: "9px 16px", borderRadius: 9, fontSize: 13,
    fontWeight: 700, cursor: "pointer",
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.4, letterSpacing: 1.5,
        textTransform: "uppercase" as const, marginBottom: 10 }}>💾 데이터 관리</div>

      <Card>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>전체 데이터 백업</div>
        <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 14 }}>
          거래 내역과 사이클 전체를 CSV로 내보냅니다. 삭제 전 반드시 백업하세요.
        </div>
        <button onClick={handleExport} disabled={exporting} style={{
          ...btnBase,
          background: "color-mix(in srgb,var(--green,#0b7949) 15%,transparent)",
          border: "1px solid color-mix(in srgb,var(--green,#0b7949) 35%,transparent)",
          color: "var(--green,#0b7949)", opacity: exporting ? 0.5 : 1,
        }}>{exporting ? "내보내는 중…" : "💾 전체 거래 내역 백업 (.csv)"}</button>
      </Card>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--red,#c0392b)" }}>⚠️ Danger Zone</div>
          <button onClick={() => setShowDanger(v => !v)} style={{
            ...btnBase, padding: "4px 10px", fontSize: 11,
            background: "rgba(192,57,43,0.08)",
            border: "1px solid rgba(192,57,43,.2)",
            color: "var(--red,#c0392b)",
          }}>{showDanger ? "접기" : "펼치기"}</button>
        </div>
        <div style={{ fontSize: 12, opacity: 0.6, marginBottom: showDanger ? 14 : 0 }}>
          현재 사이클 이전 거래를 일괄 삭제합니다. 복구 불가 — 백업 필수.
        </div>

        {showDanger && (
          !purgeInfo ? (
            <button onClick={handleCheck} disabled={checking} style={{
              ...btnBase, background: "rgba(192,57,43,0.08)",
              border: "1px solid rgba(192,57,43,.25)",
              color: "var(--red,#c0392b)", opacity: checking ? 0.5 : 1,
            }}>{checking ? "확인 중…" : "🔍 삭제 예정 건수 확인"}</button>
          ) : (
            <div>
              <div style={{ padding: "12px 14px", borderRadius: 10, marginBottom: 12, fontSize: 13,
                background: "rgba(192,57,43,0.08)", border: "1px solid rgba(192,57,43,.2)" }}>
                <strong>{purgeInfo.cutoff}</strong> 이전{" "}
                <strong style={{ color: "var(--red,#c0392b)" }}>{purgeInfo.count.toLocaleString()}건</strong> 삭제 예정.
                현재 사이클 이후는 보존됩니다.
              </div>
              {purgeInfo.count > 0 ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" as const }}>
                  <input value={confirmVal} onChange={e => setConfirmVal(e.target.value)} placeholder="삭제"
                    style={{ padding: "8px 12px", borderRadius: 8, fontSize: 13, width: 100,
                      border: "1px solid rgba(192,57,43,.3)", background: "rgba(192,57,43,0.06)",
                      color: "inherit", outline: "none", boxSizing: "border-box" as const }} />
                  <button onClick={handlePurge} disabled={purging || confirmVal !== "삭제"} style={{
                    ...btnBase,
                    background: confirmVal === "삭제" ? "rgba(192,57,43,0.85)" : "rgba(192,57,43,0.3)",
                    border: "none", color: "white", opacity: purging ? 0.5 : 1,
                  }}>{purging ? "삭제 중…" : `🗑️ ${purgeInfo.count}건 영구 삭제`}</button>
                </div>
              ) : (
                <div style={{ fontSize: 12, opacity: 0.5 }}>삭제할 과거 데이터 없음</div>
              )}
            </div>
          )
        )}
      </Card>
    </div>
  );
}
