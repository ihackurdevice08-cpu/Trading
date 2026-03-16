"use client";
import { useEffect, useState } from "react";
import { firebaseAuth } from "@/lib/firebase/client";
import { GoogleAuthProvider, signInWithRedirect, getRedirectResult } from "firebase/auth";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState("");

  useEffect(() => {
    let cancelled = false;

    async function checkRedirect() {
      try {
        const auth = firebaseAuth();
        // 타임아웃: 5초 안에 결과 없으면 포기
        const result = await Promise.race([
          getRedirectResult(auth),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
        ]);
        if (cancelled || !result) return;
        setLoading(true);
        const idToken = await result.user.getIdToken();
        await fetch("/auth/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        window.location.href = "/dashboard";
      } catch (e: any) {
        if (cancelled) return;
        setErr(e?.message ?? "로그인 실패");
      }
    }

    checkRedirect();
    return () => { cancelled = true; };
  }, []);

  async function signIn() {
    setLoading(true);
    setErr("");
    try {
      const auth     = firebaseAuth();
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithRedirect(auth, provider);
    } catch (e: any) {
      setErr(e?.message ?? "로그인 실패");
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      background: "#0d0f14",
      color: "rgba(255,255,255,0.92)",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif",
    }}>
      <div style={{
        width: "min(400px, 90vw)",
        padding: "40px 32px",
        borderRadius: 20,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.04)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
      }}>

        {/* 브랜드 */}
        <div style={{ marginBottom: 32, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: "#F0B429",
            boxShadow: "0 0 12px #F0B429",
            flexShrink: 0,
          }} />
          <div>
            <div style={{ fontWeight: 900, fontSize: 17, letterSpacing: 2, lineHeight: 1 }}>
              MAN CAVE OS
            </div>
            <div style={{ fontSize: 9, opacity: 0.3, letterSpacing: 3, marginTop: 4 }}>
              PRIVATE CONSOLE
            </div>
          </div>
        </div>

        <div style={{ fontSize: 13, opacity: 0.5, lineHeight: 1.9, marginBottom: 32 }}>
          트레이딩을 차분하고 일관되게 관리하는<br />전용 공간입니다.
        </div>

        {err && (
          <div style={{
            fontSize: 12, color: "#FF4D4D", marginBottom: 16,
            padding: "10px 14px", borderRadius: 8,
            background: "rgba(255,77,77,0.08)",
            border: "1px solid rgba(255,77,77,0.2)",
            lineHeight: 1.5,
          }}>
            {err}
          </div>
        )}

        <button
          onClick={signIn}
          disabled={loading}
          style={{
            width: "100%",
            padding: "14px 16px",
            borderRadius: 12,
            border: "1px solid rgba(240,180,41,0.35)",
            background: loading ? "rgba(255,255,255,0.04)" : "rgba(240,180,41,0.10)",
            color: loading ? "rgba(255,255,255,0.25)" : "#F0B429",
            fontWeight: 700,
            fontSize: 14,
            cursor: loading ? "not-allowed" : "pointer",
            transition: "all 0.15s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            letterSpacing: 0.3,
          }}
        >
          {loading ? (
            <span style={{ opacity: 0.5 }}>연결 중…</span>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Google로 시작하기
            </>
          )}
        </button>

        <div style={{ marginTop: 20, fontSize: 11, opacity: 0.25, textAlign: "center", letterSpacing: 0.3 }}>
          초대된 계정만 접속할 수 있습니다
        </div>
      </div>
    </div>
  );
}
