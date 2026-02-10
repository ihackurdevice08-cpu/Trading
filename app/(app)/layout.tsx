"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import AppLayout from "../../components/layout/AppLayout";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sb = supabaseBrowser();

    const check = async () => {
      const { data } = await sb.auth.getSession();
      const session = data.session;

      if (!session) {
        router.replace("/login");
        return;
      }
      setReady(true);
    };

    check().catch(() => router.replace("/login"));

    const { data: sub } = sb.auth.onAuthStateChange((_evt, session) => {
      // 세션이 끊기면 즉시 로그인으로
      if (!session && pathname?.startsWith("/")) {
        router.replace("/login");
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!ready) return null;

  return <AppLayout>{children}</AppLayout>;
}
