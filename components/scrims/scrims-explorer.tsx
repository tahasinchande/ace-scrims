"use client"

import { useMemo, useState, useEffect } from "react"
import { Search, Flame, Trophy, Calendar, AlertCircle, Lock } from "lucide-react"
import { Input } from "@/components/ui/input"
import { ScrimCard, type ScrimCardData } from "@/components/site/scrim-card"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/language"

export function ScrimsExplorer({ scrims: initialScrims, isAuthed: _isAuthed }: { scrims: ScrimCardData[]; isAuthed?: boolean }) {
  const { t } = useLanguage()
  const [scrims, setScrims] = useState<ScrimCardData[]>(initialScrims)
  const [query, setQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [time, setTime] = useState<string>("All")

  // Sync if initial server props update
  useEffect(() => {
    setScrims(initialScrims)
  }, [initialScrims])

  // Live real-time slot polling to synchronize /scrims with outside view after reset
  useEffect(() => {
    let active = true
    async function syncSlots() {
      try {
        const { getLiveScrimSlotsMap } = await import("@/app/actions/booking")
        const slotMap = await getLiveScrimSlotsMap()
        if (!active || !slotMap || Object.keys(slotMap).length === 0) return
        setScrims((prev) =>
          prev.map((s) => {
            const live = slotMap[s.slug] || slotMap[(s as any).id]
            if (!live) return s
            return {
              ...s,
              confirmedTeams: live.confirmed,
              maxTeams: live.maxTeams,
              registrationOpen: live.registrationOpen,
              status: live.status,
            }
          })
        )
      } catch {}
    }

    syncSlots()
    const timer = setInterval(syncSlots, 10000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      const categoryParam = params.get("category")
      if (categoryParam) {
        setSelectedCategory(categoryParam)
      }
    }
  }, [])

  const filtered = useMemo(() => {
    return scrims.filter((s) => {
      // Category filter
      if (selectedCategory === "friday-special-blast") {
        const isBlast = s.title.toLowerCase().includes("friday special") || s.slug.includes("friday-special")
        if (!isBlast) return false
      } else if (selectedCategory === "champion-rush") {
        const isCR = s.title.toLowerCase().includes("champion rush") || s.slug.includes("champion-rush")
        if (!isCR) return false
      }

      // Time filter
      const normTime = s.startTime.replace(/\s*(AM|PM)/i, "").trim()
      const filterNorm = time.replace(/\s*(AM|PM)/i, "").trim()
      const matchesTime = time === "All" || s.startTime.includes(time) || normTime === filterNorm

      // Query filter
      const q = query.trim().toLowerCase()
      const matchesQuery =
        q.length === 0 ||
        s.title.toLowerCase().includes(q) ||
        s.map.toLowerCase().includes(q) ||
        s.mode.toLowerCase().includes(q) ||
        s.startTime.toLowerCase().includes(q)

      return matchesTime && matchesQuery
    })
  }, [scrims, query, time, selectedCategory])

  const isChampionRushActive = selectedCategory === "champion-rush" || filtered.some((f) => f.slug.includes("champion-rush"))

  return (
    <div className="flex flex-col gap-6">
      <div className="mb-2 flex flex-col gap-2">
        <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-primary">
          {t("tonight_schedule_eyebrow", "Esports Scrims Lobbies")}
        </p>
        <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-foreground sm:text-5xl text-balance">
          {selectedCategory === "friday-special-blast"
            ? "Friday Special Blast"
            : selectedCategory === "champion-rush"
            ? "10 PM Champion Rush"
            : t("todays_scrims_title", "Today's Scrims")}
        </h1>
        <p className="max-w-2xl leading-relaxed text-muted-foreground">
          {selectedCategory === "friday-special-blast"
            ? "5 high-stakes matches (Bermuda, Purgatory, Kalahari, Solana, and Nexterra) across 3 PM, 5 PM, 7 PM, 9 PM, and 11 PM. Entry ৳80 per squad, Prize pool ৳850!"
            : selectedCategory === "champion-rush"
            ? "Ultimate Free Fire survival challenge! Up to 8 matches. Reach 80 points to unlock Champion Rush format, then conquer a BOOYAH to be crowned Champion Team."
            : t("todays_scrims_subtitle", "Competitive squad scrim lobbies with instant slot confirmation. Entry from ৳35 per squad, 12 teams max. Book your slot before the lobby fills.")}
        </p>
      </div>

      {/* Category Pills Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/50 pb-4">
        <button
          type="button"
          onClick={() => setSelectedCategory("all")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all",
            selectedCategory === "all"
              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
              : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
          )}
        >
          <Calendar className="size-3.5" />
          All Scrims
        </button>

        <button
          type="button"
          onClick={() => setSelectedCategory("friday-special-blast")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all",
            selectedCategory === "friday-special-blast"
              ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20"
              : "bg-secondary/60 text-amber-400 hover:bg-amber-500/10"
          )}
        >
          <Flame className="size-3.5" />
          Friday Special Blast (5 Matches · ৳80/৳850)
        </button>

        <button
          type="button"
          onClick={() => setSelectedCategory("champion-rush")}
          style={{
            fontWeight: "bold",
            backgroundColor: "#000000",
            fontStyle: "normal",
            textDecorationLine: "none",
            borderColor: "#253032",
          }}
          className={cn(
            "flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold transition-all",
            selectedCategory === "champion-rush"
              ? "text-emerald-400 shadow-lg shadow-emerald-500/20"
              : "text-emerald-400/80 hover:text-emerald-300"
          )}
        >
          <Trophy className="size-3.5" />
          10 PM CHAMPION RUSH
        </button>
      </div>

      {/* 10 PM Champion Rush Rules Notice Banner */}
      {selectedCategory === "champion-rush" && (
        <div className="glass flex flex-col gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                <Trophy className="size-5" />
              </span>
              <div>
                <h2 className="font-display text-base font-bold text-foreground">
                  10 PM Champion Rush Tournament Rules & Format (Friday Only)
                </h2>
                <p className="text-xs text-muted-foreground">
                  Entry: ৳35 · Prize Pool: ৳320 · Maximum 8 Matches Format
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-emerald-950/60 border border-emerald-500/40 px-3.5 py-1.5 text-xs font-semibold text-emerald-300">
              <Lock className="size-3.5 text-emerald-400" />
              WhatsApp Channel link delivered upon registration
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-emerald-500/20 text-xs">
            <div className="flex items-start gap-2.5 rounded-xl bg-emerald-950/30 p-3 border border-emerald-500/20">
              <AlertCircle className="size-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-emerald-300 block mb-0.5">1. Max 8 Matches</strong>
                <span>BATTLE ROYALE format — Maximum 8 matches will occur. Not more than that.</span>
              </div>
            </div>
            <div className="flex items-start gap-2.5 rounded-xl bg-emerald-950/30 p-3 border border-emerald-500/20">
              <AlertCircle className="size-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-emerald-300 block mb-0.5">2. 80 Points Unlock</strong>
                <span>The team which collects 80 points can unlock the Champion Rush format.</span>
              </div>
            </div>
            <div className="flex items-start gap-2.5 rounded-xl bg-emerald-950/30 p-3 border border-emerald-500/20">
              <AlertCircle className="size-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-emerald-300 block mb-0.5">3. Champion Decider</strong>
                <span>Once Champion Rush format is unlocked, if any of the teams that unlocked the Champion Rush format gets a BOOYAH, the scrim will finish there and that team will be Champion.</span>
              </div>
            </div>
            <div className="flex items-start gap-2.5 rounded-xl bg-emerald-950/30 p-3 border border-emerald-500/20">
              <AlertCircle className="size-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-emerald-300 block mb-0.5">4. Overall Points Win</strong>
                <span>If 8 matches conclude without a Booyah by an unlocked team, highest overall points wins. Emulators strictly prohibited.</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-emerald-950/40 border border-emerald-500/30 p-3.5 text-xs text-emerald-200 leading-relaxed">
            <span className="font-bold text-emerald-400 uppercase tracking-wider block mb-1">Important Notes</span>
            <p className="font-mono text-[11px] text-zinc-300">
              RULES: MAX 8 MATCHES WILL OCCUR. NOT MORE THAN THAT. THE TEAM WHICH WOULD COLLECT 80 PTS CAN UNLOCK THE CHAMPION RUSH FORMAT, THEN IF ANY OF THE TEAMS THAT UNLOCKED THE CHAMPION RUSH FORMAT GETS A BOOYAH, THE SCRIM WILL FINISH THERE AND THAT TEAM WILL BE CHAMPION.
            </p>
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search_scrims_placeholder", "Search time, map or mode...")}
            className="pl-9"
            aria-label="Search scrims"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="glass flex flex-col items-center gap-2 rounded-2xl py-16 text-center">
          <p className="font-display text-xl font-bold uppercase tracking-wide">No scrims found</p>
          <p className="text-sm text-muted-foreground">Try selecting "All Scrims" or adjust your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((scrim) => (
            <ScrimCard key={scrim.slug} scrim={scrim} />
          ))}
        </div>
      )}
    </div>
  )
}
