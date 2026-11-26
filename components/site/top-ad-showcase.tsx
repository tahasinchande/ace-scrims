"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence, useReducedMotion } from "motion/react"
import { ArrowRight, Megaphone, X } from "lucide-react"
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
    bar: string
    sheen: string
    badge: string
    dot: string
    highlight: string
    chip: string
    chipUnit: string
    colon: string
    cta: string
    glowLine: string
  }
> = {
  amber: {
    bar: "border-amber-400/25 bg-[#0d0a06]/96",
    sheen:
      "radial-gradient(65% 180% at 50% 0%, rgba(245, 158, 11, 0.17) 0%, rgba(180, 83, 9, 0.06) 55%, transparent 100%)",
    badge: "border-amber-400/45 bg-amber-500/18 text-amber-200 shadow-[0_0_16px_rgba(245,158,11,0.16)]",
    dot: "bg-amber-400",
    highlight: "text-amber-300",
    chip: "border-amber-400/28 bg-[#1b1409]/95 text-amber-100",
    chipUnit: "text-amber-300/75",
    colon: "text-amber-400/65",
    cta: "border-amber-300/50 bg-gradient-to-r from-amber-400 to-amber-500 text-zinc-950 hover:from-amber-300 hover:to-amber-400 shadow-[0_6px_18px_-6px_rgba(245,158,11,0.65)]",
    glowLine: "from-transparent via-amber-400/85 to-transparent",
  },
  blue: {
    bar: "border-blue-400/28 bg-[#050a18]/96",
    sheen:
      "radial-gradient(65% 180% at 50% 0%, rgba(31, 115, 255, 0.22) 0%, rgba(56, 189, 248, 0.08) 55%, transparent 100%)",
    badge: "border-blue-400/45 bg-blue-500/20 text-blue-100 shadow-[0_0_16px_rgba(31,115,255,0.22)]",
    dot: "bg-sky-400",
    highlight: "text-sky-300",
    chip: "border-blue-400/30 bg-[#08132b]/95 text-blue-50",
    chipUnit: "text-sky-300/80",
    colon: "text-sky-400/65",
    cta: "border-sky-300/45 bg-gradient-to-r from-[#1f73ff] to-[#38bdf8] text-white hover:brightness-110 shadow-[0_6px_18px_-6px_rgba(31,115,255,0.72)]",
    glowLine: "from-transparent via-sky-400/85 to-transparent",
  },
  cyan: {
    bar: "border-cyan-400/28 bg-[#050e17]/96",
    sheen:
      "radial-gradient(65% 180% at 50% 0%, rgba(6, 182, 212, 0.20) 0%, rgba(34, 211, 238, 0.06) 55%, transparent 100%)",
    badge: "border-cyan-400/45 bg-cyan-500/20 text-cyan-100",
    dot: "bg-cyan-400",
    highlight: "text-cyan-300",
    chip: "border-cyan-400/30 bg-[#071926]/95 text-cyan-50",
    chipUnit: "text-cyan-300/80",
    colon: "text-cyan-400/65",
    cta: "border-cyan-300/45 bg-gradient-to-r from-cyan-400 to-sky-400 text-slate-950 hover:brightness-105 shadow-[0_6px_18px_-6px_rgba(34,211,238,0.62)]",
    glowLine: "from-transparent via-cyan-400/85 to-transparent",
  },
  violet: {
    bar: "border-[#9B5DE5]/30 bg-[#0a0714]/96",
    sheen:
      "radial-gradient(65% 180% at 50% 0%, rgba(139, 92, 246, 0.22) 0%, rgba(107, 47, 168, 0.08) 55%, transparent 100%)",
    badge: "border-[#9B5DE5]/45 bg-[#6B2FA8]/30 text-[#efe4ff]",
    dot: "bg-[#c084fc]",
    highlight: "text-[#d8b4fe]",
    chip: "border-[#8C44D4]/32 bg-[#160d29]/95 text-[#f3e8ff]",
    chipUnit: "text-[#c4b5fd]/80",
    colon: "text-[#a78bfa]/70",
    cta: "border-[#c084fc]/45 bg-gradient-to-r from-[#7c3aed] to-[#9b5de5] text-white hover:brightness-110 shadow-[0_6px_18px_-6px_rgba(139,92,246,0.68)]",
    glowLine: "from-transparent via-[#a855f7]/85 to-transparent",
  },
  crimson: {
    bar: "border-[#D9536F]/32 bg-[#12070c]/96",
    sheen:
      "radial-gradient(65% 180% at 50% 0%, rgba(217, 83, 111, 0.22) 0%, rgba(159, 18, 57, 0.08) 55%, transparent 100%)",
    badge: "border-[#D9536F]/50 bg-[#D9536F]/22 text-[#ffe4e6]",
    dot: "bg-[#fb7185]",
    highlight: "text-[#fda4af]",
    chip: "border-[#D9536F]/35 bg-[#220c14]/95 text-[#ffe4e6]",
    chipUnit: "text-[#fda4af]/80",
    colon: "text-[#fb7185]/70",
    cta: "border-rose-300/45 bg-gradient-to-r from-[#e11d48] to-[#f43f5e] text-white hover:brightness-110 shadow-[0_6px_18px_-6px_rgba(244,63,94,0.65)]",
    glowLine: "from-transparent via-[#fb7185]/85 to-transparent",
  },
  emerald: {
    bar: "border-emerald-400/28 bg-[#06110d]/96",
    sheen:
      "radial-gradient(65% 180% at 50% 0%, rgba(16, 185, 129, 0.20) 0%, rgba(5, 150, 105, 0.06) 55%, transparent 100%)",
    badge: "border-emerald-400/45 bg-emerald-500/20 text-emerald-100",
    dot: "bg-emerald-400",
    highlight: "text-emerald-300",
    chip: "border-emerald-400/30 bg-[#081d16]/95 text-emerald-50",
    chipUnit: "text-emerald-300/80",
    colon: "text-emerald-400/65",
    cta: "border-emerald-300/45 bg-gradient-to-r from-emerald-400 to-teal-400 text-zinc-950 hover:brightness-105 shadow-[0_6px_18px_-6px_rgba(16,185,129,0.62)]",
    glowLine: "from-transparent via-emerald-400/85 to-transparent",
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
        <strong className={cn("font-bold", highlightClass)}>{cleanHighlight}</strong>
      </>
    )
  }

  const before = cleanText.slice(0, idx)
  const match = cleanText.slice(idx, idx + cleanHighlight.length)
  const after = cleanText.slice(idx + cleanHighlight.length)

  return (
    <>
      {before}
      <strong className={cn("font-bold", highlightClass)}>{match}</strong>
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

  const countdownSegments = countdownParts
    ? [
        ...(countdownParts.hasDays ? [{ value: countdownParts.days, unit: "d" }] : []),
        { value: countdownParts.hours, unit: "h" },
        { value: countdownParts.minutes, unit: "m" },
        { value: countdownParts.seconds, unit: "s" },
      ]
    : []

  return (
    <AnimatePresence initial={!preview}>
      <motion.div
        key={`top-ad-${config.version}`}
        role="region"
        aria-label="Site announcement"
        initial={prefersReducedMotion || preview ? { opacity: 1, y: 0 } : { opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.36, ease: DEEPCHARTS_EASE }}
        className={cn(
          "relative z-50 w-full border-b backdrop-blur-2xl transition-colors duration-200 overflow-hidden",
          accentStyle.bar,
          preview && "rounded-xl border"
        )}
      >
        {/* DeepCharts-style radial luminous sheen */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: accentStyle.sheen }}
          aria-hidden="true"
        />

        {/* Subtle top shimmer accent hairline */}
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r",
            accentStyle.glowLine
          )}
          aria-hidden="true"
        />

        <div className="relative mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-3 gap-y-2 px-4 py-2 sm:px-6 pr-10 sm:pr-12">
          {/* Highlighted Keyword / Badge */}
          {config.badge.trim() ? (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.09em]",
                accentStyle.badge
              )}
            >
              <span className={cn("size-1.5 rounded-full animate-pulse", accentStyle.dot)} aria-hidden="true" />
              {config.badge.trim()}
            </span>
          ) : (
            <Megaphone className="size-3.5 shrink-0 text-slate-300" aria-hidden="true" />
          )}

          {/* Promo / Announcement Text with DeepCharts-style inline highlighted phrase */}
          <p className="text-center text-xs sm:text-[13px] font-medium text-slate-100/95 leading-snug text-pretty">
            {renderHighlightedPromoText(
              config.text,
              config.highlightText,
              accentStyle.highlight
            )}
          </p>

          {/* DeepCharts-style Segmented Tabular Countdown Boxes */}
          {countdownSegments.length > 0 && (
            <div
              className="inline-flex shrink-0 items-center gap-1 font-mono text-[11px] font-semibold tabular-nums"
              aria-label={countdownAria ? `Ends in ${countdownAria}` : "Countdown active"}
            >
              {countdownSegments.map((seg, i) => (
                <span key={seg.unit} className="inline-flex items-center gap-1">
                  <span
                    className={cn(
                      "inline-flex items-baseline gap-0.5 rounded-md border px-1.5 py-0.5 leading-none shadow-inner",
                      accentStyle.chip
                    )}
                  >
                    <span>{seg.value}</span>
                    <span className={cn("text-[9px] font-bold uppercase", accentStyle.chipUnit)}>
                      {seg.unit}
                    </span>
                  </span>
                  {i < countdownSegments.length - 1 && (
                    <span className={cn("text-[10px] font-bold", accentStyle.colon)} aria-hidden="true">
                      :
                    </span>
                  )}
                </span>
              ))}
            </div>
          )}

          {/* Compact High-Contrast Action CTA Link */}
          {safeCtaUrl && (
            isExternalCta ? (
              <a
                href={safeCtaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "group inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold tracking-tight transition-all duration-200 hover:-translate-y-px active:scale-[0.97]",
                  accentStyle.cta
                )}
              >
                <span>{config.ctaLabel.trim() || "Learn More"}</span>
                <ArrowRight className="size-3 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
              </a>
            ) : (
              <Link
                href={safeCtaUrl}
                className={cn(
                  "group inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold tracking-tight transition-all duration-200 hover:-translate-y-px active:scale-[0.97]",
                  accentStyle.cta
                )}
              >
                <span>{config.ctaLabel.trim() || "Learn More"}</span>
                <ArrowRight className="size-3 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            )
          )}
        </div>

        {/* Dismiss Button */}
        {config.dismissible && !preview && (
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss announcement"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 flex size-6 items-center justify-center rounded-md text-slate-400 hover:bg-white/[0.08] hover:text-white transition-colors duration-150 cursor-pointer"
          >
            <X className="size-3.5" />
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
