"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "../../components/layout/AppLayout";
import { AppearanceProvider } from "@/components/providers/AppearanceProvider";
import { firebaseAuth } from "@/lib/firebase/client";
import { onAuthStateChanged } from "firebase/auth";

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const auth = firebaseAuth();

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      // 토큰 갱신 후 쿠키 업데이트 (1시간마다 자동 갱신)
      const token = await user.getIdToken();
      await fetch("/auth/session", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken: token }),
      });
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
