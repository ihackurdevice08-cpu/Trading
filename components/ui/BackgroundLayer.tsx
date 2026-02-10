"use client";

import React from "react";
import { useAppearance } from "../providers/AppearanceProvider";

export default function BackgroundLayer() {
  const { appearance } = useAppearance();
  const { bgType, bgUrl, bgFit, bgOpacity, bgBlurPx, bgDim } = appearance;

  if (bgType === "none" || !bgUrl) return null;

  const commonStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 0,
    pointerEvents: "none",
    opacity: bgOpacity,
    filter: `blur(${bgBlurPx}px)`,
  };

  return (
    <>
      {bgType === "image" ? (
        <div
          style={{
            ...commonStyle,
            backgroundImage: `url("${bgUrl}")`,
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
            backgroundSize: bgFit,
          }}
        />
      ) : (
        <video
          style={{ ...commonStyle, width: "100%", height: "100%", objectFit: bgFit }}
          src={bgUrl}
          autoPlay
          muted
          loop
          playsInline
        />
      )}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1,
          pointerEvents: "none",
          background: `rgba(0,0,0, ${bgDim})`,
        }}
      />
    </>
  );
}
