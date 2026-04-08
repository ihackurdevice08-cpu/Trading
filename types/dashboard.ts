// ── 대시보드 데이터 타입 ─────────────────────────────────────

export interface DashboardStats {
  todayPnL:         number;
  weekPnL:          number;
  monthPnL:         number;
  totalTrades:      number;
  realizedTrades:   number;
  wins:             number;
  losses:           number;
  winRate:          number | null;
  cumPnl:           number;
  pnlFrom:          string | null;
  seed:             number;
  equityNow:        number;
  totalWithdrawal:  number;
  profitWithdrawal: number;
  seedWithdrawal:   number;
  retainedProfit:   number;
  currentDD:        number;
  maxDD:            number;
  recoveryNeeded:   number;
  longCount:        number;
  shortCount:       number;
  maxConsecWin:     number;
  maxConsecLoss:    number;
  avgDurationMin:   number | null;
  cycleWin:         number;
  cycleLoss:        number;
  cycleCount:       number;
  cycleWinRate:     number | null;
}

export interface DailyPnlPoint {
  date:   string;
  pnl:    number;
}

export interface DdSeriesPoint {
  date:   string;
  dd:     number;
  cumPnl: number;
}

export interface HeatmapCell {
  dow:     number;
  hour:    number;
  winRate: number | null;
  total:   number;
  pnl:     number;
}

export interface MonthlyPnlPoint {
  month: string;
  pnl:   number;
}

export interface TradeRecord {
  id:        string;
  symbol:    string;
  side:      "long" | "short";
  opened_at: string;
  pnl:       number | null;
  tags:      string[];
}

export interface SymbolStat {
  symbol:  string;
  pnl:     number;
  count:   number;
  wins:    number;
  losses:  number;
  winRate: number;
  avgWin:  number | null;
  avgLoss: number | null;
}

export interface Goal {
  id:        string;
  title:     string;
  type:      string;
  target:    number | null;
  current:   number;
  completed: boolean;
  deadline:  string | null;
  created_at: string;
}

export interface DashboardResponse {
  ok:          boolean;
  stats:       DashboardStats;
  recent:      TradeRecord[];
  topSymbols:  SymbolStat[];
  dailyPnl:    DailyPnlPoint[];
  ddSeries:    DdSeriesPoint[];
  heatmapData: HeatmapCell[];
  monthlyPnl:  MonthlyPnlPoint[];
}
