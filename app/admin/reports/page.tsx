import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import { db } from "@/lib/db"
import { reports, user, scrims } from "@/lib/db/schema"
import { eq, desc, and } from "drizzle-orm"
import { AdminReports } from "@/components/admin/admin-reports"

export const dynamic = "force-dynamic"
export const metadata = { title: "Reports — Ace Scrims Admin" }

export default async function AdminReportsPage() {
  const sessionUser = await getSessionUser()
  if (!sessionUser || sessionUser.role !== "admin") {
    redirect("/admin/scrims")
  }

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
    .where(and(eq(reports.isTrashed, false)))
    .orderBy(desc(reports.createdAt))

  const formattedReports = rows.map((r) => ({
    id: r.report.id,
    userId: r.report.userId,
    userName: r.userName,
    userPhone: r.userPhone,
    scrimId: r.report.scrimId,
    scrimTitle: r.scrimTitle,
    reportType: r.report.reportType,
    description: r.report.description,
    proofUrl: r.report.proofUrl,
    imageUrl: r.report.imageUrl,
    videoUrl: r.report.videoUrl,
    whatsapp: r.report.whatsapp,
    hackerUid: r.report.hackerUid,
    hackerName: r.report.hackerName,
    uid: r.report.uid,
    name: r.report.name,
    trxid: r.report.trxid,
    bookingDetails: r.report.bookingDetails,
    additionalInfo: r.report.additionalInfo,
    status: r.report.status,
    createdAt: r.report.createdAt,
  }))

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Player & Hacker Reports</h1>
        <p className="text-sm text-muted-foreground">
          Review hacker claims, dispute tickets, and user submissions with uploaded proof.
        </p>
      </header>
      <AdminReports reports={formattedReports} />
    </div>
  )
}
