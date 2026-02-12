"use client";

import { useAppearance } from "@/components/providers/AppearanceProvider";
import { useState } from "react";

const ROWS = [
  { id: "row1", label: "Row 1 - Status" },
  { id: "row2", label: "Row 2 - Asset & Performance" },
  { id: "row3", label: "Row 3 - Behavior" },
  { id: "row4", label: "Row 4 - Overtrade" },
  { id: "row5", label: "Row 5 - Goals" },
] as const;

export default function SettingsPage() {
  const { appearance, patchAppearance } = useAppearance();
  const [msg, setMsg] = useState("");

  const order =
    appearance.dashboardRowOrder ?? ["row1","row2","row3","row4","row5"];

  function move(idx: number, dir: -1 | 1) {
    const next = [...order];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    const temp = next[idx];
    next[idx] = next[target];
    next[target] = temp;
    patchAppearance({ dashboardRowOrder: next });
  }

  async function save() {
    setMsg("");
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ appearance }),
    });
    if (!res.ok) {
      setMsg("저장 실패");
      return;
    }
    setMsg("저장 완료");
  }

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      <h1>Settings</h1>

      <h3 style={{ marginTop: 30 }}>Dashboard Row 순서</h3>

      {order.map((id, idx) => {
        const row = ROWS.find(r => r.id === id);
        return (
          <div key={id} style={rowBox}>
            <div style={{ flex: 1 }}>{row?.label}</div>
            <button onClick={() => move(idx, -1)}>▲</button>
            <button onClick={() => move(idx, 1)}>▼</button>
          </div>
        );
      })}

      <button onClick={save} style={saveBtn}>
        Save
      </button>

      {msg && <div style={{ marginTop: 10 }}>{msg}</div>}
    </div>
  );
}

const rowBox: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: 10,
  marginBottom: 8,
  border: "1px solid #eee",
  borderRadius: 6,
  background: "white",
};

const saveBtn: React.CSSProperties = {
  marginTop: 20,
  padding: "10px 20px",
  fontWeight: 700,
};
