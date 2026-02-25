"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "../../components/layout/AppLayout";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { AppearanceProvider } from "@/components/providers/AppearanceProvider";

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sb = supabaseBrowser();

    const check = async () => {
      // getSession 대신 getUser 사용 (서버에서 토큰 검증, 더 신뢰성 높음)
      const { data, error } = await sb.auth.getUser();
      if (error || !data.user) {
        router.replace("/login");
        return;
      }
      setReady(true);
    };

    check().catch(() => router.replace("/login"));

    const { data: sub } = sb.auth.onAuthStateChange((_evt, session) => {
      if (!session) router.replace("/login");
    });

    return () => sub.subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg, #F4F0E6)",
        fontSize: 15,
        opacity: 0.7,
      }}>
        Loading...
      </div>
    );
  }

  return (
    <AppearanceProvider>
      <AppLayout>{children}</AppLayout>
    </AppearanceProvider>
  );
}
