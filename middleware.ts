import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Protect Admin Portal and Admin API routes
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    const sessionToken =
      request.cookies.get("better-auth.session_token")?.value ||
      request.cookies.get("__Secure-better-auth.session_token")?.value ||
      request.headers.get("Authorization")

    if (!sessionToken) {
      if (pathname.startsWith("/api/admin")) {
        return NextResponse.json(
          { ok: false, error: "Unauthorized: Admin privileges required." },
          { status: 401 }
        )
      }

      // Non-authenticated visitors hitting /admin are safely redirected to homepage
      return NextResponse.redirect(new URL("/", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
  ],
}
