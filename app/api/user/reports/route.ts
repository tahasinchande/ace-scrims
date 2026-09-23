import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { reports, scrims } from "@/lib/db/schema"
import { getSessionUser } from "@/lib/session"
import { desc, eq } from "drizzle-orm"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/user/reports
 * Fetches all reports submitted by the currently authenticated user, sorted by creation date (newest first).
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser().catch(() => null)
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Authentication required. Please sign in to view your reports." },
        { status: 401 }
      )
    }

    const rows = await db
      .select({
        report: reports,
        scrimTitle: scrims.title,
      })
      .from(reports)
      .leftJoin(scrims, eq(reports.scrimId, scrims.id))
      .where(eq(reports.userId, user.id))
      .orderBy(desc(reports.createdAt))

    const userReports = rows.map((r) => {
      let parsedImages: string[] = []
      if (r.report.imageUrl) {
        try {
          if (r.report.imageUrl.startsWith("[")) {
            parsedImages = JSON.parse(r.report.imageUrl)
          } else {
            parsedImages = [r.report.imageUrl]
          }
        } catch {
          parsedImages = [r.report.imageUrl]
        }
      }

      return {
        id: r.report.id,
        userId: r.report.userId,
        scrimId: r.report.scrimId,
        scrimTitle: r.scrimTitle || null,
        reportType: r.report.reportType || "General Report",
        description: r.report.description || "",
        status: r.report.status || "pending",
        proofUrl: r.report.proofUrl || null,
        imageUrl: r.report.imageUrl || null,
        imageUrls: parsedImages,
        videoUrl: r.report.videoUrl || null,
        whatsapp: r.report.whatsapp || null,
        hackerUid: r.report.hackerUid || null,
        hackerName: r.report.hackerName || null,
        uid: r.report.uid || null,
        name: r.report.name || null,
        trxid: r.report.trxid || null,
        bookingDetails: r.report.bookingDetails || null,
        additionalInfo: r.report.additionalInfo || null,
        createdAt: r.report.createdAt ? r.report.createdAt.toISOString() : new Date().toISOString(),
        updatedAt: r.report.updatedAt ? r.report.updatedAt.toISOString() : new Date().toISOString(),
      }
    })

    return NextResponse.json({
      ok: true,
      reports: userReports,
      count: userReports.length,
    })
  } catch (err: any) {
    console.error("[API GET /api/user/reports] Error fetching user reports:", err)
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to fetch user reports." },
      { status: 500 }
    )
  }
}
