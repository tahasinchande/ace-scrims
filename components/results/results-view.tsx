"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import Image from "next/image"
import { formatTaka, formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Trophy,
  Crosshair,
  Medal,
  ExternalLink,
  Clock,
  Swords,
  Crown,
  Award,
  Star,
  MapPin,
  Calendar,
  Layers,
  Sparkles,
} from "lucide-react"
import { useLanguage } from "@/lib/language"
import { resolveImageUrls } from "@/lib/image-url"
import { Reveal } from "@/components/site/reveal"
import type { ResultWithScrim } from "@/lib/queries/results"

export type LeaderboardEntry = {
  teamName: string
  wins: number
  totalKills: number
  totalPrizeBdt: number
}

export type ScrimSector = {
  id: string
  title: string
  startTime: string
  map: string
}

type LobbyGroup = {
  key: string
  scrimId: string | null
  title: string
  time: string
  map: string
  date: string | null
  results: ResultWithScrim[]
}

const medalColor = ["text-primary", "text-muted-foreground", "text-chart-3"]

export function ResultsView({
  recent = [],
  leaderboard = [],
}: {
  recent: ResultWithScrim[]
  scrimSectors?: ScrimSector[]
  leaderboard: LeaderboardEntry[]
}) {
  const { lang, t } = useLanguage()
  const isBn = lang === "bn"
  const [selectedLobbyFilter, setSelectedLobbyFilter] = useState<string>("all")

  // Group results strictly and cleanly by each individual scrim lobby
  const lobbyGroups: LobbyGroup[] = useMemo(() => {
    const map = new Map<string, LobbyGroup>()

    for (const r of recent) {
      // Create a unique composite key for each distinct scrim lobby & match date
      const lobbyKey = `${r.scrimId || r.scrimTitle || "match"}_${r.matchDate || "active"}`

      if (!map.has(lobbyKey)) {
        map.set(lobbyKey, {
          key: lobbyKey,
          scrimId: r.scrimId || null,
          title: r.scrimTitle || "Daily Scrim Lobby",
          time: r.scrimTime || "Match Slot",
          map: r.scrimMap || "Bermuda",
          date: r.matchDate ? formatDate(r.matchDate) : null,
          results: [],
        })
      }

      map.get(lobbyKey)!.results.push(r)
    }

    // Sort within each lobby by placement ascending (1st place champion first, then 2nd, etc.)
    for (const group of map.values()) {
      group.results.sort((a, b) => {
        const catWeight = (item: ResultWithScrim) => {
          if (item.category?.includes("Champion") || item.placement === 1) return 1
          if (item.category?.includes("Runner-up") || item.placement === 2) return 2
          if (item.category?.includes("Second Runner-up") || item.placement === 3) return 3
          if (item.category?.includes("Third Runner-up") || item.placement === 4) return 4
          if (item.category?.includes("MVP")) return 5
          return 10 + (item.placement || 99)
        }
        return catWeight(a) - catWeight(b)
      })
    }

    return Array.from(map.values())
  }, [recent])

  const filteredGroups = useMemo(() => {
    if (selectedLobbyFilter === "all") return lobbyGroups
    return lobbyGroups.filter((g) => g.key === selectedLobbyFilter || g.scrimId === selectedLobbyFilter)
  }, [lobbyGroups, selectedLobbyFilter])

  const hasResults = recent.length > 0

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 md:px-6">
      <Reveal immediate y={16} duration={0.62}>
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-display text-sm font-semibold uppercase tracking-widest text-primary flex items-center gap-1.5">
              <Sparkles className="size-4" />
              {t("results_eyebrow", "PROVED WINNERS & MATCH RESULTS")}
            </p>
            <h1 className="font-display text-3xl font-bold uppercase tracking-wide text-balance md:text-4xl text-foreground">
              {t("results_title", "Match Results & Leaderboard")}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {t("results_subtitle", "Verified match results grouped under distinct scrim lobby headers with high-resolution screenshot proofs.")}
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
      </Reveal>

      {/* Lobby Filter Navigation Pills */}
      {lobbyGroups.length > 1 && (
        <Reveal immediate delay={0.08} y={12} duration={0.52} className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground mr-1 flex items-center gap-1">
            <Layers className="size-3.5" /> Filter Lobby:
          </span>
          <Button
            size="sm"
            variant={selectedLobbyFilter === "all" ? "default" : "outline"}
            onClick={() => setSelectedLobbyFilter("all")}
            className="h-8 text-xs font-semibold rounded-lg"
          >
            All Lobbies ({lobbyGroups.length})
          </Button>
          {lobbyGroups.map((group) => {
            const isSelected = selectedLobbyFilter === group.key
            return (
              <Button
                key={group.key}
                size="sm"
                variant={isSelected ? "default" : "outline"}
                onClick={() => setSelectedLobbyFilter(group.key)}
                className="h-8 text-xs font-semibold rounded-lg gap-1.5"
              >
                <Clock className="size-3" />
                <span>{group.time}</span>
                <span className="opacity-70">({group.map})</span>
              </Button>
            )
          })}
        </Reveal>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
        {/* Scrim Results Column — Grouped by Distinct Lobby Headers */}
        <section aria-label="Scrim match sectors" className="flex flex-col gap-8">
          {!hasResults ? (
            <Reveal y={16} duration={0.58} className="glass flex flex-col items-center justify-center gap-4 rounded-2xl p-12 text-center border border-border/70">
              <Trophy className="size-12 text-muted-foreground/30" />
              <div>
                <h3 className="font-display text-lg font-bold uppercase text-foreground">
                  {isBn ? "এখনো কোনো ফলাফল প্রকাশিত হয়নি" : "No Match Results Published Yet"}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground max-w-md">
                  {isBn
                    ? "আজকের ম্যাচগুলো সম্পন্ন হলে এখানে লবি অনুযায়ী বিজয়ীদের তালিকা ও প্রুফ স্ক্রিনশট প্রকাশিত হবে।"
                    : "Once today matches conclude, official winner standings and verified proofs will be published here grouped by scrim lobby."}
                </p>
              </div>
            </Reveal>
          ) : (
            <div className="flex flex-col gap-8">
              {filteredGroups.map((group, groupIdx) => (
                <Reveal
                  key={group.key}
                  delay={Math.min(groupIdx, 5) * 0.06}
                  y={20}
                  duration={0.62}
                  className="rounded-2xl border border-border/80 bg-secondary/10 overflow-hidden shadow-sm"
                >
                  {/* Distinct Scrim Lobby Header */}
                  <div className="border-b border-border/70 bg-gradient-to-r from-secondary/80 via-secondary/40 to-transparent p-4 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shrink-0">
                          <Swords className="size-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                              SCRIM LOBBY
                            </span>
                            {group.date && (
                              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Calendar className="size-3" /> {group.date}
                              </span>
                            )}
                          </div>
                          <h2 className="font-display text-lg sm:text-xl font-bold uppercase tracking-wide text-foreground">
                            {group.title}
                          </h2>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary font-bold gap-1 text-xs py-1">
                          <Clock className="size-3.5" />
                          {group.time}
                        </Badge>
                        <Badge variant="outline" className="border-border bg-background text-muted-foreground font-semibold gap-1 text-xs py-1">
                          <MapPin className="size-3.5 text-muted-foreground" />
                          {group.map}
                        </Badge>
                        <Badge variant="secondary" className="text-xs py-1">
                          {group.results.length} {group.results.length === 1 ? "Result" : "Results"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Results inside this Lobby */}
                  <div className="p-4 sm:p-5 flex flex-col gap-4">
                    {group.results.map((r) => {
                      const isChampion = r.category?.includes("Champion") || r.placement === 1
                      const isRunnerUp = r.category?.includes("Runner-up") || r.placement === 2
                      const isSecondRunnerUp = r.category?.includes("Second Runner-up") || r.placement === 3
                      const isThirdRunnerUp = r.category?.includes("Third Runner-up") || r.placement === 4
                      const isMvp = r.category?.includes("MVP") || Boolean(r.mvpPlayerName)

                      const rawImgs = Array.isArray(r.imageUrls) && r.imageUrls.length > 0
                        ? (r.imageUrls as string[])
                        : r.screenshotUrl ? [r.screenshotUrl] : []
                      const imgs = resolveImageUrls(rawImgs)

                      return (
                        <div
                          key={r.id}
                          className={`glass flex flex-col gap-3 rounded-xl p-4 sm:p-5 border transition-all ${
                            isChampion
                              ? "border-amber-500/50 bg-amber-500/5 shadow-md"
                              : isRunnerUp
                              ? "border-slate-400/40 bg-slate-400/5"
                              : isSecondRunnerUp
                              ? "border-amber-700/40 bg-amber-700/5"
                              : "border-border/70"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              {isChampion ? (
                                <Crown className="size-5 shrink-0 text-amber-400" />
                              ) : isRunnerUp ? (
                                <Medal className="size-5 shrink-0 text-slate-300" />
                              ) : isSecondRunnerUp ? (
                                <Medal className="size-5 shrink-0 text-amber-600" />
                              ) : isThirdRunnerUp ? (
                                <Award className="size-5 shrink-0 text-primary" />
                              ) : isMvp ? (
                                <Star className="size-5 shrink-0 text-amber-400" />
                              ) : (
                                <Trophy className="size-5 shrink-0 text-primary" />
                              )}

                              <div className="min-w-0">
                                <h3 className="font-display font-bold text-base sm:text-lg text-foreground truncate">
                                  {r.winningTeam}
                                </h3>
                              </div>

                              {r.category && (
                                <Badge
                                  variant="outline"
                                  className={`text-xs font-bold ${
                                    isChampion
                                      ? "border-amber-500/50 text-amber-400 bg-amber-500/10"
                                      : isRunnerUp
                                      ? "border-slate-400/50 text-slate-300 bg-slate-400/10"
                                      : isSecondRunnerUp
                                      ? "border-amber-700/50 text-amber-500 bg-amber-700/10"
                                      : "border-primary/40 text-primary bg-primary/10"
                                  }`}
                                >
                                  {r.category}
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              {r.prizeBdt > 0 && (
                                <span className="font-display text-base font-bold text-amber-400 bg-amber-400/10 border border-amber-400/30 px-2.5 py-0.5 rounded-lg">
                                  {formatTaka(r.prizeBdt)}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* MVP Callout if available */}
                          {r.mvpPlayerName && (
                            <div className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-300 font-semibold w-fit">
                              <Star className="size-3.5 text-amber-400" />
                              <span>MVP Player: <strong>{r.mvpPlayerName}</strong> {r.mvpTeamName ? `(${r.mvpTeamName})` : ""}</span>
                            </div>
                          )}

                          {/* Stats Row */}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground border-t border-border/40 pt-2">
                            <span className="flex items-center gap-1 font-medium">
                              <Crosshair className="size-3.5 text-primary" />
                              <strong>{r.kills}</strong> {isBn ? "কিলস" : "kills"}
                            </span>
                            <span>Placement: <strong>#{r.placement}</strong></span>
                            {r.matchDate && <span>Date: {formatDate(r.matchDate)}</span>}
                          </div>

                          {/* Screenshots / Banner Proofs */}
                          {imgs.length > 0 && (
                            <div className="mt-2 grid gap-3 sm:grid-cols-2">
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
                                    {t("view_full_image", "View Full Image Proof")}
                                  </a>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </Reveal>
              ))}
            </div>
          )}
        </section>

        {/* Leaderboard Column */}
        <Reveal delay={0.1} y={18} duration={0.62}>
          <aside aria-label="Team leaderboard" className="flex flex-col gap-3">
          <h2 className="font-display text-lg font-bold uppercase tracking-wide">
            {isBn ? "শীর্ষ বিজয়ী স্কোয়াড" : "Top Teams Leaderboard"}
          </h2>
          <div className="glass rounded-2xl p-2 border border-border/80">
            {leaderboard.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
                <Medal className="size-8 text-muted-foreground/40" />
                <div>
                  <p className="font-display text-sm font-bold uppercase text-foreground">
                    {isBn ? "এখনো কোনো ফলাফল প্রকাশিত হয়নি" : "No match results published yet"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    {isBn
                      ? "ফলাফল প্রকাশিত হওয়ার সাথে সাথে লিডারবোর্ড র‍্যাংকিং আপডেট হবে।"
                      : "The team leaderboard will update automatically as verified match results are published."}
                  </p>
                </div>
              </div>
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
        </Reveal>
      </div>
    </main>
  )
}
