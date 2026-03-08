"use client";
import { useState } from "react";
import { firebaseAuth } from "@/lib/firebase/client";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function signInWithGoogle() {
    setLoading(true); setErr("");
    try {
      const auth = firebaseAuth();
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      // ID 토큰 발급 → 쿠키 저장
      const idToken = await result.user.getIdToken();
      await fetch("/auth/session", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      window.location.href = "/dashboard";
    } catch (e: any) {
      setErr(e?.message ?? "로그인 실패");
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "grid", placeItems: "center",
      background: "var(--bg, #F4F0E6)", color: "var(--text-primary, rgba(0,0,0,0.88))",
    }}>
      <div style={{
        width: "min(400px, 90vw)", padding: "32px 28px", borderRadius: 20,
        border: "1px solid var(--line-soft, rgba(0,0,0,.1))",
        background: "rgba(255,255,255,0.72)",
        backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
      }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontWeight: 900, fontSize: 20, letterSpacing: 0.3, marginBottom: 4 }}>
            Man Cave OS
          </div>
          <div style={{ fontSize: 11, opacity: 0.4, letterSpacing: 0.8 }}>PRIVATE CONSOLE</div>
        </div>
        <div style={{ fontSize: 14, opacity: 0.7, lineHeight: 1.7, marginBottom: 24 }}>
          트레이딩을 차분하고 일관되게 관리하는 전용 공간입니다.<br />
          Google 계정으로 접속하면 시작할 수 있습니다.
        </div>
        {err && <div style={{ fontSize: 12, color: "#c0392b", marginBottom: 12 }}>{err}</div>}
        <button onClick={signInWithGoogle} disabled={loading} style={{
          width: "100%", padding: "13px 16px", borderRadius: 12,
          border: "1px solid var(--line-soft, rgba(0,0,0,.12))",
          background: loading ? "rgba(0,0,0,0.06)" : "var(--text-primary, #111)",
          color: loading ? "var(--text-muted, rgba(0,0,0,0.4))" : "white",
          fontWeight: 800, fontSize: 14, cursor: loading ? "not-allowed" : "pointer",
          transition: "all 0.15s",
        }}>
          {loading ? "연결 중…" : "Google로 시작하기"}
        </button>
        <div style={{ marginTop: 16, fontSize: 11, opacity: 0.4, textAlign: "center", lineHeight: 1.6 }}>
          초대된 계정만 접속할 수 있습니다.
        </div>
      </div>
    </div>
  );
}
