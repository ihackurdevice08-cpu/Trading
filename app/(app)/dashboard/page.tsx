"use client";

import { useAppearance } from "../../../components/providers/AppearanceProvider";

function Card({ title, children }: any) {
  return (
    <div style={{ padding: 14, border: "1px solid var(--line-soft)", borderRadius: 14, background: "rgba(34,32,28,0.55)" }}>
      <div style={{ fontWeight: 900, marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  );
}

export default function DashboardPage() {
  const { appearance } = useAppearance();

  return (
    <div style={{ display: "grid", gap: 14 }}>
      {appearance.showRow1Status ? (
        <Card title="Row 1 — Status Strip">
          <div style={{ color: "var(--text-muted)" }}>
            (여기에 GREAT/GOOD/SLOW/STOP + 요약 KPI가 들어감)
          </div>
        </Card>
      ) : null}

      {appearance.showRow2AssetPerf ? (
        <Card title="Row 2 — Asset & Performance">
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12 }}>
            <div style={{ padding: 12, borderRadius: 12, border: "1px solid var(--line-soft)", background: "rgba(0,0,0,0.12)" }}>
              <div style={{ fontWeight: 800 }}>Asset Graph</div>
              <div style={{ color: "var(--text-muted)", marginTop: 6 }}>Equity curve placeholder</div>
            </div>
            <div style={{ padding: 12, borderRadius: 12, border: "1px solid var(--line-soft)", background: "rgba(0,0,0,0.12)" }}>
              <div style={{ fontWeight: 800 }}>Performance Box</div>
              <div style={{ color: "var(--text-muted)", marginTop: 6 }}>PF / NetPnL / AvgWin/Loss / MaxWin/Loss</div>
            </div>
          </div>
        </Card>
      ) : null}

      {appearance.showRow3Behavior ? (
        <Card title="Row 3 — Behavior">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ padding: 12, borderRadius: 12, border: "1px solid var(--line-soft)", background: "rgba(0,0,0,0.12)" }}>
              <div style={{ fontWeight: 800 }}>Speed</div>
              <div style={{ color: "var(--text-muted)", marginTop: 6 }}>Avg Hold Time / Avg Time To Open</div>
            </div>
            <div style={{ padding: 12, borderRadius: 12, border: "1px solid var(--line-soft)", background: "rgba(0,0,0,0.12)" }}>
              <div style={{ fontWeight: 800 }}>Discipline</div>
              <div style={{ color: "var(--text-muted)", marginTop: 6 }}>Avg Trades/Day / Streaks</div>
            </div>
          </div>
        </Card>
      ) : null}

      {appearance.showRow4Overtrade ? (
        <Card title="Row 4 — Overtrade Monitor">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div style={{ padding: 12, borderRadius: 12, border: "1px solid var(--line-soft)", background: "rgba(0,0,0,0.12)" }}>
              <div style={{ fontWeight: 800 }}>Trades last 1h</div>
              <div style={{ color: "var(--text-muted)", marginTop: 6 }}>placeholder</div>
            </div>
            <div style={{ padding: 12, borderRadius: 12, border: "1px solid var(--line-soft)", background: "rgba(0,0,0,0.12)" }}>
              <div style={{ fontWeight: 800 }}>Overtrade Count</div>
              <div style={{ color: "var(--text-muted)", marginTop: 6 }}>max(0, n - 2)</div>
            </div>
            <div style={{ padding: 12, borderRadius: 12, border: "1px solid var(--line-soft)", background: "rgba(0,0,0,0.12)" }}>
              <div style={{ fontWeight: 800 }}>Last Overtrade Time</div>
              <div style={{ color: "var(--text-muted)", marginTop: 6 }}>placeholder</div>
            </div>
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
