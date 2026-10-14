import { getAdminScrims, getAllBookingsByScrim, getHistoricalDates, getHistoricalBookings } from "@/lib/queries/admin"
import { getBangladeshActiveDate } from "@/lib/queries/scrims"
import { db } from "@/lib/db"
import { imageRequests, bookings } from "@/lib/db/schema"
import { desc, eq, and } from "drizzle-orm"
import { AdminImageRequestsView } from "@/components/admin/admin-image-requests-view"

export const dynamic = "force-dynamic"
export const metadata = { title: "Image Requests — Ace Scrims Admin" }

export default async function AdminImageRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; scrim?: string }>
}) {
  const { date, scrim } = (await searchParams) || {}
  const today = getBangladeshActiveDate()

  const [scrims, dates, allRequests] = await Promise.all([
    getAdminScrims({ includeDeleted: false }),
    getHistoricalDates(),
    db
      .select()
      .from(imageRequests)
      .where(eq(imageRequests.isTrashed, false))
      .orderBy(desc(imageRequests.createdAt)),
  ])

  const selectedDate = date || today
  const selectedScrimId = scrim || scrims[0]?.id || ""

  let bookingsByScrim: Record<string, any[]> = {}

  if (selectedDate === today || !date) {
    // Live / today's active bookings
    bookingsByScrim = await getAllBookingsByScrim()
  } else {
    // Historical bookings for the selected historical date
    const historicalList = await getHistoricalBookings({
      date: selectedDate,
      scrimId: "all",
    })

    // Group by scrimId
    historicalList.forEach((b: any) => {
      const sId = b.scrimId
      if (!bookingsByScrim[sId]) {
        bookingsByScrim[sId] = []
      }
      bookingsByScrim[sId].push(b)
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Image Requests & Assets</h1>
            <span className="flex items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400 px-2.5 py-0.5 text-xs font-bold font-mono">
              Live & Archive Integrated
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Request winner and MVP player photos directly from squad captains for any match date, and inspect submitted assets.
          </p>
        </div>
      </header>

      <AdminImageRequestsView
        scrims={scrims}
        bookingsByScrim={bookingsByScrim}
        allRequests={allRequests}
        dates={dates}
        selectedDate={selectedDate}
        todayDate={today}
        initialSelectedScrimId={selectedScrimId}
      />
    </div>
  )
}
