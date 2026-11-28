import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import { isAdminOrOwner } from "@/lib/roles"
import {
  getTrashScrims,
  getTrashResults,
  getTrashReports,
  getTrashImageRequests,
  getTrashUsers,
  getTrashPayments,
} from "@/lib/queries/admin"
import { AdminTrash } from "@/components/admin/admin-trash"

export const dynamic = "force-dynamic"
export const metadata = { title: "Trash & Soft-Deleted Items — RushX Organization" }

export default async function AdminTrashPage() {
  const user = await getSessionUser()
  const isAdmin = isAdminOrOwner(user?.role)
  if (!user || !isAdmin) {
    redirect("/admin/scrims")
  }

  const [trashScrims, trashResults, trashReports, trashImageRequests, trashUsers, trashPayments] =
    await Promise.all([
      getTrashScrims(),
      getTrashResults(),
      getTrashReports(),
      getTrashImageRequests(),
      getTrashUsers(),
      getTrashPayments(),
    ])
  const totalTrashCount =
    trashScrims.length +
    trashResults.length +
    trashReports.length +
    trashImageRequests.length +
    trashUsers.length +
    trashPayments.length

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Trash</h1>
            <span className="flex items-center justify-center rounded-full bg-rose-500/15 text-rose-400 px-2.5 py-0.5 text-xs font-bold font-mono">
              {totalTrashCount}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "View and restore soft-deleted scrims, match results, player reports, photo requests, users, and transactions, or purge them permanently."
              : "View soft-deleted items across all platform sections."}
          </p>
        </div>
      </header>

      <AdminTrash
        scrims={trashScrims}
        results={trashResults}
        reports={trashReports as any}
        imageRequests={trashImageRequests as any}
        users={trashUsers as any}
        payments={trashPayments as any}
      />
    </div>
  )
}
