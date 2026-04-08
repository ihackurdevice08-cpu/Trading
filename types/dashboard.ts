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

// ── API 공통 타입 ─────────────────────────────────────────────

export interface ApiOk { ok: true }
export interface ApiError { ok: false; error: string }

// risk_settings
export interface RiskSettings {
  seed_usd:        number;
  max_dd_usd:      number | null;
  max_dd_pct:      number | null;
  pnl_from:        string | null;
  daily_loss_limit:number | null;
  updated_at?:     string;
}

// risk_cycles
export interface RiskCycle {
  id:              string;
  started_at:      string;
  note:            string | null;
  equity_snapshot: number | null;
}

// withdrawal
export interface Withdrawal {
  id:           string;
  amount:       number;
  source:       "profit" | "seed" | "rebate";
  note:         string | null;
  withdrawn_at: string;
  sort_order:   number | null;
  created_at:   string;
}

// exchange account
export interface ExchangeAccount {
  id:              string;
  exchange:        "bitget";
  alias:           string;
  api_key_enc:     string;
  api_secret_enc:  string;
  passphrase_enc:  string;
  created_at:      string;
}

// Firestore 문서 공통
export interface FirestoreDoc {
  __id: string;
  [key: string]: unknown;
}

// Bitget fill (raw)
export interface BitgetFill {
  tradeId:   string;
  orderId:   string;
  symbol:    string;
  tradeSide: string;
  side:      string;
  profit:    string;
  fee:       string;
  cTime:     string;
  price:     string;
  baseVolume:string;
  feeDetail: Array<{ totalFee?: string; fee?: string }> | null;
}
