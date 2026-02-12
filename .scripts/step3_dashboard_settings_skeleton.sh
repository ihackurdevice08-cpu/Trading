#!/usr/bin/env bash
set -euo pipefail

echo "==> 1) lib/appearance/types.ts 업데이트 (Rule 필드 추가 + 디폴트 Row ON)"
cat > "lib/appearance/types.ts" <<'TS'
import type { ThemeId } from "./themes";

export type NavLayout = "top" | "side";
export type BgType = "none" | "image" | "video";
export type BgFit = "cover" | "contain";

export type OvertradeCountBasis = "close" | "open"; // default close
export type RefreshPlacement = "global" | "dashboard"; // default global

export type TradingState = "Great" | "Good" | "Slow Down" | "Stop";
export type ManualTradingState = "auto" | TradingState;

export type AppearanceSettings = {
  themeId: ThemeId;
  navLayout: NavLayout;

  bgType: BgType;
  bgUrl: string;
  bgFit: BgFit;
  bgOpacity: number;
  bgBlurPx: number;
  bgDim: number;

  // Dashboard rows
  showRow1Status: boolean;
  showRow2AssetPerf: boolean;
  showRow3Behavior: boolean;
  showRow4Overtrade: boolean;

  // Rules (계정 귀속 / cloud synced)
  overtradeCountBasis: OvertradeCountBasis; // close/open
  overtradeWindowMin: number;              // default 60
  overtradeMaxTrades: number;              // default 2 (초과분 카운팅)

  slowDownAfterWins: number;               // default 4
  stopAfterLosses: number;                 // default 3
  manualTradingState: ManualTradingState;  // auto | Great | Good | Slow Down | Stop

  maxRiskPct: number;                      // default 1.0 (placeholder)
  avgLossDangerPct: number;                // default 2.0 (placeholder)

  // Header
  refreshPlacement: RefreshPlacement; // global/dashboard
};

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  themeId: 1,
  navLayout: "top",

  bgType: "none",
  bgUrl: "",
  bgFit: "cover",
  bgOpacity: 0.22,
  bgBlurPx: 10,
  bgDim: 0.45,

  // ✅ 지금 단계 Row 뼈대 확인용: 기본 ON
  showRow1Status: true,
  showRow2AssetPerf: true,
  showRow3Behavior: true,
  showRow4Overtrade: true,

  overtradeCountBasis: "close",
  overtradeWindowMin: 60,
  overtradeMaxTrades: 2,

  slowDownAfterWins: 4,
  stopAfterLosses: 3,
  manualTradingState: "auto",

  maxRiskPct: 1.0,
  avgLossDangerPct: 2.0,

  refreshPlacement: "global",
};
TS

echo "==> 2) Dashboard Row1/2/3 텍스트 구조 적용"
cat > "app/(app)/dashboard/page.tsx" <<'TSX'
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
TSX

echo "==> 3) Settings page에 'Trading State & Safety Rules' 카드 삽입"
node <<'NODE'
const fs = require("fs");

const file = "app/(app)/settings/page.tsx";
let s = fs.readFileSync(file, "utf8");

// 이미 삽입되었으면 중복 방지
if (s.includes('title="Trading State & Safety Rules"')) {
  console.log("SKIP: Rules card already exists");
  process.exit(0);
}

const anchor = '<Card title="Dashboard Rows"';
const idx = s.indexOf(anchor);
if (idx === -1) {
  throw new Error("Anchor not found. SettingsPage 구조가 예상과 다릅니다.");
}

const insert = `
      <Card
        title="Trading State & Safety Rules"
        desc="모든 값은 로그인한 계정에 저장됩니다. 다른 기기에서 로그인해도 동일하게 유지됩니다."
      >
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <Label>Manual Trading State</Label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {["auto","Great","Good","Slow Down","Stop"].map((x) => (
                <button
                  key={x}
                  type="button"
                  onClick={() => patchAppearance({ manualTradingState: x } as any)}
                  style={{
                    padding: "10px 12px",
                    borderRadius: 12,
                    border: "1px solid var(--line-soft)",
                    background: (appearance as any).manualTradingState === x ? "rgba(210,194,165,0.14)" : "transparent",
                    color: "var(--text-primary)",
                    fontWeight: 900,
                    cursor: "pointer",
                  }}
                >
                  {x}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 8, color: "var(--text-muted)", fontSize: 12, lineHeight: 1.5 }}>
              auto는 향후 API/거래 데이터 기반 자동판단으로 전환됩니다.
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
            <div>
              <Label>Slow Down after consecutive wins</Label>
              <input
                value={String((appearance as any).slowDownAfterWins ?? 4)}
                onChange={(e) => patchAppearance({ slowDownAfterWins: Number(e.target.value || 0) } as any)}
                placeholder="4"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--line-soft)",
                  background: "rgba(0,0,0,0.08)",
                  color: "var(--text-primary)",
                }}
              />
              <div style={{ marginTop: 6, color: "var(--text-muted)", fontSize: 12 }}>연승 과열 시 속도 조절 기준</div>
            </div>

            <div>
              <Label>Stop after consecutive losses</Label>
              <input
                value={String((appearance as any).stopAfterLosses ?? 3)}
                onChange={(e) => patchAppearance({ stopAfterLosses: Number(e.target.value || 0) } as any)}
                placeholder="3"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--line-soft)",
                  background: "rgba(0,0,0,0.08)",
                  color: "var(--text-primary)",
                }}
              />
              <div style={{ marginTop: 6, color: "var(--text-muted)", fontSize: 12 }}>연패 시 즉시 중단 기준</div>
            </div>

            <div>
              <Label>Overtrade window (minutes)</Label>
              <input
                value={String((appearance as any).overtradeWindowMin ?? 60)}
                onChange={(e) => patchAppearance({ overtradeWindowMin: Number(e.target.value || 0) } as any)}
                placeholder="60"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--line-soft)",
                  background: "rgba(0,0,0,0.08)",
                  color: "var(--text-primary)",
                }}
              />
              <div style={{ marginTop: 6, color: "var(--text-muted)", fontSize: 12 }}>기본 60분 (1시간)</div>
            </div>

            <div>
              <Label>Allowed trades in window</Label>
              <input
                value={String((appearance as any).overtradeMaxTrades ?? 2)}
                onChange={(e) => patchAppearance({ overtradeMaxTrades: Number(e.target.value || 0) } as any)}
                placeholder="2"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--line-soft)",
                  background: "rgba(0,0,0,0.08)",
                  color: "var(--text-primary)",
                }}
              />
              <div style={{ marginTop: 6, color: "var(--text-muted)", fontSize: 12 }}>2회 초과분부터 카운팅</div>
            </div>

            <div>
              <Label>Max risk % (placeholder)</Label>
              <input
                value={String((appearance as any).maxRiskPct ?? 1)}
                onChange={(e) => patchAppearance({ maxRiskPct: Number(e.target.value || 0) } as any)}
                placeholder="1.0"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--line-soft)",
                  background: "rgba(0,0,0,0.08)",
                  color: "var(--text-primary)",
                }}
              />
              <div style={{ marginTop: 6, color: "var(--text-muted)", fontSize: 12 }}>현재는 UI/구조만. 계산은 API 연결 후</div>
            </div>

            <div>
              <Label>Avg loss danger % (placeholder)</Label>
              <input
                value={String((appearance as any).avgLossDangerPct ?? 2)}
                onChange={(e) => patchAppearance({ avgLossDangerPct: Number(e.target.value || 0) } as any)}
                placeholder="2.0"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid var(--line-soft)",
                  background: "rgba(0,0,0,0.08)",
                  color: "var(--text-primary)",
                }}
              />
              <div style={{ marginTop: 6, color: "var(--text-muted)", fontSize: 12 }}>현재는 UI/구조만. 계산은 API 연결 후</div>
            </div>
          </div>

          <div style={{ color: "var(--text-muted)", fontSize: 12, lineHeight: 1.5 }}>
            Save를 누르면 계정에 저장됩니다. 새로고침/다른 기기에서도 동일하게 적용됩니다.
          </div>
        </div>
      </Card>

`;
s = s.slice(0, idx) + insert + s.slice(idx);
fs.writeFileSync(file, s, "utf8");
console.log("OK: inserted Trading State & Safety Rules card");
NODE

echo "==> 4) 빌드/커밋/푸시/배포"
npm run build
git add "lib/appearance/types.ts" "app/(app)/dashboard/page.tsx" "app/(app)/settings/page.tsx"
git commit -m "feat: dashboard row1/2/3 skeleton + cloud-synced trading rules in settings" || true
git push
vercel --prod

echo "DONE"
