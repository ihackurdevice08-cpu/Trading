"use client";
import { useEffect, useState } from "react";
import { firebaseAuth } from "@/lib/firebase/client";
import {
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
} from "firebase/auth";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState("");

  // 리다이렉트 복귀 시 결과 처리
  useEffect(() => {
    const auth = firebaseAuth();
    setLoading(true);
    getRedirectResult(auth)
      .then(async (result) => {
        if (!result) { setLoading(false); return; }
        const idToken = await result.user.getIdToken();
        await fetch("/auth/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        window.location.href = "/dashboard";
      })
      .catch((e: any) => {
        setErr(e?.message ?? "로그인 실패");
        setLoading(false);
      });
  }, []);

  async function signIn() {
    setLoading(true);
    setErr("");
    try {
      const auth     = firebaseAuth();
      const provider = new GoogleAuthProvider();
      await signInWithRedirect(auth, provider);
      // 이후 Google 로그인 페이지로 이동 → 완료 후 이 페이지로 복귀
    } catch (e: any) {
      setErr(e?.message ?? "로그인 실패");
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "grid", placeItems: "center",
      background: "var(--bg, #0d0f14)", color: "var(--text-primary, rgba(255,255,255,0.92))",
    }}>
      <div style={{
        width: "min(400px, 90vw)", padding: "36px 28px", borderRadius: 20,
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.04)",
        backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
      }}>
        {/* 브랜드 */}
        <div style={{ marginBottom: 28, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: "#F0B429",
            boxShadow: "0 0 10px #F0B429",
          }} />
          <div>
            <div style={{ fontWeight: 900, fontSize: 18, letterSpacing: 1.5, lineHeight: 1 }}>
              MAN CAVE OS
            </div>
            <div style={{ fontSize: 9.5, opacity: 0.3, letterSpacing: 2.5, marginTop: 3 }}>
              PRIVATE CONSOLE
            </div>
          </div>
        </div>

        <div style={{ fontSize: 13.5, opacity: 0.55, lineHeight: 1.8, marginBottom: 28 }}>
          트레이딩을 차분하고 일관되게 관리하는<br />전용 공간입니다.
        </div>

        {err && (
          <div style={{
            fontSize: 12, color: "#FF4D4D", marginBottom: 14,
            padding: "8px 12px", borderRadius: 8,
            background: "rgba(255,77,77,0.08)",
            border: "1px solid rgba(255,77,77,0.2)",
          }}>
            {err}
          </div>
        )}

        <button
          onClick={signIn}
          disabled={loading}
          style={{
            width: "100%", padding: "13px 16px", borderRadius: 12,
            border: "1px solid rgba(240,180,41,0.3)",
            background: loading ? "rgba(255,255,255,0.06)" : "rgba(240,180,41,0.12)",
            color: loading ? "rgba(255,255,255,0.3)" : "#F0B429",
            fontWeight: 700, fontSize: 14,
            cursor: loading ? "not-allowed" : "pointer",
            transition: "all 0.15s",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          }}
        >
          {/* Google 아이콘 */}
          {!loading && (
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          {loading ? "연결 중…" : "Google로 시작하기"}
        </button>

        <div style={{ marginTop: 18, fontSize: 11, opacity: 0.3, textAlign: "center" }}>
          초대된 계정만 접속할 수 있습니다
        </div>
      </div>
    </div>
  );
}
