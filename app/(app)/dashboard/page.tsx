"use client";

import { useMemo, useState } from "react";
import { useAppearance } from "../../../components/providers/AppearanceProvider";

function Card({ title, children }: any) {
  return (
    <div style={{ padding: 14, border: "1px solid var(--line-soft)", borderRadius: 14, background: "rgba(34,32,28,0.55)" }}>
      <div style={{ fontWeight: 900, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

function MiniToggle({ items, value, onChange }: { items: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {items.map((x) => (
        <button
          key={x}
          type="button"
          onClick={() => onChange(x)}
          style={{
            padding: "8px 10px",
            borderRadius: 12,
            border: "1px solid var(--line-soft)",
            background: value === x ? "rgba(210,194,165,0.14)" : "transparent",
            color: "var(--text-primary)",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          {x}
        </button>
      ))}
    </div>
  );
}

function StatCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <div style={{ padding: 12, borderRadius: 12, border: "1px solid var(--line-soft)", background: "rgba(0,0,0,0.12)" }}>
      <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: 0.2, color: "var(--text-muted)" }}>{title}</div>
      <div style={{ fontSize: 22, fontWeight: 900, marginTop: 6 }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>{subtitle}</div>
    </div>
  );
}

export default function DashboardPage() {
  const { appearance } = useAppearance();

  // period toggle: 3D / 7D / 30D
  const [period, setPeriod] = useState<"3D" | "7D" | "30D">("7D");

  const stateView = useMemo(() => {
    const manual = (appearance as any).manualTradingState;
    if (manual && manual !== "auto") {
      return {
        value: manual,
        source: "manual",
        note: "Manual override enabled.",
      };
    }
    return {
      value: "Good",
      source: "auto",
      note: "Auto state will be available once API is connected.",
    };
  }, [appearance]);

  const basisText = period === "3D" ? "Based on last 3 trading days" : period === "7D" ? "Based on last 7 trading days" : "Based on last 30 days (calendar)";

  return (
    <div style={{ display: "grid", gap: 14, paddingBottom: 96 /* bottom ticker space */ }}>
      {/* Row 1 */}
      {appearance.showRow1Status ? (
        <Card title="Row 1 — Trading State">
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 26, fontWeight: 1000, letterSpacing: 0.3 }}>{stateView.value}</div>
              <div style={{ marginTop: 6, color: "var(--text-muted)", lineHeight: 1.5 }}>{stateView.note}</div>
              <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-muted)" }}>
                {basisText} • source: {stateView.source}
              </div>
            </div>
            <MiniToggle items={["3D", "7D", "30D"]} value={period} onChange={(v) => setPeriod(v as any)} />
          </div>
        </Card>
      ) : null}

      {/* Row 2 */}
      {appearance.showRow2AssetPerf ? (
        <Card title="Row 2 — Performance Metrics">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            <StatCard title="Win Rate" value="-" subtitle={basisText} />
            <StatCard title="Avg R:R" value="-" subtitle={basisText} />
            <StatCard title="Avg Loss (% of equity)" value="-" subtitle={basisText} />
            <StatCard title="Max Loss" value="-" subtitle={basisText} />
            <StatCard title="Consecutive Wins" value="-" subtitle={basisText} />
            <StatCard title="Consecutive Losses" value="-" subtitle={basisText} />
          </div>
        </Card>
      ) : null}

      {/* Row 3 */}
      {appearance.showRow3Behavior ? (
        <Card title="Row 3 — Behavior Metrics">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            <StatCard title="Overtrade Count (last 1h)" value="-" subtitle={`Window ${(appearance as any).overtradeWindowMin}m, allowed ${(appearance as any).overtradeMaxTrades}`} />
            <StatCard title="Avg Time Between Trades" value="-" subtitle={basisText} />
            <StatCard title="Avg Hold Time" value="-" subtitle={basisText} />
            <StatCard title="Session Trade Count" value="-" subtitle={basisText} />
          </div>
        </Card>
      ) : null}

      {/* Row 4 */}
      {appearance.showRow4Overtrade ? (
        <Card title="Row 4 — Overtrade Monitor">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
            <StatCard title="Trades last 1h" value="-" subtitle="placeholder" />
            <StatCard title="Overtrade Count" value="-" subtitle={`max(0, n - ${(appearance as any).overtradeMaxTrades})`} />
            <StatCard title="Last Overtrade Time" value="-" subtitle="placeholder" />
          </div>
        </Card>
      ) : null}

      {!appearance.showRow1Status && !appearance.showRow2AssetPerf && !appearance.showRow3Behavior && !appearance.showRow4Overtrade ? (
        <div style={{ color: "var(--text-muted)" }}>
          Dashboard Row가 전부 OFF 상태입니다. Settings에서 켜세요.
        </div>
      ) : null}
    </div>
  );
}
