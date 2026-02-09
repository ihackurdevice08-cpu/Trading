import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;

  // IMPORTANT: set cookies on the SAME response we return
  const response = NextResponse.redirect(origin, { status: 303 });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  });

  if (error || !data?.url) {
    response.headers.set("Location", `${origin}/?e=oauth_start_failed`);
    return response;
  }

  // Keep the same response (with cookies), only swap Location
  response.headers.set("Location", data.url);
  return response;
}
