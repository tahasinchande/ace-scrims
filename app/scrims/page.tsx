import type { Metadata } from "next"
import { Suspense } from "react"
import { SiteHeader } from "@/components/site/site-header"
import { SiteFooter } from "@/components/site/site-footer"
import { getActiveScrims } from "@/lib/queries/scrims"
import { getPublicSiteSettings } from "@/lib/queries/settings"
import { getSessionUser, checkMaintenanceMode } from "@/lib/session"
import { ScrimsExplorer } from "@/components/scrims/scrims-explorer"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata: Metadata = {
  title: "Daily Scrims — Ace Scrims",
  description:
    "Browse today's Free Fire scrim lobbies. 12 daily slots from 7 PM to 12 AM, ৳35 entry, 12 teams max per lobby.",
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
  const [scrims, user] = await Promise.all([getActiveScrims(), getSessionUser()])
  return <ScrimsExplorer scrims={scrims} isAuthed={!!user} />
}

export default async function ScrimsPage() {
  const settings = await getPublicSiteSettings().catch(() => undefined)

  return (
    <>
      <SiteHeader settings={settings} />
      <main className="min-h-screen pt-24 pb-20">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <Suspense fallback={<ScrimsSkeleton />}>
            <ScrimsContent />
          </Suspense>
        </div>
      </main>
      <SiteFooter settings={settings} />
    </>
  )
}
