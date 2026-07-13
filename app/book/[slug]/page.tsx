import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { SiteHeader } from "@/components/site/site-header"
import { SiteFooter } from "@/components/site/site-footer"
import { getScrimBySlug } from "@/lib/queries/scrims"
import { getSessionUser } from "@/lib/session"
import { scrimStatus } from "@/lib/format"
import { BookingWizard } from "@/components/booking/booking-wizard"

export const metadata: Metadata = {
  title: "Book Your Spot — Ace Scrims",
  description: "Reserve your squad's slot in a Free Fire scrim lobby.",
}

export default async function BookPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const [scrim, user] = await Promise.all([getScrimBySlug(slug), getSessionUser()])
  if (!scrim) notFound()
  if (!user) redirect(`/sign-in?next=/book/${slug}`)

  const status = scrimStatus(scrim.confirmedTeams, scrim.maxTeams, scrim.registrationOpen, scrim.status)
  const bookable = status.tone === "open" || status.tone === "filling"
  if (!bookable) redirect(`/scrims/${slug}`)

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen pb-20 pt-28">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
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
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
