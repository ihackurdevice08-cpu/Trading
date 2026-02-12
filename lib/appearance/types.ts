export type ThemeId = "linen" | "resort" | "cafe" | "noir" | "royal";
export type NavLayout = "top" | "side";

export type BackgroundFit = "cover" | "contain";
export type BackgroundType = "none" | "image" | "video";

export type AppearanceSettings = {
  themeId: ThemeId;
  navLayout: NavLayout;

  // Dashboard toggles (optional)
  showRow1Status?: boolean;
  showRow2AssetPerf?: boolean;
  showRow3Behavior?: boolean;
  showRow4Overtrade?: boolean;
  showRow5Goals?: boolean;

  dashboardRowOrder?: (
    | "row1"
    | "row2"
    | "row3"
    | "row4"
    | "row5"
  )[];

  // Overtrade options (optional)
  overtradeWindowMin?: number;
  overtradeMaxTrades?: number;
  overtradeCountBasis?: "close" | "fills";

  // Background (account-bound)
  bg?: {
    enabled?: boolean;
    type?: BackgroundType;       // image|video|none
    url?: string | null;         // public url
    fit?: BackgroundFit;         // cover|contain
    opacity?: number;            // 0~1
    dim?: number;                // 0~1
    blurPx?: number;             // px
  };
};
