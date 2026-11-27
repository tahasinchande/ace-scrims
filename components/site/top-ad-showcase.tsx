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
import { isSafeHttpOrRelativeUrl } from "@/lib/url-safety"
import { DEEPCHARTS_EASE } from "@/lib/intro-motion"
import { cn } from "@/lib/utils"

const ACCENT_STYLES: Record<
  TopAdAccent,
  {
    glow: string
    mark: string
    highlight: string
    divider: string
    ctaHover: string
  }
> = {
  amber: {
    glow: "radial-gradient(38% 150% at 50% 50%, rgba(245, 166, 35, 0.24) 0%, rgba(180, 92, 14, 0.08) 54%, transparent 100%)",
    mark: "from-[#fff3d1] via-[#f5a623] to-[#b45309]",
    highlight: "text-[#F5A623]",
    divider: "bg-amber-400/20",
    ctaHover: "hover:border-amber-300/35 hover:bg-amber-400/[0.10] hover:text-amber-100",
  },
  blue: {
    glow: "radial-gradient(38% 150% at 50% 50%, rgba(31, 115, 255, 0.26) 0%, rgba(56, 189, 248, 0.08) 54%, transparent 100%)",
    mark: "from-[#e0f2fe] via-[#60a5fa] to-[#1d4ed8]",
    highlight: "text-[#60A5FA]",
    divider: "bg-sky-400/20",
    ctaHover: "hover:border-sky-300/35 hover:bg-sky-400/[0.10] hover:text-sky-100",
  },
  cyan: {
    glow: "radial-gradient(38% 150% at 50% 50%, rgba(6, 182, 212, 0.25) 0%, rgba(34, 211, 238, 0.08) 54%, transparent 100%)",
    mark: "from-[#cffafe] via-[#22d3ee] to-[#0284c7]",
    highlight: "text-[#22D3EE]",
    divider: "bg-cyan-400/20",
    ctaHover: "hover:border-cyan-300/35 hover:bg-cyan-400/[0.10] hover:text-cyan-100",
  },
  violet: {
    glow: "radial-gradient(38% 150% at 50% 50%, rgba(140, 68, 212, 0.28) 0%, rgba(107, 47, 168, 0.09) 54%, transparent 100%)",
    mark: "from-[#f3e8ff] via-[#c084fc] to-[#7e22ce]",
    highlight: "text-[#C084FC]",
    divider: "bg-purple-400/20",
    ctaHover: "hover:border-purple-300/35 hover:bg-purple-400/[0.10] hover:text-purple-100",
  },
  crimson: {
    glow: "radial-gradient(38% 150% at 50% 50%, rgba(217, 83, 111, 0.28) 0%, rgba(159, 18, 57, 0.09) 54%, transparent 100%)",
    mark: "from-[#ffe4e6] via-[#fb7185] to-[#be123c]",
    highlight: "text-[#FB7185]",
    divider: "bg-rose-400/20",
    ctaHover: "hover:border-rose-300/35 hover:bg-rose-400/[0.10] hover:text-rose-100",
  },
  emerald: {
    glow: "radial-gradient(38% 150% at 50% 50%, rgba(16, 185, 129, 0.24) 0%, rgba(5, 150, 105, 0.08) 54%, transparent 100%)",
    mark: "from-[#d1fae5] via-[#34d399] to-[#047857]",
    highlight: "text-[#34D399]",
    divider: "bg-emerald-400/20",
    ctaHover: "hover:border-emerald-300/35 hover:bg-emerald-400/[0.10] hover:text-emerald-100",
  },
}

const HIDDEN_PATH_PREFIXES = ["/admin", "/maintenance", "/staff-login", "/sign-in", "/sign-up"]

function renderHighlightedPromoText(
  text: string,
  highlightText: string,
  highlightClass: string
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
        <span className={cn("font-extrabold", highlightClass)}>{cleanHighlight}</span>
      </>
    )
  }

  const before = cleanText.slice(0, idx)
  const match = cleanText.slice(idx, idx + cleanHighlight.length)
  const after = cleanText.slice(idx + cleanHighlight.length)

  return (
    <>
      {before}
      <span className={cn("font-extrabold", highlightClass)}>{match}</span>
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
  const [dismissed, setDismissed] = useState(false)
  const [nowMs, setNowMs] = useState<number | null>(null)

  const dismissStorageKey = `rushx_top_ad_dismissed_v_${config.version || 1}`

  // Hydration-safe dismiss & live 1-second clock tick
  useEffect(() => {
    setNowMs(Date.now())

    if (!preview && config.dismissible) {
      try {
        if (window.localStorage.getItem(dismissStorageKey) === "1") {
          setDismissed(true)
        } else {
          setDismissed(false)
        }
      } catch {
        setDismissed(false)
      }
    } else {
      setDismissed(false)
    }

    const needsTick = Boolean(config.countdownEnd || config.startsAt || config.endsAt)
    if (!needsTick) return

    const timer = window.setInterval(() => {
      setNowMs(Date.now())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [config.countdownEnd, config.startsAt, config.endsAt, config.dismissible, dismissStorageKey, preview])

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
    try {
      window.localStorage.setItem(dismissStorageKey, "1")
    } catch {
      // Ignore storage errors in private browsing contexts
    }
  }

  const countdownColumns = countdownParts
    ? [
        ...(countdownParts.hasDays ? [{ value: countdownParts.days, label: "Days" }] : []),
        { value: countdownParts.hours, label: "Hours" },
        { value: countdownParts.minutes, label: "Min" },
        { value: countdownParts.seconds, label: "Sec" },
      ]
    : []

  const hasCenterMark = Boolean(config.badge.trim())

  return (
    <AnimatePresence initial={!preview}>
      <motion.div
        key={`top-ad-${config.version}`}
        role="region"
        aria-label="Site announcement"
        initial={prefersReducedMotion || preview ? { opacity: 1, y: 0 } : { opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.42, ease: DEEPCHARTS_EASE }}
        className={cn(
          "relative z-50 w-full border-b border-white/[0.08] bg-[#050507]/96 text-zinc-100 backdrop-blur-xl overflow-hidden",
          preview && "rounded-xl border border-white/[0.09]"
        )}
      >
        {/* Focused DeepCharts-style warm/accent radial glow centered behind the event mark */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: accentStyle.glow }}
          aria-hidden="true"
        />

        <div className="relative mx-auto flex min-h-[44px] max-w-7xl flex-wrap items-center justify-center gap-x-5 gap-y-2 px-4 py-2 sm:px-6 lg:justify-between pr-10 sm:pr-12">
          {/* Left Zone: Sharp Unboxed Promo Copy */}
          <p className="text-center lg:text-left text-[12px] sm:text-[13px] font-bold tracking-[0.025em] text-zinc-100/95 leading-snug text-pretty">
            {renderHighlightedPromoText(
              config.text,
              config.highlightText,
              accentStyle.highlight
            )}
          </p>

          {/* Center Zone: Unboxed Metallic Editorial Event Mark (DeepCharts centerpiece lockup) */}
          {hasCenterMark && (
            <div className="flex shrink-0 items-center gap-3">
              <span
                className={cn("hidden lg:block h-3.5 w-px", accentStyle.divider)}
                aria-hidden="true"
              />
              <span
                className={cn(
                  "font-display text-[15px] sm:text-[17px] font-extrabold tracking-tight leading-none bg-gradient-to-b bg-clip-text text-transparent select-none",
                  accentStyle.mark
                )}
              >
                {config.badge.trim()}
              </span>
              <span
                className={cn("hidden lg:block h-3.5 w-px", accentStyle.divider)}
                aria-hidden="true"
              />
            </div>
          )}

          {/* Right Zone: Stacked Unboxed Tabular Countdown + Understated Hairline Action */}
          {(countdownColumns.length > 0 || safeCtaUrl) && (
            <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-5 gap-y-1.5">
              {countdownColumns.length > 0 && (
                <div
                  className="inline-flex items-center gap-3.5 sm:gap-4"
                  aria-label={countdownAria ? `Ends in ${countdownAria}` : "Countdown active"}
                >
                  {countdownColumns.map((col) => (
                    <div
                      key={col.label}
                      className="flex flex-col items-center justify-center leading-none"
                    >
                      <span className="font-sans text-[15px] sm:text-[16px] font-bold tracking-tight text-white tabular-nums">
                        {col.value}
                      </span>
                      <span className="mt-0.5 text-[9px] font-medium tracking-[0.04em] text-zinc-400">
                        {col.label}
                      </span>
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
                    className={cn(
                      "group inline-flex shrink-0 items-center gap-1 rounded-md border border-white/15 bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold tracking-tight text-zinc-100 transition-all duration-200 active:scale-[0.98]",
                      accentStyle.ctaHover
                    )}
                  >
                    <span>{config.ctaLabel.trim() || "Learn More"}</span>
                    <ChevronRight
                      className="size-3 shrink-0 text-zinc-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-current"
                      aria-hidden="true"
                    />
                  </a>
                ) : (
                  <Link
                    href={safeCtaUrl}
                    className={cn(
                      "group inline-flex shrink-0 items-center gap-1 rounded-md border border-white/15 bg-white/[0.05] px-2.5 py-1 text-[11px] font-semibold tracking-tight text-zinc-100 transition-all duration-200 active:scale-[0.98]",
                      accentStyle.ctaHover
                    )}
                  >
                    <span>{config.ctaLabel.trim() || "Learn More"}</span>
                    <ChevronRight
                      className="size-3 shrink-0 text-zinc-400 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-current"
                      aria-hidden="true"
                    />
                  </Link>
                ))}
            </div>
          )}
        </div>

        {/* Quiet Dismiss Button */}
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
