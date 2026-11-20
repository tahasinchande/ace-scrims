/**
 * Edge & Node runtime-safe sliding-window rate limiter with Cloudflare IP awareness.
 * Designed for Vercel Edge Middleware and API Route Handlers.
 */

type Bucket = {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()
const MAX_BUCKETS = 10_000

export function getClientIp(headers: Headers): string {
  const cfIp = headers.get("cf-connecting-ip")?.trim()
  if (cfIp) return cfIp

  const trueClientIp = headers.get("true-client-ip")?.trim()
  if (trueClientIp) return trueClientIp

  const realIp = headers.get("x-real-ip")?.trim()
  if (realIp) return realIp

  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  if (forwarded) return forwarded

  return "unknown"
}

export function checkRateLimit(params: {
  key: string
  limit: number
  windowMs: number
}): {
  allowed: boolean
  remaining: number
  resetAt: number
  retryAfterSec: number
} {
  const now = Date.now()

  // Opportunistic pruning to keep memory bounded in long-lived isolates
  if (buckets.size > MAX_BUCKETS) {
    for (const [k, v] of buckets.entries()) {
      if (v.resetAt <= now) {
        buckets.delete(k)
      }
    }
  }

  const existing = buckets.get(params.key)
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + params.windowMs
    buckets.set(params.key, { count: 1, resetAt })
    return {
      allowed: true,
      remaining: Math.max(0, params.limit - 1),
      resetAt,
      retryAfterSec: Math.ceil(params.windowMs / 1000),
    }
  }

  if (existing.count >= params.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    }
  }

  existing.count += 1
  return {
    allowed: true,
    remaining: Math.max(0, params.limit - existing.count),
    resetAt: existing.resetAt,
    retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  }
}
