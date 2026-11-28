import { z } from "zod"
import { isSafeHttpOrRelativeUrl } from "@/lib/url-safety"
import { HEX_COLOR_RE, normalizeHexColor } from "@/lib/background-config"

export const TOP_AD_ACCENTS = ["amber", "blue", "cyan", "violet", "crimson", "emerald"] as const
export type TopAdAccent = (typeof TOP_AD_ACCENTS)[number]

export interface TopAdConfig {
  enabled: boolean
  badge: string
  accent: TopAdAccent
  /** When true (default), the ad surface & highlights dynamically match the site's active background color */
  matchBackground: boolean
  /** Optional custom hex color (#RRGGBB) applied when matchBackground is false */
  customColor: string
  text: string
  highlightText: string
  ctaLabel: string
  ctaUrl: string
  countdownEnd: string
  startsAt: string
  endsAt: string
  dismissible: boolean
  version: number
}

export interface TopAdCountdownParts {
  days: string
  hours: string
  minutes: string
  seconds: string
  hasDays: boolean
}

export const DEFAULT_TOP_AD_CONFIG: TopAdConfig = {
  enabled: false,
  badge: "LIMITED OFFER",
  accent: "amber",
  matchBackground: true,
  customColor: "",
  text: "",
  highlightText: "",
  ctaLabel: "Book Now",
  ctaUrl: "/scrims",
  countdownEnd: "",
  startsAt: "",
  endsAt: "",
  dismissible: true,
  version: 1,
}

function isValidOptionalIsoDate(val: string): boolean {
  if (!val) return true
  const ms = Date.parse(val)
  return Number.isFinite(ms)
}

export const topAdConfigSchema = z
  .object({
    enabled: z.boolean(),
    badge: z.string().trim().max(32, "Badge must be 32 characters or less").default(""),
    accent: z.enum(TOP_AD_ACCENTS).default("amber"),
    matchBackground: z.boolean().default(true),
    customColor: z
      .string()
      .trim()
      .max(16)
      .default("")
      .transform((v) => (v ? normalizeHexColor(v) : ""))
      .refine((v) => v === "" || HEX_COLOR_RE.test(v), {
        message: "Custom color must be a valid hex code (e.g. #F97316)",
      }),
    text: z.string().trim().max(180, "Announcement text must be 180 characters or less").default(""),
    highlightText: z
      .string()
      .trim()
      .max(60, "Highlighted phrase must be 60 characters or less")
      .default(""),
    ctaLabel: z.string().trim().max(32, "CTA label must be 32 characters or less").default(""),
    ctaUrl: z
      .string()
      .trim()
      .max(500, "Destination URL is too long")
      .default("")
      .refine((v) => v.length === 0 || isSafeHttpOrRelativeUrl(v), {
        message: "Destination link must start with https://, http://, or /",
      }),
    countdownEnd: z
      .string()
      .trim()
      .max(64)
      .default("")
      .refine(isValidOptionalIsoDate, { message: "Invalid countdown end date/time" }),
    startsAt: z
      .string()
      .trim()
      .max(64)
      .default("")
      .refine(isValidOptionalIsoDate, { message: "Invalid schedule start date/time" }),
    endsAt: z
      .string()
      .trim()
      .max(64)
      .default("")
      .refine(isValidOptionalIsoDate, { message: "Invalid schedule expiry date/time" }),
    dismissible: z.boolean().default(true),
    version: z.number().int().nonnegative().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.enabled && data.text.trim().length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["text"],
        message: "Promo text is required when the Top Ad Showcase is enabled.",
      })
    }
    if (data.startsAt && data.endsAt) {
      const startMs = Date.parse(data.startsAt)
      const endMs = Date.parse(data.endsAt)
      if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs <= startMs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["endsAt"],
          message: "Expiry time must be after schedule start time.",
        })
      }
    }
  })

/**
 * Parses persisted `top_ad_config` JSON from settings with graceful fallback to the
 * legacy plain-text `announcement` key so existing banners keep displaying seamlessly.
 */
export function parseTopAdConfig(
  rawJson: string | null | undefined,
  legacyAnnouncement?: string | null
): TopAdConfig {
  if (rawJson && rawJson.trim().length > 0) {
    try {
      const parsed = JSON.parse(rawJson)
      const safe = topAdConfigSchema.safeParse({
        ...DEFAULT_TOP_AD_CONFIG,
        ...(parsed && typeof parsed === "object" ? parsed : {}),
        // Default matchBackground to true for any pre-existing configs that didn't store this key
        matchBackground:
          parsed && typeof parsed === "object" && typeof parsed.matchBackground === "boolean"
            ? parsed.matchBackground
            : true,
        customColor:
          parsed && typeof parsed === "object" && typeof parsed.customColor === "string"
            ? parsed.customColor
            : "",
        // Allow loading disabled drafts even if text is empty
        enabled: Boolean(parsed?.enabled) && Boolean(String(parsed?.text || "").trim()),
      })
      if (safe.success) {
        return {
          ...safe.data,
          version: safe.data.version ?? 1,
        }
      }
    } catch {
      // Fall through to legacy announcement fallback
    }
  }

  const legacyText = (legacyAnnouncement || "").trim()
  if (legacyText.length > 0) {
    return {
      ...DEFAULT_TOP_AD_CONFIG,
      enabled: true,
      badge: "NOTICE",
      accent: "blue",
      matchBackground: true,
      customColor: "",
      text: legacyText.slice(0, 180),
      highlightText: "",
      ctaLabel: "",
      ctaUrl: "",
      dismissible: true,
      version: 1,
    }
  }

  return { ...DEFAULT_TOP_AD_CONFIG }
}

/**
 * Returns true if the Top Ad Showcase should currently be displayed at `nowMs`.
 */
export function isTopAdActiveNow(config: TopAdConfig, nowMs: number = Date.now()): boolean {
  if (!config.enabled || !config.text.trim()) return false
  if (config.startsAt) {
    const startMs = Date.parse(config.startsAt)
    if (Number.isFinite(startMs) && nowMs < startMs) return false
  }
  if (config.endsAt) {
    const endMs = Date.parse(config.endsAt)
    if (Number.isFinite(endMs) && nowMs >= endMs) return false
  }
  return true
}

/**
 * Splits remaining milliseconds into DeepCharts-style segmented tabular countdown parts.
 * Returns null once expired.
 */
export function getTopAdCountdownParts(remainingMs: number): TopAdCountdownParts | null {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return null
  const totalSeconds = Math.floor(remainingMs / 1000)
  const daysNum = Math.floor(totalSeconds / 86400)
  const hoursNum = Math.floor((totalSeconds % 86400) / 3600)
  const minutesNum = Math.floor((totalSeconds % 3600) / 60)
  const secondsNum = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, "0")
  return {
    days: pad(daysNum),
    hours: pad(hoursNum),
    minutes: pad(minutesNum),
    seconds: pad(secondsNum),
    hasDays: daysNum > 0,
  }
}

/**
 * Formats remaining milliseconds into a compact tabular countdown string.
 * Returns null once expired.
 */
export function formatTopAdCountdown(remainingMs: number): string | null {
  const parts = getTopAdCountdownParts(remainingMs)
  if (!parts) return null
  if (parts.hasDays) {
    return `${parts.days}d ${parts.hours}:${parts.minutes}:${parts.seconds}`
  }
  return `${parts.hours}:${parts.minutes}:${parts.seconds}`
}
