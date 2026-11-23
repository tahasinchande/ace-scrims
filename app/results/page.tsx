import { SiteHeader } from "@/components/site/site-header"
import { SiteFooter } from "@/components/site/site-footer"
import { getRecentResults, getLeaderboard } from "@/lib/queries/results"
import { getActiveScrims } from "@/lib/queries/scrims"
import { getPublicSiteSettings } from "@/lib/queries/settings"
import { getSessionUser, checkMaintenanceMode } from "@/lib/session"
import { ResultsView } from "@/components/results/results-view"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Results & Leaderboard — RushX Organization",
  description:
    "12 Scrim match results, winning teams, kill counts, and the team leaderboard for RushX Organization Free Fire lobbies.",
}

export default async function ResultsPage() {
  await checkMaintenanceMode()
  const [user, recent, activeScrims, leaderboard, settings] = await Promise.all([
    getSessionUser().catch(() => null),
    getRecentResults(100).catch(() => []),
    getActiveScrims().catch(() => []),
    getLeaderboard().catch(() => []),
    getPublicSiteSettings().catch(() => undefined),
  ])

  const scrimSectors = activeScrims.map((s) => ({
    id: s.id,
    title: s.title,
    startTime: s.startTime,
    map: s.map,
  }))

  return (
    <>
      <SiteHeader user={user} settings={settings} />
      <ResultsView recent={recent} scrimSectors={scrimSectors} leaderboard={leaderboard} />
      <SiteFooter settings={settings} />
    </>
  )
}
