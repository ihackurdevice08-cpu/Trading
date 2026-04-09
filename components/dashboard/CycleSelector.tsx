"use client";
import React, { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import type { Cycle } from "@/types/dashboard";

const fmt = (v: number) => v.toLocaleString("ko-KR", { maximumFractionDigits: 2 });

interface Props {
  cycles:      Cycle[];
  activeCycle: Cycle | null;
  pnlFrom:     string;
  onSelect:    (date: string) => void;   // pnlFrom 변경
  onCreated:   () => void;               // 사이클 생성 후 리프레시
  equityNow:   number;                   // 현재 자산 (스냅샷용)
}

// ── 새 사이클 모달 ─────────────────────────────────────────────
function NewCycleModal({
  equityNow,
  onClose,
  onCreated,
}: {
  equityNow: number;
  onClose:   () => void;
  onCreated: () => void;
}) {
  const [title,   setTitle]   = useState("");
  const [busy,    setBusy]    = useState(false);

  async function submit() {
    if (!title.trim()) { toast.error("사이클 이름을 입력하세요"); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/cycles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: title.trim(), start_equity: equityNow }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error);
      toast.success(`새 사이클 시작: ${title.trim()}`);
      onCreated();
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "생성 실패");
    } finally {
      setBusy(false);
    }
  }

  const overlay: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 200,
    background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)",
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: 20,
  };
  const modal: React.CSSProperties = {
    background: "var(--bg,#0d0f14)",
    border: "1px solid var(--line-soft,rgba(255,255,255,.1))",
    borderRadius: 16, padding: "28px 28px 24px",
    width: "100%", maxWidth: 400,
    boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>➕ 새 사이클 시작</div>
        <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 20 }}>
          현재 자산 <strong>{fmt(equityNow)} USDT</strong>를 시드(start_equity)로 스냅샷합니다.
          이전 사이클은 자동으로 종료됩니다.
        </div>

        <label style={{ fontSize: 11, opacity: 0.55, display: "block", marginBottom: 6 }}>사이클 이름</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()}
          placeholder="예: 5월의 도전, Q2 챌린지..."
          autoFocus
          style={{
            width: "100%", padding: "10px 14px", borderRadius: 9, fontSize: 14,
            border: "1px solid var(--line-soft,rgba(255,255,255,.15))",
            background: "rgba(255,255,255,0.06)", color: "inherit", outline: "none",
            boxSizing: "border-box",
          }}
        />

        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "10px", borderRadius: 9, fontSize: 13, fontWeight: 600,
            border: "1px solid var(--line-soft,rgba(255,255,255,.1))",
            background: "transparent", color: "inherit", cursor: "pointer",
          }}>취소</button>
          <button onClick={submit} disabled={busy || !title.trim()} style={{
            flex: 2, padding: "10px", borderRadius: 9, fontSize: 13, fontWeight: 700,
            border: "1px solid color-mix(in srgb,var(--accent,#F0B429) 50%,transparent)",
            background: "color-mix(in srgb,var(--accent,#F0B429) 15%,transparent)",
            color: "var(--accent,#F0B429)", cursor: busy ? "not-allowed" : "pointer",
            opacity: busy || !title.trim() ? 0.5 : 1,
          }}>
            {busy ? "생성 중…" : "🚀 시작"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 사이클 드롭다운 ────────────────────────────────────────────
export function CycleSelector({ cycles, activeCycle, pnlFrom, onSelect, onCreated, equityNow }: Props) {
  const [open,    setOpen]    = useState(false);
  const [modal,   setModal]   = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 바깥 클릭 닫기
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // 현재 선택 레이블
  const label = activeCycle
    ? activeCycle.title
    : pnlFrom
      ? `${pnlFrom} 이후`
      : "전체 기간";

  const btn: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 8,
    padding: "7px 12px", borderRadius: 9, fontSize: 13, fontWeight: 600,
    border: "1px solid var(--line-soft,rgba(255,255,255,.12))",
    background: "var(--panel,rgba(255,255,255,0.04))",
    color: "inherit", cursor: "pointer", userSelect: "none",
    minWidth: 160, justifyContent: "space-between",
    whiteSpace: "nowrap",
  };

  const dropdown: React.CSSProperties = {
    position: "absolute", top: "calc(100% + 6px)", left: 0,
    minWidth: 240, zIndex: 100,
    background: "var(--bg,#0d0f14)",
    border: "1px solid var(--line-soft,rgba(255,255,255,.12))",
    borderRadius: 12, padding: "6px",
    boxShadow: "0 16px 48px rgba(0,0,0,0.4)",
  };

  const item = (active: boolean): React.CSSProperties => ({
    display: "flex", flexDirection: "column", gap: 2,
    padding: "9px 12px", borderRadius: 8, cursor: "pointer",
    background: active
      ? "color-mix(in srgb,var(--accent,#F0B429) 12%,transparent)"
      : "transparent",
    border: "1px solid transparent",
  });

  return (
    <>
      <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
        {/* 드롭다운 트리거 */}
        <button style={btn} onClick={() => setOpen(v => !v)}>
          <span style={{ fontSize: 11, opacity: 0.45 }}>📅</span>
          <span style={{ flex: 1 }}>{label}</span>
          <span style={{ opacity: 0.4, fontSize: 10 }}>{open ? "▲" : "▼"}</span>
        </button>

        {open && (
          <div style={dropdown}>
            {/* 전체 기간 */}
            <div style={item(!pnlFrom)} onClick={() => { onSelect(""); setOpen(false); }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>전체 기간</span>
              <span style={{ fontSize: 10, opacity: 0.4 }}>모든 거래 기준</span>
            </div>

            {cycles.length > 0 && (
              <div style={{ height: 1, background: "var(--line-soft,rgba(255,255,255,.08))", margin: "4px 0" }} />
            )}

            {/* 사이클 목록 */}
            {cycles.map(c => {
              const isActive = !c.end_date;
              const isSel = pnlFrom === c.start_date;
              return (
                <div key={c.id} style={item(isSel)}
                  onClick={() => { onSelect(c.start_date); setOpen(false); }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{c.title}</span>
                    {isActive && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4,
                        background: "color-mix(in srgb,var(--green,#0b7949) 20%,transparent)",
                        color: "var(--green,#0b7949)",
                      }}>진행 중</span>
                    )}
                  </div>
                  <span style={{ fontSize: 10, opacity: 0.4, fontVariantNumeric: "tabular-nums" }}>
                    {c.start_date}{c.end_date ? ` → ${c.end_date}` : " ~ 현재"} · 시드 {fmt(c.start_equity)} USDT
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 새 사이클 버튼 */}
      <button onClick={() => setModal(true)} style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "7px 12px", borderRadius: 9, fontSize: 12, fontWeight: 700,
        border: "1px solid color-mix(in srgb,var(--accent,#F0B429) 35%,transparent)",
        background: "color-mix(in srgb,var(--accent,#F0B429) 10%,transparent)",
        color: "var(--accent,#F0B429)", cursor: "pointer", whiteSpace: "nowrap",
      }}>
        ➕ 새 사이클
      </button>

      {modal && (
        <NewCycleModal
          equityNow={equityNow}
          onClose={() => setModal(false)}
          onCreated={onCreated}
        />
      )}
    </>
  );
}
