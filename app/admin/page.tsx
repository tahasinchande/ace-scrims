import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import { getAdminStats, getAdminPayments } from "@/lib/queries/admin"
import { formatTaka, timeAgo } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { BanknoteIcon, CalendarCheck, Users, Ticket, Wallet, Swords } from "lucide-react"

export const metadata = { title: "Admin Overview — Ace Scrims" }

export default async function AdminOverviewPage() {
  const user = await getSessionUser()
  if (user?.role !== "admin") redirect("/admin/scrims")

  const [stats, recentPayments] = await Promise.all([getAdminStats(), getAdminPayments()])

  const cards = [
    { label: "Today's Revenue", value: formatTaka(stats.revenueToday), icon: BanknoteIcon, accent: "text-primary" },
    { label: "Today's Bookings", value: String(stats.bookingsToday), icon: CalendarCheck, accent: "text-chart-3" },
    { label: "Total Users", value: String(stats.totalUsers), icon: Users, accent: "text-chart-2" },
    { label: "Total Bookings", value: String(stats.totalBookings), icon: Ticket, accent: "text-chart-3" },
    { label: "All-time Revenue", value: formatTaka(stats.revenueAll), icon: Wallet, accent: "text-primary" },
    { label: "Active Scrims", value: String(stats.activeScrims), icon: Swords, accent: "text-chart-2" },
  ]

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Overview</h1>
        <p className="text-sm text-muted-foreground">Platform analytics at a glance.</p>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="glass flex flex-col gap-2 rounded-2xl p-4">
              <div className="flex items-center gap-2">
                <Icon className={`size-4 ${card.accent}`} />
                <p className="text-xs text-muted-foreground">{card.label}</p>
              </div>
              <p className="font-display text-2xl font-bold">{card.value}</p>
            </div>
          )
        })}
      </div>

      <section className="glass rounded-2xl p-5">
        <h2 className="mb-4 font-display text-lg font-bold uppercase tracking-wide">
          Recent Payments
        </h2>
        {recentPayments.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No payments yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {recentPayments.slice(0, 10).map(({ payment, teamName, scrimTitle, userEmail }) => (
              <li key={payment.id} className="flex flex-wrap items-center gap-2 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {teamName ?? "—"}{" "}
                    <span className="text-muted-foreground">· {scrimTitle ?? "Deleted scrim"}</span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
                </div>
                <span className="font-display font-bold">{formatTaka(payment.amountBdt)}</span>
                <Badge
                  variant={payment.status === "completed" ? "default" : "secondary"}
                  className="capitalize"
                >
                  {payment.status}
                </Badge>
                <span className="text-xs text-muted-foreground">{timeAgo(payment.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
