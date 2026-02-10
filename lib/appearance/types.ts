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

  bg?: {
    enabled?: boolean;
    fit?: "cover" | "contain";
    url?: string | null;
  };

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
