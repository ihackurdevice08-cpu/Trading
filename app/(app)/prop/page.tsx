"use client";

import useSWR from "swr";

const fetcher = (url: string) => fetch(url, { cache: "no-store" }).then(res => res.json());
const n = (value: unknown) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const fmt = (value: unknown, digits = 2) => n(value).toLocaleString("ko-KR", { maximumFractionDigits: digits });
const signed = (value: unknown) => `${n(value) > 0 ? "+" : ""}${fmt(value)}`;
const pnlColor = (value: unknown) => n(value) > 0 ? "var(--green,#00C076)" : n(value) < 0 ? "var(--red,#FF4D4D)" : "inherit";

export default function PropPage() {
  const { data, error, mutate } = useSWR("/api/prop-dashboard", fetcher, {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  });

  if (error) {
    return <div style={notice("rgba(255,77,77,.08)", "rgba(255,77,77,.22)")}>프랍 데이터를 불러오지 못했습니다.</div>;
  }

  if (!data?.ok) {
    return (
      <div style={{ maxWidth: 1120 }}>
        <Header onRefresh={() => mutate()} updatedAt={null} />
        <div style={notice("var(--panel,rgba(255,255,255,.04))", "var(--line-soft,rgba(255,255,255,.08))")}>
          아직 Firestore에 프랍 거래 데이터가 없습니다. Oracle VPS 봇에서 `prop_snapshots`, `prop_trades`, `prop_summary` 업로드를 붙이면 이 화면이 채워집니다.
        </div>
      </div>
    );
  }

  const stats = data.stats ?? {};
  const account = data.account ?? {};
  const recentTrades = data.recentTrades ?? [];
  const bySymbol = data.bySymbol ?? [];
  const ddSeries = data.ddSeries ?? [];

  return (
    <div style={{ maxWidth: 1120 }}>
      <Header onRefresh={() => mutate()} updatedAt={account.updatedAt} />

      <div style={topBar}>
        <div>
          <div style={eyebrow}>계좌</div>
          <div style={{ fontSize: 18, fontWeight: 900 }}>{account.accountLabel ?? "ForTraders FAST PRO"}</div>
        </div>
        <div style={phaseChip}>{account.phase ?? "challenge"}</div>
      </div>

      <section style={grid4}>
        <Metric label="현재 수익" value={`${signed(stats.currentProfit)} USD`} sub={`타겟 ${fmt(stats.profitTarget)} · 남은 ${fmt(stats.profitToTarget)}`} tone={pnlColor(stats.currentProfit)} />
        <Metric label="남은 DD 여유" value={`${fmt(stats.maxDdBuffer)} USD`} sub={`라인 ${fmt(stats.maxDdLine)}`} tone={n(stats.maxDdBuffer) <= 1500 ? "var(--red,#FF4D4D)" : "var(--accent,#F0B429)"} />
        <Metric label="전체 포지션 규모" value={`${fmt(stats.totalExposure)} USD`} sub={`오픈 ${fmt(stats.openPositionsCount, 0)}개`} tone={n(stats.totalExposure) > 40000 ? "var(--red,#FF4D4D)" : "inherit"} />
        <Metric label="수익 인정일" value={`${fmt(stats.profitableDayCount, 0)} / ${fmt(stats.profitableDayTarget, 0)}`} sub={`Best Day ${fmt(stats.bestDayProfit)}`} />
      </section>

      <section style={grid4}>
        <Metric label="종료 거래" value={`${fmt(stats.realizedTradeCount, 0)}건`} sub={`승률 ${stats.winRate == null ? "—" : `${fmt(stats.winRate, 1)}%`}`} />
        <Metric label="누적 순손익" value={`${signed(stats.totalNetPnl)} USD`} sub={`수수료 ${fmt(stats.totalFees)}`} tone={pnlColor(stats.totalNetPnl)} />
        <Metric label="최고 거래" value={`${signed(stats.bestTrade)} USD`} sub="닫힌 포지션 기준" tone={pnlColor(stats.bestTrade)} />
        <Metric label="최악 거래" value={`${signed(stats.worstTrade)} USD`} sub="닫힌 포지션 기준" tone={pnlColor(stats.worstTrade)} />
      </section>

      <section style={twoCol}>
        <Panel title="DD Buffer 추이">
          {ddSeries.length ? <BufferChart rows={ddSeries.slice(-80)} /> : <Empty text="스냅샷 데이터가 아직 없습니다." />}
        </Panel>
        <Panel title="심볼별 순손익">
          {bySymbol.length ? (
            <div style={{ display: "grid", gap: 8 }}>
              {bySymbol.slice(0, 8).map((row: any) => (
                <div key={row.symbol} style={symbolRow}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{row.symbol}</div>
                    <div style={subtle}>{row.trades}건 · 승 {row.wins} / 패 {row.losses}</div>
                  </div>
                  <div style={{ fontWeight: 900, color: pnlColor(row.netPnl) }}>{signed(row.netPnl)}</div>
                </div>
              ))}
            </div>
          ) : <Empty text="종료 거래가 아직 없습니다." />}
        </Panel>
      </section>

      <Panel title="최근 종료 거래">
        {recentTrades.length ? (
          <div style={{ overflowX: "auto" }}>
            <table style={table}>
              <thead>
                <tr>
                  {["시간", "종목", "방향", "수량", "진입", "청산", "실현손익", "수수료", "순손익"].map(head => (
                    <th key={head} style={th}>{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentTrades.map((trade: any) => (
                  <tr key={`${trade.id}-${trade.closedAt}`}>
                    <td style={td}>{trade.closedAt ? new Date(trade.closedAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                    <td style={tdStrong}>{trade.symbol || "—"}</td>
                    <td style={td}>{trade.side || "—"}</td>
                    <td style={tdNum}>{fmt(trade.lots, 4)}</td>
                    <td style={tdNum}>{fmt(trade.entry, 4)}</td>
                    <td style={tdNum}>{fmt(trade.exit, 4)}</td>
                    <td style={{ ...tdNum, color: pnlColor(trade.realizedPnl) }}>{signed(trade.realizedPnl)}</td>
                    <td style={tdNum}>{fmt(trade.commission)}</td>
                    <td style={{ ...tdNum, color: pnlColor(trade.netPnl), fontWeight: 900 }}>{signed(trade.netPnl)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty text="종료 거래가 기록되면 여기에 표시됩니다." />}
      </Panel>
    </div>
  );
}

function Header({ onRefresh, updatedAt }: { onRefresh: () => void; updatedAt: string | null }) {
  return (
    <div style={header}>
      <div>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>프랍 거래</h1>
        <div style={subtle}>ForTraders Risk Watchdog 전용 대시보드</div>
      </div>
      <button onClick={onRefresh} style={button}>갱신</button>
      {updatedAt && <div style={subtle}>{new Date(updatedAt).toLocaleString("ko-KR")} 기준</div>}
    </div>
  );
}

function Metric({ label, value, sub, tone = "inherit" }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div style={card}>
      <div style={eyebrow}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 950, color: tone, marginTop: 6 }}>{value}</div>
      {sub && <div style={{ ...subtle, marginTop: 8 }}>{sub}</div>}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={panel}>
      <div style={panelTitle}>{title}</div>
      {children}
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ ...subtle, padding: "16px 0" }}>{text}</div>;
}

function BufferChart({ rows }: { rows: any[] }) {
  const max = Math.max(...rows.map(row => Math.max(0, n(row.maxDdBuffer))), 1);
  return (
    <div style={{ height: 170, display: "flex", alignItems: "end", gap: 3, paddingTop: 8 }}>
      {rows.map((row, index) => {
        const value = Math.max(0, n(row.maxDdBuffer));
        const h = Math.max(4, (value / max) * 150);
        const danger = value <= 1500;
        return (
          <div
            key={`${row.timestamp}-${index}`}
            title={`${row.timestamp} · ${fmt(value)} USD`}
            style={{
              flex: 1,
              minWidth: 3,
              height: h,
              borderRadius: 3,
              background: danger ? "var(--red,#FF4D4D)" : "var(--accent,#F0B429)",
              opacity: 0.35 + (value / max) * 0.65,
            }}
          />
        );
      })}
    </div>
  );
}

function notice(background: string, border: string): React.CSSProperties {
  return {
    padding: "14px 16px",
    borderRadius: 12,
    border: `1px solid ${border}`,
    background,
    fontSize: 13,
  };
}

const header: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 14,
};
const topBar: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  marginBottom: 12,
  padding: "14px 16px",
  borderRadius: 12,
  border: "1px solid var(--line-soft,rgba(255,255,255,.08))",
  background: "var(--panel,rgba(255,255,255,.04))",
};
const grid4: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
  gap: 10,
  marginBottom: 10,
};
const twoCol: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
  gap: 10,
  marginBottom: 10,
};
const card: React.CSSProperties = {
  padding: "14px 16px",
  borderRadius: 12,
  border: "1px solid var(--line-soft,rgba(255,255,255,.08))",
  background: "var(--panel,rgba(255,255,255,.04))",
};
const panel: React.CSSProperties = {
  padding: "16px 18px",
  borderRadius: 12,
  border: "1px solid var(--line-soft,rgba(255,255,255,.08))",
  background: "var(--panel,rgba(255,255,255,.04))",
  marginBottom: 10,
};
const panelTitle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  opacity: 0.62,
  marginBottom: 12,
};
const eyebrow: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  opacity: 0.48,
  letterSpacing: 0.8,
  textTransform: "uppercase",
};
const subtle: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.55,
};
const phaseChip: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid color-mix(in srgb,var(--accent,#F0B429) 35%,transparent)",
  background: "color-mix(in srgb,var(--accent,#F0B429) 12%,transparent)",
  color: "var(--accent,#F0B429)",
  fontSize: 12,
  fontWeight: 900,
};
const button: React.CSSProperties = {
  padding: "7px 12px",
  borderRadius: 8,
  cursor: "pointer",
  border: "1px solid var(--line-soft,rgba(255,255,255,.12))",
  background: "transparent",
  color: "inherit",
  fontWeight: 800,
};
const symbolRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "9px 10px",
  borderRadius: 9,
  border: "1px solid var(--line-soft,rgba(255,255,255,.08))",
};
const table: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: 820,
  fontSize: 12,
};
const th: React.CSSProperties = {
  textAlign: "left",
  padding: "9px 8px",
  borderBottom: "1px solid var(--line-soft,rgba(255,255,255,.1))",
  opacity: 0.5,
};
const td: React.CSSProperties = {
  padding: "9px 8px",
  borderBottom: "1px solid var(--line-soft,rgba(255,255,255,.06))",
  whiteSpace: "nowrap",
};
const tdStrong: React.CSSProperties = {
  ...td,
  fontWeight: 900,
};
const tdNum: React.CSSProperties = {
  ...td,
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};
