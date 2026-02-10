import type { ThemeId } from "./themes";

export type NavLayout = "top" | "side";
export type BgType = "none" | "image" | "video";
export type BgFit = "cover" | "contain";

export type OvertradeCountBasis = "close" | "open"; // default close

export type AppearanceSettings = {
  themeId: ThemeId;
  navLayout: NavLayout;

  bgType: BgType;
  bgUrl: string;
  bgFit: BgFit;
  bgOpacity: number;
  bgBlurPx: number;
  bgDim: number;

  // Dashboard rows (Row 1~4)
  showRow1Status: boolean;
  showRow2AssetPerf: boolean;
  showRow3Behavior: boolean;
  showRow4Overtrade: boolean;

  // Behavior / Rules (settings-driven; must never break)
  overtradeCountBasis: OvertradeCountBasis; // close/open
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

  showRow1Status: false,
  showRow2AssetPerf: false,
  showRow3Behavior: false,
  showRow4Overtrade: true,

  overtradeCountBasis: "close",
};
