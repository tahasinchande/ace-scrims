import Link from "next/link"
import { requireUser } from "@/lib/session"
import { getUserBookings, splitBookings, getUserNotifications } from "@/lib/queries/dashboard"
import { BookingCard } from "@/components/dashboard/booking-card"
import { Button } from "@/components/ui/button"
import { bdt, timeAgo } from "@/lib/format"
import { Swords, Trophy, CalendarCheck, Bell } from "lucide-react"

export default async function DashboardPage() {
  const user = await requireUser()
  const [allBookings, recentNotifications] = await Promise.all([
    getUserBookings(user.id),
    getUserNotifications(user.id, 5),
  ])
  const { upcoming, past } = splitBookings(allBookings)
  const confirmed = allBookings.filter((b) => b.status === "confirmed")
  const wins = allBookings.filter((b) => b.result)
  const totalPrize = wins.reduce((sum, b) => sum + (b.result?.prizeBdt ?? 0), 0)

  const stats = [
    { icon: CalendarCheck, label: "Total Bookings", value: String(confirmed.length) },
    { icon: Swords, label: "Upcoming Matches", value: String(upcoming.filter((b) => b.status === "confirmed").length) },
    { icon: Trophy, label: "Wins", value: String(wins.length) },
    { icon: Trophy, label: "Prize Won", value: bdt(totalPrize) },
  ]

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight">
          Welcome back, {user.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your scrim HQ — bookings, room credentials and results in one place.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="glass rounded-xl p-4">
            <s.icon className="size-4 text-primary" aria-hidden />
            <p className="mt-2 font-display text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <section aria-labelledby="upcoming-heading" className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 id="upcoming-heading" className="font-display text-xl font-bold uppercase tracking-wide">
            Upcoming Matches
          </h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/scrims">View all</Link>
          </Button>
        </div>
        {upcoming.length === 0 ? (
          <div className="glass flex flex-col items-center gap-3 rounded-2xl py-12 text-center">
            <Swords className="size-8 text-muted-foreground" aria-hidden />
            <p className="font-display font-bold uppercase">No upcoming matches</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Book a slot in tonight&apos;s lobbies before they fill up.
            </p>
            <Button asChild className="glow-primary mt-2 font-display font-bold uppercase">
              <Link href="/scrims">Browse Scrims</Link>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {upcoming.slice(0, 3).map((b) => (
              <BookingCard key={b.id} booking={b} />
            ))}
          </div>
        )}
      </section>

      {recentNotifications.length > 0 && (
        <section aria-labelledby="activity-heading" className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 id="activity-heading" className="font-display text-xl font-bold uppercase tracking-wide">
              Recent Activity
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/notifications">View all</Link>
            </Button>
          </div>
          <div className="glass divide-y divide-border/60 rounded-2xl">
            {recentNotifications.map((n) => (
              <div key={n.id} className="flex items-start gap-3 px-5 py-3.5">
                <Bell className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{n.title}</p>
                  {n.body && <p className="truncate text-xs text-muted-foreground">{n.body}</p>}
                </div>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">{timeAgo(n.createdAt)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section aria-labelledby="past-heading" className="flex flex-col gap-4">
          <h2 id="past-heading" className="font-display text-xl font-bold uppercase tracking-wide">
            Past Matches
          </h2>
          <div className="flex flex-col gap-4">
            {past.slice(0, 2).map((b) => (
              <BookingCard key={b.id} booking={b} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
