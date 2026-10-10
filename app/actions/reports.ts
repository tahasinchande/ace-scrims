"use server"

import { randomUUID } from "crypto"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { reports } from "@/lib/db/schema"
import { getSessionUser, requireAdmin } from "@/lib/session"
import { saveUploadedFile } from "@/lib/upload"
import { eq } from "drizzle-orm"
import { z } from "zod"

// Helper to preprocess form fields: handles null, undefined, empty strings and non-string values safely
const sanitizedString = z.preprocess((val) => {
  if (val === null || val === undefined) return null
  if (typeof val === "string") {
    const trimmed = val.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  return String(val).trim()
}, z.string().nullable().optional())

const reportValidationSchema = z.object({
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
  imageUrlsJson: sanitizedString,
})

export type SubmitReportResult = {
  ok: boolean
  error: string | null
  reportId?: string
}

export async function submitReport(_prev: unknown, formData: FormData): Promise<SubmitReportResult> {
  try {
    const user = await getSessionUser()
    if (!user) {
      return { ok: false, error: "Please sign in to submit a report." }
    }
    if (!user.emailVerified) {
      return { ok: false, error: "Please verify your email address before submitting a report." }
    }

    // Extract all fields into an object
    const rawData = {
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
      imageUrlsJson: formData.get("imageUrls"),
    }

    const parsed = reportValidationSchema.safeParse(rawData)

    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]
      const errorMsg = firstIssue
        ? `${firstIssue.path.join(".")}: ${firstIssue.message}`
        : "Invalid input provided"
      console.error("[Report Action] Zod schema validation failed:", {
        issues: parsed.error.issues,
        rawData,
      })
      return { ok: false, error: errorMsg }
    }

    const data = parsed.data
    const reportType = data.reportType || "Hacker Report"

    // Contextual validation per report type with exact error messages
    if (reportType === "Hacker Report") {
      if (!data.hackerUid) {
        return { ok: false, error: "Hacker Free Fire UID is required" }
      }
      if (!data.hackerName) {
        return { ok: false, error: "Hacker in-game name is required" }
      }
      if (!data.whatsapp) {
        return { ok: false, error: "Reporter WhatsApp number is required" }
      }
    } else if (reportType === "Winner Payment Not Received") {
      if (!data.uid) {
        return { ok: false, error: "Winner Free Fire UID is required" }
      }
      if (!data.name) {
        return { ok: false, error: "Winner / Team Leader name is required" }
      }
      if (!data.whatsapp) {
        return { ok: false, error: "WhatsApp number is required" }
      }
    } else if (reportType === "Payment Completed But Slot Not Booked") {
      if (!data.bookingDetails) {
        return { ok: false, error: "Registration details (Team Name, Leader Name) are required" }
      }
      if (!data.trxid) {
        return { ok: false, error: "Payment TrxID is required" }
      }
      if (!data.whatsapp) {
        return { ok: false, error: "WhatsApp number is required" }
      }
    } else if (reportType === "Other Report") {
      if (!data.description && !data.additionalInfo) {
        return { ok: false, error: "Please provide a description of the issue" }
      }
      if (!data.whatsapp) {
        return { ok: false, error: "WhatsApp number is required" }
      }
    }

    // Combine metadata notes
    const metaNotes: string[] = []
    if (data.incidentDate) metaNotes.push(`Incident Date: ${data.incidentDate}`)
    if (data.customScrimName) metaNotes.push(`Scrim: ${data.customScrimName}`)
    if (data.additionalInfo) metaNotes.push(data.additionalInfo)

    const finalAdditionalInfo = metaNotes.length > 0 ? metaNotes.join(" | ") : null

    // Determine final description text (ensuring it is non-null for DB constraint)
    const descriptionText =
      data.description ||
      data.additionalInfo ||
      finalAdditionalInfo ||
      `Report filed for ${reportType} (${data.incidentDate || "No date"})`

    // Process image proofs (from Cloudinary JSON array, single URL, or multipart file)
    let imageUrls: string[] = []
    if (data.imageUrlsJson) {
      try {
        const parsedUrls = JSON.parse(data.imageUrlsJson)
        if (Array.isArray(parsedUrls)) {
          imageUrls = parsedUrls.filter((u): u is string => typeof u === "string" && u.trim().length > 0)
        }
      } catch {
        imageUrls = [data.imageUrlsJson]
      }
    }

    if (data.proofUrlInput && !imageUrls.includes(data.proofUrlInput)) {
      imageUrls.unshift(data.proofUrlInput)
    }

    // Fallback file upload if a raw File was submitted in FormData
    const proofFile = formData.get("proof") || formData.get("imageProof")
    if (imageUrls.length === 0 && proofFile instanceof File && proofFile.size > 0) {
      try {
        const savedUrl = await saveUploadedFile(proofFile, "reports")
        if (savedUrl) imageUrls.push(savedUrl)
      } catch (uploadErr) {
        console.error("[Report Action] File upload failed:", uploadErr)
      }
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

    revalidatePath("/dashboard/reports")
    revalidatePath("/admin/reports")
    return { ok: true, error: null, reportId }
  } catch (e: any) {
    console.error("[Report Action] submitReport uncaught exception:", e)
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to submit report. Please try again.",
    }
  }
}

export async function updateReportStatus(reportId: string, status: "pending" | "reviewed" | "resolved") {
  try {
    await requireAdmin()
    await db.update(reports).set({ status, updatedAt: new Date() }).where(eq(reports.id, reportId))
    revalidatePath("/admin/reports")
    return { ok: true, error: null }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update report status" }
  }
}

export async function deleteReport(reportId: string) {
  try {
    await requireAdmin()
    await db.delete(reports).where(eq(reports.id, reportId))
    revalidatePath("/admin/reports")
    return { ok: true, error: null }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to delete report" }
  }
}

export async function bulkDeleteReports(reportIds: string[]): Promise<{ ok: boolean; count: number; error: string | null }> {
  try {
    await requireAdmin()
    if (!reportIds || reportIds.length === 0) return { ok: true, count: 0, error: null }
    let count = 0
    for (const id of reportIds) {
      await db.delete(reports).where(eq(reports.id, id))
      count++
    }
    revalidatePath("/admin/reports")
    return { ok: true, count, error: null }
  } catch (e) {
    return { ok: false, count: 0, error: e instanceof Error ? e.message : "Failed to bulk delete reports" }
  }
}
