import Link from "next/link"
import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import { getAdminStats, getAdminPayments } from "@/lib/queries/admin"
import { formatTaka } from "@/lib/format"
import { BanknoteIcon, CalendarCheck, Users, Ticket, Wallet, Swords, KeyRound } from "lucide-react"
import { AdminOverviewRecentPayments } from "@/components/admin/admin-overview-recent-payments"
import { Reveal } from "@/components/site/reveal"

export const dynamic = "force-dynamic"
export const metadata = { title: "Admin Overview — RushX Organization" }

export default async function AdminOverviewPage() {
  const user = await getSessionUser()
  if (user?.role !== "admin") redirect("/admin/scrims")

  const [stats, recentPayments] = await Promise.all([getAdminStats(), getAdminPayments()])

  const cards = [
    { label: "Today's Revenue", value: formatTaka(stats.revenueToday), icon: BanknoteIcon, accent: "text-emerald-400" },
    { label: "Today's Bookings", value: String(stats.bookingsToday), icon: CalendarCheck, accent: "text-cyan-300" },
    { label: "Total Users", value: String(stats.totalUsers), icon: Users, accent: "text-violet-300" },
    { label: "Total Bookings", value: String(stats.totalBookings), icon: Ticket, accent: "text-cyan-300" },
    { label: "All-time Revenue", value: formatTaka(stats.revenueAll), icon: Wallet, accent: "text-emerald-400" },
    { label: "Active Scrims", value: String(stats.activeScrims), icon: Swords, accent: "text-violet-300" },
  ]

  return (
    <div className="flex flex-col gap-6">
      <Reveal>
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-white">Overview</h1>
            <p className="text-sm text-slate-400">Platform analytics and recent operations at a glance.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/admin/scrims?tab=room1"
              className="rushx-btn-splash inline-flex items-center gap-2 rounded-xl border border-cyan-400/35 bg-cyan-500/12 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-cyan-200 transition-colors hover:bg-cyan-500/20 hover:text-white"
            >
              <KeyRound className="size-4 text-cyan-300" />
              Room 1 Lobbies
            </Link>
            <Link
              href="/admin/scrims"
              className="rushx-btn-splash inline-flex items-center gap-2 rounded-xl border border-violet-400/35 bg-violet-500/14 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-violet-100 transition-colors hover:bg-violet-500/24 hover:text-white"
            >
              <Swords className="size-4 text-violet-300" />
              Manage Scrims
            </Link>
          </div>
        </header>
      </Reveal>

      <Reveal delay={0.05}>
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-3">
          {cards.map((card) => {
            const Icon = card.icon
            return (
              <div key={card.label} className="dc-surface dc-card-hover rushx-box-splash flex flex-col gap-2.5 rounded-2xl p-4 sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-slate-400">{card.label}</p>
                  <Icon className={`size-4 ${card.accent}`} />
                </div>
                <p className="font-display text-2xl font-bold text-white tabular-nums">{card.value}</p>
              </div>
            )
          })}
        </div>
      </Reveal>

      <Reveal delay={0.08}>
        <AdminOverviewRecentPayments payments={recentPayments.slice(0, 15) as any} />
      </Reveal>
    </div>
  )
}
