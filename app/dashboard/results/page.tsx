import { requireUser } from "@/lib/session"
import { getUserBookings } from "@/lib/queries/dashboard"
import { Badge } from "@/components/ui/badge"
import { bdt, formatDate } from "@/lib/format"
import { Trophy } from "lucide-react"

export const metadata = { title: "My Results — Ace Scrims" }

export default async function MyResultsPage() {
  const user = await requireUser()
  const bookings = await getUserBookings(user.id)
  const withResults = bookings.filter((b) => b.result)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight">My Results</h1>
        <p className="mt-1 text-sm text-muted-foreground">Matches where your team took the Booyah.</p>
      </div>

      {withResults.length === 0 ? (
        <div className="glass flex flex-col items-center gap-3 rounded-2xl py-16 text-center">
          <Trophy className="size-10 text-muted-foreground" aria-hidden />
          <p className="font-display text-xl font-bold uppercase">No wins recorded yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            When a moderator publishes a result for your team, it appears here with the prize status.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {withResults.map((b) => (
            <article key={b.id} className="glass flex flex-col gap-3 rounded-2xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-full bg-primary/15">
                    <Trophy className="size-5 text-primary" aria-hidden />
                  </div>
                  <div>
                    <p className="font-display font-bold">{b.scrim?.title ?? "Scrim"}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.result && formatDate(b.result.matchDate)} · Team {b.teamName}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="border-success/30 capitalize text-success">
                  Prize {b.result?.prizeStatus}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-secondary/60 px-2 py-2.5">
                  <p className="font-display text-lg font-bold">#{b.result?.placement ?? 1}</p>
                  <p className="text-[10px] text-muted-foreground">Placement</p>
                </div>
                <div className="rounded-lg bg-secondary/60 px-2 py-2.5">
                  <p className="font-display text-lg font-bold">{b.result?.kills ?? 0}</p>
                  <p className="text-[10px] text-muted-foreground">Kills</p>
                </div>
                <div className="rounded-lg bg-secondary/60 px-2 py-2.5">
                  <p className="font-display text-lg font-bold text-primary">{bdt(b.result?.prizeBdt ?? 0)}</p>
                  <p className="text-[10px] text-muted-foreground">Prize</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
