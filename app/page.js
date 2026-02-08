import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export default async function Page() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // server component에서는 set 불가 (middleware가 쿠키 세팅 처리)
        }
      }
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ marginTop: 0 }}>Trading OS v2</h1>

      {!user ? (
        <form action="/auth/signin" method="post">
          <button type="submit" style={btn}>
            Google 로그인
          </button>
        </form>
      ) : (
        <>
          <div style={{ marginBottom: 12 }}>로그인됨: {user.email}</div>
          <form action="/auth/signout" method="post">
            <button type="submit" style={btn}>로그아웃</button>
          </form>
        </>
      )}
    </div>
  );
}

const btn = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #ddd",
  background: "white",
  cursor: "pointer"
};
