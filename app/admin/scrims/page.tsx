import { getSessionUser } from "@/lib/session"
import { getAdminScrims } from "@/lib/queries/admin"
import { AdminScrimList } from "@/components/admin/admin-scrim-list"
import { CreateScrimButton } from "@/components/admin/scrim-form-dialog"

export const metadata = { title: "Manage Scrims — Ace Scrims" }

export default async function AdminScrimsPage() {
  const [user, scrims] = await Promise.all([getSessionUser(), getAdminScrims()])
  const isAdmin = user?.role === "admin"

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Scrims</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "Create, edit, and manage every scrim."
              : "Publish room credentials for scrims."}
          </p>
        </div>
        {isAdmin && <CreateScrimButton />}
      </header>

      <AdminScrimList scrims={scrims} isAdmin={isAdmin} />
    </div>
  )
}
