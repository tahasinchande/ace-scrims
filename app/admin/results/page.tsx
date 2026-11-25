import { getAdminResults, getAdminScrims, getHistoricalDates } from "@/lib/queries/admin"
import { getBangladeshActiveDate } from "@/lib/queries/scrims"
import { AdminResults } from "@/components/admin/admin-results"
import { getSessionUser } from "@/lib/session"
import { isAdminOrOwner } from "@/lib/roles"

export const dynamic = "force-dynamic"
export const metadata = { title: "Manage Results — RushX Organization" }

export default async function AdminResultsPage() {
  const [user, results, scrims, historicalDates] = await Promise.all([
    getSessionUser(),
    getAdminResults(),
    getAdminScrims(),
    getHistoricalDates().catch(() => []),
  ])

  const activeDate = getBangladeshActiveDate()

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Results</h1>
        <p className="text-sm text-muted-foreground">
          Publish match results, select winners directly from team lists, upload banners, and manage prize payouts.
        </p>
      </header>
      <AdminResults
        results={results}
        scrims={scrims.map((s) => ({
          id: s.id,
          title: s.title,
          startTime: s.startTime,
          prizePoolBdt: s.prizePoolBdt,
        }))}
        availableDates={historicalDates}
        initialDate={activeDate}
        isAdmin={isAdminOrOwner(user?.role)}
      />
    </div>
  )
}
