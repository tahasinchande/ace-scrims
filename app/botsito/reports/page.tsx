import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { reports, user, scrims } from "@/lib/db/schema"
import { getSessionUser } from "@/lib/session"
import { desc, eq } from "drizzle-orm"
import { AdminReports } from "@/components/admin/admin-reports"

export const metadata = { title: "Reports — Admin — Ace Scrims" }
export const dynamic = "force-dynamic"

export default async function AdminReportsPage() {
  const sessionUser = await getSessionUser()
  if (!sessionUser) redirect("/sign-in")
  // Strictly Admin-only. Moderators cannot view reports.
  if (sessionUser.role !== "admin") redirect("/botsito/scrims")

  try {
    const rows = await db
      .select({
        report: reports,
        userName: user.name,
        userPhone: user.phone,
        scrimTitle: scrims.title,
      })
      .from(reports)
      .leftJoin(user, eq(reports.userId, user.id))
      .leftJoin(scrims, eq(reports.scrimId, scrims.id))
      .orderBy(desc(reports.createdAt))

    const items = rows.map((r) => ({
      ...r.report,
      userName: r.userName,
      userPhone: r.userPhone,
      scrimTitle: r.scrimTitle,
    }))

    return <AdminReports reports={items} />
  } catch (err) {
    console.error("[AdminReportsPage] Error loading reports:", err)
    return <AdminReports reports={[]} />
  }
}
