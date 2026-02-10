"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const sb = supabaseBrowser();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => {
      if (data.session) {
        router.replace("/dashboard");
      }
    });
  }, []);

  async function signInWithGoogle() {
    setLoading(true);
    await sb.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/dashboard",
      },
    });
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "var(--bg-main)",
        color: "var(--text-primary)",
      }}
    >
      <div
        style={{
          maxWidth: 420,
          padding: 28,
          borderRadius: 18,
          border: "1px solid var(--line-soft)",
          background: "rgba(210,194,165,0.08)",
          backdropFilter: "blur(14px)",
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 22, marginBottom: 8 }}>
          Welcome to Man Cave OS
        </div>

        <div style={{ color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 18 }}>
          전용 라운지에 오신 것을 환영합니다.<br />
          이 공간은 당신의 트레이딩을 보다 차분하고
          일관되게 관리하기 위해 설계되었습니다.
        </div>

        <button
          onClick={signInWithGoogle}
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px 14px",
            borderRadius: 14,
            border: "1px solid var(--line-soft)",
            background: "rgba(210,194,165,0.16)",
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          {loading ? "Connecting…" : "Continue with Google"}
        </button>
      </div>
    </div>
  );
}
