import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { SiteHeader } from "@/components/site/site-header"
import { SiteFooter } from "@/components/site/site-footer"
import { getScrimBySlug } from "@/lib/queries/scrims"
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

  const status = scrimStatus(scrim.confirmedTeams, scrim.maxTeams, scrim.registrationOpen, scrim.status)
  const bookable = status.tone === "open" || status.tone === "filling"
  if (!bookable) redirect(`/scrims/${slug}`)

  return (
    <>
      <SiteHeader user={user ? { name: user.name, role: user.role } : null} settings={settings} />
      <main className="min-h-screen pb-20 pt-28">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 flex flex-col gap-8">
          <BookingWizard
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
              confirmedTeams: scrim.confirmedTeams,
            }}
          />

          <ScrimRules scrim={scrim} />
        </div>
      </main>
      <SiteFooter settings={settings} />
    </>
  )
}
