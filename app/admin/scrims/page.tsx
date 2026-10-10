import { getAdminScrims, getAllBookingsByScrim } from "@/lib/queries/admin"
import { AdminScrimList } from "@/components/admin/admin-scrim-list"
import { CreateScrimButton } from "@/components/admin/scrim-form-dialog"
import { getSessionUser } from "@/lib/session"

export const dynamic = "force-dynamic"
export const metadata = { title: "Manage Scrims — Ace Scrims Admin" }

export default async function AdminScrimsPage() {
  const [user, scrims, bookingsByScrim] = await Promise.all([
    getSessionUser(),
    getAdminScrims({ includeDeleted: true }),
    getAllBookingsByScrim().catch(() => ({})),
  ])

  const isAdmin = user?.role === "admin"

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Scrims</h1>
          <p className="text-sm text-muted-foreground">
            Publish room IDs and passwords, manage squad rosters, and toggle lobby registrations.
          </p>
        </div>
        {isAdmin && <CreateScrimButton />}
      </header>

      <AdminScrimList
        scrims={scrims}
        isAdmin={isAdmin}
        bookingsByScrim={bookingsByScrim}
      />
    </div>
  )
}
