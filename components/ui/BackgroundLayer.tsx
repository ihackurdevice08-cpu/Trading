"use client";

import { useAppearance } from "@/components/providers/AppearanceProvider";

export default function BackgroundLayer() {
  const { appearance } = useAppearance();

  // 타입 충돌 회피: bg는 런타임 필드가 더 많을 수 있음(opacity/dim/blurPx/type 등)
  const bg: any = (appearance as any)?.bg || {};

  if (!bg.enabled) return null;
  if (!bg.url) return null;
  if (!bg.type || bg.type === "none") return null;

  const fit = bg.fit || "cover";
  const opacity = typeof bg.opacity === "number" ? bg.opacity : 0.22;
  const dim = typeof bg.dim === "number" ? bg.dim : 0.45;
  const blurPx = typeof bg.blurPx === "number" ? bg.blurPx : 10;

  const isVideo = bg.type === "video";
  const src = String(bg.url || "");

  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "var(--bg)",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity,
          filter: blurPx ? `blur(${blurPx}px)` : undefined,
          transform: blurPx ? "scale(1.04)" : undefined,
        }}
      >
        {isVideo ? (
          <video
            src={src}
            autoPlay
            muted
            loop
            playsInline
            style={{
              width: "100%",
              height: "100%",
              objectFit: fit,
            }}
          />
        ) : (
          <img
            src={src}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: fit,
            }}
          />
        )}
      </div>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `rgba(0,0,0,${dim})`,
        }}
      />
    </div>
  );
}
