import { getSessionUser } from "@/lib/session"
import { getTrashScrims, getTrashResults } from "@/lib/queries/admin"
import { AdminTrash } from "@/components/admin/admin-trash"

export const dynamic = "force-dynamic"
export const metadata = { title: "Trash & Soft-Deleted Items — Ace Scrims" }

export default async function AdminTrashPage() {
  const [user, trashScrims, trashResults] = await Promise.all([
    getSessionUser(),
    getTrashScrims(),
    getTrashResults(),
  ])

  const isAdmin = user?.role === "admin"
  const totalTrashCount = trashScrims.length + trashResults.length

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
              ? "View and restore soft-deleted scrims and match results, or purge them permanently."
              : "View soft-deleted scrims and match results."}
          </p>
        </div>
      </header>

      <AdminTrash scrims={trashScrims} results={trashResults} />
    </div>
  )
}
