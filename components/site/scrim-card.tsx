"use client"

import { useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { motion, useReducedMotion } from "motion/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Countdown } from "@/components/site/countdown"
import { bdt, scrimStatus, scrimStartDate } from "@/lib/format"
import { Clock, Users, Trophy, MapPin, Award, ArrowUpRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/language"
import { getRandomScrimImage } from "@/lib/scrim-images"
import { getScrimPrizeBreakdown } from "@/lib/prizepool"
import { useReliableOnceReveal, DEEPCHARTS_EASE } from "@/components/site/reveal"

const toneStyles: Record<string, string> = {
  open: "bg-emerald-500/14 text-emerald-300 border-emerald-400/35",
  filling: "bg-amber-500/14 text-amber-300 border-amber-400/35",
  full: "bg-[#D9536F]/16 text-[#f8a5b5] border-[#D9536F]/45",
  closed: "bg-zinc-500/14 text-zinc-300 border-white/15",
}

const toneDots: Record<string, string> = {
  open: "bg-emerald-400",
  filling: "bg-amber-400",
  full: "bg-[#D9536F]",
  closed: "bg-zinc-400",
}

export type ScrimCardData = {
  slug: string
  title: string
  startTime: string
  scrimDate: string
  priceBdt: number
  prizePoolBdt: number
  maxTeams: number
  confirmedTeams: number
  map: string
  mode: string
  category?: string | null
  registrationOpen: boolean
  status: string
  bannerUrl: string | null
}

export function ScrimCard({
  scrim,
  hideSingleMap = false,
  index = 0,
}: {
  scrim: ScrimCardData
  hideSingleMap?: boolean
  index?: number
}) {
  const { t } = useLanguage()
  const prefersReducedMotion = useReducedMotion()
  const wrapRef = useRef<HTMLDivElement>(null)
  const isVisible = useReliableOnceReveal(wrapRef, prefersReducedMotion, false)

  const status = scrimStatus(
    scrim.confirmedTeams,
    scrim.maxTeams,
    scrim.registrationOpen,
    scrim.status,
    scrim.scrimDate,
    scrim.startTime,
  )
  const remaining = Math.max(0, scrim.maxTeams - scrim.confirmedTeams)
  const fillPercent = Math.min(100, Math.round((scrim.confirmedTeams / Math.max(1, scrim.maxTeams)) * 100))
  const start = scrimStartDate(scrim.scrimDate, scrim.startTime)
  const banner =
    scrim.bannerUrl && !scrim.bannerUrl.includes("map-")
      ? scrim.bannerUrl
      : getRandomScrimImage(scrim.slug || scrim.title)
  const bookable = status.tone === "open" || status.tone === "filling"
  const prizeBreakdown = getScrimPrizeBreakdown(scrim)

  const timeParts = scrim.startTime.trim().split(/\s+/)
  const timeDigits = timeParts[0] || scrim.startTime
  const timePeriod = timeParts[1] ? ` ${timeParts[1]}` : ""

  const translatedStatusLabel =
    status.tone === "open"
      ? t("status_open", "OPEN")
      : status.tone === "filling"
        ? t("status_filling", "FILLING FAST")
        : status.tone === "full"
          ? t("status_full", "FULL")
          : status.label

  const customMapList = (scrim.map || "")
    .replace(/^\d+\s*matches?\s*\((.+)\)$/i, "$1")
    .split(/[,&+/|]+/)
    .map((m) => m.trim())
    .filter(Boolean)

  const isChampionRush =
    scrim.title.toLowerCase().includes("champion rush") || scrim.slug.includes("champion-rush")
  const isFridaySpecial =
    scrim.title.toLowerCase().includes("friday special") || scrim.slug.includes("friday-special")

  const matchesLabel = isChampionRush
    ? "Max 8 Matches"
    : customMapList.length > 1
      ? `${customMapList.length} Maps (${customMapList.slice(0, 3).join(", ")}${customMapList.length > 3 ? "…" : ""})`
      : isFridaySpecial
        ? "5 Matches (All Maps)"
        : hideSingleMap
          ? t("matches_per_scrim", "3 Matches per Scrim")
          : scrim.map || t("matches_per_scrim", "3 Matches per Scrim")

  const modeSubLabel =
    scrim.category ||
    (hideSingleMap && customMapList.length <= 1 ? "Daily Scrim" : scrim.map || "Daily Scrim")

  function handlePointerMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = wrapRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = Math.round(e.clientX - rect.left)
    const y = Math.round(e.clientY - rect.top)
    el.style.setProperty("--splash-x", `${x}px`)
    el.style.setProperty("--splash-y", `${y}px`)
  }

  function handlePointerLeave() {
    const el = wrapRef.current
    if (!el) return
    el.style.setProperty("--splash-x", "50%")
    el.style.setProperty("--splash-y", "35%")
  }

  const staggerDelay = Math.min(index, 7) * 0.095

  return (
    <motion.div
      ref={wrapRef}
      onMouseMove={handlePointerMove}
      onMouseLeave={handlePointerLeave}
      initial={
        prefersReducedMotion
          ? { opacity: 1, y: 0, scale: 1 }
          : { opacity: 0, y: 24, scale: 0.976 }
      }
      animate={
        isVisible || prefersReducedMotion
          ? { opacity: 1, y: 0, scale: 1 }
          : { opacity: 0, y: 24, scale: 0.976 }
      }
      transition={{
        duration: prefersReducedMotion ? 0 : 0.68,
        delay: prefersReducedMotion ? 0 : staggerDelay,
        ease: DEEPCHARTS_EASE,
      }}
      className="scrim-splash-wrap group relative flex flex-col"
    >
      {/* Dynamic outer hover splash layers (RandomQbit-inspired diffused outer halo + crisp edge bloom) */}
      <div className="scrim-splash-aura" aria-hidden />
      <div className="scrim-splash-ring" aria-hidden />

      <article className="dc-surface relative z-10 flex h-full flex-col overflow-hidden rounded-2xl transition-transform duration-300 ease-out group-hover:-translate-y-1">
        {/* Top-edge precision accent beam (DeepCharts signature sheen) */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px bg-gradient-to-r from-transparent via-primary/65 to-transparent opacity-65 transition-opacity duration-300 group-hover:opacity-100"
          aria-hidden
        />

        <Link
          href={`/scrims/${scrim.slug}`}
          className="absolute inset-0 z-10"
          aria-label={`View ${scrim.title}`}
        />

        {/* Banner Media Header */}
        <div className="relative h-44 w-full overflow-hidden bg-[#080b15]">
          <Image
            src={banner || getRandomScrimImage(scrim.slug || scrim.title || "scrim")}
            alt={`${scrim.title} banner`}
            fill
            referrerPolicy="no-referrer"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b1020] via-[#0b1020]/50 to-black/20" />

          {/* Status & Countdown Bar */}
          <div className="absolute inset-x-3.5 top-3.5 flex items-center justify-between gap-2">
            <Badge
              variant="outline"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold tracking-wide backdrop-blur-md shadow-sm",
                toneStyles[status.tone]
              )}
            >
              <span className={cn("size-1.5 rounded-full", toneDots[status.tone])} aria-hidden />
              {translatedStatusLabel}
            </Badge>

            <Badge
              variant="outline"
              className="rounded-lg border border-white/12 bg-[#070a14]/82 px-2.5 py-1 font-mono text-[11px] font-semibold text-foreground/95 tabular-nums backdrop-blur-md shadow-sm"
            >
              <Countdown targetIso={start.toISOString()} />
            </Badge>
          </div>

          {/* Bottom-left Category Tag */}
          {scrim.category && (
            <div className="absolute bottom-3 left-3.5">
              <span className="inline-flex items-center rounded-md border border-white/10 bg-[#070a14]/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-200 backdrop-blur-md">
                {scrim.category}
              </span>
            </div>
          )}
        </div>

        {/* Card Body */}
        <div className="flex flex-1 flex-col justify-between gap-4 p-5">
          {/* Title + Start Time + Entry Fee */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-display text-[1.15rem] font-semibold leading-snug tracking-tight text-foreground transition-colors group-hover:text-primary text-balance">
                {scrim.title}
              </h3>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[13px] font-semibold text-muted-foreground">
                <Clock className="size-3.5 shrink-0 text-primary/90" aria-hidden />
                <span className="tabular-nums text-foreground/95">
                  {timeDigits}
                  {timePeriod}
                </span>
                <span className="text-white/25">·</span>
                <span className="truncate">{matchesLabel}</span>
              </p>
            </div>

            <div className="shrink-0 rounded-xl border border-primary/25 bg-gradient-to-b from-primary/[0.12] to-primary/[0.04] px-3 py-1.5 text-right">
              <p className="font-display text-lg font-semibold leading-none text-primary tabular-nums">
                {scrim.priceBdt === 0 ? "FREE" : bdt(scrim.priceBdt)}
              </p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {scrim.priceBdt === 0 ? "free entry" : t("price_label", "per team")}
              </p>
            </div>
          </div>

          {/* 3-Column DeepCharts Metric Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="dc-metric-cell rounded-xl px-2.5 py-2.5 text-center">
              <Trophy className="mx-auto mb-1 size-3.5 text-primary" aria-hidden />
              <p className="text-[12px] font-semibold tabular-nums text-foreground truncate">
                {scrim.prizePoolBdt === 0 ? "Practice" : bdt(scrim.prizePoolBdt)}
              </p>
              <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
                {t("prize_label", "Prize Pool")}
              </p>
            </div>

            <div className="dc-metric-cell rounded-xl px-2.5 py-2.5 text-center">
              <MapPin className="mx-auto mb-1 size-3.5 text-accent" aria-hidden />
              <p
                className="text-[11px] font-semibold uppercase tracking-wide text-accent truncate"
                title={scrim.mode}
              >
                {scrim.mode || "BATTLE ROYALE"}
              </p>
              <p
                className="mt-0.5 text-[10px] font-semibold text-muted-foreground truncate"
                title={modeSubLabel}
              >
                {modeSubLabel}
              </p>
            </div>

            <div className="dc-metric-cell rounded-xl px-2.5 py-2.5 text-center">
              <Users className="mx-auto mb-1 size-3.5 text-accent" aria-hidden />
              <p className="text-[12px] font-semibold tabular-nums text-foreground">
                {scrim.confirmedTeams}/{scrim.maxTeams}
              </p>
              <p className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
                {t("team_slots", "Teams")}
              </p>
            </div>
          </div>

          {/* Prize Distribution Breakdown */}
          <div className="dc-metric-cell rounded-xl p-3">
            <div className="mb-2 flex items-center justify-between text-[11px] font-semibold">
              <span className="flex items-center gap-1.5 text-accent">
                <Award className="size-3.5 text-accent" aria-hidden />
                Prize Breakdown
              </span>
              <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                Pool: {bdt(prizeBreakdown.totalPrizeBdt)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {prizeBreakdown.places.map((p) => (
                <span
                  key={p.rank}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold tabular-nums",
                    p.rank === 1
                      ? "border-amber-400/30 bg-amber-500/14 text-amber-200"
                      : p.rank === 2
                        ? "border-slate-300/25 bg-slate-400/10 text-slate-200"
                        : p.rank === 3
                          ? "border-violet-400/30 bg-violet-500/14 text-violet-200"
                          : "border-white/10 bg-white/[0.04] text-muted-foreground"
                  )}
                >
                  <span className="opacity-75">{p.place}:</span>
                  <span className="text-foreground">{bdt(p.prizeBdt)}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Slot Availability Progress */}
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs tabular-nums">
              <span className="font-semibold text-foreground/90">
                <span className="text-accent">{remaining}</span>{" "}
                <span className="text-muted-foreground">{t("slots_left", "spots left")}</span>
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">{fillPercent}% filled</span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-white/[0.07] ring-1 ring-white/[0.05]"
              role="progressbar"
              aria-valuenow={scrim.confirmedTeams}
              aria-valuemin={0}
              aria-valuemax={scrim.maxTeams}
              aria-label="Slots filled"
            >
              <motion.div
                initial={{ width: prefersReducedMotion ? `${fillPercent}%` : 0 }}
                animate={{ width: `${fillPercent}%` }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.64, ease: DEEPCHARTS_EASE }}
                className={cn(
                  "h-full rounded-full",
                  status.tone === "full"
                    ? "bg-rose-500"
                    : status.tone === "filling"
                      ? "bg-amber-400"
                      : ""
                )}
                style={
                  status.tone !== "full" && status.tone !== "filling"
                    ? {
                        background:
                          "linear-gradient(90deg, rgb(var(--rushx-primary-rgb)) 0%, rgb(var(--rushx-accent-rgb)) 100%)",
                      }
                    : undefined
                }
              />
            </div>
          </div>

          {/* Action CTA */}
          <div className="relative z-20 pt-0.5">
            {bookable ? (
              <Button
                asChild
                className="h-10 w-full rounded-xl font-semibold tracking-tight transition-all duration-200 glow-primary button-shimmer hover:-translate-y-0.5 active:scale-[0.98]"
                variant="default"
              >
                <Link href={`/book/${scrim.slug}`} className="inline-flex items-center justify-center gap-1.5">
                  <span>{t("book_now", "Book Spot")}</span>
                  <ArrowUpRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
              </Button>
            ) : (
              <Button
                disabled
                className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.04] font-semibold text-muted-foreground opacity-85 cursor-not-allowed"
                variant="secondary"
              >
                {scrim.status === "not_hosted"
                  ? t("status_registration_closed", "Registration Closed")
                  : status.tone === "full"
                    ? t("status_full", "Lobby Full")
                    : t("status_registration_closed", "Registration Closed")}
              </Button>
            )}
          </div>
        </div>
      </article>
    </motion.div>
  )
}
