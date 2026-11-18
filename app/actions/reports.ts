"use server"

import { randomUUID } from "crypto"
import { revalidatePath } from "next/cache"
import { db, ensureSchemaReady } from "@/lib/db"
import { reports } from "@/lib/db/schema"
import { getSessionUser, requireAdmin } from "@/lib/session"
import { saveUploadedFile } from "@/lib/upload"
import { eq, inArray } from "drizzle-orm"
import { z } from "zod"
import { isSafeHttpOrRelativeUrl } from "@/lib/url-safety"

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
  videoUrlsJson: sanitizedString,
  externalLinksJson: sanitizedString,
  proofUrlInput: sanitizedString,
  imageUrlsJson: sanitizedString,
})

function parseAndDeduplicateUrls(
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
    if (user.banned) {
      return { ok: false, error: "Your account is restricted from submitting reports." }
    }
    if (!user.emailVerified) {
      return { ok: false, error: "Please verify your email address before submitting a report." }
    }

    await ensureSchemaReady()

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
      videoUrlsJson: formData.get("videoUrls"),
      externalLinksJson: formData.get("externalLinks"),
      proofUrlInput: formData.get("proofUrlInput"),
      imageUrlsJson: formData.get("imageUrls"),
    }

    const parsed = reportValidationSchema.safeParse(rawData)
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]
      return {
        ok: false,
        error: firstIssue ? `${firstIssue.path.join(".")}: ${firstIssue.message}` : "Invalid input provided",
      }
    }

    const data = parsed.data
    const reportType = data.reportType || "Hacker Report"

    if (reportType === "Hacker Report") {
      if (!data.hackerUid) return { ok: false, error: "Hacker Free Fire UID is required" }
      if (!data.hackerName) return { ok: false, error: "Hacker in-game name is required" }
      if (!data.whatsapp) return { ok: false, error: "Reporter WhatsApp number is required" }
    } else if (reportType === "Winner Payment Not Received") {
      if (!data.uid) return { ok: false, error: "Winner Free Fire UID is required" }
      if (!data.name) return { ok: false, error: "Winner / Team Leader name is required" }
      if (!data.whatsapp) return { ok: false, error: "WhatsApp number is required" }
    } else if (reportType === "Payment Completed But Slot Not Booked") {
      if (!data.bookingDetails) {
        return { ok: false, error: "Registration details (Team Name, Leader Name) are required" }
      }
      if (!data.trxid) return { ok: false, error: "Payment TrxID is required" }
      if (!data.whatsapp) return { ok: false, error: "WhatsApp number is required" }
    } else if (reportType === "Feature Request") {
      if (!data.description && !data.additionalInfo) {
        return { ok: false, error: "Please describe the feature you would like to request" }
      }
      if (!data.whatsapp) {
        return { ok: false, error: "WhatsApp number is required so our team can follow up" }
      }
    } else if (reportType === "Other Report") {
      if (!data.description && !data.additionalInfo) {
        return { ok: false, error: "Please provide a description of the issue" }
      }
      if (!data.whatsapp) return { ok: false, error: "WhatsApp number is required" }
    }

    const metaNotes: string[] = []
    if (data.incidentDate && reportType !== "Feature Request") {
      metaNotes.push(`Incident Date: ${data.incidentDate}`)
    }
    if (data.customScrimName && reportType !== "Feature Request") {
      metaNotes.push(`Scrim: ${data.customScrimName}`)
    }
    if (data.additionalInfo) metaNotes.push(data.additionalInfo)

    const finalAdditionalInfo = metaNotes.length > 0 ? metaNotes.join(" | ") : null

    const descriptionText =
      data.description ||
      data.additionalInfo ||
      finalAdditionalInfo ||
      `Report filed for ${reportType} (${data.incidentDate || "No date"})`

    const rawImages = parseAndDeduplicateUrls(
      [data.imageUrlsJson, !data.imageUrlsJson ? data.proofUrlInput : null],
      true
    )

    const proofFile = formData.get("proof") || formData.get("imageProof")
    if (rawImages.length === 0 && proofFile instanceof File && proofFile.size > 0) {
      try {
        const savedUrl = await saveUploadedFile(proofFile, "reports")
        if (savedUrl && isSafeHttpOrRelativeUrl(savedUrl, { allowImageDataUri: true })) {
          rawImages.push(savedUrl)
        }
      } catch (uploadErr) {
        console.error("[Report Action] File upload failed:", uploadErr)
      }
    }

    const videoUrls = parseAndDeduplicateUrls([data.videoUrlsJson], false)
    const externalLinks = parseAndDeduplicateUrls([data.externalLinksJson, data.videoLink], false)

    const primaryProofUrl = rawImages.length > 0 ? rawImages[0] : null
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
      imageUrl: rawImages.length > 0 ? JSON.stringify(rawImages) : null,
      videoUrl: primaryVideoUrl,
      videoUrls,
      externalLinks,
      status: "pending",
    })

    revalidatePath("/dashboard/reports")
    revalidatePath("/admin/reports")
    return { ok: true, error: null, reportId }
  } catch (e: unknown) {
    console.error("[Report Action] submitReport uncaught exception:", e)
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to submit report. Please try again.",
    }
  }
}

const statusSchema = z.enum(["pending", "reviewed", "resolved"])

export async function updateReportStatus(reportId: string, status: "pending" | "reviewed" | "resolved") {
  try {
    await requireAdmin()
    await ensureSchemaReady()
    const validId = z.string().trim().min(1).parse(reportId)
    const validStatus = statusSchema.parse(status)
    await db.update(reports).set({ status: validStatus, updatedAt: new Date() }).where(eq(reports.id, validId))
    revalidatePath("/admin/reports")
    revalidatePath("/dashboard/reports")
    return { ok: true, error: null }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update report status" }
  }
}

export async function deleteReport(reportId: string) {
  try {
    await requireAdmin()
    await ensureSchemaReady()
    const validId = z.string().trim().min(1).parse(reportId)
    await db.delete(reports).where(eq(reports.id, validId))
    revalidatePath("/admin/reports")
    revalidatePath("/dashboard/reports")
    return { ok: true, error: null }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to delete report" }
  }
}

export async function bulkDeleteReports(reportIds: string[]): Promise<{ ok: boolean; count: number; error: string | null }> {
  try {
    await requireAdmin()
    await ensureSchemaReady()
    const validIds = z.array(z.string().trim().min(1)).max(200).parse(reportIds || [])
    if (validIds.length === 0) return { ok: true, count: 0, error: null }
    const deleted = await db.delete(reports).where(inArray(reports.id, validIds)).returning({ id: reports.id })
    revalidatePath("/admin/reports")
    revalidatePath("/dashboard/reports")
    return { ok: true, count: deleted.length, error: null }
  } catch (e) {
    return { ok: false, count: 0, error: e instanceof Error ? e.message : "Failed to bulk delete reports" }
  }
}
