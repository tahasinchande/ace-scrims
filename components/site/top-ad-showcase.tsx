"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence, useReducedMotion } from "motion/react"
import { ChevronRight, X } from "lucide-react"
import {
  formatTopAdCountdown,
  getTopAdCountdownParts,
  isTopAdActiveNow,
  type TopAdAccent,
  type TopAdConfig,
} from "@/lib/top-ad"
import { hexToRgbTuple, HEX_COLOR_RE, normalizeHexColor } from "@/lib/background-config"
import { isSafeHttpOrRelativeUrl } from "@/lib/url-safety"
import { DEEPCHARTS_EASE } from "@/lib/intro-motion"
import { cn } from "@/lib/utils"

const ACCENT_STYLES: Record<
  TopAdAccent,
  {
    glow: string
    mark: string
    markDropShadow: string
    highlight: string
    colon: string
    ctaHover: string
  }
> = {
  amber: {
    glow: "radial-gradient(34% 160% at 50% 50%, rgba(245, 166, 35, 0.28) 0%, rgba(180, 92, 14, 0.1) 52%, transparent 100%)",
    mark: "from-[#fff4d4] via-[#f5a623] to-[#c2610c]",
    markDropShadow: "drop-shadow-[0_0_14px_rgba(245,166,35,0.34)]",
    highlight: "text-[#F5A623]",
    colon: "text-zinc-500",
    ctaHover: "hover:border-amber-300/35 hover:bg-amber-400/[0.10] hover:text-amber-100",
  },
  blue: {
    glow: "radial-gradient(34% 160% at 50% 50%, rgba(31, 115, 255, 0.28) 0%, rgba(56, 189, 248, 0.1) 52%, transparent 100%)",
    mark: "from-[#e0f2fe] via-[#60a5fa] to-[#1d4ed8]",
    markDropShadow: "drop-shadow-[0_0_14px_rgba(56,189,248,0.34)]",
    highlight: "text-[#60A5FA]",
    colon: "text-zinc-500",
    ctaHover: "hover:border-sky-300/35 hover:bg-sky-400/[0.10] hover:text-sky-100",
  },
  cyan: {
    glow: "radial-gradient(34% 160% at 50% 50%, rgba(6, 182, 212, 0.28) 0%, rgba(34, 211, 238, 0.1) 52%, transparent 100%)",
    mark: "from-[#cffafe] via-[#22d3ee] to-[#0284c7]",
    markDropShadow: "drop-shadow-[0_0_14px_rgba(34,211,238,0.34)]",
    highlight: "text-[#22D3EE]",
    colon: "text-zinc-500",
    ctaHover: "hover:border-cyan-300/35 hover:bg-cyan-400/[0.10] hover:text-cyan-100",
  },
  violet: {
    glow: "radial-gradient(34% 160% at 50% 50%, rgba(140, 68, 212, 0.30) 0%, rgba(107, 47, 168, 0.1) 52%, transparent 100%)",
    mark: "from-[#f3e8ff] via-[#c084fc] to-[#7e22ce]",
    markDropShadow: "drop-shadow-[0_0_14px_rgba(192,132,252,0.34)]",
    highlight: "text-[#C084FC]",
    colon: "text-zinc-500",
    ctaHover: "hover:border-purple-300/35 hover:bg-purple-400/[0.10] hover:text-purple-100",
  },
  crimson: {
    glow: "radial-gradient(34% 160% at 50% 50%, rgba(217, 83, 111, 0.30) 0%, rgba(159, 18, 57, 0.1) 52%, transparent 100%)",
    mark: "from-[#ffe4e6] via-[#fb7185] to-[#be123c]",
    markDropShadow: "drop-shadow-[0_0_14px_rgba(251,113,133,0.34)]",
    highlight: "text-[#FB7185]",
    colon: "text-zinc-500",
    ctaHover: "hover:border-rose-300/35 hover:bg-rose-400/[0.10] hover:text-rose-100",
  },
  emerald: {
    glow: "radial-gradient(34% 160% at 50% 50%, rgba(16, 185, 129, 0.28) 0%, rgba(5, 150, 105, 0.1) 52%, transparent 100%)",
    mark: "from-[#d1fae5] via-[#34d399] to-[#047857]",
    markDropShadow: "drop-shadow-[0_0_14px_rgba(52,211,153,0.34)]",
    highlight: "text-[#34D399]",
    colon: "text-zinc-500",
    ctaHover: "hover:border-emerald-300/35 hover:bg-emerald-400/[0.10] hover:text-emerald-100",
  },
}

const HIDDEN_PATH_PREFIXES = ["/admin", "/maintenance", "/staff-login", "/sign-in", "/sign-up"]

function splitTwoLineBadge(raw: string): [string, string | null] {
  const clean = raw.trim()
  if (!clean) return ["", null]
  const words = clean.split(/\s+/)
  if (words.length <= 1) return [clean, null]
  const mid = Math.ceil(words.length / 2)
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")]
}

function renderHighlightedPromoText(
  text: string,
  highlightText: string,
  highlightClass: string,
  highlightStyle?: React.CSSProperties
): ReactNode {
  const cleanText = text.trim()
  const cleanHighlight = (highlightText || "").trim()
  if (!cleanHighlight) return cleanText

  const lowerText = cleanText.toLowerCase()
  const lowerHighlight = cleanHighlight.toLowerCase()
  const idx = lowerText.indexOf(lowerHighlight)

  if (idx === -1) {
    return (
      <>
        <span>{cleanText}</span>{" "}
        <span className={cn("font-extrabold", highlightClass)} style={highlightStyle}>
          {cleanHighlight}
        </span>
      </>
    )
  }

  const before = cleanText.slice(0, idx)
  const match = cleanText.slice(idx, idx + cleanHighlight.length)
  const after = cleanText.slice(idx + cleanHighlight.length)

  return (
    <>
      {before}
      <span className={cn("font-extrabold", highlightClass)} style={highlightStyle}>
        {match}
      </span>
      {after}
    </>
  )
}

export function TopAdShowcase({
  config,
  preview = false,
}: {
  config: TopAdConfig
  preview?: boolean
}) {
  const pathname = usePathname()
  const prefersReducedMotion = useReducedMotion()
  // Pure in-memory dismissal: reloads & re-entries always re-display the active ad
  const [dismissed, setDismissed] = useState(false)
  const [nowMs, setNowMs] = useState<number | null>(null)

  // Reset in-memory dismissal if admin updates ad version live; tick clock when scheduled/countdown active
  useEffect(() => {
    setNowMs(Date.now())
    setDismissed(false)

    const needsTick = Boolean(config.countdownEnd || config.startsAt || config.endsAt)
    if (!needsTick) return

    const timer = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [config.countdownEnd, config.startsAt, config.endsAt, config.version, preview])

  if (!preview && HIDDEN_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null
  }

  const effectiveNow = nowMs ?? Date.now()
  const active = preview
    ? Boolean(config.text.trim())
    : isTopAdActiveNow(config, effectiveNow)

  if (!active || (!preview && dismissed)) {
    return null
  }

  const matchBg = config.matchBackground !== false
  const normalizedCustomHex = !matchBg ? normalizeHexColor(config.customColor) : ""
  const hasCustomHex = Boolean(normalizedCustomHex && HEX_COLOR_RE.test(normalizedCustomHex))
  const customRgb = hasCustomHex ? hexToRgbTuple(normalizedCustomHex) : null
  const customRgbStr = customRgb ? `${customRgb[0]}, ${customRgb[1]}, ${customRgb[2]}` : ""

  const accentStyle = ACCENT_STYLES[config.accent] || ACCENT_STYLES.amber
  const safeCtaUrl =
    config.ctaUrl && isSafeHttpOrRelativeUrl(config.ctaUrl) ? config.ctaUrl.trim() : ""
  const isExternalCta = safeCtaUrl.startsWith("http://") || safeCtaUrl.startsWith("https://")

  const countdownMs =
    config.countdownEnd && nowMs !== null ? Date.parse(config.countdownEnd) - nowMs : NaN
  const countdownParts =
    Number.isFinite(countdownMs) && countdownMs > 0
      ? getTopAdCountdownParts(countdownMs)
      : null
  const countdownAria =
    Number.isFinite(countdownMs) && countdownMs > 0
      ? formatTopAdCountdown(countdownMs)
      : null

  function handleDismiss() {
    setDismissed(true)
  }

  // Always show all 4 fixed-width units (days : hours : minutes : seconds) so numbers never jitter
  const countdownColumns = countdownParts
    ? [
        { value: countdownParts.days, label: "days" },
        { value: countdownParts.hours, label: "hours" },
        { value: countdownParts.minutes, label: "minutes" },
        { value: countdownParts.seconds, label: "seconds" },
      ]
    : []

  const [badgeLine1, badgeLine2] = splitTwoLineBadge(config.badge)
  const hasCenterMark = Boolean(badgeLine1)

  // Compute dynamic background-matched, custom-hex, or preset-accent visuals
  const containerStyle: React.CSSProperties = matchBg
    ? {
        borderColor: "rgba(var(--rushx-primary-rgb), 0.24)",
        backgroundColor: "rgba(5, 7, 15, 0.92)",
      }
    : hasCustomHex
      ? {
          borderColor: `rgba(${customRgbStr}, 0.28)`,
          backgroundColor: "rgba(5, 7, 15, 0.94)",
        }
      : {}

  const glowBackground = matchBg
    ? "radial-gradient(42% 175% at 50% 50%, rgba(var(--rushx-primary-rgb), 0.34) 0%, rgba(var(--rushx-accent-rgb), 0.14) 52%, transparent 100%)"
    : hasCustomHex
      ? `radial-gradient(42% 175% at 50% 50%, rgba(${customRgbStr}, 0.34) 0%, rgba(${customRgbStr}, 0.12) 52%, transparent 100%)`
      : accentStyle.glow

  const highlightStyle: React.CSSProperties | undefined = matchBg
    ? { color: "rgb(var(--rushx-accent-rgb))" }
    : hasCustomHex
      ? { color: normalizedCustomHex }
      : undefined

  const markFilterStyle: React.CSSProperties | undefined = matchBg
    ? { filter: "drop-shadow(0 0 14px rgba(var(--rushx-primary-rgb), 0.42))" }
    : hasCustomHex
      ? { filter: `drop-shadow(0 0 14px rgba(${customRgbStr}, 0.42))` }
      : undefined

  const markTextStyle: React.CSSProperties | undefined = matchBg
    ? {
        backgroundImage:
          "linear-gradient(to bottom, rgb(var(--rushx-soft-rgb)), rgb(var(--rushx-accent-rgb)), rgb(var(--rushx-primary-rgb)))",
      }
    : hasCustomHex
      ? {
          backgroundImage: `linear-gradient(to bottom, #ffffff, ${normalizedCustomHex}, rgba(${customRgbStr}, 0.85))`,
        }
      : undefined

  const ctaInlineStyle: React.CSSProperties | undefined = matchBg
    ? {
        borderColor: "rgba(var(--rushx-primary-rgb), 0.34)",
        backgroundColor: "rgba(var(--rushx-primary-rgb), 0.14)",
      }
    : hasCustomHex
      ? {
          borderColor: `rgba(${customRgbStr}, 0.38)`,
          backgroundColor: `rgba(${customRgbStr}, 0.15)`,
        }
      : undefined

  return (
    <AnimatePresence initial={false}>
      <motion.div
        key={`top-ad-${config.version}`}
        role="region"
        aria-label="Site announcement"
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.42, ease: DEEPCHARTS_EASE }}
        style={containerStyle}
        className={cn(
          "relative z-50 w-full border-b border-white/[0.08] bg-[#050507]/96 text-zinc-100 backdrop-blur-xl overflow-hidden transition-colors duration-300",
          preview && "rounded-xl border border-white/[0.09]"
        )}
      >
        {/* Focused radial highlight matching active site background color (or custom color override) */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: glowBackground }}
          aria-hidden="true"
        />

        <div className="relative mx-auto flex min-h-[46px] max-w-7xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 py-2 sm:px-6 lg:justify-between pr-10 sm:pr-12">
          {/* Left Zone: Compact Bold Offer Statement */}
          <p className="text-center lg:text-left text-[11px] sm:text-[12.5px] font-bold uppercase tracking-[0.04em] text-zinc-100/95 leading-snug text-pretty">
            {renderHighlightedPromoText(
              config.text,
              config.highlightText,
              matchBg || hasCustomHex ? "" : accentStyle.highlight,
              highlightStyle
            )}
          </p>

          {/* Center Zone: Highlighted Two-Line Stacked Promo Mark with Subtle Pulse Motion */}
          {hasCenterMark && (
            <motion.div
              animate={
                prefersReducedMotion
                  ? undefined
                  : {
                      scale: [1, 1.035, 1],
                      opacity: [0.92, 1, 0.92],
                    }
              }
              transition={
                prefersReducedMotion
                  ? undefined
                  : {
                      duration: 3.4,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }
              }
              style={markFilterStyle}
              className={cn(
                "flex shrink-0 flex-col items-center justify-center text-center select-none will-change-transform",
                !(matchBg || hasCustomHex) && accentStyle.markDropShadow
              )}
            >
              <span
                style={markTextStyle}
                className={cn(
                  "font-display text-[13px] sm:text-[14px] font-extrabold italic tracking-tight leading-[0.95] bg-clip-text text-transparent",
                  !(matchBg || hasCustomHex) && cn("bg-gradient-to-b", accentStyle.mark)
                )}
              >
                {badgeLine1}
              </span>
              {badgeLine2 && (
                <span
                  style={markTextStyle}
                  className={cn(
                    "font-display text-[15px] sm:text-[17px] font-black italic tracking-tight leading-[0.95] bg-clip-text text-transparent",
                    !(matchBg || hasCustomHex) && cn("bg-gradient-to-b", accentStyle.mark)
                  )}
                >
                  {badgeLine2}
                </span>
              )}
            </motion.div>
          )}

          {/* Right Zone: Tabular 4-Unit Countdown (days : hours : minutes : seconds) + Hairline CTA */}
          {(countdownColumns.length > 0 || safeCtaUrl) && (
            <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
              {countdownColumns.length > 0 && (
                <div
                  className="inline-flex items-start gap-1.5 sm:gap-2"
                  aria-label={countdownAria ? `Ends in ${countdownAria}` : "Countdown active"}
                >
                  {countdownColumns.map((col, idx) => (
                    <div key={col.label} className="inline-flex items-start gap-1.5 sm:gap-2">
                      <div className="flex min-w-[2.15rem] sm:min-w-[2.4rem] flex-col items-center justify-center leading-none">
                        <span className="font-sans text-[15px] sm:text-[16px] font-bold tracking-tight text-white tabular-nums">
                          {col.value}
                        </span>
                        <span className="mt-1 text-[9px] font-medium tracking-[0.02em] text-zinc-400">
                          {col.label}
                        </span>
                      </div>
                      {idx < countdownColumns.length - 1 && (
                        <span
                          className={cn(
                            "pt-[1px] font-sans text-[13px] sm:text-[14px] font-bold leading-none select-none",
                            accentStyle.colon
                          )}
                          aria-hidden="true"
                        >
                          :
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {safeCtaUrl &&
                (isExternalCta ? (
                  <a
                    href={safeCtaUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={ctaInlineStyle}
                    className={cn(
                      "group inline-flex shrink-0 items-center gap-1 rounded-md border border-white/15 bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold tracking-tight text-zinc-100 transition-all duration-200 hover:brightness-115 active:scale-[0.98]",
                      !(matchBg || hasCustomHex) && accentStyle.ctaHover
                    )}
                  >
                    <span>{config.ctaLabel.trim() || "Learn More"}</span>
                    <ChevronRight
                      className="size-3 shrink-0 text-zinc-300 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-white"
                      aria-hidden="true"
                    />
                  </a>
                ) : (
                  <Link
                    href={safeCtaUrl}
                    style={ctaInlineStyle}
                    className={cn(
                      "group inline-flex shrink-0 items-center gap-1 rounded-md border border-white/15 bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold tracking-tight text-zinc-100 transition-all duration-200 hover:brightness-115 active:scale-[0.98]",
                      !(matchBg || hasCustomHex) && accentStyle.ctaHover
                    )}
                  >
                    <span>{config.ctaLabel.trim() || "Learn More"}</span>
                    <ChevronRight
                      className="size-3 shrink-0 text-zinc-300 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-white"
                      aria-hidden="true"
                    />
                  </Link>
                ))}
            </div>
          )}
        </div>

        {/* Quiet Dismiss Button (in-memory only; reappears on reload or re-entry) */}
        {config.dismissible && !preview && (
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss announcement"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 flex size-6 items-center justify-center rounded-md text-zinc-500 hover:bg-white/[0.07] hover:text-zinc-200 transition-colors duration-150 cursor-pointer"
          >
            <X className="size-3.5" />
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
