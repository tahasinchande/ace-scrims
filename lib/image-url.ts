/**
 * Resolves image and asset URLs safely for browser display.
 * 
 * - Converts private Vercel Blob URLs (*.private.blob.vercel-storage.com)
 *   to authenticated proxy endpoints (/api/screenshot?url=...).
 * - Cleans up accidental /public/ or public/ prefixes to ensure valid root-relative paths.
 * - Ensures local paths start with a leading slash.
 * - Handles null, undefined, or empty string gracefully with fallbacks.
 */
export function resolveImageUrl(url: string | null | undefined, fallback: string = "/placeholder.svg"): string {
  if (!url || typeof url !== "string" || url.trim() === "") {
    return fallback
  }

  let trimmed = url.trim()

  // Strip accidental /public/ or public/ prefix
  if (trimmed.startsWith("/public/")) {
    trimmed = trimmed.replace("/public/", "/")
  } else if (trimmed.startsWith("public/")) {
    trimmed = "/" + trimmed.slice(7)
  }

  // Handle private Vercel Blob URLs
  if (trimmed.includes(".private.blob.vercel-storage.com")) {
    if (trimmed.startsWith("/api/screenshot?url=")) {
      return trimmed
    }
    return `/api/screenshot?url=${encodeURIComponent(trimmed)}`
  }

  // If it's a relative path without leading slash and not a protocol URL / data URI
  if (!trimmed.startsWith("/") && !trimmed.startsWith("http://") && !trimmed.startsWith("https://") && !trimmed.startsWith("data:")) {
    trimmed = `/${trimmed}`
  }

  return trimmed
}

export function resolveImageUrls(urls: (string | null | undefined)[] | null | undefined): string[] {
  if (!Array.isArray(urls)) return []
  return urls
    .map((u) => resolveImageUrl(u, ""))
    .filter((u): u is string => u.length > 0 && u !== "/placeholder.svg")
}

