import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"

function getRateLimitPolicy(pathname: string, method: string): {
  bucket: string
  limit: number
  windowMs: number
} | null {
  // Never rate-limit payment webhooks or payment return callbacks
  if (pathname.startsWith("/api/payment/webhook") || pathname.startsWith("/payment/callback")) {
    return null
  }

  if (pathname.startsWith("/api/auth/")) {
    // Allow normal session polling while protecting credential/signup endpoints from brute force
    if (method === "GET" && pathname.includes("/get-session")) {
      return { bucket: "auth-session", limit: 120, windowMs: 60_000 }
    }
    return { bucket: "auth-write", limit: 30, windowMs: 60_000 }
  }

  if (pathname.startsWith("/api/referrals/")) {
    return { bucket: "referrals", limit: 40, windowMs: 60_000 }
  }

  if (pathname.startsWith("/api/reports")) {
    return { bucket: "reports", limit: 15, windowMs: 60_000 }
  }

  if (pathname.startsWith("/api/chat") && method !== "GET") {
    return { bucket: "chat-write", limit: 35, windowMs: 60_000 }
  }

  return null
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. Cloudflare-aware Edge rate limiting on abuse-sensitive API endpoints
  const policy = getRateLimitPolicy(pathname, request.method)
  if (policy) {
    const ip = getClientIp(request.headers)
    const result = checkRateLimit({
      key: `${policy.bucket}:${ip}`,
      limit: policy.limit,
      windowMs: policy.windowMs,
    })

    if (!result.allowed) {
      return NextResponse.json(
        {
          ok: false,
          error: "Too many requests. Please wait a moment and try again.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(result.retryAfterSec),
            "Cache-Control": "no-store, no-cache, must-revalidate, private",
            "CDN-Cache-Control": "no-store",
          },
        }
      )
    }
  }

  // 2. Protect Admin Portal and Admin API routes
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    const sessionToken =
      request.cookies.get("better-auth.session_token")?.value ||
      request.cookies.get("__Secure-better-auth.session_token")?.value ||
      request.headers.get("Authorization")

    if (!sessionToken) {
      if (pathname.startsWith("/api/admin")) {
        return NextResponse.json(
          { ok: false, error: "Unauthorized: Admin privileges required." },
          {
            status: 401,
            headers: {
              "Cache-Control": "no-store, no-cache, must-revalidate, private",
              "CDN-Cache-Control": "no-store",
            },
          }
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
    "/api/auth/:path*",
    "/api/referrals/:path*",
    "/api/reports/:path*",
    "/api/chat/:path*",
  ],
}
