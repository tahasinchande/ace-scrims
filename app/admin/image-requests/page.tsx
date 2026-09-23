import { getSessionUser } from "@/lib/session"
import { getAdminScrims, getAllBookingsByScrim } from "@/lib/queries/admin"
import { getAllImageRequests } from "@/app/actions/image-requests"
import { AdminImageRequestsView } from "@/components/admin/admin-image-requests-view"
import { Camera } from "lucide-react"
import { notFound } from "next/navigation"

export const dynamic = "force-dynamic"
export const metadata = { title: "MVP & Top 3 Image Requests — Ace Scrims Admin" }

export default async function AdminImageRequestsPage() {
  const user = await getSessionUser()
  if (!user || (user.role !== "admin" && user.role !== "moderator")) {
    notFound()
  }

  const [scrims, bookingsByScrim, allRequests] = await Promise.all([
    getAdminScrims(),
    getAllBookingsByScrim(),
    getAllImageRequests(),
  ])

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/20 text-primary">
              <Camera className="size-4" />
            </div>
            <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
              MVP & Top 3 Image Requests
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Request waist-up photos from registered teams and view submitted player photos for the homepage banner showcase.
          </p>
        </div>
      </header>

      <AdminImageRequestsView
        scrims={scrims}
        bookingsByScrim={bookingsByScrim}
        allRequests={allRequests}
      />
    </div>
  )
}
