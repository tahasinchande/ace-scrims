"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { ScrimCard, type ScrimCardData } from "@/components/site/scrim-card"
import { cn } from "@/lib/utils"

const TIME_FILTERS = ["All", "7:00 PM", "8:00 PM", "9:00 PM", "10:00 PM", "11:00 PM", "12:00 AM"] as const

export function ScrimsExplorer({ scrims, isAuthed: _isAuthed }: { scrims: ScrimCardData[]; isAuthed?: boolean }) {
  const [query, setQuery] = useState("")
  const [time, setTime] = useState<string>("All")

  const filtered = useMemo(() => {
    return scrims.filter((s) => {
      const matchesTime = time === "All" || s.startTime === time
      const q = query.trim().toLowerCase()
      const matchesQuery =
        q.length === 0 ||
        s.title.toLowerCase().includes(q) ||
        s.map.toLowerCase().includes(q) ||
        s.mode.toLowerCase().includes(q) ||
        s.startTime.toLowerCase().includes(q)
      return matchesTime && matchesQuery
    })
  }, [scrims, query, time])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, map, mode or time..."
            className="pl-9"
            aria-label="Search scrims"
          />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by time">
          {TIME_FILTERS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTime(t)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                time === t
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="glass flex flex-col items-center gap-2 rounded-2xl py-16 text-center">
          <p className="font-display text-xl font-bold uppercase tracking-wide">No scrims found</p>
          <p className="text-sm text-muted-foreground">Try a different search or time filter.</p>
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
