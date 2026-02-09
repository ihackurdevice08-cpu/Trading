import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function Home() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui" }}>
        <h1 style={{ margin: 0 }}>Man Cave</h1>
        <p style={{ opacity: 0.7 }}>로그인이 필요합니다.</p>
        <a href="/auth/signin" style={{
          display: "inline-block", padding: "10px 14px", border: "1px solid #ddd",
          borderRadius: 10, textDecoration: "none"
        }}>
          Google 로그인
        </a>
      </main>
    );
  }

  redirect("/dashboard");
}
