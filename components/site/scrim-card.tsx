"use client"

import Link from "next/link"
import Image from "next/image"
import { motion } from "motion/react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Countdown } from "@/components/site/countdown"
import { bdt, scrimStatus, scrimStartDate } from "@/lib/format"
import { Clock, Users, Trophy, MapPin, Award } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/language"
import { getRandomScrimImage } from "@/lib/scrim-images"
import { getScrimPrizeBreakdown } from "@/lib/prizepool"

const toneStyles: Record<string, string> = {
  open: "bg-success/15 text-success border-success/30",
  filling: "bg-warning/15 text-warning border-warning/30",
  full: "bg-destructive/15 text-destructive border-destructive/30",
  closed: "bg-muted text-muted-foreground border-border",
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

export function ScrimCard({ scrim }: { scrim: ScrimCardData }) {
  const { t } = useLanguage()
  const status = scrimStatus(
    scrim.confirmedTeams,
    scrim.maxTeams,
    scrim.registrationOpen,
    scrim.status,
    scrim.scrimDate,
    scrim.startTime,
  )
  const remaining = Math.max(0, scrim.maxTeams - scrim.confirmedTeams)
  const start = scrimStartDate(scrim.scrimDate, scrim.startTime)
  const banner = scrim.bannerUrl && !scrim.bannerUrl.includes("map-") 
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

  const matchesLabel =
    scrim.title.toLowerCase().includes("champion rush") || scrim.slug.includes("champion-rush")
      ? "Max 8 Matches"
      : customMapList.length > 1
        ? `${customMapList.length} Maps (${customMapList.slice(0, 3).join(", ")}${customMapList.length > 3 ? "…" : ""})`
        : scrim.title.toLowerCase().includes("friday special") || scrim.slug.includes("friday-special")
          ? "5 Matches (All Maps)"
          : scrim.map || t("matches_per_scrim", "3 Matches per Scrim")

  return (
    <motion.article
      initial={{ opacity: 0, y: 30, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.4, type: "spring", stiffness: 200 }}
      whileHover={{ y: -4 }}
      className="group glass relative overflow-hidden rounded-2xl border border-border/75 shadow-xl shadow-black/35 transition-all duration-300 hover:shadow-primary/15 hover:border-primary/50"
    >
      <Link href={`/scrims/${scrim.slug}`} className="absolute inset-0 z-10" aria-label={`View ${scrim.title}`} />

      <div className="relative h-44 overflow-hidden bg-muted/40">
        <Image
          src={banner || getRandomScrimImage(scrim.slug || scrim.title || "scrim")}
          alt={`${scrim.map} map`}
          fill
          unoptimized
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, 33vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/30 to-black/25" />
        <div className="absolute left-4 top-4 flex gap-2">
          <Badge variant="outline" className={cn("border font-semibold shadow-sm backdrop-blur-md", toneStyles[status.tone])}>
            {translatedStatusLabel}
          </Badge>
        </div>
        <div className="absolute right-4 top-4">
          <Badge variant="outline" className="glass border-border/80 font-mono text-xs tabular-nums shadow-sm">
            <Countdown targetIso={start.toISOString()} />
          </Badge>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold leading-tight tracking-wide text-balance group-hover:text-primary transition-colors">{scrim.title}</h3>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="size-3.5 shrink-0 text-primary/80" aria-hidden />
              <span className="tabular-nums">
                <span className="font-bold text-foreground">{timeDigits}</span>
                {timePeriod}
              </span>
              {" · "}
              {matchesLabel}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-display text-xl font-bold text-primary tabular-nums">
              {scrim.priceBdt === 0 ? "FREE" : bdt(scrim.priceBdt)}
            </p>
            <p className="text-[11px] font-medium text-muted-foreground">
              {scrim.priceBdt === 0 ? "free entry" : t("price_label", "per team")}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border border-border/50 bg-secondary/50 px-2 py-2">
            <Trophy className="mx-auto mb-1 size-4 text-primary" aria-hidden />
            <p className="text-xs font-bold tabular-nums text-foreground">
              {scrim.prizePoolBdt === 0 ? "Fun / Practice" : bdt(scrim.prizePoolBdt)}
            </p>
            <p className="text-[10px] text-muted-foreground">{t("prize_label", "Prize Pool")}</p>
          </div>
          <div className="rounded-lg border border-border/50 bg-secondary/50 px-2 py-2">
            <MapPin className="mx-auto mb-1 size-4 text-accent" aria-hidden />
            <p className="text-xs font-bold uppercase tracking-wider text-accent truncate" title={scrim.mode}>
              {scrim.mode || "BATTLE ROYALE"}
            </p>
            <p className="text-[10px] text-muted-foreground truncate" title={scrim.category || scrim.map}>
              {scrim.category || scrim.map}
            </p>
          </div>
          <div className="rounded-lg border border-border/50 bg-secondary/50 px-2 py-2">
            <Users className="mx-auto mb-1 size-4 text-info" aria-hidden />
            <p className="text-xs font-bold tabular-nums text-foreground">
              {scrim.confirmedTeams}/{scrim.maxTeams}
            </p>
            <p className="text-[10px] text-muted-foreground">{t("team_slots", "Teams")}</p>
          </div>
        </div>

        {/* Prize Distribution Breakdown */}
        <div className="rounded-xl border border-border/60 bg-secondary/35 p-2.5">
          <div className="flex items-center justify-between text-[11px] mb-1.5 font-semibold">
            <span className="flex items-center gap-1 text-amber-400">
              <Award className="size-3.5" />
              Prize Breakdown
            </span>
            <span className="text-muted-foreground font-mono text-[10px] tabular-nums">
              Pool: {bdt(prizeBreakdown.totalPrizeBdt)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {prizeBreakdown.places.map((p) => (
              <span
                key={p.rank}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                  p.rank === 1
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    : p.rank === 2
                    ? "bg-zinc-400/15 text-zinc-300 border border-zinc-400/25"
                    : p.rank === 3
                    ? "bg-amber-700/20 text-amber-400 border border-amber-700/30"
                    : "bg-secondary text-muted-foreground border border-border/50"
                )}
              >
                <span className="opacity-75">{p.place}:</span>
                <span className="font-bold text-foreground">{bdt(p.prizeBdt)}</span>
              </span>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs tabular-nums">
            <span className="font-bold text-accent">{remaining} {t("slots_left", "spots left")}</span>
            <span className="text-muted-foreground font-mono text-[11px]">{Math.round((scrim.confirmedTeams / scrim.maxTeams) * 100)}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-md bg-secondary/90 border border-border/40" role="progressbar" aria-valuenow={scrim.confirmedTeams} aria-valuemin={0} aria-valuemax={scrim.maxTeams} aria-label="Slots filled">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (scrim.confirmedTeams / scrim.maxTeams) * 100)}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
              className={cn(
                "h-full rounded-md",
                status.tone === "full" ? "bg-destructive" : status.tone === "filling" ? "bg-warning" : "bg-primary",
              )}
            />
          </div>
        </div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          className="relative z-20"
        >
          {bookable ? (
            <Button
              asChild
              className="h-10 w-full font-semibold transition-all duration-300 glow-primary button-shimmer"
              variant="default"
            >
              <Link href={`/book/${scrim.slug}`}>
                {t("book_now", "Book Spot")}
              </Link>
            </Button>
          ) : (
            <Button
              disabled
              className="h-10 w-full font-semibold opacity-80 cursor-not-allowed"
              variant="secondary"
            >
              {scrim.status === "not_hosted"
                ? t("status_registration_closed", "Registration Closed")
                : status.tone === "full"
                ? t("status_full", "Lobby Full")
                : t("status_registration_closed", "Registration Closed")}
            </Button>
          )}
        </motion.div>
      </div>
    </motion.article>
  )
}
