import { redirect } from "next/navigation"
import { db, ensureNotHostedTable } from "@/lib/db"
import { notHostedTeams } from "@/lib/db/schema"
import { getSessionUser } from "@/lib/session"
import { desc } from "drizzle-orm"
import { AdminNotHosted } from "@/components/admin/admin-not-hosted"
import { getAllScrims } from "@/lib/queries/scrims"

export const metadata = { title: "Not Hosted & Refunds — Admin — Ace Scrims" }
export const dynamic = "force-dynamic"

export default async function AdminNotHostedPage() {
  const user = await getSessionUser()
  if (!user) redirect("/sign-in")
  if (user.role !== "admin") redirect("/admin/scrims")

  try {
    await ensureNotHostedTable().catch((err) => console.warn("[AdminNotHostedPage] ensure table warning:", err))

    const [rows, scrimList] = await Promise.all([
      db.select().from(notHostedTeams).orderBy(desc(notHostedTeams.createdAt)),
      getAllScrims().catch(() => []),
    ])

    return <AdminNotHosted teams={rows} scrims={scrimList} />
  } catch (err) {
    console.error("[AdminNotHostedPage] Error loading teams:", err)
    return <AdminNotHosted teams={[]} scrims={[]} />
  }
}

