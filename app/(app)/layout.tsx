"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "../../components/layout/AppLayout";
import { AppearanceProvider } from "@/components/providers/AppearanceProvider";
import { firebaseAuth } from "@/lib/firebase/client";
import { onAuthStateChanged, onIdTokenChanged } from "firebase/auth";

export default function Layout({ children }: { children: React.ReactNode }) {
  const router  = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const auth = firebaseAuth();

    // onIdTokenChanged: 토큰이 갱신될 때마다 호출됨 (만료 전 자동 갱신 포함)
    const unsub = onIdTokenChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      try {
        // 항상 최신 토큰 가져와서 쿠키 업데이트
        const token = await user.getIdToken();
        await fetch("/auth/session", {
          method:  "POST",
          headers: { "content-type": "application/json" },
          body:    JSON.stringify({ idToken: token }),
        });
      } catch {
        // 쿠키 갱신 실패해도 앱 동작 유지
      }
      setReady(true);
    });

    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) return null;

  return (
    <AppearanceProvider>
      <AppLayout>{children}</AppLayout>
    </AppearanceProvider>
  );
}
