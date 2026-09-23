import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { db } from "@/lib/db"
import { reports, scrims } from "@/lib/db/schema"
import { getSessionUser } from "@/lib/session"
import { desc, eq } from "drizzle-orm"
import { z } from "zod"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const sanitizedString = z.preprocess((val) => {
  if (val === null || val === undefined) return null
  if (typeof val === "string") {
    const trimmed = val.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  return String(val).trim()
}, z.string().nullable().optional())

const apiReportSchema = z.object({
  scrimId: sanitizedString,
  customScrimName: sanitizedString,
  incidentDate: sanitizedString,
  reportType: z.preprocess(
    (val) => (typeof val === "string" && val.trim().length > 0 ? val.trim() : "Hacker Report"),
    z.string()
  ),
  whatsapp: sanitizedString,
  hackerUid: sanitizedString,
  hackerName: sanitizedString,
  uid: sanitizedString,
  name: sanitizedString,
  trxid: sanitizedString,
  bookingDetails: sanitizedString,
  description: sanitizedString,
  additionalInfo: sanitizedString,
  videoLink: sanitizedString,
  proofUrlInput: sanitizedString,
  imageUrls: z.union([z.array(z.string()), sanitizedString]).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser().catch(() => null)
    if (!user) {
      return NextResponse.json({ ok: false, error: "Authentication required. Please sign in." }, { status: 401 })
    }
    if (!user.emailVerified) {
      return NextResponse.json({ ok: false, error: "Please verify your email address to submit reports." }, { status: 403 })
    }

    let payload: any = {}
    const contentType = req.headers.get("content-type") || ""

    if (contentType.includes("application/json")) {
      try {
        payload = await req.json()
      } catch (jsonErr) {
        console.error("[API Reports] Malformed JSON payload:", jsonErr)
        return NextResponse.json({ ok: false, error: "Malformed JSON payload" }, { status: 400 })
      }
    } else if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
      try {
        const formData = await req.formData()
        payload = {
          scrimId: formData.get("scrimId"),
          customScrimName: formData.get("customScrimName"),
          incidentDate: formData.get("incidentDate"),
          reportType: formData.get("reportType"),
          whatsapp: formData.get("whatsapp"),
          hackerUid: formData.get("hackerUid"),
          hackerName: formData.get("hackerName"),
          uid: formData.get("uid"),
          name: formData.get("name"),
          trxid: formData.get("trxid"),
          bookingDetails: formData.get("bookingDetails"),
          description: formData.get("description"),
          additionalInfo: formData.get("additionalInfo"),
          videoLink: formData.get("videoLink") || formData.get("videoUrlInput"),
          proofUrlInput: formData.get("proofUrlInput"),
          imageUrls: formData.get("imageUrls"),
        }
      } catch (formErr) {
        console.error("[API Reports] Failed to parse formData:", formErr)
        return NextResponse.json({ ok: false, error: "Failed to parse form-data payload" }, { status: 400 })
      }
    } else {
      try {
        payload = await req.json()
      } catch {
        payload = {}
      }
    }

    const parsed = apiReportSchema.safeParse(payload)
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]
      const errorMsg = firstIssue
        ? `Validation error (${firstIssue.path.join(".")}): ${firstIssue.message}`
        : "Invalid report payload"
      console.error("[API Reports] Validation failed:", {
        issues: parsed.error.issues,
        receivedPayload: payload,
      })
      return NextResponse.json(
        { ok: false, error: errorMsg, details: parsed.error.issues },
        { status: 400 }
      )
    }

    const data = parsed.data
    const reportType = data.reportType || "Hacker Report"

    // Contextual checks with exact descriptive feedback
    if (reportType === "Hacker Report") {
      if (!data.hackerUid) {
        return NextResponse.json({ ok: false, error: "Hacker Free Fire UID is required" }, { status: 400 })
      }
      if (!data.hackerName) {
        return NextResponse.json({ ok: false, error: "Hacker in-game name is required" }, { status: 400 })
      }
      if (!data.whatsapp) {
        return NextResponse.json({ ok: false, error: "Reporter WhatsApp number is required" }, { status: 400 })
      }
    } else if (reportType === "Winner Payment Not Received") {
      if (!data.uid) {
        return NextResponse.json({ ok: false, error: "Winner Free Fire UID is required" }, { status: 400 })
      }
      if (!data.name) {
        return NextResponse.json({ ok: false, error: "Winner / Team Leader name is required" }, { status: 400 })
      }
      if (!data.whatsapp) {
        return NextResponse.json({ ok: false, error: "WhatsApp number is required" }, { status: 400 })
      }
    } else if (reportType === "Payment Completed But Slot Not Booked") {
      if (!data.bookingDetails) {
        return NextResponse.json({ ok: false, error: "Registration details (Team Name, Leader Name) are required" }, { status: 400 })
      }
      if (!data.trxid) {
        return NextResponse.json({ ok: false, error: "Payment TrxID is required" }, { status: 400 })
      }
      if (!data.whatsapp) {
        return NextResponse.json({ ok: false, error: "WhatsApp number is required" }, { status: 400 })
      }
    } else if (reportType === "Other Report") {
      if (!data.description && !data.additionalInfo) {
        return NextResponse.json({ ok: false, error: "Please provide a description of the issue" }, { status: 400 })
      }
      if (!data.whatsapp) {
        return NextResponse.json({ ok: false, error: "WhatsApp number is required" }, { status: 400 })
      }
    }

    // Combine metadata notes
    const metaNotes: string[] = []
    if (data.incidentDate) metaNotes.push(`Incident Date: ${data.incidentDate}`)
    if (data.customScrimName) metaNotes.push(`Scrim: ${data.customScrimName}`)
    if (data.additionalInfo) metaNotes.push(data.additionalInfo)

    const finalAdditionalInfo = metaNotes.length > 0 ? metaNotes.join(" | ") : null
    const descriptionText =
      data.description ||
      data.additionalInfo ||
      finalAdditionalInfo ||
      `Report filed for ${reportType} (${data.incidentDate || "No date"})`

    // Normalize image proofs
    let imageUrls: string[] = []
    if (Array.isArray(data.imageUrls)) {
      imageUrls = data.imageUrls.filter((u) => typeof u === "string" && u.trim().length > 0)
    } else if (typeof data.imageUrls === "string" && data.imageUrls.trim().length > 0) {
      try {
        const parsedUrls = JSON.parse(data.imageUrls)
        if (Array.isArray(parsedUrls)) {
          imageUrls = parsedUrls.filter((u): u is string => typeof u === "string" && u.trim().length > 0)
        } else {
          imageUrls = [data.imageUrls]
        }
      } catch {
        imageUrls = [data.imageUrls]
      }
    }

    if (data.proofUrlInput && !imageUrls.includes(data.proofUrlInput)) {
      imageUrls.unshift(data.proofUrlInput)
    }

    const primaryProofUrl = imageUrls.length > 0 ? imageUrls[0] : null
    const videoUrl = data.videoLink || null

    const reportId = randomUUID()
    await db.insert(reports).values({
      id: reportId,
      userId: user.id,
      scrimId: data.scrimId && data.scrimId !== "custom" ? data.scrimId : null,
      reportType,
      description: descriptionText,
      whatsapp: data.whatsapp || null,
      hackerUid: data.hackerUid || null,
      hackerName: data.hackerName || null,
      uid: data.uid || null,
      name: data.name || null,
      trxid: data.trxid || null,
      bookingDetails: data.bookingDetails || null,
      additionalInfo: finalAdditionalInfo,
      proofUrl: primaryProofUrl,
      imageUrl: imageUrls.length > 0 ? JSON.stringify(imageUrls) : primaryProofUrl,
      videoUrl,
      status: "pending",
    })

    return NextResponse.json({ ok: true, reportId, message: "Report submitted successfully." })
  } catch (err: any) {
    console.error("[API Reports] Uncaught error handling report POST:", err)
    return NextResponse.json(
      { ok: false, error: err?.message || "Internal server error submitting report" },
      { status: 500 }
    )
  }
}

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
    console.error("[API GET /api/reports] Error fetching user reports:", err)
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to fetch user reports." },
      { status: 500 }
    )
  }
}

