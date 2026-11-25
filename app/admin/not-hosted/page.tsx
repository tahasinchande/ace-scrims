import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import { isAdminOrOwner } from "@/lib/roles"
import { db } from "@/lib/db"
import { notHostedTeams } from "@/lib/db/schema"
import { desc } from "drizzle-orm"
import { getActiveScrims } from "@/lib/queries/scrims"
import { AdminNotHosted } from "@/components/admin/admin-not-hosted"

export const dynamic = "force-dynamic"
export const metadata = { title: "Not Hosted & Refunds — RushX Organization Admin" }

export default async function AdminNotHostedPage() {
  const user = await getSessionUser()
  if (!user || !isAdminOrOwner(user.role)) {
    redirect("/admin/scrims")
  }

  const [teams, scrims] = await Promise.all([
    db.select().from(notHostedTeams).orderBy(desc(notHostedTeams.createdAt)),
    getActiveScrims(true, true),
  ])

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Not Hosted Teams & Refunds</h1>
        <p className="text-sm text-muted-foreground">
          Process automatic gateway refunds or manual refunds for teams whose scrims could not be hosted.
        </p>
      </header>
      <AdminNotHosted teams={teams} scrims={scrims} />
    </div>
  )
}
