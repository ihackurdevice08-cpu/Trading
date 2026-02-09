import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export default async function Home() {
  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main style={{ padding: 40 }}>
        <h1>Man Cave</h1>
        <a href="/auth/signin">
          <button>Google 로그인</button>
        </a>
      </main>
    );
  }

  return (
    <main style={{ padding: 40 }}>
      <h1>환영합니다</h1>
      <p>{user.email}</p>

      <a href="/auth/signout">
        <button>로그아웃</button>
      </a>
    </main>
  );
}
