import Link from "next/link"
import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import { getAdminStats, getAdminPayments } from "@/lib/queries/admin"
import { formatTaka } from "@/lib/format"
import { BanknoteIcon, CalendarCheck, Users, Ticket, Wallet, Swords, KeyRound } from "lucide-react"
import { AdminOverviewRecentPayments } from "@/components/admin/admin-overview-recent-payments"

export const dynamic = "force-dynamic"
export const metadata = { title: "Admin Overview — RushX Organization" }

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
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Overview</h1>
          <p className="text-sm text-muted-foreground">Platform analytics and trash management at a glance.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/scrims?tab=room1"
            className="inline-flex items-center gap-2 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-blue-300 transition-colors hover:bg-blue-500/20 hover:text-blue-200"
          >
            <KeyRound className="size-4 text-blue-400" />
            Room 1 Lobbies
          </Link>
          <Link
            href="/admin/scrims"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary/70 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-foreground transition-colors hover:bg-secondary"
          >
            <Swords className="size-4 text-primary" />
            Manage Scrims
          </Link>
        </div>
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

      <AdminOverviewRecentPayments payments={recentPayments.slice(0, 15) as any} />
    </div>
  )
}
