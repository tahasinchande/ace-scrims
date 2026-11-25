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

/**
 * Strips CR/LF and null control characters to prevent SMTP/email header injection.
 */
export function sanitizeEmailHeader(input: string): string {
  return input.replace(/[\r\n\u0000-\u001f\u007f]+/g, " ").trim()
}

/**
 * Validates a standard single recipient email address (rejects newlines, commas, or malformed addresses).
 */
export function isValidEmailAddress(email: string | null | undefined): boolean {
  if (!email || typeof email !== "string") return false
  if (/[\r\n,;<>]/.test(email)) return false
  const trimmed = email.trim()
  if (trimmed.length < 5 || trimmed.length > 254) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed)
}

/**
 * Sanitizes admin-authored email HTML templates to strip active scripting,
 * embedded frames/objects, inline event handlers, and unsafe URI schemes
 * while preserving safe email layout markup and inline styles.
 */
export function sanitizeEmailHtml(html: string): string {
  if (!html || typeof html !== "string") return ""

  let clean = html
    // Remove dangerous elements along with their contents
    .replace(/<\s*(script|iframe|object|embed|applet|form|svg|math|base|meta|link)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    // Remove standalone / self-closing dangerous tags
    .replace(/<\s*\/?\s*(script|iframe|object|embed|applet|form|input|button|textarea|select|svg|math|base|meta|link)\b[^>]*\/?>/gi, "")
    // Remove inline event handler attributes (onclick=, onload=, onerror=, etc.)
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    // Neutralize srcdoc attributes
    .replace(/\s+srcdoc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    // Neutralize javascript:, vbscript:, and non-raster data: URLs in href/src/action attributes
    .replace(
      /\b(href|src|action|background)\s*=\s*(["'])\s*([\s\S]*?)\2/gi,
      (_match, attr: string, quote: string, val: string) => {
        const trimmed = val.trim()
        if (trimmed.includes("{{")) {
          // Template placeholder variable; reject obvious dangerous schemes before interpolation
          const compact = trimmed.replace(/[\u0000-\u001f\u007f\s]+/g, "").toLowerCase()
          if (compact.startsWith("javascript:") || compact.startsWith("vbscript:") || compact.startsWith("data:")) {
            return `${attr}=${quote}#${quote}`
          }
          return `${attr}=${quote}${trimmed}${quote}`
        }
        if (
          trimmed.startsWith("#") ||
          trimmed.startsWith("mailto:") ||
          trimmed.startsWith("tel:") ||
          isSafeHttpOrRelativeUrl(trimmed, { allowImageDataUri: true })
        ) {
          return `${attr}=${quote}${trimmed}${quote}`
        }
        return `${attr}=${quote}#${quote}`
      }
    )
    // Remove CSS expression() / url(javascript:...) / @import inside inline style attributes
    .replace(/expression\s*\([^)]*\)/gi, "")
    .replace(/url\s*\(\s*["']?\s*(?:javascript|vbscript|data:text\/html)[^)]*\)/gi, "")

  return clean
}

