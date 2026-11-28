"use client"

import { useMemo, useState, useEffect } from "react"
import { Search, Flame, Trophy, Calendar, AlertCircle, Lock, CalendarClock, PauseCircle, Layers } from "lucide-react"
import { Input } from "@/components/ui/input"
import { ScrimCard, type ScrimCardData } from "@/components/site/scrim-card"
import { Reveal } from "@/components/site/reveal"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/language"
import { sortScrimsAscending } from "@/lib/format"
import { getScrimRoomNumber } from "@/lib/room-multiplier"
import { classifyScrimHierarchy } from "@/components/site/cascading-scrim-selector"
import type { EvaluatedScheduleOverride } from "@/lib/schedule-override"

export function ScrimsExplorer({
  scrims: initialScrims,
  isAuthed: _isAuthed,
  initialScheduleStatus = null,
}: {
  scrims: ScrimCardData[]
  isAuthed?: boolean
  initialScheduleStatus?: EvaluatedScheduleOverride | null
}) {
  const { t } = useLanguage()
  const [scrims, setScrims] = useState<ScrimCardData[]>(initialScrims)
  const [scheduleStatus, setScheduleStatus] = useState<EvaluatedScheduleOverride | null>(
    initialScheduleStatus
  )
  const [query, setQuery] = useState("")
  const [selectedSchedule, setSelectedSchedule] = useState<"all" | "daily" | "friday">("all")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [selectedRoom, setSelectedRoom] = useState<number | "all">("all")
  const [time] = useState<string>("All")

  // Sync if initial server props update
  useEffect(() => {
    setScrims(initialScrims)
  }, [initialScrims])

  useEffect(() => {
    setScheduleStatus(initialScheduleStatus)
  }, [initialScheduleStatus])

  // Live real-time slot polling via /api/scrims/slots
  useEffect(() => {
    let active = true
    async function syncSlots() {
      try {
        const res = await fetch("/api/scrims/slots", { cache: "no-store" })
        if (!res.ok) return
        const data = await res.json()
        if (!active || !data?.ok || !Array.isArray(data.scrims)) return
        setScrims(data.scrims as ScrimCardData[])
        if (data.scheduleStatus !== undefined) {
          setScheduleStatus(data.scheduleStatus as EvaluatedScheduleOverride | null)
        }
      } catch {
        // Silent retry on next interval
      }
    }

    const onVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        void syncSlots()
      }
    }

    const onSlotsUpdated = () => {
      void syncSlots()
    }

    let channel: BroadcastChannel | null = null
    if (typeof BroadcastChannel !== "undefined") {
      channel = new BroadcastChannel("acescrims-slots")
      channel.onmessage = () => {
        void syncSlots()
      }
    }

    void syncSlots()

    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        void syncSlots()
      }
    }, 5000)

    window.addEventListener("focus", onVisibilityOrFocus)
    window.addEventListener("acescrims:slots-updated", onSlotsUpdated)
    document.addEventListener("visibilitychange", onVisibilityOrFocus)

    return () => {
      active = false
      clearInterval(timer)
      window.removeEventListener("focus", onVisibilityOrFocus)
      window.removeEventListener("acescrims:slots-updated", onSlotsUpdated)
      document.removeEventListener("visibilitychange", onVisibilityOrFocus)
      channel?.close()
    }
  }, [])

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      const categoryParam = params.get("category")
      if (categoryParam === "friday-special-blast" || categoryParam === "champion-rush") {
        setSelectedSchedule("friday")
        setSelectedCategory(categoryParam)
      } else if (categoryParam) {
        setSelectedCategory(categoryParam)
      }
    }
  }, [])

  const scheduleScopedScrims = useMemo(() => {
    if (selectedSchedule === "all") return scrims
    return scrims.filter((s) => classifyScrimHierarchy(s).schedule === selectedSchedule)
  }, [scrims, selectedSchedule])

  const dynamicCategories = useMemo(() => {
    if (selectedSchedule === "all") return []
    const set = new Set<string>()
    for (const s of scheduleScopedScrims) {
      const cat = classifyScrimHierarchy(s).category
      if (cat) set.add(cat)
    }
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
    )
  }, [scheduleScopedScrims, selectedSchedule])

  const availableRooms = useMemo(() => {
    const set = new Set<number>()
    for (const s of scheduleScopedScrims) {
      set.add(getScrimRoomNumber(s))
    }
    return Array.from(set).sort((a, b) => a - b)
  }, [scheduleScopedScrims])

  const filtered = useMemo(() => {
    return sortScrimsAscending(
      scheduleScopedScrims.filter((s) => {
        const hierarchy = classifyScrimHierarchy(s)

        // Category filter
        if (selectedCategory === "friday-special-blast") {
          const cat = (s.category || "").toLowerCase()
          const isBlast =
            s.title.toLowerCase().includes("friday special") ||
            s.slug.includes("friday-special") ||
            cat === "friday scrims" ||
            cat.includes("friday special")
          if (!isBlast) return false
        } else if (selectedCategory === "champion-rush") {
          const cat = (s.category || "").toLowerCase()
          const isCR =
            s.title.toLowerCase().includes("champion rush") ||
            s.slug.includes("champion-rush") ||
            cat.includes("champion rush")
          if (!isCR) return false
        } else if (selectedCategory !== "all") {
          if (hierarchy.category !== selectedCategory) return false
        }

        // Dynamic Room filter
        if (selectedRoom !== "all" && getScrimRoomNumber(s) !== selectedRoom) {
          return false
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
    )
  }, [scheduleScopedScrims, query, time, selectedCategory, selectedRoom])

  const isChampionRushActive = selectedCategory === "champion-rush" || filtered.some((f) => f.slug.includes("champion-rush"))

  return (
    <div className="flex flex-col gap-6">
      <Reveal immediate y={16} duration={0.62} className="mb-2 flex flex-col gap-2">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          {t("tonight_schedule_eyebrow", "Esports Scrims Lobbies")}
        </p>
        <h1 className="font-display text-4xl font-semibold tracking-[-0.03em] text-foreground sm:text-5xl text-balance">
          {selectedCategory === "friday-special-blast"
            ? "Friday Special Blast"
            : selectedCategory === "champion-rush"
            ? "10 PM Champion Rush"
            : t("todays_scrims_title", "Today's Scrims")}
        </h1>
        <p className="max-w-2xl text-sm sm:text-base leading-relaxed text-muted-foreground">
          {selectedCategory === "friday-special-blast"
            ? "5 high-stakes matches (Bermuda, Purgatory, Kalahari, Solana, and Nexterra) across 3 PM, 5 PM, 7 PM, 9 PM, and 11 PM. Entry ৳80 per squad, Prize pool ৳850!"
            : selectedCategory === "champion-rush"
            ? "Ultimate Free Fire survival challenge! Up to 8 matches. Reach 80 points to unlock Champion Rush format, then conquer a BOOYAH to be crowned Champion Team."
            : t("todays_scrims_subtitle", "Competitive squad scrim lobbies with instant slot confirmation. Entry from ৳35 per squad, 12 teams max. Book your slot before the lobby fills.")}
        </p>
      </Reveal>

      {/* Step 1: Cascading Schedule & Category Navigation */}
      <Reveal immediate delay={0.08} y={12} duration={0.54} className="flex flex-col gap-3 border-b border-white/[0.07] pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectedSchedule("all")
              setSelectedCategory("all")
              setSelectedRoom("all")
            }}
            className={cn(
              "rushx-btn-splash flex items-center gap-2 whitespace-nowrap rounded-xl border px-4 py-2 text-xs font-semibold transition-all cursor-pointer",
              selectedSchedule === "all" && selectedCategory === "all"
                ? "border-violet-400/45 bg-gradient-to-r from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/25"
                : "border-white/[0.08] bg-white/[0.03] text-muted-foreground hover:border-white/[0.15] hover:bg-white/[0.06] hover:text-foreground"
            )}
          >
            <Calendar className="size-3.5" />
            All Scrims
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedSchedule("daily")
              setSelectedCategory("all")
              setSelectedRoom("all")
            }}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap rounded-xl border px-4 py-2 text-xs font-semibold transition-all cursor-pointer",
              selectedSchedule === "daily"
                ? "border-primary/60 bg-primary/20 text-white shadow-lg shadow-primary/15"
                : "border-white/[0.08] bg-white/[0.03] text-muted-foreground hover:border-white/[0.15] hover:bg-white/[0.06] hover:text-foreground"
            )}
          >
            <Layers className="size-3.5" />
            Daily Scrims
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedSchedule("friday")
              setSelectedCategory("all")
              setSelectedRoom("all")
            }}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap rounded-xl border px-4 py-2 text-xs font-semibold transition-all cursor-pointer",
              selectedSchedule === "friday" && selectedCategory === "all"
                ? "border-amber-400/45 bg-gradient-to-b from-amber-400 to-amber-500 text-zinc-950 shadow-lg shadow-amber-500/20"
                : "border-amber-500/20 bg-amber-500/[0.07] text-amber-300 hover:border-amber-500/35 hover:bg-amber-500/[0.14]"
            )}
          >
            <Flame className="size-3.5" />
            Friday Scrims
          </button>
        </div>

        {/* Step 2: Category sub-bar (shown automatically when Friday Scrims or categorized schedule is selected) */}
        {(selectedSchedule === "friday" || dynamicCategories.length > 0) && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mr-1">
              Category:
            </span>
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
                selectedCategory === "all"
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-white/[0.08] bg-white/[0.03] text-muted-foreground hover:text-foreground"
              )}
            >
              All Categories
            </button>

            {selectedSchedule === "friday" && (
              <>
                <button
                  type="button"
                  onClick={() => setSelectedCategory("friday-special-blast")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
                    selectedCategory === "friday-special-blast"
                      ? "border-amber-400/50 bg-amber-500/20 text-amber-200"
                      : "border-amber-500/20 bg-amber-500/[0.05] text-amber-300/85 hover:bg-amber-500/[0.12]"
                  )}
                >
                  <Flame className="size-3.5" />
                  Friday Special Blast (5 Matches · ৳80/৳850)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory("champion-rush")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
                    selectedCategory === "champion-rush"
                      ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-200"
                      : "border-emerald-500/20 bg-emerald-950/30 text-emerald-400/85 hover:bg-emerald-500/12"
                  )}
                >
                  <Trophy className="size-3.5" />
                  Champion Rush
                </button>
              </>
            )}

            {dynamicCategories
              .filter(
                (cat) =>
                  selectedSchedule !== "friday" ||
                  (!cat.toLowerCase().includes("friday special") &&
                    !cat.toLowerCase().includes("champion rush")),
              )
              .map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
                    selectedCategory === cat
                      ? "border-primary/60 bg-primary/15 text-primary"
                      : "border-white/[0.08] bg-white/[0.03] text-muted-foreground hover:text-foreground"
                  )}
                >
                  {cat}
                </button>
              ))}
          </div>
        )}
      </Reveal>

      {/* 10 PM Champion Rush Rules Notice Banner */}
      {selectedCategory === "champion-rush" && (
        <Reveal immediate y={14} duration={0.54} className="dc-surface flex flex-col gap-4 rounded-2xl border-emerald-500/25 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/15 text-emerald-400">
                <Trophy className="size-5" />
              </span>
              <div>
                <h2 className="font-display text-base font-semibold tracking-tight text-foreground">
                  Friday Champion Rush Tournament Rules &amp; Format (3 PM &amp; 10 PM)
                </h2>
                <p className="text-xs text-muted-foreground">
                  Entry: ৳50 · Prize Pool: ৳480 · Maximum 8 Matches Format · Top 4 Payouts (1st: ৳180, 2nd: ৳130, 3rd: ৳100, 4th: ৳70)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-emerald-950/50 border border-emerald-500/30 px-3.5 py-1.5 text-xs font-semibold text-emerald-300">
              <Lock className="size-3.5 text-emerald-400" />
              WhatsApp Channel link delivered upon registration
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-white/[0.07] text-xs">
            <div className="dc-metric-cell flex items-start gap-2.5 rounded-xl p-3">
              <AlertCircle className="size-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-emerald-300 font-semibold block mb-0.5">1. Max 8 Matches</strong>
                <span className="text-zinc-300">BATTLE ROYALE format — Maximum 8 matches will occur. Not more than that.</span>
              </div>
            </div>
            <div className="dc-metric-cell flex items-start gap-2.5 rounded-xl p-3">
              <AlertCircle className="size-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-emerald-300 font-semibold block mb-0.5">2. 80 Points Unlock</strong>
                <span className="text-zinc-300">The team which collects 80 points can unlock the Champion Rush format.</span>
              </div>
            </div>
            <div className="dc-metric-cell flex items-start gap-2.5 rounded-xl p-3">
              <AlertCircle className="size-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-emerald-300 font-semibold block mb-0.5">3. Champion Decider</strong>
                <span className="text-zinc-300">Once Champion Rush format is unlocked, if any of the teams that unlocked the Champion Rush format gets a BOOYAH, the scrim will finish there and that team will be Champion.</span>
              </div>
            </div>
            <div className="dc-metric-cell flex items-start gap-2.5 rounded-xl p-3">
              <AlertCircle className="size-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-emerald-300 font-semibold block mb-0.5">4. Overall Points Win</strong>
                <span className="text-zinc-300">If 8 matches conclude without a Booyah by an unlocked team, highest overall points wins. Emulators strictly prohibited.</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-emerald-950/35 border border-emerald-500/25 p-3.5 text-xs text-emerald-200 leading-relaxed">
            <span className="font-semibold text-emerald-400 uppercase tracking-wider block mb-1">Important Notes</span>
            <p className="font-mono text-[11px] text-zinc-300">
              RULES: MAX 8 MATCHES WILL OCCUR. NOT MORE THAN THAT. THE TEAM WHICH WOULD COLLECT 80 PTS CAN UNLOCK THE CHAMPION RUSH FORMAT, THEN IF ANY OF THE TEAMS THAT UNLOCKED THE CHAMPION RUSH FORMAT GETS A BOOYAH, THE SCRIM WILL FINISH THERE AND THAT TEAM WILL BE CHAMPION.
            </p>
          </div>
        </Reveal>
      )}

      {/* Schedule Shutdown / Advance Registration Window Banner */}
      {scheduleStatus?.isShutdownActive && (
        <Reveal immediate y={10} duration={0.45} className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 sm:p-5 flex items-start gap-3">
          <PauseCircle className="size-5 shrink-0 text-rose-400 mt-0.5" />
          <div className="space-y-1">
            <p className="font-display text-sm font-bold uppercase tracking-wider text-rose-300">
              Scrims Temporarily Paused
            </p>
            <p className="text-xs sm:text-sm text-rose-100/90 leading-relaxed">
              {scheduleStatus.summary}
            </p>
          </div>
        </Reveal>
      )}
      {scheduleStatus?.isRegWindowActive && (
        <Reveal immediate y={10} duration={0.45} className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 sm:p-5 flex items-start gap-3">
          <CalendarClock className="size-5 shrink-0 text-emerald-400 mt-0.5" />
          <div className="space-y-1">
            <p className="font-display text-sm font-bold uppercase tracking-wider text-emerald-300">
              Advance Registration Open · Target Date: {scheduleStatus.effectiveScrimDate}
            </p>
            <p className="text-xs sm:text-sm text-emerald-100/90 leading-relaxed">
              {scheduleStatus.summary}
            </p>
          </div>
        </Reveal>
      )}

      {/* Search & Filters */}
      <Reveal immediate delay={0.12} y={12} duration={0.52} className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search_scrims_placeholder", "Search time, map or mode...")}
            className="h-10 rounded-xl border-white/[0.1] bg-white/[0.03] pl-10"
            aria-label="Search scrims"
          />
        </div>
        {availableRooms.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedRoom("all")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
                selectedRoom === "all"
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-white/[0.08] bg-white/[0.03] text-muted-foreground hover:text-foreground"
              )}
            >
              <Layers className="size-3.5" />
              All Rooms
            </button>
            {availableRooms.map((roomNum) => (
              <button
                key={roomNum}
                type="button"
                onClick={() => setSelectedRoom(roomNum)}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
                  selectedRoom === roomNum
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "border-white/[0.08] bg-white/[0.03] text-muted-foreground hover:text-foreground"
                )}
              >
                Room {roomNum}
              </button>
            ))}
          </div>
        )}
      </Reveal>

      {filtered.length === 0 ? (
        <Reveal y={14} duration={0.5} className="dc-surface flex flex-col items-center gap-2 rounded-2xl py-16 text-center">
          <p className="font-display text-xl font-semibold tracking-tight">No scrims found</p>
          <p className="text-sm text-muted-foreground">Try selecting &quot;All Scrims&quot; or adjust your search.</p>
        </Reveal>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((scrim, idx) => (
            <ScrimCard key={scrim.slug} scrim={scrim} index={idx} />
          ))}
        </div>
      )}
    </div>
  )
}
