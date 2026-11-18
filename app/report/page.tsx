import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { SiteHeader } from "@/components/site/site-header"
import { SiteFooter } from "@/components/site/site-footer"
import { getSessionUser, checkMaintenanceMode } from "@/lib/session"
import { getAllScrims } from "@/lib/queries/scrims"
import { ReportFormView } from "@/components/user/report-modal"
import { getPublicSiteSettings } from "@/lib/queries/settings"

export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  title: "Report Issue — Ace Scrims",
  description: "Submit hack, slot, prize reports, or feature requests to Ace Scrims administrators.",
}

export default async function ReportPage() {
  await checkMaintenanceMode()
  const [user, settings, scrimList] = await Promise.all([
    getSessionUser().catch(() => null),
    getPublicSiteSettings().catch(() => undefined),
    getAllScrims().catch(() => []),
  ])
  if (!user) redirect("/sign-in?next=/report")
  if (!user.emailVerified) redirect("/verify-email?next=/report")

  const formattedScrims = scrimList.map((s) => ({
    id: s.id,
    title: s.title,
    startTime: s.startTime,
    map: s.map,
  }))

  return (
    <>
      <SiteHeader user={user} settings={settings} />
      <main className="min-h-screen pb-20 pt-24">
        <div className="mx-auto w-full max-w-2xl px-4 sm:px-6">
          <div className="glass-strong flex flex-col gap-6 rounded-3xl p-6 sm:p-8 border border-border">
            <ReportFormView scrims={formattedScrims} showHeader />
          </div>
        </div>
      </main>
      <SiteFooter settings={settings} />
    </>
  )
}
