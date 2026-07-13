import Image from "next/image"
import { SiteHeader } from "@/components/site/site-header"
import { SiteFooter } from "@/components/site/site-footer"
import { getRecentResults, getLeaderboard } from "@/lib/queries/results"
import { getSessionUser } from "@/lib/session"
import { formatTaka, formatDate } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Trophy, Crosshair, Medal } from "lucide-react"

export const metadata = {
  title: "Results & Leaderboard — Ace Scrims",
  description:
    "Match results, winning teams, kill counts, and the all-time team leaderboard for Ace Scrims Free Fire lobbies.",
}

const medalColor = ["text-primary", "text-muted-foreground", "text-chart-3"]

export default async function ResultsPage() {
  const [user, recent, leaderboard] = await Promise.all([
    getSessionUser(),
    getRecentResults(),
    getLeaderboard(),
  ])

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto w-full max-w-7xl px-4 py-10 md:px-6">
        <header className="mb-8">
          <p className="font-display text-sm font-semibold uppercase tracking-widest text-primary">
            Hall of Fame
          </p>
          <h1 className="font-display text-3xl font-bold uppercase tracking-wide text-balance md:text-4xl">
            Results & Leaderboard
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Every published match result with proof. Win a scrim and your squad goes on the board.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
          {/* Recent results */}
          <section aria-label="Recent match results" className="flex flex-col gap-3">
            <h2 className="font-display text-lg font-bold uppercase tracking-wide">
              Recent Matches
            </h2>
            {recent.length === 0 ? (
              <div className="glass flex flex-col items-center gap-3 rounded-2xl p-12 text-center">
                <Trophy className="size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No results published yet. Results appear here right after each scrim ends.
                </p>
              </div>
            ) : (
              <ul className="flex flex-col gap-3">
                {recent.map((r) => (
                  <li key={r.id} className="glass flex flex-col gap-3 rounded-2xl p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Trophy className="size-4 shrink-0 text-primary" />
                      <h3 className="min-w-0 flex-1 truncate font-display text-lg font-bold">
                        {r.winningTeam}
                      </h3>
                      <Badge variant={r.prizeStatus === "sent" ? "default" : "secondary"}>
                        {r.prizeStatus === "sent" ? "Prize sent" : "Prize processing"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span>{r.scrimTitle ?? "Scrim"}</span>
                      {r.scrimTime && <span>{r.scrimTime}</span>}
                      {r.scrimMap && <span>{r.scrimMap}</span>}
                      <span className="flex items-center gap-1">
                        <Crosshair className="size-3.5" />
                        {r.kills} kills
                      </span>
                      <span className="font-medium text-foreground">{formatTaka(r.prizeBdt)}</span>
                      <span>{formatDate(r.matchDate)}</span>
                    </div>
                    {r.screenshotUrl && (
                      <Image
                        src={r.screenshotUrl || "/placeholder.svg"}
                        alt={`Match result screenshot — ${r.winningTeam}`}
                        width={640}
                        height={360}
                        className="w-full max-w-md rounded-lg border border-border object-cover"
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Leaderboard */}
          <aside aria-label="Team leaderboard" className="flex flex-col gap-3">
            <h2 className="font-display text-lg font-bold uppercase tracking-wide">
              Top Teams
            </h2>
            <div className="glass rounded-2xl p-2">
              {leaderboard.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  The leaderboard fills up as results are published.
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
                          {team.wins} {team.wins === 1 ? "win" : "wins"} · {team.totalKills} kills
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
      <SiteFooter />
    </>
  )
}
