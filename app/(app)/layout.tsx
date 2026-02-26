"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "../../components/layout/AppLayout";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { AppearanceProvider } from "@/components/providers/AppearanceProvider";

export default function Layout({ children }: { children: React.ReactNode }) {
  const router  = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sb = supabaseBrowser();

    // getSession() — 로컬 캐시에서 즉시 읽어 초기 로딩 빠름
    // 미들웨어에서 이미 서버 토큰 검증하므로 클라이언트는 캐시로 충분
    sb.auth.getSession().then(({ data }) => {
      if (!data.session) { router.replace("/login"); return; }
      setReady(true);
    });

    const { data: sub } = sb.auth.onAuthStateChange((_evt, session) => {
      if (!session) router.replace("/login");
    });

    return () => sub.subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg, #F4F0E6)", fontSize: 15, opacity: 0.5,
    }}>
      불러오는 중…
    </div>
  );

  return (
    <AppearanceProvider>
      <AppLayout>{children}</AppLayout>
    </AppearanceProvider>
  );
}
