import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import Link from "next/link";

export default async function Home() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // 로그인 안됐으면 -> 로그인 화면
  if (!user) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui" }}>
        <h1 style={{ margin: 0 }}>Man Cave</h1>
        <p style={{ opacity: 0.7 }}>로그인이 필요합니다.</p>
        <a href="/auth/signin"
           style={{
             display: "inline-block",
             padding: "10px 14px",
             border: "1px solid #ddd",
             borderRadius: 10,
             textDecoration: "none"
           }}>
          Google 로그인
        </a>
      </main>
    );
  }

  // 로그인 됐으면 -> 홈
  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ margin: 0 }}>Man Cave</h1>
      <p style={{ opacity: 0.7, marginTop: 8 }}>
        로그인됨: {user.email}
      </p>

      <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        <a href="/auth/signout"
           style={{
             display: "inline-block",
             padding: "10px 14px",
             border: "1px solid #ddd",
             borderRadius: 10,
             textDecoration: "none"
           }}>
          로그아웃
        </a>

        <Link href="/me"
          style={{
            display: "inline-block",
            padding: "10px 14px",
            border: "1px solid #ddd",
            borderRadius: 10,
            textDecoration: "none"
          }}>
          내 정보 페이지
        </Link>
      </div>
    </main>
  );
}
