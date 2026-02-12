"use client";

import { useState } from "react";
import { useAppearance } from "@/components/providers/AppearanceProvider";

export default function SettingsPage() {
  const { appearance, patchAppearance } = useAppearance();
  const [msg, setMsg] = useState("");

  async function save() {
    setMsg("");

    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ appearance }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setMsg(`Save failed (${response.status})`);
        return;
      }

      setMsg("저장 완료");
    } catch (e) {
      setMsg("Save error");
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <h1>Settings</h1>

      <div style={{ marginTop: 20 }}>
        <h3>Dashboard Rows</h3>

        <label>
          <input
            type="checkbox"
            checked={appearance.showRow1Status}
            onChange={(e) =>
              patchAppearance({ showRow1Status: e.target.checked })
            }
          />
          Row 1 - Status
        </label>
        <br />

        <label>
          <input
            type="checkbox"
            checked={appearance.showRow2AssetPerf}
            onChange={(e) =>
              patchAppearance({ showRow2AssetPerf: e.target.checked })
            }
          />
          Row 2 - Asset & Performance
        </label>
        <br />

        <label>
          <input
            type="checkbox"
            checked={appearance.showRow3Behavior}
            onChange={(e) =>
              patchAppearance({ showRow3Behavior: e.target.checked })
            }
          />
          Row 3 - Behavior
        </label>
        <br />

        <label>
          <input
            type="checkbox"
            checked={appearance.showRow4Overtrade}
            onChange={(e) =>
              patchAppearance({ showRow4Overtrade: e.target.checked })
            }
          />
          Row 4 - Overtrade
        </label>
        <br />

        <label>
          <input
            type="checkbox"
            checked={appearance.showRow5Goals}
            onChange={(e) =>
              patchAppearance({ showRow5Goals: e.target.checked })
            }
          />
          Row 5 - Goals
        </label>
      </div>

      <button
        onClick={save}
        style={{
          marginTop: 24,
          padding: "10px 20px",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        Save
      </button>

      {msg && (
        <div style={{ marginTop: 16, color: "green" }}>
          {msg}
        </div>
      )}
    </div>
  );
}
