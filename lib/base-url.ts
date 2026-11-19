import "server-only"
import { headers } from "next/headers"

function normalizeOrigin(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim().replace(/\/+$/, "")
  if (!trimmed) return null
  if (trimmed.includes("0.0.0.0")) return null
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed
  }
  if (trimmed.startsWith("localhost") || trimmed.startsWith("127.0.0.1")) {
    return `http://${trimmed}`
  }
  return `https://${trimmed}`
}

/**
 * Resolves the active origin for payment redirects and server webhooks.
 * Prefers the incoming request host (custom domain, vercel.app, or preview host),
 * falling back to configured environment URLs.
 */
export async function resolveAppBaseUrl(): Promise<string> {
  try {
    const hdrs = await headers()
    const originHeader = normalizeOrigin(hdrs.get("origin"))
    const forwardedHost = hdrs.get("x-forwarded-host")?.split(",")[0]?.trim()
    const forwardedProto = hdrs.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https"
    const hostHeader = hdrs.get("host")?.split(",")[0]?.trim()

    const candidateHost = forwardedHost || hostHeader
    if (candidateHost && !candidateHost.includes("0.0.0.0")) {
      const isLocalHost =
        candidateHost.startsWith("localhost") || candidateHost.startsWith("127.0.0.1")
      if (!isLocalHost) {
        return `${forwardedProto}://${candidateHost}`.replace(/\/+$/, "")
      }
    }

    if (originHeader && !originHeader.includes("localhost") && !originHeader.includes("127.0.0.1")) {
      return originHeader
    }
  } catch {
    // headers() is unavailable outside request context
  }

  const envCandidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    process.env.BETTER_AUTH_URL,
  ]

  for (const raw of envCandidates) {
    const normalized = normalizeOrigin(raw)
    if (normalized && !normalized.includes("localhost") && !normalized.includes("127.0.0.1")) {
      return normalized
    }
  }

  try {
    const hdrs = await headers()
    const host = hdrs.get("host")?.trim()
    if (host) {
      return `http://${host.replace("0.0.0.0", "localhost")}`.replace(/\/+$/, "")
    }
  } catch {}

  return "https://www.acescrims.online"
}
