"use client";

import { useState } from "react";
import { useAppearance } from "../../../components/providers/AppearanceProvider";
import { supabaseBrowser } from "@/lib/supabase/browser";

function Card({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid var(--line-soft)", borderRadius: 16, padding: 16, background: "rgba(0,0,0,0.12)" }}>
      <div style={{ fontSize: 18, fontWeight: 900 }}>{title}</div>
      {desc ? <div style={{ color: "var(--text-muted)", marginTop: 6, lineHeight: 1.5 }}>{desc}</div> : null}
      <div style={{ marginTop: 14 }}>{children}</div>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 13, fontWeight: 900, marginBottom: 8 }}>{children}</div>;
}

function RowToggle({
  checked,
  onChange,
  title,
  desc,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  desc: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        padding: 12,
        borderRadius: 14,
        border: "1px solid var(--line-soft)",
        background: "rgba(0,0,0,0.10)",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 18, height: 18, marginTop: 2 }}
      />
      <div>
        <div style={{ fontWeight: 900 }}>{title}</div>
        <div style={{ color: "var(--text-muted)", marginTop: 4, lineHeight: 1.5 }}>{desc}</div>
      </div>
    </div>
  );
}

export default function SettingsPage() {

  
  
  async function manualSync() {
    setMsg("Syncing…");
    try {
      const res = await fetch("/api/sync-now", { method: "POST" });

      const text = await res.text();
      let j = null;
      try { j = JSON.parse(text); } catch {}

      if (!res.ok) {
        setMsg(`Sync failed (${res.status}): ${(j && j.error) ? j.error : text}`);
        return;
      }
      setMsg((j && j.note) ? j.note : "Sync done.");
    } catch (e) {
      setMsg(`Sync failed: ${e?.message || e}`);
      console.error("Sync failed", e);
    }
  }

