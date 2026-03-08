import { NextResponse, type NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";

const PUBLIC_PATHS = ["/login", "/auth/signin", "/auth/callback", "/auth/signout"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p));

  const token = request.cookies.get("__session")?.value;

  if (!token) {
    if (isPublic) return NextResponse.next();
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    await adminAuth().verifyIdToken(token);
    if (pathname === "/login") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  } catch {
    if (isPublic) return NextResponse.next();
    const res = NextResponse.redirect(new URL("/login", request.url));
    res.cookies.delete("__session");
    return res;
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
