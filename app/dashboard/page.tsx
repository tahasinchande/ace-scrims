export const dynamic = "force-dynamic"

import Link from "next/link"
import { requireUser } from "@/lib/session"
import { db } from "@/lib/db"
import { user as userTable } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { getUserBookings, splitBookings, getUserNotifications, getChampionRushWhatsappUrl, getChampionRush3pmWhatsappUrl, getMainWhatsappUrl } from "@/lib/queries/dashboard"
import { getUserPendingImageRequests } from "@/app/actions/image-requests"
import { BookingCard } from "@/components/dashboard/booking-card"
import { PendingImageRequestsSection } from "@/components/dashboard/pending-image-requests"
import { Button } from "@/components/ui/button"
import { bdt, timeAgo } from "@/lib/format"
import { Swords, Trophy, CalendarCheck, Bell, Wallet, Plus, ArrowRight, UserCog } from "lucide-react"

export default async function DashboardPage() {
  const user = await requireUser()
  const [userRow, allBookings, recentNotifications, championRushWhatsappUrl, championRush3pmWhatsappUrl, mainWhatsappUrl, pendingImageRequests] = await Promise.all([
    db.select({ balance: userTable.balance }).from(userTable).where(eq(userTable.id, user.id)).limit(1),
    getUserBookings(user.id),
    getUserNotifications(user.id, 5),
    getChampionRushWhatsappUrl(),
    getChampionRush3pmWhatsappUrl(),
    getMainWhatsappUrl(),
    getUserPendingImageRequests(user.id),
  ])
  const balance = userRow[0]?.balance ?? 0
  const { upcoming, past } = splitBookings(allBookings)
  const confirmed = allBookings.filter((b) => b.status === "confirmed")
  const wins = allBookings.filter((b) => b.result)
  const totalPrize = wins.reduce((sum, b) => sum + (b.result?.prizeBdt ?? 0), 0)

  const stats = [
    { icon: Wallet, label: "Account Balance", value: bdt(balance), isWallet: true },
    { icon: CalendarCheck, label: "Total Bookings", value: String(confirmed.length) },
    { icon: Swords, label: "Upcoming Matches", value: String(upcoming.filter((b) => b.status === "confirmed").length) },
    { icon: Trophy, label: "Prize Won", value: bdt(totalPrize) },
  ]

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight">
            Welcome back, {user.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your scrim HQ — bookings, room credentials, wallet balance and results in one place.
          </p>
        </div>
        <Button asChild className="glow-primary shrink-0 font-display font-bold uppercase">
          <Link href="/dashboard/wallet" className="flex items-center gap-2">
            <Wallet className="size-4" />
            <span>Load Balance</span>
          </Link>
        </Button>
      </div>

      {/* Account Balance Highlight Banner */}
      <div className="glass relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/30 via-zinc-900/60 to-zinc-900/40 p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              <Wallet className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Live Account Balance</span>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">1-Click Booking</span>
              </div>
              <p className="font-mono text-3xl font-extrabold text-emerald-400 sm:text-4xl mt-0.5">
                {bdt(balance)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-sm">
              <Link href="/dashboard/wallet">
                <Plus className="size-3.5 mr-1" />
                Load Funds
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="border-border text-foreground hover:bg-secondary">
              <Link href="/dashboard/wallet">
                View History
                <ArrowRight className="size-3.5 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Info Setup Quick Callout */}
      <div className="glass relative overflow-hidden rounded-2xl border border-primary/30 bg-secondary/30 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <UserCog className="size-5" />
            </div>
            <div>
              <p className="font-display text-sm font-bold uppercase text-foreground">
                Squad Info Setup &amp; Auto-Fill
              </p>
              <p className="text-xs text-muted-foreground">
                Save your team name, captain UID, WhatsApp number &amp; prize payout account once to auto-fill every registration.
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="secondary" className="border border-primary/30 text-primary hover:bg-primary/10 shrink-0">
            <Link href="/dashboard/info-setup">
              Setup Squad Info
              <ArrowRight className="size-3.5 ml-1" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className={`glass rounded-xl p-4 ${s.isWallet ? "border-emerald-500/30 bg-emerald-950/10" : ""}`}>
            <s.icon className={`size-4 ${s.isWallet ? "text-emerald-400" : "text-primary"}`} aria-hidden />
            <p className={`mt-2 font-display text-2xl font-bold ${s.isWallet ? "text-emerald-400 font-mono" : ""}`}>{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <PendingImageRequestsSection requests={pendingImageRequests} />

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
              <BookingCard
                key={b.id}
                booking={b}
                mainWhatsappUrl={mainWhatsappUrl}
                championRushWhatsappUrl={championRushWhatsappUrl}
                championRush3pmWhatsappUrl={championRush3pmWhatsappUrl}
              />
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
              <BookingCard
                key={b.id}
                booking={b}
                mainWhatsappUrl={mainWhatsappUrl}
                championRushWhatsappUrl={championRushWhatsappUrl}
                championRush3pmWhatsappUrl={championRush3pmWhatsappUrl}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
