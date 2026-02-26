import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export default async function MePage() {
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

  return (
    <main style={{ padding: 24, fontFamily: "inherit" }}>
      <h1>내 정보</h1>
      <pre style={{ whiteSpace: "pre-wrap" }}>
{JSON.stringify(user, null, 2)}
      </pre>
      <a href="/" style={{ textDecoration: "none" }}>← 홈</a>
    </main>
  );
}
