"use client";
import { useState, useEffect } from "react";
import { GoogleAuthProvider, signInWithRedirect, getRedirectResult, onAuthStateChanged, type User } from "firebase/auth";
import { ensurePersistence } from "@/lib/firebase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router  = useRouter();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    async function createSession(user: User) {
      const idToken = await user.getIdToken();
      const res = await fetch("/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.ok) {
        throw new Error(body?.error || "세션 생성 실패");
      }
      sessionStorage.setItem("__session_ts", String(Date.now()));
      router.replace("/dashboard");
    }

    async function boot() {
      setLoading(true);
      try {
        const auth = await ensurePersistence();
        const result = await getRedirectResult(auth);
        const user = result?.user ?? auth.currentUser;
        if (user) {
          await createSession(user);
          return;
        }

        unsubscribe = onAuthStateChanged(auth, async currentUser => {
          unsubscribe?.();
          if (cancelled) return;
          if (!currentUser) {
            setLoading(false);
            return;
          }
          try {
            await createSession(currentUser);
          } catch (e: any) {
            if (!cancelled) {
              setError(e?.message ?? "로그인 오류");
              setLoading(false);
            }
          }
        });
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "로그인 오류");
          setLoading(false);
        }
      }
    }

    boot();
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [router]);

  async function signInWithGoogle() {
    setLoading(true);
    setError(null);
    try {
      const auth = await ensurePersistence();
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithRedirect(auth, provider);
    } catch (e: any) {
      setError(e?.message ?? "로그인 실패");
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight:"100vh", display:"grid", placeItems:"center", background:"var(--bg,#0d0f14)", color:"var(--text-primary,rgba(255,255,255,.92))" }}>
      <div style={{ width:"min(400px,90vw)", padding:"40px 32px", borderRadius:20, border:"1px solid var(--line-soft,rgba(255,255,255,.08))", background:"var(--panel,rgba(255,255,255,.04))", backdropFilter:"blur(20px)" }}>
        <div style={{ marginBottom:32, display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:"var(--accent,#F0B429)", boxShadow:"0 0 12px var(--accent,#F0B429)" }} />
          <div>
            <div style={{ fontWeight:900, fontSize:17, letterSpacing:2 }}>MAN CAVE OS</div>
            <div style={{ fontSize:9, opacity:.3, letterSpacing:3, marginTop:4 }}>PRIVATE CONSOLE</div>
          </div>
        </div>
        <div style={{ fontSize:13, opacity:.5, lineHeight:1.9, marginBottom:32 }}>
          트레이딩을 차분하고 일관되게 관리하는<br/>전용 공간입니다.
        </div>
        {error && <div style={{ marginBottom:16, padding:"10px 14px", borderRadius:10, background:"rgba(192,57,43,.08)", border:"1px solid rgba(192,57,43,.2)", fontSize:12, color:"#c0392b" }}>⚠ {error}</div>}
        <button onClick={signInWithGoogle} disabled={loading}
          style={{ width:"100%", padding:"14px 16px", borderRadius:12, border:"1px solid rgba(240,180,41,.35)", background:"rgba(240,180,41,.10)", color:"var(--accent,#F0B429)", fontWeight:700, fontSize:14, cursor:loading?"not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:10, opacity:loading?.6:1 }}>
          <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          {loading ? "연결 중…" : "Google로 시작하기"}
        </button>
        <div style={{ marginTop:20, fontSize:11, opacity:.25, textAlign:"center" }}>초대된 계정만 접속할 수 있습니다</div>
      </div>
    </div>
  );
}
