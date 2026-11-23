export const dynamic = "force-dynamic"

import Link from "next/link"
import { requireUser } from "@/lib/session"
import { db } from "@/lib/db"
import { user as userTable } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { getUserBookings, splitBookings, getUserNotifications, getChampionRushWhatsappUrl, getChampionRush3pmWhatsappUrl, getMainWhatsappUrl } from "@/lib/queries/dashboard"
import { getUserPendingImageRequests } from "@/app/actions/image-requests"
import { getUserReferralRedemptionStatus } from "@/app/actions/referrals"
import { BookingCard } from "@/components/dashboard/booking-card"
import { PendingImageRequestsSection } from "@/components/dashboard/pending-image-requests"
import { ReferralRedeemCard } from "@/components/dashboard/referral-redeem-card"
import { Reveal } from "@/components/site/reveal"
import { Button } from "@/components/ui/button"
import { bdt, timeAgo } from "@/lib/format"
import { Swords, Trophy, CalendarCheck, Bell, Wallet, Plus, ArrowRight, UserCog } from "lucide-react"

export default async function DashboardPage() {
  const user = await requireUser()
  const [userRow, allBookings, recentNotifications, championRushWhatsappUrl, championRush3pmWhatsappUrl, mainWhatsappUrl, pendingImageRequests, referralRedemption] = await Promise.all([
    db.select({ balance: userTable.balance }).from(userTable).where(eq(userTable.id, user.id)).limit(1),
    getUserBookings(user.id),
    getUserNotifications(user.id, 5),
    getChampionRushWhatsappUrl(),
    getChampionRush3pmWhatsappUrl(),
    getMainWhatsappUrl(),
    getUserPendingImageRequests(user.id),
    getUserReferralRedemptionStatus(user.id),
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
    <div className="flex flex-col gap-7">
      <Reveal>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-white">
              Welcome back, {user.name.split(" ")[0]}
            </h1>
            <p className="mt-1 text-sm text-slate-400">
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
      </Reveal>

      {/* Gmail / New User 6-Hour One-Time Referral Code Redemption */}
      <ReferralRedeemCard
        isGoogleUser={referralRedemption.isGoogleUser}
        alreadyRedeemed={referralRedemption.alreadyRedeemed}
        referredByCode={referralRedemption.referredByCode}
        referredByType={referralRedemption.referredByType}
        canRedeem={referralRedemption.canRedeem}
        windowExpired={referralRedemption.windowExpired}
        windowEndsAt={referralRedemption.windowEndsAt}
        compact
      />

      {/* Luminous Obsidian-Emerald Account Balance Banner */}
      <Reveal delay={0.04}>
        <div className="dc-surface rushx-box-splash relative overflow-hidden rounded-2xl border-emerald-400/25 p-5 sm:p-6">
          <div className="pointer-events-none absolute -right-12 -top-12 size-44 rounded-full bg-emerald-500/12 blur-3xl" aria-hidden />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3.5">
              <Wallet className="mt-1 size-5 shrink-0 text-emerald-400" aria-hidden />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">
                  Live Account Balance <span className="text-emerald-400/90">· Instant Booking</span>
                </p>
                <p className="font-mono text-3xl font-extrabold text-emerald-300 sm:text-4xl mt-1 tabular-nums">
                  {bdt(balance)}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <Button asChild size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-sm border-emerald-400/30">
                <Link href="/dashboard/wallet">
                  <Plus className="size-3.5 mr-1" />
                  Load Funds
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/dashboard/wallet">
                  View History
                  <ArrowRight className="size-3.5 ml-1" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </Reveal>

      {/* Info Setup Quick Callout */}
      <Reveal delay={0.07}>
        <div className="dc-surface rushx-box-splash relative overflow-hidden rounded-2xl p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <UserCog className="mt-0.5 size-5 shrink-0 text-violet-300" aria-hidden />
              <div>
                <p className="font-display text-sm font-bold uppercase tracking-wide text-white">
                  Squad Info Setup &amp; Auto-Fill
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Save your team name, captain UID, WhatsApp number &amp; prize payout account once to auto-fill every registration.
                </p>
              </div>
            </div>
            <Button asChild size="sm" variant="outline" className="shrink-0">
              <Link href="/dashboard/info-setup">
                Setup Squad Info
                <ArrowRight className="size-3.5 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      </Reveal>

      {/* Luminous KPI Grid */}
      <Reveal delay={0.1}>
        <div className="grid grid-cols-2 gap-3.5 lg:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className={`dc-surface dc-card-hover rushx-box-splash rounded-2xl p-4 sm:p-5 ${
                s.isWallet ? "border-emerald-400/25" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-slate-400">{s.label}</p>
                <s.icon className={`size-4 ${s.isWallet ? "text-emerald-400" : "text-violet-300"}`} aria-hidden />
              </div>
              <p className={`mt-2.5 font-display text-2xl font-bold tabular-nums ${s.isWallet ? "text-emerald-300 font-mono" : "text-white"}`}>
                {s.value}
              </p>
            </div>
          ))}
        </div>
      </Reveal>

      <PendingImageRequestsSection requests={pendingImageRequests} />

      <Reveal delay={0.12}>
        <section aria-labelledby="upcoming-heading" className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 id="upcoming-heading" className="font-display text-xl font-bold uppercase tracking-wide text-white">
              Upcoming Matches
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/scrims">View all</Link>
            </Button>
          </div>
          {upcoming.length === 0 ? (
            <div className="dc-surface flex flex-col items-center gap-3 rounded-2xl py-12 text-center">
              <Swords className="size-8 text-violet-300/60" aria-hidden />
              <p className="font-display font-bold uppercase text-white">No upcoming matches</p>
              <p className="max-w-sm text-sm text-slate-400">
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
      </Reveal>

      {recentNotifications.length > 0 && (
        <Reveal delay={0.14}>
          <section aria-labelledby="activity-heading" className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 id="activity-heading" className="font-display text-xl font-bold uppercase tracking-wide text-white">
                Recent Activity
              </h2>
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard/notifications">View all</Link>
              </Button>
            </div>
            <div className="dc-surface divide-y divide-white/[0.07] rounded-2xl">
              {recentNotifications.map((n) => (
                <div key={n.id} className="flex items-start gap-3 px-5 py-3.5">
                  <Bell className="mt-0.5 size-4 shrink-0 text-violet-300" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{n.title}</p>
                    {n.body && <p className="truncate text-xs text-slate-400">{n.body}</p>}
                  </div>
                  <span className="ml-auto shrink-0 text-xs text-slate-400 tabular-nums">{timeAgo(n.createdAt)}</span>
                </div>
              ))}
            </div>
          </section>
        </Reveal>
      )}

      {past.length > 0 && (
        <Reveal delay={0.16}>
          <section aria-labelledby="past-heading" className="flex flex-col gap-4">
            <h2 id="past-heading" className="font-display text-xl font-bold uppercase tracking-wide text-white">
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
        </Reveal>
      )}
    </div>
  )
}
