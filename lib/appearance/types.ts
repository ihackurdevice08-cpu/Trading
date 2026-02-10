export type NavLayout = "top" | "side";
export type BgType = "none" | "image" | "video";
export type BgFit = "cover" | "contain";

export type AppearanceSettings = {
  themeId: "linen" | "resort" | "noir" | "vault" | "dune";
  navLayout: NavLayout;

  // global background media (account-bound)
  bgType: BgType;
  bgUrl: string;          // public URL (Supabase storage publicUrl or pasted URL)
  bgFit: BgFit;
  bgOpacity: number;      // 0..1
  bgBlurPx: number;       // 0..24
  bgDim: number;          // 0..0.9

  // for future: ticker toggles etc.
};

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  themeId: "linen",
  navLayout: "top",

  bgType: "none",
  bgUrl: "",
  bgFit: "cover",
  bgOpacity: 0.22,
  bgBlurPx: 0,
  bgDim: 0.45,
};
