import type { Metadata } from "next"
import { Suspense } from "react"
import { SiteHeader } from "@/components/site/site-header"
import { SiteFooter } from "@/components/site/site-footer"
import { getActiveScrims, getEvaluatedScheduleOverride } from "@/lib/queries/scrims"
import { sanitizePublicScrim } from "@/lib/iceberg"
import { getPublicSiteSettings } from "@/lib/queries/settings"
import { getSessionUser, checkMaintenanceMode } from "@/lib/session"
import { ScrimsExplorer } from "@/components/scrims/scrims-explorer"
import { Skeleton } from "@/components/ui/skeleton"
import { PartnershipTickerBar } from "@/components/site/partnership-ticker-bar"

export const metadata: Metadata = {
  title: "Daily Scrims — RushX Organization",
  description:
    "Browse today's live Free Fire scrim lobbies managed by RushX Organization. Instant booking, automated checkout, and verified cash prize pools.",
}

export const dynamic = "force-dynamic"
export const revalidate = 0

function ScrimsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-72 rounded-2xl" />
      ))}
    </div>
  )
}

async function ScrimsContent() {
  await checkMaintenanceMode()
  const [scrims, user, scheduleInfo] = await Promise.all([
    getActiveScrims(),
    getSessionUser(),
    getEvaluatedScheduleOverride().catch(() => null),
  ])
  return (
    <ScrimsExplorer
      scrims={scrims.map((s) => sanitizePublicScrim(s))}
      isAuthed={!!user}
      initialScheduleStatus={scheduleInfo?.status ?? null}
    />
  )
}

export default async function ScrimsPage() {
  const settings = await getPublicSiteSettings().catch(() => undefined)

  return (
    <>
      <SiteHeader settings={settings} />
      <main className="min-h-screen pt-16 pb-20">
        <Suspense fallback={null}>
          <PartnershipTickerBar />
        </Suspense>
        <div className="mx-auto w-full max-w-6xl px-4 pt-8 sm:px-6">
          <Suspense fallback={<ScrimsSkeleton />}>
            <ScrimsContent />
          </Suspense>
        </div>
      </main>
      <SiteFooter settings={settings} />
    </>
  )
}
