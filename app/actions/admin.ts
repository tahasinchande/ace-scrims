"use server"

import { randomUUID } from "crypto"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { scrims, user, settings, notifications, bookings, payments, notHostedTeams, results, reports, chatMessages, activityLogs, imageRequests } from "@/lib/db/schema"
import { requireAdmin } from "@/lib/session"
import { logActivity } from "@/lib/notify"
import { eq, ne, and, or, sql, inArray } from "drizzle-orm"
import { z } from "zod"
import { saveUploadedFile } from "@/lib/upload"

// ─────────────────────────────────────────────────────────────────────────
// Admin-only actions. Every function begins with requireAdmin().
// ─────────────────────────────────────────────────────────────────────────

const scrimSchema = z.object({
  title: z.string().trim().min(3).max(80),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  rules: z.string().trim().max(4000).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  map: z.enum(["Bermuda", "Purgatory", "Kalahari", "Alpine", "NeXTerra"]),
  mode: z.string().trim().min(2).max(40),
  startTime: z.string().trim().min(4).max(10),
  priceBdt: z.coerce.number().int().min(0).max(10000),
  prizePoolBdt: z.coerce.number().int().min(0).max(1000000),
  maxTeams: z.coerce.number().int().min(2).max(48),
})

function slugify(title: string) {
  return `${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}-${randomUUID().slice(0, 6)}`
}

async function maybeUploadBanner(formData: FormData): Promise<string | null> {
  const directUrl = formData.get("bannerUrl")
  if (typeof directUrl === "string" && directUrl.trim().length > 0) {
    return directUrl.trim()
  }
  const file = formData.get("banner")
  if (file instanceof File && file.size > 0) {
    if (file.size > 20 * 1024 * 1024) throw new Error("Banner must be under 20MB")
    if (!file.type.startsWith("image/")) throw new Error("Banner must be an image")
    return await saveUploadedFile(file, "banners")
  }
  return null
}

function ensureGlobalRules(rules: string | null | undefined): string {
  const HACKER_RULE = "If you want to submit a hacker report, you have to submit it within 1 hour after the match gets completed."
  const PRIZE_FEE_RULE = "Please note that a 5.00 BDT fee will be deducted from the final prize payout to cover transfer charges."

  if (!rules || !rules.trim()) {
    return `1. 3 Matches (BERMUDA, PURGATORY & KALAHARI).\n2. BATTLE ROYALE squad mode (12 Teams).\n3. No emulators allowed.\n4. Join room 10-15 minutes prior to match start.\n5. ${HACKER_RULE}\n6. ${PRIZE_FEE_RULE}`
  }

  const lines = rules
    .split("\n")
    .map((r) => r.trim())
    .filter(Boolean)
    .filter(
      (r) =>
        !r.toLowerCase().includes("hacker report") &&
        !r.toLowerCase().includes("5.00 bdt fee") &&
        !r.toLowerCase().includes("final prize payout")
    )

  const renumbered = lines.map((r, i) => `${i + 1}. ${r.replace(/^\d+\.\s*/, "")}`)
  renumbered.push(`${lines.length + 1}. ${HACKER_RULE}`)
  renumbered.push(`${lines.length + 2}. ${PRIZE_FEE_RULE}`)
  return renumbered.join("\n")
}

function parseScrimForm(formData: FormData) {
  return scrimSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    rules: formData.get("rules"),
    notes: formData.get("notes"),
    map: formData.get("map"),
    mode: formData.get("mode"),
    startTime: formData.get("startTime"),
    priceBdt: formData.get("priceBdt"),
    prizePoolBdt: formData.get("prizePoolBdt"),
    maxTeams: formData.get("maxTeams"),
  })
}

export async function createScrim(_prev: unknown, formData: FormData) {
  try {
    const admin = await requireAdmin()
    const parsed = parseScrimForm(formData)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
    }
    const bannerUrl = await maybeUploadBanner(formData)
    const d = parsed.data

    await db.insert(scrims).values({
      id: randomUUID(),
      title: d.title,
      slug: slugify(d.title),
      description: d.description || null,
      rules: ensureGlobalRules(d.rules),
      notes: d.notes || null,
      map: d.map,
      mode: d.mode,
      startTime: d.startTime,
      scrimDate: new Date().toISOString().slice(0, 10),
      priceBdt: d.priceBdt,
      prizePoolBdt: d.prizePoolBdt,
      maxTeams: d.maxTeams,
      bannerUrl,
    })

    await logActivity(admin.id, "admin", "create_scrim", d.title)
    revalidatePath("/admin/scrims")
    revalidatePath("/scrims")
    revalidatePath("/")
    return { ok: true, error: null }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" }
  }
}

export async function updateScrim(_prev: unknown, formData: FormData) {
  try {
    const admin = await requireAdmin()
    const scrimId = String(formData.get("scrimId") ?? "")
    if (!scrimId) return { ok: false, error: "Missing scrim ID" }
    const parsed = parseScrimForm(formData)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
    }
    const bannerUrl = await maybeUploadBanner(formData)
    const d = parsed.data

    await db
      .update(scrims)
      .set({
        title: d.title,
        description: d.description || null,
        rules: ensureGlobalRules(d.rules),
        notes: d.notes || null,
        map: d.map,
        mode: d.mode,
        startTime: d.startTime,
        priceBdt: d.priceBdt,
        prizePoolBdt: d.prizePoolBdt,
        maxTeams: d.maxTeams,
        ...(bannerUrl ? { bannerUrl } : {}),
        updatedAt: new Date(),
      })
      .where(eq(scrims.id, scrimId))

    await logActivity(admin.id, "admin", "update_scrim", d.title)
    revalidatePath("/admin/scrims")
    revalidatePath("/scrims")
    revalidatePath("/")
    return { ok: true, error: null }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" }
  }
}

async function ensureScrimInDb(scrimId: string) {
  try {
    const existing = await db.select({ id: scrims.id }).from(scrims).where(eq(scrims.id, scrimId)).limit(1)
    if (existing.length > 0) return

    const { ALL_STANDARD_SCRIM_DEFINITIONS, getBangladeshActiveDate } = await import("@/lib/queries/scrims")
    const def = ALL_STANDARD_SCRIM_DEFINITIONS.find((d) => d.id === scrimId || d.slug === scrimId)
    if (def) {
      await db.insert(scrims).values({
        id: def.id,
        title: def.name,
        slug: def.slug,
        map: def.map,
        mode: "BATTLE ROYALE",
        startTime: def.time,
        scrimDate: getBangladeshActiveDate(),
        priceBdt: def.priceBdt,
        prizePoolBdt: def.prizePoolBdt,
        maxTeams: 12,
        bannerUrl: def.bannerUrl || "/images/scrim-1.jpg",
        hidden: false,
        status: "upcoming",
        registrationOpen: true,
      }).onConflictDoNothing()
    }
  } catch (err) {
    console.warn("[ensureScrimInDb] Error:", err)
  }
}

export async function deleteScrim(scrimId: string): Promise<{ ok: boolean; error: string | null }> {
  try {
    const user = await requireAdmin().catch(() => null)
    if (!user) {
      return { ok: false, error: "Access Denied: Only Admins can delete scrims." }
    }

    // Soft-delete in DB: mark status as deleted with timestamp and isTrashed flag
    const existing = await db.select({ id: scrims.id }).from(scrims).where(eq(scrims.id, scrimId)).limit(1)
    if (existing.length > 0) {
      await db
        .update(scrims)
        .set({
          status: "deleted",
          isTrashed: true,
          deletedAt: new Date(),
          hidden: true,
          registrationOpen: false,
          updatedAt: new Date(),
        })
        .where(eq(scrims.id, scrimId))
    } else {
      // If it's a standard definition, insert it as soft-deleted
      const { ALL_STANDARD_SCRIM_DEFINITIONS, getBangladeshActiveDate } = await import("@/lib/queries/scrims")
      const def = ALL_STANDARD_SCRIM_DEFINITIONS.find((d) => d.id === scrimId || d.slug === scrimId)
      if (def) {
        await db.insert(scrims).values({
          id: def.id,
          title: def.name,
          slug: def.slug,
          map: def.map,
          mode: "BATTLE ROYALE",
          startTime: def.time,
          scrimDate: getBangladeshActiveDate(),
          priceBdt: def.priceBdt,
          prizePoolBdt: def.prizePoolBdt,
          maxTeams: 12,
          bannerUrl: def.bannerUrl || "/images/scrim-1.jpg",
          hidden: true,
          status: "deleted",
          isTrashed: true,
          deletedAt: new Date(),
          registrationOpen: false,
        }).onConflictDoUpdate({
          target: scrims.id,
          set: {
            hidden: true,
            status: "deleted",
            isTrashed: true,
            deletedAt: new Date(),
            registrationOpen: false,
            updatedAt: new Date(),
          }
        })
      }
    }

    await logActivity(user.id, "admin", "soft_delete_scrim", scrimId)
    revalidatePath("/admin/scrims")
    revalidatePath("/admin/trash")
    revalidatePath("/scrims")
    revalidatePath("/")
    return { ok: true, error: null }
  } catch (e) {
    console.error("[deleteScrim] Error:", e)
    return { ok: false, error: e instanceof Error ? e.message : "Failed to move scrim to trash" }
  }
}

/** Bulk soft-deletes multiple scrims */
export async function bulkDeleteScrims(scrimIds: string[]): Promise<{ ok: boolean; count: number; error: string | null }> {
  try {
    const user = await requireAdmin().catch(() => null)
    if (!user) {
      return { ok: false, count: 0, error: "Access Denied: Only Admins can delete scrims." }
    }
    if (!scrimIds || scrimIds.length === 0) {
      return { ok: true, count: 0, error: null }
    }

    let count = 0
    for (const id of scrimIds) {
      const res = await deleteScrim(id)
      if (res.ok) count++
    }

    revalidatePath("/admin/scrims")
    revalidatePath("/admin/trash")
    revalidatePath("/scrims")
    revalidatePath("/")
    return { ok: true, count, error: null }
  } catch (e) {
    console.error("[bulkDeleteScrims] Error:", e)
    return { ok: false, count: 0, error: e instanceof Error ? e.message : "Failed to bulk delete scrims" }
  }
}

/** Restores a soft-deleted scrim from Trash back to active */
export async function restoreScrim(scrimId: string): Promise<{ ok: boolean; error: string | null }> {
  try {
    const user = await requireAdmin().catch(() => null)
    if (!user) {
      return { ok: false, error: "Access Denied: Only Admins can restore scrims." }
    }

    await db
      .update(scrims)
      .set({
        status: "upcoming",
        isTrashed: false,
        deletedAt: null,
        hidden: false,
        registrationOpen: true,
        updatedAt: new Date(),
      })
      .where(eq(scrims.id, scrimId))

    // Remove from permanently deleted settings if present
    try {
      const existingSetting = await db
        .select({ value: settings.value })
        .from(settings)
        .where(eq(settings.key, "permanently_deleted_scrims"))
        .limit(1)

      if (existingSetting[0]?.value) {
        const setList: string[] = JSON.parse(existingSetting[0].value)
        const filtered = setList.filter((id) => id !== scrimId)
        await db
          .update(settings)
          .set({ value: JSON.stringify(filtered), updatedAt: new Date() })
          .where(eq(settings.key, "permanently_deleted_scrims"))
      }
    } catch {
      // ignore
    }

    await logActivity(user.id, "admin", "restore_scrim", scrimId)
    revalidatePath("/admin/scrims")
    revalidatePath("/admin/trash")
    revalidatePath("/scrims")
    revalidatePath("/")
    return { ok: true, error: null }
  } catch (e) {
    console.error("[restoreScrim] Error:", e)
    return { ok: false, error: e instanceof Error ? e.message : "Failed to restore scrim" }
  }
}

/** Bulk restores multiple soft-deleted scrims from Trash */
export async function bulkRestoreScrims(scrimIds: string[]): Promise<{ ok: boolean; count: number; error: string | null }> {
  try {
    const user = await requireAdmin().catch(() => null)
    if (!user) {
      return { ok: false, count: 0, error: "Access Denied: Only Admins can restore scrims." }
    }
    if (!scrimIds || scrimIds.length === 0) {
      return { ok: true, count: 0, error: null }
    }

    let count = 0
    for (const id of scrimIds) {
      const res = await restoreScrim(id)
      if (res.ok) count++
    }

    revalidatePath("/admin/scrims")
    revalidatePath("/admin/trash")
    revalidatePath("/scrims")
    revalidatePath("/")
    return { ok: true, count, error: null }
  } catch (e) {
    console.error("[bulkRestoreScrims] Error:", e)
    return { ok: false, count: 0, error: e instanceof Error ? e.message : "Failed to bulk restore scrims" }
  }
}

/** Permanently deletes a soft-deleted scrim from database */
export async function permanentlyDeleteScrim(scrimId: string): Promise<{ ok: boolean; error: string | null }> {
  try {
    const user = await requireAdmin().catch(() => null)
    if (!user) {
      return { ok: false, error: "Access Denied: Only Admins can permanently delete scrims." }
    }

    // Clean up any bookings, payments, and results for this scrim
    await db.delete(bookings).where(eq(bookings.scrimId, scrimId))
    await db.delete(payments).where(eq(payments.scrimId, scrimId))
    await db.delete(results).where(eq(results.scrimId, scrimId))
    await db.delete(scrims).where(eq(scrims.id, scrimId))

    // Store in settings tombstone so standard definitions are never resurrected
    try {
      const existingSetting = await db
        .select({ value: settings.value })
        .from(settings)
        .where(eq(settings.key, "permanently_deleted_scrims"))
        .limit(1)

      const setList: string[] = existingSetting[0]?.value ? JSON.parse(existingSetting[0].value) : []
      if (!setList.includes(scrimId)) {
        setList.push(scrimId)
        await db
          .insert(settings)
          .values({
            key: "permanently_deleted_scrims",
            value: JSON.stringify(setList),
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: settings.key,
            set: {
              value: JSON.stringify(setList),
              updatedAt: new Date(),
            },
          })
      }
    } catch (settErr) {
      console.warn("[permanentlyDeleteScrim] Failed to write tombstone:", settErr)
    }

    await logActivity(user.id, "admin", "permanent_delete_scrim", scrimId)
    revalidatePath("/admin/scrims")
    revalidatePath("/admin/trash")
    revalidatePath("/scrims")
    revalidatePath("/")
    return { ok: true, error: null }
  } catch (e) {
    console.error("[permanentlyDeleteScrim] Error:", e)
    return { ok: false, error: e instanceof Error ? e.message : "Failed to permanently delete scrim" }
  }
}

/** Bulk permanently deletes multiple scrims */
export async function bulkPermanentlyDeleteScrims(scrimIds: string[]): Promise<{ ok: boolean; count: number; error: string | null }> {
  try {
    const user = await requireAdmin().catch(() => null)
    if (!user) {
      return { ok: false, count: 0, error: "Access Denied: Only Admins can permanently delete scrims." }
    }
    if (!scrimIds || scrimIds.length === 0) {
      return { ok: true, count: 0, error: null }
    }

    let count = 0
    for (const id of scrimIds) {
      const res = await permanentlyDeleteScrim(id)
      if (res.ok) count++
    }

    revalidatePath("/admin/scrims")
    revalidatePath("/admin/trash")
    revalidatePath("/scrims")
    revalidatePath("/")
    return { ok: true, count, error: null }
  } catch (e) {
    console.error("[bulkPermanentlyDeleteScrims] Error:", e)
    return { ok: false, count: 0, error: e instanceof Error ? e.message : "Failed to bulk delete permanently" }
  }
}

/** Restores a soft-deleted result from Trash back to active */
export async function restoreResult(resultId: string): Promise<{ ok: boolean; error: string | null }> {
  try {
    const user = await requireAdmin().catch(() => null)
    if (!user) {
      return { ok: false, error: "Access Denied: Only Admins can restore match results." }
    }

    await db
      .update(results)
      .set({
        isTrashed: false,
        deletedAt: null,
      })
      .where(eq(results.id, resultId))

    await logActivity(user.id, "admin", "restore_result", resultId)
    revalidatePath("/admin/results")
    revalidatePath("/admin/trash")
    revalidatePath("/results")
    revalidatePath("/dashboard/results")
    return { ok: true, error: null }
  } catch (e) {
    console.error("[restoreResult] Error:", e)
    return { ok: false, error: e instanceof Error ? e.message : "Failed to restore match result" }
  }
}

/** Bulk restores multiple soft-deleted results from Trash */
export async function bulkRestoreResults(resultIds: string[]): Promise<{ ok: boolean; count: number; error: string | null }> {
  try {
    const user = await requireAdmin().catch(() => null)
    if (!user) {
      return { ok: false, count: 0, error: "Access Denied: Only Admins can restore match results." }
    }
    if (!resultIds || resultIds.length === 0) {
      return { ok: true, count: 0, error: null }
    }

    let count = 0
    for (const id of resultIds) {
      const res = await restoreResult(id)
      if (res.ok) count++
    }

    revalidatePath("/admin/results")
    revalidatePath("/admin/trash")
    revalidatePath("/results")
    revalidatePath("/dashboard/results")
    return { ok: true, count, error: null }
  } catch (e) {
    console.error("[bulkRestoreResults] Error:", e)
    return { ok: false, count: 0, error: e instanceof Error ? e.message : "Failed to bulk restore results" }
  }
}

/** Permanently deletes a result from database */
export async function permanentlyDeleteResult(resultId: string): Promise<{ ok: boolean; error: string | null }> {
  try {
    const user = await requireAdmin().catch(() => null)
    if (!user) {
      return { ok: false, error: "Access Denied: Only Admins can permanently delete match results." }
    }

    await db.delete(results).where(eq(results.id, resultId))

    await logActivity(user.id, "admin", "permanent_delete_result", resultId)
    revalidatePath("/admin/results")
    revalidatePath("/admin/trash")
    revalidatePath("/results")
    revalidatePath("/dashboard/results")
    return { ok: true, error: null }
  } catch (e) {
    console.error("[permanentlyDeleteResult] Error:", e)
    return { ok: false, error: e instanceof Error ? e.message : "Failed to permanently delete match result" }
  }
}

/** Bulk permanently deletes multiple results */
export async function bulkPermanentlyDeleteResults(resultIds: string[]): Promise<{ ok: boolean; count: number; error: string | null }> {
  try {
    const user = await requireAdmin().catch(() => null)
    if (!user) {
      return { ok: false, count: 0, error: "Access Denied: Only Admins can permanently delete match results." }
    }
    if (!resultIds || resultIds.length === 0) {
      return { ok: true, count: 0, error: null }
    }

    let count = 0
    for (const id of resultIds) {
      const res = await permanentlyDeleteResult(id)
      if (res.ok) count++
    }

    revalidatePath("/admin/results")
    revalidatePath("/admin/trash")
    revalidatePath("/results")
    revalidatePath("/dashboard/results")
    return { ok: true, count, error: null }
  } catch (e) {
    console.error("[bulkPermanentlyDeleteResults] Error:", e)
    return { ok: false, count: 0, error: e instanceof Error ? e.message : "Failed to bulk delete results permanently" }
  }
}

/** Bulk Move Match Results to Trash */
export async function bulkDeleteResults(resultIds: string[]): Promise<{ ok: boolean; count: number; error: string | null }> {
  try {
    const admin = await requireAdmin()
    if (!resultIds || resultIds.length === 0) return { ok: true, count: 0, error: null }

    await db
      .update(results)
      .set({ isTrashed: true, deletedAt: new Date() })
      .where(inArray(results.id, resultIds))

    await logActivity(admin.id, "admin", "bulk_trash_results", undefined, { count: resultIds.length })
    revalidatePath("/admin/results")
    revalidatePath("/admin/trash")
    revalidatePath("/results")
    revalidatePath("/dashboard/results")
    return { ok: true, count: resultIds.length, error: null }
  } catch (e) {
    console.error("[bulkDeleteResults] Error:", e)
    return { ok: false, count: 0, error: e instanceof Error ? e.message : "Failed to move results to trash" }
  }
}

/** Trash Reports */
export async function trashReports(reportIds: string[]): Promise<{ ok: boolean; count: number; error: string | null }> {
  try {
    const admin = await requireAdmin()
    if (!reportIds || reportIds.length === 0) return { ok: true, count: 0, error: null }

    await db
      .update(reports)
      .set({ isTrashed: true, deletedAt: new Date() })
      .where(inArray(reports.id, reportIds))

    await logActivity(admin.id, "admin", "trash_reports", undefined, { count: reportIds.length })
    revalidatePath("/admin/reports")
    revalidatePath("/admin/trash")
    return { ok: true, count: reportIds.length, error: null }
  } catch (e) {
    return { ok: false, count: 0, error: e instanceof Error ? e.message : "Failed to trash reports" }
  }
}

export async function restoreReport(id: string): Promise<{ ok: boolean; error: string | null }> {
  try {
    const admin = await requireAdmin()
    await db.update(reports).set({ isTrashed: false, deletedAt: null }).where(eq(reports.id, id))
    await logActivity(admin.id, "admin", "restore_report", id)
    revalidatePath("/admin/reports")
    revalidatePath("/admin/trash")
    return { ok: true, error: null }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to restore report" }
  }
}

export async function bulkRestoreReports(ids: string[]): Promise<{ ok: boolean; count: number; error: string | null }> {
  try {
    const admin = await requireAdmin()
    if (!ids || ids.length === 0) return { ok: true, count: 0, error: null }
    await db.update(reports).set({ isTrashed: false, deletedAt: null }).where(inArray(reports.id, ids))
    await logActivity(admin.id, "admin", "bulk_restore_reports", undefined, { count: ids.length })
    revalidatePath("/admin/reports")
    revalidatePath("/admin/trash")
    return { ok: true, count: ids.length, error: null }
  } catch (e) {
    return { ok: false, count: 0, error: e instanceof Error ? e.message : "Failed to restore reports" }
  }
}

export async function permanentlyDeleteReport(id: string): Promise<{ ok: boolean; error: string | null }> {
  try {
    const admin = await requireAdmin()
    await db.delete(reports).where(eq(reports.id, id))
    await logActivity(admin.id, "admin", "permanently_delete_report", id)
    revalidatePath("/admin/reports")
    revalidatePath("/admin/trash")
    return { ok: true, error: null }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to permanently delete report" }
  }
}

export async function bulkPermanentlyDeleteReports(ids: string[]): Promise<{ ok: boolean; count: number; error: string | null }> {
  try {
    const admin = await requireAdmin()
    if (!ids || ids.length === 0) return { ok: true, count: 0, error: null }
    await db.delete(reports).where(inArray(reports.id, ids))
    await logActivity(admin.id, "admin", "bulk_permanently_delete_reports", undefined, { count: ids.length })
    revalidatePath("/admin/reports")
    revalidatePath("/admin/trash")
    return { ok: true, count: ids.length, error: null }
  } catch (e) {
    return { ok: false, count: 0, error: e instanceof Error ? e.message : "Failed to permanently delete reports" }
  }
}

/** Trash Image Requests */
export async function trashImageRequests(ids: string[]): Promise<{ ok: boolean; count: number; error: string | null }> {
  try {
    const admin = await requireAdmin()
    if (!ids || ids.length === 0) return { ok: true, count: 0, error: null }
    await db.update(imageRequests).set({ isTrashed: true, deletedAt: new Date() }).where(inArray(imageRequests.id, ids))
    await logActivity(admin.id, "admin", "trash_image_requests", undefined, { count: ids.length })
    revalidatePath("/admin/image-requests")
    revalidatePath("/admin/trash")
    return { ok: true, count: ids.length, error: null }
  } catch (e) {
    return { ok: false, count: 0, error: e instanceof Error ? e.message : "Failed to trash image requests" }
  }
}

export async function restoreImageRequest(id: string): Promise<{ ok: boolean; error: string | null }> {
  try {
    const admin = await requireAdmin()
    await db.update(imageRequests).set({ isTrashed: false, deletedAt: null }).where(eq(imageRequests.id, id))
    await logActivity(admin.id, "admin", "restore_image_request", id)
    revalidatePath("/admin/image-requests")
    revalidatePath("/admin/trash")
    return { ok: true, error: null }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to restore image request" }
  }
}

export async function bulkRestoreImageRequests(ids: string[]): Promise<{ ok: boolean; count: number; error: string | null }> {
  try {
    const admin = await requireAdmin()
    if (!ids || ids.length === 0) return { ok: true, count: 0, error: null }
    await db.update(imageRequests).set({ isTrashed: false, deletedAt: null }).where(inArray(imageRequests.id, ids))
    await logActivity(admin.id, "admin", "bulk_restore_image_requests", undefined, { count: ids.length })
    revalidatePath("/admin/image-requests")
    revalidatePath("/admin/trash")
    return { ok: true, count: ids.length, error: null }
  } catch (e) {
    return { ok: false, count: 0, error: e instanceof Error ? e.message : "Failed to restore image requests" }
  }
}

export async function permanentlyDeleteImageRequest(id: string): Promise<{ ok: boolean; error: string | null }> {
  try {
    const admin = await requireAdmin()
    await db.delete(imageRequests).where(eq(imageRequests.id, id))
    await logActivity(admin.id, "admin", "permanently_delete_image_request", id)
    revalidatePath("/admin/image-requests")
    revalidatePath("/admin/trash")
    return { ok: true, error: null }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to permanently delete image request" }
  }
}

export async function bulkPermanentlyDeleteImageRequests(ids: string[]): Promise<{ ok: boolean; count: number; error: string | null }> {
  try {
    const admin = await requireAdmin()
    if (!ids || ids.length === 0) return { ok: true, count: 0, error: null }
    await db.delete(imageRequests).where(inArray(imageRequests.id, ids))
    await logActivity(admin.id, "admin", "bulk_permanently_delete_image_requests", undefined, { count: ids.length })
    revalidatePath("/admin/image-requests")
    revalidatePath("/admin/trash")
    return { ok: true, count: ids.length, error: null }
  } catch (e) {
    return { ok: false, count: 0, error: e instanceof Error ? e.message : "Failed to permanently delete image requests" }
  }
}

/** Trash Users */
export async function trashUsers(userIds: string[]): Promise<{ ok: boolean; count: number; error: string | null }> {
  try {
    const admin = await requireAdmin()
    // Cannot trash oneself or other admins
    const targets = await db
      .select({ id: user.id, role: user.role })
      .from(user)
      .where(and(inArray(user.id, userIds), ne(user.id, admin.id), ne(user.role, "admin")))

    if (targets.length === 0) {
      return { ok: false, count: 0, error: "Cannot delete admin accounts or your own account." }
    }

    const idsToTrash = targets.map((t) => t.id)
    await db
      .update(user)
      .set({ isTrashed: true, deletedAt: new Date() })
      .where(inArray(user.id, idsToTrash))

    await logActivity(admin.id, "admin", "trash_users", undefined, { count: idsToTrash.length })
    revalidatePath("/admin/users")
    revalidatePath("/admin/trash")
    return { ok: true, count: idsToTrash.length, error: null }
  } catch (e) {
    return { ok: false, count: 0, error: e instanceof Error ? e.message : "Failed to trash users" }
  }
}

export async function restoreUser(id: string): Promise<{ ok: boolean; error: string | null }> {
  try {
    const admin = await requireAdmin()
    await db.update(user).set({ isTrashed: false, deletedAt: null }).where(eq(user.id, id))
    await logActivity(admin.id, "admin", "restore_user", id)
    revalidatePath("/admin/users")
    revalidatePath("/admin/trash")
    return { ok: true, error: null }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to restore user" }
  }
}

export async function bulkRestoreUsers(ids: string[]): Promise<{ ok: boolean; count: number; error: string | null }> {
  try {
    const admin = await requireAdmin()
    if (!ids || ids.length === 0) return { ok: true, count: 0, error: null }
    await db.update(user).set({ isTrashed: false, deletedAt: null }).where(inArray(user.id, ids))
    await logActivity(admin.id, "admin", "bulk_restore_users", undefined, { count: ids.length })
    revalidatePath("/admin/users")
    revalidatePath("/admin/trash")
    return { ok: true, count: ids.length, error: null }
  } catch (e) {
    return { ok: false, count: 0, error: e instanceof Error ? e.message : "Failed to restore users" }
  }
}

export async function permanentlyDeleteUser(id: string): Promise<{ ok: boolean; error: string | null }> {
  try {
    const admin = await requireAdmin()
    if (id === admin.id) return { ok: false, error: "Cannot delete your own account" }
    await db.delete(user).where(and(eq(user.id, id), ne(user.role, "admin")))
    await logActivity(admin.id, "admin", "permanently_delete_user", id)
    revalidatePath("/admin/users")
    revalidatePath("/admin/trash")
    return { ok: true, error: null }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to permanently delete user" }
  }
}

export async function bulkPermanentlyDeleteUsers(ids: string[]): Promise<{ ok: boolean; count: number; error: string | null }> {
  try {
    const admin = await requireAdmin()
    if (!ids || ids.length === 0) return { ok: true, count: 0, error: null }
    await db.delete(user).where(and(inArray(user.id, ids), ne(user.id, admin.id), ne(user.role, "admin")))
    await logActivity(admin.id, "admin", "bulk_permanently_delete_users", undefined, { count: ids.length })
    revalidatePath("/admin/users")
    revalidatePath("/admin/trash")
    return { ok: true, count: ids.length, error: null }
  } catch (e) {
    return { ok: false, count: 0, error: e instanceof Error ? e.message : "Failed to permanently delete users" }
  }
}

/** Trash Payments */
export async function trashPayments(paymentIds: string[]): Promise<{ ok: boolean; count: number; error: string | null }> {
  try {
    const admin = await requireAdmin()
    if (!paymentIds || paymentIds.length === 0) return { ok: true, count: 0, error: null }
    await db.update(payments).set({ isTrashed: true, deletedAt: new Date() }).where(inArray(payments.id, paymentIds))
    await logActivity(admin.id, "admin", "trash_payments", undefined, { count: paymentIds.length })
    revalidatePath("/admin/payments")
    revalidatePath("/admin/trash")
    revalidatePath("/admin")
    return { ok: true, count: paymentIds.length, error: null }
  } catch (e) {
    return { ok: false, count: 0, error: e instanceof Error ? e.message : "Failed to trash payments" }
  }
}

export async function restorePayment(id: string): Promise<{ ok: boolean; error: string | null }> {
  try {
    const admin = await requireAdmin()
    await db.update(payments).set({ isTrashed: false, deletedAt: null }).where(eq(payments.id, id))
    await logActivity(admin.id, "admin", "restore_payment", id)
    revalidatePath("/admin/payments")
    revalidatePath("/admin/trash")
    revalidatePath("/admin")
    return { ok: true, error: null }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to restore payment" }
  }
}

export async function bulkRestorePayments(ids: string[]): Promise<{ ok: boolean; count: number; error: string | null }> {
  try {
    const admin = await requireAdmin()
    if (!ids || ids.length === 0) return { ok: true, count: 0, error: null }
    await db.update(payments).set({ isTrashed: false, deletedAt: null }).where(inArray(payments.id, ids))
    await logActivity(admin.id, "admin", "bulk_restore_payments", undefined, { count: ids.length })
    revalidatePath("/admin/payments")
    revalidatePath("/admin/trash")
    revalidatePath("/admin")
    return { ok: true, count: ids.length, error: null }
  } catch (e) {
    return { ok: false, count: 0, error: e instanceof Error ? e.message : "Failed to restore payments" }
  }
}

export async function permanentlyDeletePayment(id: string): Promise<{ ok: boolean; error: string | null }> {
  try {
    const admin = await requireAdmin()
    await db.delete(payments).where(eq(payments.id, id))
    await logActivity(admin.id, "admin", "permanently_delete_payment", id)
    revalidatePath("/admin/payments")
    revalidatePath("/admin/trash")
    revalidatePath("/admin")
    return { ok: true, error: null }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to permanently delete payment" }
  }
}

export async function bulkPermanentlyDeletePayments(ids: string[]): Promise<{ ok: boolean; count: number; error: string | null }> {
  try {
    const admin = await requireAdmin()
    if (!ids || ids.length === 0) return { ok: true, count: 0, error: null }
    await db.delete(payments).where(inArray(payments.id, ids))
    await logActivity(admin.id, "admin", "bulk_permanently_delete_payments", undefined, { count: ids.length })
    revalidatePath("/admin/payments")
    revalidatePath("/admin/trash")
    revalidatePath("/admin")
    return { ok: true, count: ids.length, error: null }
  } catch (e) {
    return { ok: false, count: 0, error: e instanceof Error ? e.message : "Failed to permanently delete payments" }
  }
}

/** Admin Action: Data Reset / Wipe Test Data (preserves scrims, admin accounts, and user accounts) */
export async function wipeTestData(): Promise<{ ok: boolean; message?: string; error?: string | null }> {
  try {
    const admin = await requireAdmin()

    // 1. Delete test reports
    await db.delete(reports)

    // 2. Delete test payments and bookings
    await db.delete(payments)
    await db.delete(bookings)

    // 3. Delete live chat history
    await db.delete(chatMessages)

    // 4. Delete not-hosted archived teams
    await db.delete(notHostedTeams)

    // 5. Delete test notifications & activity logs (overview stats history)
    await db.delete(notifications)
    await db.delete(activityLogs)

    // 6. Delete test results
    await db.delete(results)

    // 7. Delete test image requests
    await db.delete(imageRequests)

    // NOTE: SCRIMS ARE LEFT UNTOUCHED (DO NOT DELETE, RESET, OR MODIFY ANY SCRIMS)

    revalidatePath("/admin/scrims")
    revalidatePath("/admin/not-hosted")
    revalidatePath("/admin/payments")
    revalidatePath("/admin/reports")
    revalidatePath("/admin/results")
    revalidatePath("/admin/image-requests")
    revalidatePath("/admin/chat")
    revalidatePath("/admin/logs")
    revalidatePath("/admin/trash")
    revalidatePath("/admin")
    revalidatePath("/dashboard")
    revalidatePath("/scrims")
    revalidatePath("/")

    return { ok: true, message: "Testing history wiped successfully for Overview stats, Results, Live Chat, Reports, Image Requests, and Payments. Scrims and User accounts remain intact." }
  } catch (e) {
    console.error("[wipeTestData] Error:", e)
    return { ok: false, error: e instanceof Error ? e.message : "Failed to reset test data" }
  }
}

/** Complete Fresh Deployment Wipe */
export async function wipeDeploymentData(options?: { deleteNonAdminUsers?: boolean }): Promise<{ ok: boolean; message?: string; error?: string | null }> {
  try {
    const admin = await requireAdmin()

    // 1. Wipe test payments and bookings
    await db.delete(payments)
    await db.delete(bookings)

    // 2. Wipe player image requests
    await db.delete(imageRequests)

    // 3. Wipe not-hosted teams
    await db.delete(notHostedTeams)

    // 4. Wipe match results & banners
    await db.delete(results)

    // 5. Wipe reports
    await db.delete(reports)

    // 6. Wipe chat messages
    await db.delete(chatMessages)

    // 7. Wipe user notifications & activity logs
    await db.delete(notifications)
    await db.delete(activityLogs)

    // 8. Optionally wipe non-admin test users (strictly preserving admin accounts)
    if (options?.deleteNonAdminUsers) {
      await db.delete(user).where(ne(user.role, "admin"))
    }

    revalidatePath("/")
    revalidatePath("/admin")
    revalidatePath("/admin/scrims")
    revalidatePath("/admin/results")
    revalidatePath("/admin/payments")
    revalidatePath("/admin/reports")
    revalidatePath("/admin/image-requests")
    revalidatePath("/admin/users")
    revalidatePath("/admin/trash")
    revalidatePath("/admin/chat")
    revalidatePath("/dashboard")
    revalidatePath("/scrims")

    return {
      ok: true,
      message: "Database successfully cleared for fresh production deployment! All test payments, bookings, results, reports, chat, and dashboard histories have been truncated.",
    }
  } catch (e) {
    console.error("[wipeDeploymentData] Error:", e)
    return { ok: false, error: e instanceof Error ? e.message : "Failed to wipe database for deployment" }
  }
}

export async function toggleScrimHidden(scrimId: string, hidden: boolean): Promise<{ ok: boolean; error: string | null }> {
  try {
    const admin = await requireAdmin()
    await ensureScrimInDb(scrimId)
    await db
      .update(scrims)
      .set({ hidden, updatedAt: new Date() })
      .where(eq(scrims.id, scrimId))
    await logActivity(admin.id, "admin", hidden ? "hide_scrim" : "show_scrim", scrimId)
    revalidatePath("/admin/scrims")
    revalidatePath("/scrims")
    revalidatePath("/")
    return { ok: true, error: null }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update visibility" }
  }
}

export async function toggleRegistration(scrimId: string, open: boolean): Promise<{ ok: boolean; error: string | null }> {
  try {
    const admin = await requireAdmin()
    await ensureScrimInDb(scrimId)
    await db
      .update(scrims)
      .set({ registrationOpen: open, updatedAt: new Date() })
      .where(eq(scrims.id, scrimId))
    await logActivity(admin.id, "admin", open ? "open_registration" : "close_registration", scrimId)
    revalidatePath("/admin/scrims")
    revalidatePath("/scrims")
    revalidatePath("/")
    return { ok: true, error: null }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to toggle registration" }
  }
}

export async function toggleScrimStatus(
  scrimId: string,
  status: "upcoming" | "live" | "registration_closed" | "completed"
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const admin = await requireAdmin()
    await ensureScrimInDb(scrimId)
    const isClosed = status === "registration_closed" || status === "completed"
    await db
      .update(scrims)
      .set({
        status,
        registrationOpen: !isClosed,
        updatedAt: new Date(),
      })
      .where(eq(scrims.id, scrimId))
    await logActivity(admin.id, "admin", "toggle_scrim_status", scrimId, { status })
    revalidatePath("/admin/scrims")
    revalidatePath("/scrims")
    revalidatePath("/")
    return { ok: true, error: null }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update scrim status" }
  }
}

export async function markScrimNotHosted(scrimId: string) {
  const admin = await requireAdmin()
  const { executeMarkScrimNotHosted } = await import("@/app/actions/not-hosted")
  return executeMarkScrimNotHosted(scrimId, admin.id, admin.role)
}

export async function deleteResult(resultId: string) {
  const admin = await requireAdmin()
  const { results } = await import("@/lib/db/schema")
  await db.delete(results).where(eq(results.id, resultId))
  await logActivity(admin.id, "admin", "delete_result", resultId)
  revalidatePath("/admin/results")
  revalidatePath("/results")
  revalidatePath("/dashboard/results")
}

// ── User management ─────────────────────────────────────────────────────

export async function setUserRole(userId: string, role: "user" | "moderator" | "admin") {
  const admin = await requireAdmin()
  if (userId === admin.id) throw new Error("You cannot change your own role")
  await db.update(user).set({ role, updatedAt: new Date() }).where(eq(user.id, userId))
  await logActivity(admin.id, "admin", "set_role", userId, { role })
  revalidatePath("/admin/users")
}

export async function setUserBanned(userId: string, banned: boolean) {
  const admin = await requireAdmin()
  if (userId === admin.id) throw new Error("You cannot ban yourself")
  await db.update(user).set({ banned, updatedAt: new Date() }).where(eq(user.id, userId))
  await logActivity(admin.id, "admin", banned ? "ban_user" : "unban_user", userId)
  revalidatePath("/admin/users")
}

// ── Settings & announcements ────────────────────────────────────────────

export async function setSetting(key: string, value: string): Promise<{ ok: boolean; error: string | null }> {
  try {
    const admin = await requireAdmin()
    const allowed = [
      "announcement",
      "discord_url",
      "facebook_url",
      "youtube_url",
      "tiktok_url",
      "whatsapp_channel_url",
      "telegram_url",
      "instagram_url",
      "support_whatsapp",
      "champion_rush_whatsapp_url",
      "support_kori_url",
      "show_room2",
      "maintenance_mode",
      "staff_portal_path",
      "friday_scrims_override",
      "rules_general",
      "payment_note",
      "site_logo_url",
    ]
    if (!allowed.includes(key)) return { ok: false, error: "Unknown setting: " + key }
    await db
      .insert(settings)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } })
    await logActivity(admin.id, "admin", "update_setting", key)
    revalidatePath("/admin/settings")
    revalidatePath("/admin/scrims")
    revalidatePath("/")
    return { ok: true, error: null }
  } catch (err: any) {
    return { ok: false, error: err?.message || "Failed to update setting" }
  }
}

export async function saveAllSiteSettings(
  settingsMap: Record<string, string>
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const admin = await requireAdmin()
    const allowedKeys = new Set([
      "announcement",
      "discord_url",
      "facebook_url",
      "youtube_url",
      "tiktok_url",
      "whatsapp_channel_url",
      "telegram_url",
      "instagram_url",
      "support_whatsapp",
      "champion_rush_whatsapp_url",
      "support_kori_url",
      "show_room2",
      "maintenance_mode",
      "staff_portal_path",
      "friday_scrims_override",
      "rules_general",
      "payment_note",
      "site_logo_url",
    ])

    for (const [key, val] of Object.entries(settingsMap)) {
      if (!allowedKeys.has(key)) continue
      await db
        .insert(settings)
        .values({ key, value: String(val ?? ""), updatedAt: new Date() })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: String(val ?? ""), updatedAt: new Date() },
        })
    }

    await logActivity(admin.id, "admin", "batch_update_settings")
    revalidatePath("/admin/settings")
    revalidatePath("/")
    return { ok: true, error: null }
  } catch (e) {
    console.error("[saveAllSiteSettings] Error:", e)
    return { ok: false, error: e instanceof Error ? e.message : "Failed to save settings" }
  }
}

const broadcastSchema = z.object({
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().max(500).optional().or(z.literal("")),
})

export async function broadcastNotification(_prev: unknown, formData: FormData) {
  try {
    const admin = await requireAdmin()
    const parsed = broadcastSchema.safeParse({
      title: formData.get("title"),
      body: formData.get("body"),
    })
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
    }
    const users = await db
      .select({ id: user.id })
      .from(user)
      .where(ne(user.banned, true))
    if (users.length > 0) {
      await db.insert(notifications).values(
        users.map((u) => ({
          id: randomUUID(),
          userId: u.id,
          type: "announcement",
          title: parsed.data.title,
          body: parsed.data.body || null,
        })),
      )
    }
    await logActivity(admin.id, "admin", "broadcast", parsed.data.title)
    revalidatePath("/dashboard/notifications")
    return { ok: true, error: null }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" }
  }
}

export async function deleteBroadcast(notificationId: string) {
  const admin = await requireAdmin()
  await db.delete(notifications).where(eq(notifications.id, notificationId))
  await logActivity(admin.id, "admin", "delete_broadcast", notificationId)
  revalidatePath("/dashboard/notifications")
  revalidatePath("/admin/announcements")
}

export async function bulkDeleteBookings(bookingIds: string[]): Promise<{ ok: boolean; count: number; error?: string }> {
  try {
    const admin = await requireAdmin()
    if (!bookingIds || bookingIds.length === 0) return { ok: true, count: 0 }
    
    await db
      .update(bookings)
      .set({ isTrashed: true, deletedAt: new Date(), updatedAt: new Date() })
      .where(inArray(bookings.id, bookingIds))

    await logActivity(admin.id, "admin", "bulk_trash_bookings", undefined, { count: bookingIds.length })
    revalidatePath("/admin/history")
    revalidatePath("/admin/scrims")
    revalidatePath("/admin/trash")
    return { ok: true, count: bookingIds.length }
  } catch (err: any) {
    return { ok: false, count: 0, error: err?.message || "Failed to delete bookings" }
  }
}

export async function queryHistoricalScrimsAction(date: string, scrimId?: string) {
  try {
    const { getAdminScrims, getHistoricalBookings } = await import("@/lib/queries/admin")
    const { results } = await import("@/lib/db/schema")
    
    const allScrims = await getAdminScrims({ includeDeleted: true })
    const allBookings = await getHistoricalBookings({ date })
    
    const scrimMap = new Map<string, typeof allBookings>()
    for (const b of allBookings) {
      const list = scrimMap.get(b.scrimId) || []
      list.push(b)
      scrimMap.set(b.scrimId, list)
    }

    const scrimsMeta = allScrims.map((s) => {
      const bList = scrimMap.get(s.id) || (s.slug ? scrimMap.get(s.slug) : []) || []
      return {
        id: s.id,
        title: s.title,
        slug: s.slug,
        startTime: s.startTime,
        map: s.map,
        priceBdt: s.priceBdt,
        prizePoolBdt: s.prizePoolBdt,
        maxTeams: s.maxTeams,
        confirmedCount: bList.filter((b: any) => b.status === "confirmed").length,
      }
    })

    const targetScrim = scrimId 
      ? scrimsMeta.find((s) => s.id === scrimId || s.slug === scrimId) || scrimsMeta[0] 
      : scrimsMeta[0]

    let roster: any[] = []
    let result: any = null

    if (targetScrim) {
      roster = scrimMap.get(targetScrim.id) || (targetScrim.slug ? scrimMap.get(targetScrim.slug) : []) || []
      
      const foundResults = await db
        .select()
        .from(results)
        .where(
          and(
            or(eq(results.scrimId, targetScrim.id), eq(results.scrimId, targetScrim.slug || "")),
            eq(results.matchDate, date),
            eq(results.isTrashed, false)
          )
        )
        .limit(1)
      result = foundResults[0] || null
    }

    return {
      ok: true,
      data: {
        scrims: scrimsMeta,
        selectedScrim: targetScrim || null,
        roster,
        result,
      },
    }
  } catch (err: any) {
    return { ok: false, error: err?.message || "Failed to query historical scrims" }
  }
}

