"use client";

import React from "react";
import { PlasmicAppShell } from "./plasmic/man_cave/PlasmicAppShell";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const C: any = PlasmicAppShell;
  // slot 이름이 children이든 content든 둘 중 하나는 먹게 "둘 다" 넣어둠
  return <C children={children} content={children} />;
}
