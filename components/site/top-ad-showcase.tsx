"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence, useReducedMotion } from "motion/react"
import { ArrowUpRight, Clock, Megaphone, Sparkles, X } from "lucide-react"
import {
  formatTopAdCountdown,
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
    badge: string
    dot: string
    timer: string
    cta: string
    glowLine: string
  }
> = {
  violet: {
    bar: "border-[#8C44D4]/30 bg-[#0a0714]/92",
    badge: "border-[#9B5DE5]/45 bg-[#6B2FA8]/30 text-[#e4d4ff]",
    dot: "bg-[#9B5DE5]",
    timer: "border-[#8C44D4]/30 bg-[#140d26]/90 text-[#d8b4fe]",
    cta: "border-[#9B5DE5]/40 bg-[#8C44D4]/22 text-[#f3e8ff] hover:bg-[#8C44D4]/38 hover:border-[#9B5DE5]/65",
    glowLine: "from-transparent via-[#9B5DE5]/70 to-transparent",
  },
  cyan: {
    bar: "border-cyan-400/30 bg-[#050d17]/92",
    badge: "border-cyan-400/45 bg-cyan-500/20 text-cyan-200",
    dot: "bg-cyan-400",
    timer: "border-cyan-400/30 bg-[#071828]/90 text-cyan-200",
    cta: "border-cyan-400/40 bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/35 hover:border-cyan-300/65",
    glowLine: "from-transparent via-cyan-400/75 to-transparent",
  },
  crimson: {
    bar: "border-[#D9536F]/35 bg-[#12070c]/92",
    badge: "border-[#D9536F]/50 bg-[#D9536F]/22 text-[#fecdd3]",
    dot: "bg-[#D9536F]",
    timer: "border-[#D9536F]/35 bg-[#200c14]/90 text-[#fda4af]",
    cta: "border-[#D9536F]/45 bg-[#D9536F]/24 text-[#ffe4e6] hover:bg-[#D9536F]/38 hover:border-[#D9536F]/70",
    glowLine: "from-transparent via-[#D9536F]/75 to-transparent",
  },
  amber: {
    bar: "border-amber-400/30 bg-[#120e07]/92",
    badge: "border-amber-400/45 bg-amber-500/20 text-amber-200",
    dot: "bg-amber-400",
    timer: "border-amber-400/30 bg-[#1f1709]/90 text-amber-200",
    cta: "border-amber-400/40 bg-amber-500/20 text-amber-100 hover:bg-amber-500/35 hover:border-amber-300/65",
    glowLine: "from-transparent via-amber-400/75 to-transparent",
  },
  emerald: {
    bar: "border-emerald-400/30 bg-[#06110d]/92",
    badge: "border-emerald-400/45 bg-emerald-500/20 text-emerald-200",
    dot: "bg-emerald-400",
    timer: "border-emerald-400/30 bg-[#081c15]/90 text-emerald-200",
    cta: "border-emerald-400/40 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/35 hover:border-emerald-300/65",
    glowLine: "from-transparent via-emerald-400/75 to-transparent",
  },
}

const HIDDEN_PATH_PREFIXES = ["/admin", "/maintenance", "/staff-login", "/sign-in", "/sign-up"]

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

  const accentStyle = ACCENT_STYLES[config.accent] || ACCENT_STYLES.violet
  const safeCtaUrl =
    config.ctaUrl && isSafeHttpOrRelativeUrl(config.ctaUrl) ? config.ctaUrl.trim() : ""
  const isExternalCta = safeCtaUrl.startsWith("http://") || safeCtaUrl.startsWith("https://")

  const countdownMs =
    config.countdownEnd && nowMs !== null ? Date.parse(config.countdownEnd) - nowMs : NaN
  const countdownText =
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

  return (
    <AnimatePresence initial={!preview}>
      <motion.div
        key={`top-ad-${config.version}`}
        role="region"
        aria-label="Site announcement"
        initial={prefersReducedMotion || preview ? { opacity: 1, y: 0 } : { opacity: 0.94, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.26, ease: DEEPCHARTS_EASE }}
        className={cn(
          "relative z-50 w-full border-b backdrop-blur-xl transition-colors duration-200",
          accentStyle.bar,
          preview && "rounded-xl border overflow-hidden"
        )}
      >
        {/* Subtle top shimmer accent line */}
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r",
            accentStyle.glowLine
          )}
          aria-hidden="true"
        />

        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-3 gap-y-1.5 px-4 py-2 sm:px-6 pr-10 sm:pr-12">
          {/* Highlighted Keyword / Badge */}
          {config.badge.trim() ? (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                accentStyle.badge
              )}
            >
              <span className={cn("size-1.5 rounded-full animate-pulse", accentStyle.dot)} aria-hidden="true" />
              {config.badge.trim()}
            </span>
          ) : (
            <Megaphone className="size-3.5 shrink-0 text-slate-300" aria-hidden="true" />
          )}

          {/* Promo / Announcement Text */}
          <p className="text-center text-xs sm:text-[13px] font-medium text-slate-100 leading-snug text-pretty">
            {config.text.trim()}
          </p>

          {/* Optional Live Tabular Countdown Timer */}
          {countdownText && (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums tracking-tight",
                accentStyle.timer
              )}
              aria-label={`Ends in ${countdownText}`}
            >
              <Clock className="size-3 shrink-0 opacity-85" aria-hidden="true" />
              <span>{countdownText}</span>
            </span>
          )}

          {/* Optional Validated CTA Destination Link */}
          {safeCtaUrl && (
            isExternalCta ? (
              <a
                href={safeCtaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-0.5 text-[11px] font-semibold transition-all duration-200",
                  accentStyle.cta
                )}
              >
                <Sparkles className="size-3 shrink-0" aria-hidden="true" />
                <span>{config.ctaLabel.trim() || "Learn More"}</span>
                <ArrowUpRight className="size-3 shrink-0" aria-hidden="true" />
              </a>
            ) : (
              <Link
                href={safeCtaUrl}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-0.5 text-[11px] font-semibold transition-all duration-200",
                  accentStyle.cta
                )}
              >
                <Sparkles className="size-3 shrink-0" aria-hidden="true" />
                <span>{config.ctaLabel.trim() || "Learn More"}</span>
                <ArrowUpRight className="size-3 shrink-0" aria-hidden="true" />
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
