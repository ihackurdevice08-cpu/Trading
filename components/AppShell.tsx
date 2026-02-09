"use client";

import React from "react";
import PlasmicAppShell from "./plasmic/man_cave/PlasmicAppShell";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return <PlasmicAppShell children={children} />;
}
