// 실제 themes.ts의 THEMES 키와 일치해야 함
export type ThemeId = "linen" | "resort" | "noir" | "vault" | "dune";
export type NavLayout = "top" | "side";
export type BackgroundFit = "cover" | "contain";
export type BackgroundType = "none" | "image" | "video";

export type AppearanceSettings = {
  themeId: ThemeId;
  navLayout: NavLayout;

  // Dashboard row toggles
  showRow1Status?: boolean;
  showRow2AssetPerf?: boolean;
  showRow3Behavior?: boolean;
  showRow4Overtrade?: boolean;
  showRow5Goals?: boolean;

  // Overtrade settings
  overtradeWindowMin?: number;
  overtradeMaxTrades?: number;
  overtradeCountBasis?: "close" | "open";

  // Trading safety rules
  manualTradingState?: "auto" | "Great" | "Good" | "Slow Down" | "Stop";
  slowDownAfterWins?: number;
  stopAfterLosses?: number;
  maxRiskPct?: number;
  avgLossDangerPct?: number;

  // Risk widget visibility per tab (둘 다 false 불가)
  riskWidget?: { dashboard: boolean; trades: boolean };

  // Background
  bg?: {
    enabled?: boolean;
    type?: BackgroundType;   // "image" | "video" | "none"
    url?: string | null;
    fit?: BackgroundFit;
    opacity?: number;        // 0~1
    dim?: number;            // 0~1
    blurPx?: number;
  };
};
