"use client";

import React from "react";
import { useAppearance } from "@/components/providers/AppearanceProvider";

export default function BackgroundLayer() {
  const { appearance } = useAppearance();

  const bg = appearance.bg || {
    enabled: false,
    type: "none",
    url: null,
    fit: "cover",
    opacity: 0.22,
    dim: 0.45,
    blurPx: 10,
  };

  if (!bg.enabled) return null;
  if (!bg.url) return null;
  if (!bg.type || bg.type === "none") return null;

  const fit = bg.fit || "cover";
  const opacity = typeof bg.opacity === "number" ? bg.opacity : 0.22;
  const dim = typeof bg.dim === "number" ? bg.dim : 0.45;
  const blurPx = typeof bg.blurPx === "number" ? bg.blurPx : 10;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {bg.type === "video" ? (
        <video
          src={bg.url}
          autoPlay
          muted
          loop
          playsInline
          style={{
            width: "100%",
            height: "100%",
            objectFit: fit as any,
            opacity,
            filter: `blur(${blurPx}px)`,
          }}
        />
      ) : (
        <img
          src={bg.url}
          alt="background"
          style={{
            width: "100%",
            height: "100%",
            objectFit: fit as any,
            opacity,
            filter: `blur(${blurPx}px)`,
          }}
        />
      )}

      {/* dim overlay */}
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
