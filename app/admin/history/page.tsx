import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import { getHistoricalDates, getHistoricalBookings, getAdminScrims } from "@/lib/queries/admin"
import { getBangladeshActiveDate } from "@/lib/queries/scrims"
import { AdminHistoryView } from "@/components/admin/admin-history-view"
import { Calendar, History } from "lucide-react"

export const dynamic = "force-dynamic"
export const metadata = { title: "Historical Scrim Data — Ace Scrims Admin" }

export default async function AdminHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; scrim?: string }>
}) {
  const user = await getSessionUser()
  if (!user || (user.role !== "admin" && user.role !== "moderator")) {
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

  const bookings = await getHistoricalBookings({
    date: selectedDate,
    scrimId: selectedScrim,
  })

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
              Historical Data Archive
            </h1>
            <span className="flex items-center justify-center rounded-full bg-primary/15 text-primary px-2.5 py-0.5 text-xs font-bold font-mono">
              Archived
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            View exact confirmed rosters, player UIDs, phone numbers, and payment verification for any previous day after daily scrim reset.
          </p>
        </div>
      </header>

      <AdminHistoryView
        dates={dates}
        scrims={scrims.map((s) => ({
          id: s.id,
          title: s.title,
          startTime: s.startTime,
        }))}
        selectedDate={selectedDate}
        selectedScrimId={selectedScrim}
        bookings={bookings as any}
      />
    </div>
  )
}
