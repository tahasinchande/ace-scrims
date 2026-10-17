"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { formatTaka, formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Trophy, Crosshair, Medal, ExternalLink, Clock, ChevronDown, ChevronUp, Swords } from "lucide-react"
import { useLanguage } from "@/lib/language"
import { resolveImageUrl, resolveImageUrls } from "@/lib/image-url"
import type { MatchResult } from "@/lib/db/schema"
import type { ResultWithScrim } from "@/lib/queries/results"

type LeaderboardEntry = {
  teamName: string
  wins: number
  totalKills: number
  totalPrizeBdt: number
}

type ScrimSector = {
  id: string
  title: string
  startTime: string
  map: string
}

const medalColor = ["text-primary", "text-muted-foreground", "text-chart-3"]

export function ResultsView({
  recent,
  scrimSectors = [],
  leaderboard,
}: {
  recent: ResultWithScrim[]
  scrimSectors?: ScrimSector[]
  leaderboard: LeaderboardEntry[]
}) {
  const { lang, t } = useLanguage()
  const isBn = lang === "bn"
  const [showAllSectors, setShowAllSectors] = useState(false)

  // Fallback 12 default scrim sectors if none passed
  const sectors: ScrimSector[] = scrimSectors.length > 0 ? scrimSectors : [
    { id: "scrim-7pm-r1", title: "7 PM SCRIM ROOM 1", startTime: "7:00 PM", map: "Bermuda" },
    { id: "scrim-7pm-r2", title: "7 PM SCRIM ROOM 2", startTime: "7:00 PM", map: "Purgatory" },
    { id: "scrim-8pm-r1", title: "8 PM SCRIM ROOM 1", startTime: "8:00 PM", map: "Kalahari" },
    { id: "scrim-8pm-r2", title: "8 PM SCRIM ROOM 2", startTime: "8:00 PM", map: "Bermuda" },
    { id: "scrim-9pm-r1", title: "9 PM SCRIM ROOM 1", startTime: "9:00 PM", map: "Purgatory" },
    { id: "scrim-9pm-r2", title: "9 PM SCRIM ROOM 2", startTime: "9:00 PM", map: "Kalahari" },
    { id: "scrim-10pm-r1", title: "10 PM SCRIM ROOM 1", startTime: "10:00 PM", map: "Bermuda" },
    { id: "scrim-10pm-r2", title: "10 PM SCRIM ROOM 2", startTime: "10:00 PM", map: "Purgatory" },
    { id: "scrim-11pm-r1", title: "11 PM SCRIM ROOM 1", startTime: "11:00 PM", map: "Kalahari" },
    { id: "scrim-11pm-r2", title: "11 PM SCRIM ROOM 2", startTime: "11:00 PM", map: "Bermuda" },
    { id: "scrim-12am-r1", title: "12 AM SCRIM ROOM 1", startTime: "12:00 AM", map: "Purgatory" },
    { id: "scrim-12am-r2", title: "12 AM SCRIM ROOM 2", startTime: "12:00 AM", map: "Kalahari" },
  ]

  const visibleSectors = showAllSectors ? sectors : sectors.slice(0, 6)

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 md:px-6">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-display text-sm font-semibold uppercase tracking-widest text-primary">
            {t("results_eyebrow", "PROVED WINNERS")}
          </p>
          <h1 className="font-display text-3xl font-bold uppercase tracking-wide text-balance md:text-4xl">
            {t("results_title", "Match Results & Leaderboard")}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {t("results_subtitle", "Daily Scrim sectors organized by match slot with verified screenshot proofs.")}
          </p>
        </div>

        <Link
          href="/scrims"
          className="glow-primary inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 font-display text-sm font-bold uppercase text-primary-foreground transition-transform hover:scale-105"
        >
          <Swords className="size-4" />
          <span>{isBn ? "স্ক্রিমসমূহ ব্রাউজ করুন" : "Browse Scrims"}</span>
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
        {/* Scrim Sectors Column */}
        <section aria-label="Scrim match sectors" className="flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-border/80 pb-3">
            <h2 className="font-display text-xl font-bold uppercase tracking-wide flex items-center gap-2">
              <Trophy className="size-5 text-primary" />
              {isBn ? "ফলাফল সেক্টরসমূহ" : "Daily Scrim Results Sectors"}
            </h2>
            <Badge variant="outline" className="border-primary/40 text-primary font-bold">
              {sectors.length} {isBn ? "টি স্ক্রিম স্লট" : "Active Scrim Slots"}
            </Badge>
          </div>

          <div className="flex flex-col gap-6">
            {visibleSectors.map((sector) => {
              // Match results strictly belonging to this scrim sector id
              const sectorResults = recent.filter(
                (r) => r.scrimId === sector.id
              )

              return (
                <div
                  key={sector.id}
                  className="glass flex flex-col gap-4 rounded-2xl p-5 border border-border/80 relative overflow-hidden"
                >
                  {/* Sector Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
                    <div>
                      <h3 className="font-display text-lg font-bold uppercase text-foreground flex items-center gap-2">
                        <span>{sector.title}</span>
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span className="flex items-center gap-1 font-semibold text-primary">
                          <Clock className="size-3.5" />
                          {sector.startTime}
                        </span>
                        <span>Map: {sector.map}</span>
                        <span>Mode: BATTLE ROYALE</span>
                      </div>
                    </div>
                  </div>

                  {/* Sector Results */}
                  {sectorResults.length === 0 ? (
                    <div className="py-6 text-center text-xs text-muted-foreground italic bg-black/20 rounded-xl border border-dashed border-border/50">
                      No results published for this scrim slot yet.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {sectorResults.map((r) => {
                        const rawImgs = Array.isArray(r.imageUrls) && r.imageUrls.length > 0
                          ? (r.imageUrls as string[])
                          : r.screenshotUrl ? [r.screenshotUrl] : []
                        const imgs = resolveImageUrls(rawImgs)

                        return (
                          <div
                            key={r.id}
                            className="flex flex-col gap-3 rounded-xl bg-secondary/40 p-4 border border-border/60"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <Trophy className="size-4 shrink-0 text-primary" />
                              <span className="font-display font-bold text-base text-foreground flex-1">
                                {r.winningTeam}
                              </span>
                              {r.category && (
                                <Badge variant="outline" className="border-primary/50 text-primary bg-primary/10 font-bold">
                                  {r.category}
                                </Badge>
                              )}
                              {r.mvpPlayerName && (
                                <Badge variant="outline" className="border-amber-500/50 text-amber-400 bg-amber-500/10 font-bold">
                                  MVP: {r.mvpPlayerName} {r.mvpTeamName ? `(${r.mvpTeamName})` : ""}
                                </Badge>
                              )}
                              <Badge variant={r.prizeStatus === "sent" ? "default" : "secondary"}>
                                {r.prizeStatus === "sent"
                                  ? isBn ? "প্রাইজ পাঠানো হয়েছে" : "Prize Sent"
                                  : isBn ? "প্রাইজ প্রসেসিং হচ্ছে" : "Prize Processing"}
                              </Badge>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Crosshair className="size-3.5 text-primary" />
                                <strong>{r.kills}</strong> {isBn ? "কিলস" : "kills"}
                              </span>
                              <span>Placement: <strong>#{r.placement}</strong></span>
                              <span className="font-bold text-primary text-sm">{formatTaka(r.prizeBdt)}</span>
                              <span>{formatDate(r.matchDate)}</span>
                            </div>

                            {/* Screenshots / Banners */}
                            {imgs.length > 0 && (
                              <div className="mt-1 grid gap-3 sm:grid-cols-2">
                                {imgs.map((url, i) => (
                                  <div
                                    key={i}
                                    className="relative group overflow-hidden rounded-xl border border-border/80 bg-black/50"
                                  >
                                    <Image
                                      src={url || "/placeholder.svg"}
                                      alt={`Result banner ${i + 1} — ${r.winningTeam}`}
                                      width={640}
                                      height={360}
                                      unoptimized
                                      className="w-full h-44 object-cover rounded-xl transition-transform duration-300 group-hover:scale-105"
                                    />
                                    <a
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-semibold gap-1.5"
                                    >
                                      <ExternalLink className="size-4" />
                                      {t("view_full_image", "View Full Image")}
                                    </a>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {sectors.length > 6 && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={() => setShowAllSectors(!showAllSectors)}
                className="gap-2 font-display font-bold uppercase text-xs"
              >
                {showAllSectors ? (
                  <>
                    <ChevronUp className="size-4" />
                    <span>Show Fewer Sectors</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="size-4" />
                    <span>Show All {sectors.length} Sectors</span>
                  </>
                )}
              </Button>
            </div>
          )}
        </section>

        {/* Leaderboard Column */}
        <aside aria-label="Team leaderboard" className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold uppercase tracking-wide">
            {isBn ? "শীর্ষ বিজয়ী স্কোয়াড" : "Top Teams Leaderboard"}
          </h2>
          <div className="glass rounded-2xl p-2 border border-border/80">
            {leaderboard.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                {isBn ? "ফলাফল প্রকাশিত হওয়ার সাথে সাথে লিডারবোর্ড আপডেট হবে।" : "The leaderboard fills up as results are published."}
              </p>
            ) : (
              <ol className="flex flex-col">
                {leaderboard.map((team, i) => (
                  <li
                    key={team.teamName}
                    className="flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-secondary/50"
                  >
                    <span
                      className={`flex size-8 shrink-0 items-center justify-center font-display text-sm font-bold ${
                        i < 3 ? medalColor[i] : "text-muted-foreground"
                      }`}
                    >
                      {i < 3 ? <Medal className="size-5" /> : `#${i + 1}`}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display font-bold">{team.teamName}</p>
                      <p className="text-xs text-muted-foreground">
                        {team.wins} {isBn ? "টি জয়" : team.wins === 1 ? "win" : "wins"} · {team.totalKills} {isBn ? "কিলস" : "kills"}
                      </p>
                    </div>
                    <span className="font-display text-sm font-bold text-primary">
                      {formatTaka(team.totalPrizeBdt)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </aside>
      </div>
    </main>
  )
}
