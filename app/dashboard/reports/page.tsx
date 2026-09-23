import { requireUser } from "@/lib/session"
import { getUserReports } from "@/lib/queries/dashboard"
import { UserReportsList, UserReportItem } from "@/components/dashboard/user-reports-list"

export const dynamic = "force-dynamic"
export const metadata = { title: "My Reports — Ace Scrims" }

export default async function MyReportsPage() {
  const user = await requireUser()
  const rawReports = await getUserReports(user.id).catch(() => [])

  const initialReports: UserReportItem[] = rawReports.map((r) => {
    let parsedImages: string[] = []
    if (r.imageUrl) {
      try {
        if (r.imageUrl.startsWith("[")) {
          parsedImages = JSON.parse(r.imageUrl)
        } else {
          parsedImages = [r.imageUrl]
        }
      } catch {
        parsedImages = [r.imageUrl]
      }
    }

    return {
      id: r.id,
      userId: r.userId,
      scrimId: r.scrimId,
      scrimTitle: r.scrimTitle || null,
      reportType: r.reportType || "General Report",
      description: r.description || "",
      status: r.status || "pending",
      proofUrl: r.proofUrl || null,
      imageUrl: r.imageUrl || null,
      imageUrls: parsedImages,
      videoUrl: r.videoUrl || null,
      whatsapp: r.whatsapp || null,
      hackerUid: r.hackerUid || null,
      hackerName: r.hackerName || null,
      uid: r.uid || null,
      name: r.name || null,
      trxid: r.trxid || null,
      bookingDetails: r.bookingDetails || null,
      additionalInfo: r.additionalInfo || null,
      createdAt: r.createdAt ? r.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: r.updatedAt ? r.updatedAt.toISOString() : new Date().toISOString(),
    }
  })

  return <UserReportsList initialReports={initialReports} />
}
