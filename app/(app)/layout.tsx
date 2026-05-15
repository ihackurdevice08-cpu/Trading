"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "../../components/layout/AppLayout";
import { AppearanceProvider } from "@/components/providers/AppearanceProvider";
import { Toaster } from "sonner";
import { ensurePersistence } from "@/lib/firebase/client";
import { onIdTokenChanged } from "firebase/auth";

export default function Layout({ children }: { children: React.ReactNode }) {
  const router  = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;
    // 마지막 세션 갱신 시각 (55분 이내면 스킵 — Firebase 토큰 유효기간 1시간)
    const SESSION_TTL = 55 * 60 * 1000;
    let lastSessionUpdate = Number(sessionStorage.getItem("__session_ts") || 0);

    ensurePersistence().then(auth => {
      if (cancelled) return;

      unsub = onIdTokenChanged(auth, async (user) => {
        if (!user) {
          router.replace("/login");
          return;
        }

        const now = Date.now();
        const needsUpdate = now - lastSessionUpdate > SESSION_TTL;

        if (needsUpdate) {
          try {
            const token = await user.getIdToken();
            await fetch("/auth/session", {
              method:  "POST",
              headers: { "content-type": "application/json" },
              body:    JSON.stringify({ idToken: token }),
            });
            lastSessionUpdate = now;
            sessionStorage.setItem("__session_ts", String(now));
          } catch {
            // 쿠키 갱신 실패해도 앱 동작 유지
          }
        }

        setReady(true);
      });
    }).catch(() => router.replace("/login"));

    return () => {
      cancelled = true;
      unsub?.();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) return null;

  return (
    <AppearanceProvider>
      <AppLayout>{children}</AppLayout>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "var(--panel,#1e1e1e)",
            border: "1px solid var(--line-soft,rgba(255,255,255,.1))",
            color: "var(--text-primary,rgba(255,255,255,.9))",
            fontSize: 13,
            borderRadius: 10,
          },
        }}
        richColors
      />
    </AppearanceProvider>
  );
}
