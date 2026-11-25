import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import { isAdminOrOwner, isStaffRole } from "@/lib/roles"
import { getHistoricalDates, getHistoricalBookings, getAdminScrims, getAdminResults } from "@/lib/queries/admin"
import { getBangladeshActiveDate } from "@/lib/queries/scrims"
import { AdminHistoryView } from "@/components/admin/admin-history-view"
import { Calendar, History } from "lucide-react"

export const dynamic = "force-dynamic"
export const metadata = { title: "Archive / Match History — RushX Organization Admin" }

export default async function AdminHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; scrim?: string }>
}) {
  const user = await getSessionUser()
  if (!user || !isStaffRole(user.role)) {
    redirect("/admin/scrims")
  }

  const { date, scrim } = await searchParams
  const today = getBangladeshActiveDate()

  // Calculate yesterday as a default fallback
  const dObj = new Date()
  dObj.setDate(dObj.getDate() - 1)
  const yesterdayStr = dObj.toISOString().slice(0, 10)

  const [dates, scrims] = await Promise.all([
    getHistoricalDates(),
    getAdminScrims({ includeDeleted: false }),
  ])

  // Select the date from searchParams, or the first historical date, or yesterday
  const selectedDate = date || (dates.length > 0 ? dates[0] : yesterdayStr)
  const selectedScrim = scrim || "all"

  const [bookings, results] = await Promise.all([
    getHistoricalBookings({
      date: selectedDate,
      scrimId: selectedScrim,
    }),
    getAdminResults({
      date: selectedDate,
      scrimId: selectedScrim,
    }),
  ])

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
              Archive / Match History
            </h1>
            <span className="flex items-center justify-center rounded-full bg-primary/15 text-primary px-2.5 py-0.5 text-xs font-bold font-mono">
              Archived
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            View exact confirmed rosters, player UIDs, phone numbers, payment verification, and publish/adjust match results for any previous date without conflicting with active live scrims.
          </p>
        </div>
      </header>

      <AdminHistoryView
        dates={dates}
        scrims={scrims.map((s) => ({
          id: s.id,
          title: s.title,
          startTime: s.startTime,
          prizePoolBdt: s.prizePoolBdt,
        }))}
        selectedDate={selectedDate}
        selectedScrimId={selectedScrim}
        bookings={bookings as any}
        results={results as any}
        isAdmin={isAdminOrOwner(user.role)}
      />
    </div>
  )
}
