import Link from "next/link"
import { Button } from "@/components/ui/button"
import { SectionHeading } from "@/components/landing/sections"
import { Trophy, ChevronRight } from "lucide-react"
import { bdt, formatDate } from "@/lib/format"

export type ResultPreview = {
  id: string
  winningTeam: string
  kills: number
  prizeBdt: number
  matchDate: string
  scrimTitle: string | null
}

export function ResultsPreview({ results }: { results: ResultPreview[] }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 md:px-6" aria-labelledby="results-heading">
      <SectionHeading
        eyebrow="Recent Winners"
        title="Last night's champions"
        subtitle="Every result is published with kills and proof. Your team could be next."
      />
      {results.length === 0 ? (
        <div className="glass mx-auto max-w-md rounded-2xl p-10 text-center">
          <Trophy className="mx-auto mb-4 size-10 text-muted-foreground" aria-hidden />
          <p className="font-semibold">First results drop tonight</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Winners are published here after every scrim. Book a slot and claim the top spot.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((r, i) => (
            <div key={r.id} className="glass flex items-center gap-4 rounded-2xl p-5">
              <span
                className={`flex size-12 shrink-0 items-center justify-center rounded-xl font-display text-lg font-black ${
                  i === 0 ? "bg-warning/15 text-warning" : "bg-secondary text-muted-foreground"
                }`}
                aria-hidden
              >
                <Trophy className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display font-bold">{r.winningTeam}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {r.scrimTitle ?? "Scrim"} · {formatDate(r.matchDate)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-display font-bold text-primary">{bdt(r.prizeBdt)}</p>
                <p className="text-xs text-muted-foreground">{r.kills} kills</p>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-8 text-center">
        <Button asChild variant="outline" className="glass bg-transparent">
          <Link href="/results">
            Full leaderboard
            <ChevronRight className="size-4" />
          </Link>
        </Button>
      </div>
    </section>
  )
}
