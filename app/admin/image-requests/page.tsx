import { getAdminScrims, getAllBookingsByScrim } from "@/lib/queries/admin"
import { db } from "@/lib/db"
import { imageRequests } from "@/lib/db/schema"
import { desc, eq } from "drizzle-orm"
import { AdminImageRequestsView } from "@/components/admin/admin-image-requests-view"

export const dynamic = "force-dynamic"
export const metadata = { title: "Image Requests — Ace Scrims Admin" }

export default async function AdminImageRequestsPage() {
  const [scrims, bookingsByScrim, allRequests] = await Promise.all([
    getAdminScrims(),
    getAllBookingsByScrim(),
    db
      .select()
      .from(imageRequests)
      .where(eq(imageRequests.isTrashed, false))
      .orderBy(desc(imageRequests.createdAt)),
  ])

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Image Requests</h1>
        <p className="text-sm text-muted-foreground">
          Request winner and MVP player photos directly from squad captains, and inspect submitted assets.
        </p>
      </header>
      <AdminImageRequestsView
        scrims={scrims}
        bookingsByScrim={bookingsByScrim}
        allRequests={allRequests}
      />
    </div>
  )
}
