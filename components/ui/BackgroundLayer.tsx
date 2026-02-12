"use client";

import React from "react";
import { useAppearance } from "@/components/providers/AppearanceProvider";

export default function BackgroundLayer() {
  const { appearance } = useAppearance();
  const bg = appearance.bg || {};

  if (!bg.enabled) return null;
  if (!bg.url) return null;
  if (!bg.type || bg.type === "none") return null;

  const fit = bg.fit || "cover";
  const opacity = typeof bg.opacity === "number" ? bg.opacity : 0.22;
  const dim = typeof bg.dim === "number" ? bg.dim : 0.45;
  const blurPx = typeof bg.blurPx === "number" ? bg.blurPx : 10;

  const common: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 0,
    pointerEvents: "none",
    opacity,
    filter: blurPx ? `blur(${blurPx}px)` : undefined,
    transform: "scale(1.02)",
  };

  return (
    <>
      {bg.type === "image" ? (
        <div
          style={{
            ...common,
            backgroundImage: `url(${bg.url})`,
            backgroundSize: fit,
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        />
      ) : (
        <video
          autoPlay
          muted
          loop
          playsInline
          style={{ ...common, width: "100%", height: "100%", objectFit: fit }}
          src={bg.url}
        />
      )}

      {/* dim overlay */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1,
          pointerEvents: "none",
          background: `rgba(0,0,0,${dim})`,
        }}
      />
    </>
  );
}
