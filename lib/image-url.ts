/**
 * Resolves image and asset URLs safely for browser display.
 * 
 * - Unpacks JSON-stringified arrays (e.g. '["https://..."]') to extract the first valid URL.
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

  // Handle JSON stringified arrays e.g. ["https://..."]
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return resolveImageUrl(parsed[0], fallback)
      }
    } catch {
      // Fallback: strip brackets and quotes if malformed JSON
      const inner = trimmed.slice(1, -1).trim()
      const firstUrl = inner.split(",")[0]?.trim().replace(/^["']|["']$/g, "")
      if (firstUrl) {
        return resolveImageUrl(firstUrl, fallback)
      }
    }
  }

  // Strip accidental outer quotes e.g. "https://..." or 'https://...'
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    trimmed = trimmed.slice(1, -1).trim()
  }

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

  // If it's a relative path without leading slash and not a protocol URL / data URI / blob URI
  if (
    !trimmed.startsWith("/") &&
    !trimmed.startsWith("http://") &&
    !trimmed.startsWith("https://") &&
    !trimmed.startsWith("data:") &&
    !trimmed.startsWith("blob:")
  ) {
    trimmed = `/${trimmed}`
  }

  return trimmed
}

/**
 * Extracts and normalizes an array of valid image URLs from any input format:
 * - A single URL string
 * - A JSON stringified array string e.g. '["url1", "url2"]'
 * - An array of strings
 * - A comma-delimited string
 */
export function extractImageUrls(input: unknown): string[] {
  if (!input) return []

  if (Array.isArray(input)) {
    return input.flatMap((item) => extractImageUrls(item))
  }

  if (typeof input === "string") {
    const trimmed = input.trim()
    if (!trimmed) return []

    // JSON array string
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) {
          return parsed.flatMap((item) => extractImageUrls(item))
        }
      } catch {
        // Fallback: comma split
        return trimmed
          .slice(1, -1)
          .split(",")
          .map((s) => s.trim().replace(/^["']|["']$/g, ""))
          .map((u) => resolveImageUrl(u, ""))
          .filter((u): u is string => u.length > 0 && u !== "/placeholder.svg")
      }
    }

    const resolved = resolveImageUrl(trimmed, "")
    return resolved && resolved !== "/placeholder.svg" ? [resolved] : []
  }

  return []
}

export function resolveImageUrls(urls: (string | null | undefined)[] | null | undefined): string[] {
  return extractImageUrls(urls)
}


