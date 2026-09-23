import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { SiteHeader } from "@/components/site/site-header"
import { SiteFooter } from "@/components/site/site-footer"
import { getScrimBySlug } from "@/lib/queries/scrims"
import { getPublicSiteSettings } from "@/lib/queries/settings"
import { getChampionRushWhatsappUrl } from "@/lib/queries/dashboard"
import { getSessionUser, checkMaintenanceMode } from "@/lib/session"
import { bdt } from "@/lib/format"
import { ScrimDetailView } from "@/components/scrims/scrim-detail-view"
import { db } from "@/lib/db"
import { bookings } from "@/lib/db/schema"
import { and, eq, or } from "drizzle-orm"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const scrim = await getScrimBySlug(slug)
  if (!scrim) return { title: "Scrim Not Found — Ace Scrims" }
  return {
    title: `${scrim.title} — Ace Scrims`,
    description: scrim.description ?? `Free Fire scrim at ${scrim.startTime}, ${bdt(scrim.priceBdt)} entry.`,
  }
}

export default async function ScrimDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  await checkMaintenanceMode()
  const { slug } = await params
  const [scrim, user, settings, championRushWhatsappUrl] = await Promise.all([
    getScrimBySlug(slug),
    getSessionUser().catch(() => null),
    getPublicSiteSettings().catch(() => undefined),
    getChampionRushWhatsappUrl().catch(() => "https://whatsapp.com/channel/0029Vb7Bq9w42DcT1O2b0s3V"),
  ])
  if (!scrim) notFound()

  let isConfirmed = false
  if (user) {
    try {
      const userBookings = await db
        .select({ status: bookings.status })
        .from(bookings)
        .where(
          and(
            eq(bookings.userId, user.id),
            or(eq(bookings.scrimId, scrim.id), eq(bookings.scrimId, scrim.slug)),
            eq(bookings.status, "confirmed")
          )
        )
        .limit(1)
      isConfirmed = userBookings.length > 0
    } catch (e) {
      console.warn("[ScrimDetailPage] Could not check booking confirmation:", e)
    }
  }

  return (
    <>
      <SiteHeader user={user ? { name: user.name, role: user.role } : null} settings={settings} />
      <ScrimDetailView
        scrim={scrim}
        isConfirmed={isConfirmed}
        championRushWhatsappUrl={championRushWhatsappUrl}
      />
      <SiteFooter settings={settings} />
    </>
  )
}
