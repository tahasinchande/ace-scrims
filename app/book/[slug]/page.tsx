import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { SiteHeader } from "@/components/site/site-header"
import { SiteFooter } from "@/components/site/site-footer"
import { getScrimBySlug, userHasBooking } from "@/lib/queries/scrims"
import { getPublicSiteSettings } from "@/lib/queries/settings"
import { getSessionUser, checkMaintenanceMode } from "@/lib/session"
import { scrimStatus } from "@/lib/format"
import { BookingWizard } from "@/components/booking/booking-wizard"
import { ScrimRules } from "@/components/scrims/scrim-rules"

export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  title: "Book Your Spot — Ace Scrims",
  description: "Reserve your squad's slot in a Free Fire scrim lobby.",
}

export default async function BookPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  await checkMaintenanceMode()
  const { slug } = await params
  const [scrim, user, settings] = await Promise.all([
    getScrimBySlug(slug),
    getSessionUser().catch(() => null),
    getPublicSiteSettings().catch(() => undefined),
  ])
  if (!scrim) notFound()
  if (!user) redirect(`/sign-in?next=/book/${slug}`)
  if (!user.emailVerified) redirect(`/verify-email?next=/book/${slug}`)

  const status = scrimStatus(
    scrim.confirmedTeams,
    scrim.maxTeams,
    scrim.registrationOpen,
    scrim.status,
    scrim.scrimDate,
    scrim.startTime
  )
  const bookable = status.tone === "open" || status.tone === "filling"
  if (!bookable) redirect(`/scrims/${slug}`)

  let userBalance = 0
  let defaultInfo = null
  let alreadyBooked: { teamName: string; slotNumber: number | null } | null = null
  const { getActivePayoutMethods } = await import("@/lib/queries/payout-methods")
  const payoutMethods = await getActivePayoutMethods()

  if (user) {
    const { getUserDefaultInfo } = await import("@/lib/queries/user-info")
    const { db } = await import("@/lib/db")
    const { user: userTable } = await import("@/lib/db/schema")
    const { eq } = await import("drizzle-orm")
    const [userRow, savedInfo, existingBooking] = await Promise.all([
      db
        .select({ balance: userTable.balance })
        .from(userTable)
        .where(eq(userTable.id, user.id))
        .limit(1),
      getUserDefaultInfo(user.id),
      userHasBooking(user.id, scrim.id, scrim.scrimDate),
    ])
    userBalance = userRow[0]?.balance ?? 0
    defaultInfo = savedInfo
    if (existingBooking?.status === "confirmed") {
      alreadyBooked = {
        teamName: existingBooking.teamName,
        slotNumber: existingBooking.slotNumber ?? null,
      }
    }
  }

  return (
    <>
      <SiteHeader
        user={user ? { name: user.name, role: user.role } : null}
        initialBalance={userBalance}
        settings={settings}
      />
      <main className="min-h-screen pb-20 pt-28">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 flex flex-col gap-8">
          <BookingWizard
            userBalance={userBalance}
            defaultInfo={defaultInfo}
            alreadyBooked={alreadyBooked}
            payoutMethods={payoutMethods}
            scrim={{
              id: scrim.id,
              slug: scrim.slug,
              title: scrim.title,
              startTime: scrim.startTime,
              scrimDate: scrim.scrimDate,
              map: scrim.map,
              mode: scrim.mode,
              priceBdt: scrim.priceBdt,
              prizePoolBdt: scrim.prizePoolBdt,
              maxTeams: scrim.maxTeams,
              confirmedTeams: scrim.publicConfirmedTeams ?? scrim.confirmedTeams,
            }}
          />

          <ScrimRules scrim={scrim} />
        </div>
      </main>
      <SiteFooter settings={settings} />
    </>
  )
}
