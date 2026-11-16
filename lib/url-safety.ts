/**
 * Validates URLs supplied by users or admins before persistence/rendering.
 * Rejects dangerous schemes such as javascript:, vbscript:, data:text/html, etc.
 */
export function isSafeHttpOrRelativeUrl(
  rawUrl: string | null | undefined,
  options?: { allowImageDataUri?: boolean }
): boolean {
  if (!rawUrl || typeof rawUrl !== "string") return false
  const trimmed = rawUrl.trim()
  if (!trimmed) return false

  // Reject control characters or leading obfuscated schemes
  const normalized = trimmed.replace(/[\u0000-\u001f\u007f\s]+/g, "").toLowerCase()
  if (
    normalized.startsWith("javascript:") ||
    normalized.startsWith("vbscript:") ||
    normalized.startsWith("file:")
  ) {
    return false
  }

  if (normalized.startsWith("data:")) {
    if (!options?.allowImageDataUri) return false
    // Allow strictly safe raster image data URIs (never SVG or HTML)
    return /^data:image\/(?:png|jpeg|jpg|webp|gif);base64,/i.test(trimmed)
  }

  // Allow relative app paths like /uploads/... or /api/screenshot?...
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return true
  }

  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === "https:" || parsed.protocol === "http:"
  } catch {
    return false
  }
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
