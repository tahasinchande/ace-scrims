import { getAdminResults, getAdminScrims, getAllBookingsByScrim } from "@/lib/queries/admin"
import { AdminResults } from "@/components/admin/admin-results"
import { getSessionUser } from "@/lib/session"

export const dynamic = "force-dynamic"
export const metadata = { title: "Manage Results — Ace Scrims" }

export default async function AdminResultsPage() {
  const [user, results, scrims, bookingsByScrim] = await Promise.all([
    getSessionUser(),
    getAdminResults(),
    getAdminScrims(),
    getAllBookingsByScrim(undefined, true).catch(() => ({})),
  ])

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
        bookingsByScrim={bookingsByScrim}
        isAdmin={user?.role === "admin"}
      />
    </div>
  )
}
