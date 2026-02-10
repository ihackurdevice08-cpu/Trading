import type { ThemeId } from "./themes";

export type NavLayout = "top" | "side";
export type BgType = "none" | "image" | "video";
export type BgFit = "cover" | "contain";

export type AppearanceSettings = {
  themeId: ThemeId;
  navLayout: NavLayout;

  bgType: BgType;
  bgUrl: string;
  bgFit: BgFit;        // default cover
  bgOpacity: number;   // 0..1
  bgBlurPx: number;    // 0..24
  bgDim: number;       // 0..1
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
};
