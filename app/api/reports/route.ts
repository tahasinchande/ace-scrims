import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { db, ensureSchemaReady } from "@/lib/db"
import { reports, scrims } from "@/lib/db/schema"
import { getSessionUser } from "@/lib/session"
import { desc, eq } from "drizzle-orm"
import { z } from "zod"
import { isSafeHttpOrRelativeUrl } from "@/lib/url-safety"

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

const urlArrayOrJson = z.union([z.array(z.string()), sanitizedString]).optional()

const apiReportSchema = z.object({
  scrimId: sanitizedString,
  customScrimName: sanitizedString,
  incidentDate: sanitizedString,
  reportType: z.preprocess(
    (val) => (typeof val === "string" && val.trim().length > 0 ? val.trim() : "Hacker Report"),
    z.string().max(120)
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
  videoUrls: urlArrayOrJson,
  externalLinks: urlArrayOrJson,
  proofUrlInput: sanitizedString,
  imageUrls: urlArrayOrJson,
})

function normalizeUrlList(
  inputs: Array<string | string[] | null | undefined>,
  allowImageDataUri = false
): string[] {
  const candidates: string[] = []
  for (const input of inputs) {
    if (!input) continue
    if (Array.isArray(input)) {
      for (const item of input) {
        if (typeof item === "string" && item.trim()) candidates.push(item.trim())
      }
      continue
    }
    const trimmed = input.trim()
    if (!trimmed) continue
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (typeof item === "string" && item.trim()) candidates.push(item.trim())
          }
          continue
        }
      } catch {
        // treat as literal URL
      }
    }
    candidates.push(trimmed)
  }

  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of candidates) {
    const cleaned = raw.trim().replace(/^["']|["']$/g, "")
    if (!cleaned) continue
    if (!isSafeHttpOrRelativeUrl(cleaned, { allowImageDataUri })) continue
    let canonical = cleaned
    try {
      canonical = decodeURIComponent(cleaned)
    } catch {
      // ignore
    }
    canonical = canonical.toLowerCase().replace(/\/+$/, "")
    if (!seen.has(canonical)) {
      seen.add(canonical)
      result.push(cleaned)
    }
  }
  return result
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser().catch(() => null)
    if (!user) {
      return NextResponse.json({ ok: false, error: "Authentication required. Please sign in." }, { status: 401 })
    }
    if (user.banned) {
      return NextResponse.json({ ok: false, error: "Your account is restricted from submitting reports." }, { status: 403 })
    }
    if (!user.emailVerified) {
      return NextResponse.json({ ok: false, error: "Please verify your email address to submit reports." }, { status: 403 })
    }

    await ensureSchemaReady()

    let payload: Record<string, unknown> = {}
    const contentType = req.headers.get("content-type") || ""

    if (contentType.includes("application/json")) {
      try {
        payload = await req.json()
      } catch {
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
          videoUrls: formData.get("videoUrls"),
          externalLinks: formData.get("externalLinks"),
          proofUrlInput: formData.get("proofUrlInput"),
          imageUrls: formData.get("imageUrls"),
        }
      } catch {
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
      return NextResponse.json(
        {
          ok: false,
          error: firstIssue
            ? `Validation error (${firstIssue.path.join(".")}): ${firstIssue.message}`
            : "Invalid report payload",
          details: parsed.error.issues,
        },
        { status: 400 }
      )
    }

    const data = parsed.data
    const reportType = data.reportType || "Hacker Report"

    if (reportType === "Hacker Report") {
      if (!data.hackerUid) return NextResponse.json({ ok: false, error: "Hacker Free Fire UID is required" }, { status: 400 })
      if (!data.hackerName) return NextResponse.json({ ok: false, error: "Hacker in-game name is required" }, { status: 400 })
      if (!data.whatsapp) return NextResponse.json({ ok: false, error: "Reporter WhatsApp number is required" }, { status: 400 })
    } else if (reportType === "Winner Payment Not Received") {
      if (!data.uid) return NextResponse.json({ ok: false, error: "Winner Free Fire UID is required" }, { status: 400 })
      if (!data.name) return NextResponse.json({ ok: false, error: "Winner / Team Leader name is required" }, { status: 400 })
      if (!data.whatsapp) return NextResponse.json({ ok: false, error: "WhatsApp number is required" }, { status: 400 })
    } else if (reportType === "Payment Completed But Slot Not Booked") {
      if (!data.bookingDetails) {
        return NextResponse.json({ ok: false, error: "Registration details (Team Name, Leader Name) are required" }, { status: 400 })
      }
      if (!data.trxid) return NextResponse.json({ ok: false, error: "Payment TrxID is required" }, { status: 400 })
      if (!data.whatsapp) return NextResponse.json({ ok: false, error: "WhatsApp number is required" }, { status: 400 })
    } else if (reportType === "Feature Request") {
      if (!data.description && !data.additionalInfo) {
        return NextResponse.json({ ok: false, error: "Please describe the feature you are requesting" }, { status: 400 })
      }
      if (!data.whatsapp) {
        return NextResponse.json({ ok: false, error: "WhatsApp number is required" }, { status: 400 })
      }
    } else if (reportType === "Bug Report") {
      if (!data.description && !data.additionalInfo) {
        return NextResponse.json({ ok: false, error: "Please provide a description of the bug" }, { status: 400 })
      }
      if (!data.whatsapp) {
        return NextResponse.json({ ok: false, error: "Reporter WhatsApp number is required" }, { status: 400 })
      }
    } else if (reportType === "Other Report") {
      if (!data.description && !data.additionalInfo) {
        return NextResponse.json({ ok: false, error: "Please provide a description of the issue" }, { status: 400 })
      }
      if (!data.whatsapp) return NextResponse.json({ ok: false, error: "WhatsApp number is required" }, { status: 400 })
    }

    const isGeneralNonScrim = reportType === "Feature Request" || reportType === "Bug Report"
    const metaNotes: string[] = []
    if (data.incidentDate && !isGeneralNonScrim) metaNotes.push(`Incident Date: ${data.incidentDate}`)
    if (data.customScrimName && !isGeneralNonScrim) metaNotes.push(`Scrim: ${data.customScrimName}`)
    if (data.additionalInfo) metaNotes.push(data.additionalInfo)

    const finalAdditionalInfo = metaNotes.length > 0 ? metaNotes.join(" | ") : null
    const descriptionText =
      data.description ||
      data.additionalInfo ||
      finalAdditionalInfo ||
      `Report filed for ${reportType} (${data.incidentDate || "No date"})`

    const imageUrls = normalizeUrlList(
      [data.imageUrls, !data.imageUrls ? data.proofUrlInput : null],
      true
    )
    const videoUrls = normalizeUrlList([data.videoUrls], false)
    const externalLinks = normalizeUrlList([data.externalLinks, data.videoLink], false)

    const primaryProofUrl = imageUrls.length > 0 ? imageUrls[0] : null
    const primaryVideoUrl = videoUrls[0] || externalLinks[0] || null

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
      imageUrl: imageUrls.length > 0 ? JSON.stringify(imageUrls) : null,
      videoUrl: primaryVideoUrl,
      videoUrls,
      externalLinks,
      status: "pending",
    })

    return NextResponse.json({ ok: true, reportId, message: "Report submitted successfully." })
  } catch (err: unknown) {
    console.error("[API Reports] Uncaught error handling report POST:", err)
    return NextResponse.json(
      { ok: false, error: "Unable to submit report right now. Please try again." },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const user = await getSessionUser().catch(() => null)
    if (!user || user.banned) {
      return NextResponse.json(
        { ok: false, error: "Authentication required. Please sign in to view your reports." },
        { status: 401 }
      )
    }

    await ensureSchemaReady()

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
        videoUrls: Array.isArray(r.report.videoUrls) ? r.report.videoUrls : [],
        externalLinks: Array.isArray(r.report.externalLinks) ? r.report.externalLinks : [],
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

    return NextResponse.json(
      {
        ok: true,
        reports: userReports,
        count: userReports.length,
      },
      { headers: { "Cache-Control": "no-store, private" } }
    )
  } catch (err: unknown) {
    console.error("[API GET /api/reports] Error fetching user reports:", err)
    return NextResponse.json(
      { ok: false, error: "Unable to load reports right now. Please try again." },
      { status: 500 }
    )
  }
}
