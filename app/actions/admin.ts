"use server"

import { randomUUID } from "crypto"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { scrims, user, session as sessionTable, settings, notifications, bookings, payments, notHostedTeams, results, reports, chatMessages, activityLogs, imageRequests, walletTransactions } from "@/lib/db/schema"
import { requireAdmin, requireStaff } from "@/lib/session"
import { logActivity } from "@/lib/notify"
import { eq, ne, and, or, sql, inArray, notInArray } from "drizzle-orm"
import { z } from "zod"
import { saveUploadedFile } from "@/lib/upload"
import { creditAdjustmentSchema, type CreditAdjustmentInput } from "@/lib/validations/credit"
import { isSafeHttpOrRelativeUrl } from "@/lib/url-safety"
import { isOwnerRole, isValidUserRole, type UserRole } from "@/lib/roles"

// ─────────────────────────────────────────────────────────────────────────
// Admin-only actions. Every function begins with requireAdmin().
// ─────────────────────────────────────────────────────────────────────────

const scrimSchema = z.object({
  title: z.string().trim().min(2, "Title must be at least 2 characters").max(120),
  description: z.string().trim().max(1500).optional().or(z.literal("")),
  rules: z.string().trim().max(5000).optional().or(z.literal("")),
  notes: z.string().trim().max(2500).optional().or(z.literal("")),
  map: z.string().trim().min(1, "Select or enter at least one map").max(300),
  mode: z.string().trim().min(2).max(60),
  startTime: z.string().trim().min(2, "Start time is required").max(40),
  category: z.string().trim().min(2).max(80).default("Daily Scrims"),
  priceBdt: z.coerce.number().int().min(0, "Entry fee cannot be negative").max(100000),
  prizePoolBdt: z.coerce.number().int().min(0, "Prize pool cannot be negative").max(10000000),
  maxTeams: z.coerce.number().int().min(2).max(64),
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

function ensureGlobalRules(rules: string | null | undefined, fallbackRules?: string): string {
  const HACKER_RULE = "If you want to submit a hacker report, you have to submit it within 1 hour after the match gets completed."
  const PRIZE_FEE_RULE = "Please note that a 5.00 BDT fee will be deducted from the final prize payout to cover transfer charges."

  const source = rules && rules.trim() ? rules : fallbackRules
  if (!source || !source.trim()) {
    return `1. 3 Matches (BERMUDA, PURGATORY & KALAHARI).\n2. BATTLE ROYALE squad mode (12 Teams).\n3. No emulators allowed.\n4. Join room 10-15 minutes prior to match start.\n5. ${HACKER_RULE}\n6. ${PRIZE_FEE_RULE}`
  }

  const lines = source
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
    category: formData.get("category") || "Daily Scrims",
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
    const { getBangladeshActiveDate } = await import("@/lib/queries/scrims")
    const { getScrimCategoryConfig } = await import("@/lib/scrim-categories")
    const catCfg = getScrimCategoryConfig(d.category)

    const resolvedDescription =
      d.description && d.description.trim()
        ? d.description.trim()
        : catCfg.defaultDescription(d.title, d.map)
    const resolvedRules = ensureGlobalRules(
      d.rules,
      catCfg.defaultRules(d.map, d.maxTeams)
    )
    const resolvedNotes =
      d.notes && d.notes.trim() ? d.notes.trim() : catCfg.defaultNotes(d.map)

    await db.insert(scrims).values({
      id: randomUUID(),
      title: d.title,
      slug: slugify(d.title),
      description: resolvedDescription,
      rules: resolvedRules,
      notes: resolvedNotes,
      map: d.map,
      mode: d.mode,
      startTime: d.startTime,
      scrimDate: getBangladeshActiveDate(),
      category: d.category,
      priceBdt: d.priceBdt,
      prizePoolBdt: d.prizePoolBdt,
      maxTeams: d.maxTeams,
      bannerUrl,
    })

    await logActivity(admin.id, "admin", "create_scrim", d.title, {
      category: d.category,
      priceBdt: d.priceBdt,
      prizePoolBdt: d.prizePoolBdt,
      map: d.map,
    })
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
    await ensureScrimInDb(scrimId)

    const { getScrimCategoryConfig } = await import("@/lib/scrim-categories")
    const catCfg = getScrimCategoryConfig(d.category)

    const resolvedDescription =
      d.description && d.description.trim()
        ? d.description.trim()
        : catCfg.defaultDescription(d.title, d.map)
    const resolvedRules = ensureGlobalRules(
      d.rules,
      catCfg.defaultRules(d.map, d.maxTeams)
    )
    const resolvedNotes =
      d.notes && d.notes.trim() ? d.notes.trim() : catCfg.defaultNotes(d.map)

    await db
      .update(scrims)
      .set({
        title: d.title,
        description: resolvedDescription,
        rules: resolvedRules,
        notes: resolvedNotes,
        map: d.map,
        mode: d.mode,
        startTime: d.startTime,
        category: d.category,
        priceBdt: d.priceBdt,
        prizePoolBdt: d.prizePoolBdt,
        maxTeams: d.maxTeams,
        ...(bannerUrl ? { bannerUrl } : {}),
        updatedAt: new Date(),
      })
      .where(eq(scrims.id, scrimId))

    await logActivity(admin.id, "admin", "update_scrim", d.title, {
      scrimId,
      category: d.category,
      priceBdt: d.priceBdt,
      prizePoolBdt: d.prizePoolBdt,
    })
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

    const { getBangladeshActiveDate } = await import("@/lib/queries/scrims")
    const { findStandardScrimDefinition } = await import("@/lib/room-multiplier")
    const def = findStandardScrimDefinition(scrimId)
    if (def) {
      await db.insert(scrims).values({
        id: def.id,
        title: def.name,
        slug: def.slug,
        map: def.map,
        mode: "BATTLE ROYALE",
        startTime: def.time,
        scrimDate: getBangladeshActiveDate(),
        category: def.category || "Daily Scrims",
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
      // If it's a standard definition (including multiplied Room 1..10 Daily/Friday), insert it as soft-deleted
      const { getBangladeshActiveDate } = await import("@/lib/queries/scrims")
      const { findStandardScrimDefinition } = await import("@/lib/room-multiplier")
      const def = findStandardScrimDefinition(scrimId)
      if (def) {
        await db.insert(scrims).values({
          id: def.id,
          title: def.name,
          slug: def.slug,
          map: def.map,
          mode: "BATTLE ROYALE",
          startTime: def.time,
          scrimDate: getBangladeshActiveDate(),
          category: def.category || "Daily Scrims",
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
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return { ok: false, count: 0, error: "No users selected." }
    }
    // Cannot trash oneself, admins, or owners
    const targets = await db
      .select({ id: user.id, role: user.role })
      .from(user)
      .where(and(inArray(user.id, userIds), ne(user.id, admin.id), notInArray(user.role, ["admin", "owner"])))

    if (targets.length === 0) {
      return { ok: false, count: 0, error: "Cannot delete Owner/Admin accounts or your own account." }
    }

    const idsToTrash = targets.map((t) => t.id)
    await db
      .update(user)
      .set({ isTrashed: true, deletedAt: new Date() })
      .where(inArray(user.id, idsToTrash))

    await logActivity(admin.id, admin.role, "trash_users", undefined, { count: idsToTrash.length })
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
    await db.delete(user).where(and(eq(user.id, id), notInArray(user.role, ["admin", "owner"])))
    await logActivity(admin.id, admin.role, "permanently_delete_user", id)
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
    await db
      .delete(user)
      .where(and(inArray(user.id, ids), ne(user.id, admin.id), notInArray(user.role, ["admin", "owner"])))
    await logActivity(admin.id, admin.role, "bulk_permanently_delete_users", undefined, { count: ids.length })
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

    // 3. Delete live chat history & moderation logs
    const { chatSessions, chatModerationLogs, emailLogs } = await import("@/lib/db/schema")
    await db.delete(chatMessages)
    await db.delete(chatSessions)
    await db.delete(chatModerationLogs)
    await db.delete(emailLogs)

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
    revalidatePath("/admin/live-chat")
    revalidatePath("/admin/email")
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

    // 6. Wipe chat messages, sessions, moderation logs, and email logs
    const { chatSessions, chatModerationLogs, emailLogs } = await import("@/lib/db/schema")
    await db.delete(chatMessages)
    await db.delete(chatSessions)
    await db.delete(chatModerationLogs)
    await db.delete(emailLogs)

    // 7. Wipe user notifications & activity logs
    await db.delete(notifications)
    await db.delete(activityLogs)

    // 8. Optionally wipe non-admin test users (strictly preserving owner & admin accounts)
    if (options?.deleteNonAdminUsers) {
      await db.delete(user).where(notInArray(user.role, ["admin", "owner"]))
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
    revalidatePath("/admin/live-chat")
    revalidatePath("/admin/email")
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
  status: "upcoming" | "live" | "registration_closed" | "completed" | "not_hosted" | "force_open"
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const admin = await requireAdmin()
    await ensureScrimInDb(scrimId)
    const isClosed = status === "registration_closed" || status === "completed" || status === "not_hosted"
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
  const { executeMarkScrimNotHosted } = await import("@/lib/not-hosted-service")
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

export async function setUserRole(userId: string, role: UserRole) {
  const admin = await requireAdmin()
  if (!userId || typeof userId !== "string" || !userId.trim()) {
    throw new Error("Invalid user ID")
  }
  if (!isValidUserRole(role)) {
    throw new Error("Invalid role selection")
  }
  if (userId === admin.id) {
    throw new Error("You cannot change your own role")
  }

  const [target] = await db
    .select({ id: user.id, role: user.role, isTrashed: user.isTrashed })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  if (!target || target.isTrashed) {
    throw new Error("User not found")
  }

  const actorIsOwner = isOwnerRole(admin.role)
  const targetIsOwner = isOwnerRole(target.role)

  // Strict anti-privilege-escalation: only an Owner can assign Owner or modify an existing Owner
  if (!actorIsOwner && (role === "owner" || targetIsOwner)) {
    throw new Error("Only an Owner can assign or modify the Owner role.")
  }

  // Prevent removing the last remaining active Owner
  if (targetIsOwner && role !== "owner") {
    const otherOwners = await db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.role, "owner"), eq(user.isTrashed, false), ne(user.id, userId)))
      .limit(1)
    if (otherOwners.length === 0) {
      throw new Error("Cannot demote the last remaining Owner account.")
    }
  }

  await db.update(user).set({ role, updatedAt: new Date() }).where(eq(user.id, userId))
  await logActivity(admin.id, admin.role, "set_role", userId, { previousRole: target.role, role })
  revalidatePath("/admin/users")
}

export async function setUserBanned(userId: string, banned: boolean) {
  const admin = await requireAdmin()
  if (!userId || typeof userId !== "string" || !userId.trim()) {
    throw new Error("Invalid user ID")
  }
  if (userId === admin.id) throw new Error("You cannot ban yourself")

  const [target] = await db
    .select({ id: user.id, role: user.role, isTrashed: user.isTrashed })
    .from(user)
    .where(eq(user.id, userId))
    .limit(1)

  if (!target || target.isTrashed) {
    throw new Error("User not found")
  }

  if (isOwnerRole(target.role) && !isOwnerRole(admin.role)) {
    throw new Error("Only an Owner can modify an Owner account.")
  }

  const nextBanned = Boolean(banned)
  await db.update(user).set({ banned: nextBanned, updatedAt: new Date() }).where(eq(user.id, userId))

  // Immediately revoke active login sessions when banning an account
  if (nextBanned) {
    await db.delete(sessionTable).where(eq(sessionTable.userId, userId)).catch(() => {})
  }

  await logActivity(admin.id, admin.role, nextBanned ? "ban_user" : "unban_user", userId)
  revalidatePath("/admin/users")
}

export async function setUserEmailVerified(
  userId: string,
  verified: boolean
): Promise<{ ok: boolean; emailVerified?: boolean; error?: string }> {
  try {
    const admin = await requireAdmin()
    if (!userId || !userId.trim()) {
      return { ok: false, error: "Invalid user ID" }
    }
    if (userId === admin.id && !verified) {
      return { ok: false, error: "You cannot unverify your own active admin account." }
    }

    const [target] = await db
      .select({ id: user.id, role: user.role, isTrashed: user.isTrashed })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)

    if (!target || target.isTrashed) {
      return { ok: false, error: "User not found" }
    }

    if (isOwnerRole(target.role) && !isOwnerRole(admin.role)) {
      return { ok: false, error: "Only an Owner can modify an Owner account." }
    }

    const updated = await db
      .update(user)
      .set({ emailVerified: Boolean(verified), updatedAt: new Date() })
      .where(eq(user.id, userId))
      .returning({ id: user.id, emailVerified: user.emailVerified })

    if (updated.length === 0) {
      return { ok: false, error: "User not found" }
    }

    await logActivity(
      admin.id,
      admin.role,
      verified ? "verify_user" : "unverify_user",
      userId,
      { emailVerified: Boolean(verified) }
    )
    revalidatePath("/admin/users")
    return { ok: true, emailVerified: updated[0].emailVerified }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to update verification status",
    }
  }
}

// ── Settings & announcements ────────────────────────────────────────────

const URL_SETTING_KEYS = new Set([
  "discord_url",
  "facebook_url",
  "youtube_url",
  "tiktok_url",
  "whatsapp_channel_url",
  "telegram_url",
  "instagram_url",
  "champion_rush_whatsapp_url",
  "champion_rush_3pm_whatsapp_url",
  "support_kori_url",
  "site_logo_url",
])

export async function setSetting(key: string, value: string): Promise<{ ok: boolean; error: string | null }> {
  try {
    const admin = await requireAdmin()
    const allowed = [
      "announcement",
      "top_ad_config",
      "discord_url",
      "facebook_url",
      "youtube_url",
      "tiktok_url",
      "whatsapp_channel_url",
      "telegram_url",
      "instagram_url",
      "support_whatsapp",
      "champion_rush_whatsapp_url",
      "champion_rush_3pm_whatsapp_url",
      "support_kori_url",
      "show_room2",
      "room_multiplier",
      "room_tier_overrides",
      "schedule_override_config",
      "background_theme_config",
      "maintenance_mode",
      "staff_portal_path",
      "friday_scrims_override",
      "rules_general",
      "payment_note",
      "site_logo_url",
    ]
    if (!allowed.includes(key)) return { ok: false, error: "Unknown setting: " + key }
    if (
      URL_SETTING_KEYS.has(key) &&
      value.trim().length > 0 &&
      !isSafeHttpOrRelativeUrl(value, { allowImageDataUri: true })
    ) {
      return {
        ok: false,
        error: `Invalid URL scheme for "${key}". Use https://, http://, or a relative path.`,
      }
    }
    await db
      .insert(settings)
      .values({ key, value, updatedAt: new Date() })
      .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } })
    await logActivity(admin.id, "admin", "update_setting", key)
    revalidatePath("/admin/settings")
    revalidatePath("/admin/scrims")
    revalidatePath("/admin/announce")
    revalidatePath("/admin/announcements")
    revalidatePath("/", "layout")
    return { ok: true, error: null }
  } catch (err: any) {
    return { ok: false, error: err?.message || "Failed to update setting" }
  }
}

export async function saveTopAdConfig(
  input: Record<string, unknown>
): Promise<{ ok: boolean; error: string | null; version?: number }> {
  try {
    const admin = await requireAdmin()
    const { topAdConfigSchema } = await import("@/lib/top-ad")
    const parsed = topAdConfigSchema.safeParse(input)
    if (!parsed.success) {
      return {
        ok: false,
        error: parsed.error.issues[0]?.message || "Invalid Top Ad configuration.",
      }
    }

    const version = Date.now()
    const payload = {
      ...parsed.data,
      version,
    }

    const serialized = JSON.stringify(payload)
    await db
      .insert(settings)
      .values({ key: "top_ad_config", value: serialized, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: serialized, updatedAt: new Date() },
      })

    // Sync legacy plain-text announcement setting for backwards compatibility
    const legacyText = payload.enabled ? payload.text : ""
    await db
      .insert(settings)
      .values({ key: "announcement", value: legacyText, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: legacyText, updatedAt: new Date() },
      })

    await logActivity(
      admin.id,
      "admin",
      "update_top_ad",
      payload.enabled ? `enabled:${payload.badge || "ad"}` : "disabled"
    )
    revalidatePath("/", "layout")
    revalidatePath("/admin/announce")
    revalidatePath("/admin/announcements")
    return { ok: true, error: null, version }
  } catch (err: any) {
    return { ok: false, error: err?.message || "Failed to save Top Ad showcase." }
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
      "champion_rush_3pm_whatsapp_url",
      "support_kori_url",
      "show_room2",
      "room_multiplier",
      "room_tier_overrides",
      "schedule_override_config",
      "background_theme_config",
      "maintenance_mode",
      "staff_portal_path",
      "friday_scrims_override",
      "rules_general",
      "payment_note",
      "site_logo_url",
      "showcase_time_window",
      "showcase_format_label",
      "showcase_payout_sla",
      "showcase_highlight_note",
    ])

    const entriesToSave: Array<[string, string]> = []
    for (const [key, val] of Object.entries(settingsMap)) {
      if (!allowedKeys.has(key)) continue
      const strVal = String(val ?? "")
      if (
        URL_SETTING_KEYS.has(key) &&
        strVal.trim().length > 0 &&
        !isSafeHttpOrRelativeUrl(strVal, { allowImageDataUri: true })
      ) {
        return {
          ok: false,
          error: `Invalid URL scheme for "${key}". Use https://, http://, or a relative path.`,
        }
      }
      entriesToSave.push([key, strVal])
    }

    for (const [key, strVal] of entriesToSave) {
      await db
        .insert(settings)
        .values({ key, value: strVal, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: strVal, updatedAt: new Date() },
        })
    }

    await logActivity(admin.id, "admin", "batch_update_settings")
    revalidatePath("/admin/settings")
    revalidatePath("/")
    revalidatePath("/scrims")
    revalidatePath("/sign-in")
    revalidatePath("/sign-up")
    revalidatePath("/tutorial")
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
    await requireStaff()
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
      const targetIds = new Set<string>([s.id])
      if (s.slug) targetIds.add(s.slug)
      const bList = allBookings.filter((b) => targetIds.has(b.scrimId))
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
      const targetIds = new Set<string>([targetScrim.id])
      if (targetScrim.slug) targetIds.add(targetScrim.slug)
      if (scrimId) targetIds.add(scrimId)

      const seen = new Set<string>()
      const matched: typeof allBookings = []
      for (const b of allBookings) {
        if (targetIds.has(b.scrimId) && !seen.has(b.id)) {
          seen.add(b.id)
          matched.push(b)
        }
      }
      roster = matched.sort((a, b) => (a.slotNumber ?? 99) - (b.slotNumber ?? 99))
      
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

export async function adjustUserCreditsAction(input: CreditAdjustmentInput) {
  try {
    const admin = await requireAdmin()
    const parsed = creditAdjustmentSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
    }

    const { userId, actionType, amount, reason } = parsed.data

    if ((actionType === "add" || actionType === "deduct") && amount <= 0) {
      return { ok: false, error: `Amount to ${actionType} must be greater than ৳0.` }
    }

    // Fetch target user
    const targetRows = await db
      .select({ id: user.id, name: user.name, email: user.email, balance: user.balance })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)

    const targetUser = targetRows[0]
    if (!targetUser) {
      return { ok: false, error: "Target user account not found." }
    }

    const currentBalance = Number(targetUser.balance ?? 0)
    let newBalance = currentBalance
    let diff = 0

    if (actionType === "add") {
      newBalance = currentBalance + amount
      diff = amount
    } else if (actionType === "deduct") {
      if (currentBalance < amount) {
        return {
          ok: false,
          error: `Cannot deduct ৳${amount}. User currently has only ৳${currentBalance} in their balance.`,
        }
      }
      newBalance = currentBalance - amount
      diff = -amount
    } else if (actionType === "set") {
      newBalance = amount
      diff = newBalance - currentBalance
    }

    const trxId = randomUUID()

    await db.transaction(async (tx) => {
      // 1. Update user balance
      await tx
        .update(user)
        .set({
          balance: newBalance,
          updatedAt: new Date(),
        })
        .where(eq(user.id, targetUser.id))

      // 2. Insert into wallet transactions
      await tx.insert(walletTransactions).values({
        id: trxId,
        userId: targetUser.id,
        type: "adjustment",
        amountBdt: Math.abs(diff),
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        description: `Admin adjustment (${actionType.toUpperCase()}): ${reason} (by ${admin.name || admin.email})`,
        referenceId: admin.id,
        status: "completed",
        createdAt: new Date(),
      })

      // 3. Record in activity logs
      await tx.insert(activityLogs).values({
        id: randomUUID(),
        actorId: admin.id,
        actorRole: admin.role,
        action: "credit_adjustment",
        target: `${targetUser.email} (${actionType}: ৳${amount}, new: ৳${newBalance})`,
        meta: {
          targetUserId: targetUser.id,
          targetEmail: targetUser.email,
          actionType,
          amount,
          diff,
          balanceBefore: currentBalance,
          balanceAfter: newBalance,
          reason,
        },
        createdAt: new Date(),
      })
    })

    // In-app notification to the target user (non-blocking)
    try {
      const { notifyUser } = await import("@/lib/notify")
      const diffText = diff > 0 ? `+৳${diff}` : diff < 0 ? `-৳${Math.abs(diff)}` : "৳0"
      await notifyUser(
        targetUser.id,
        "payment",
        `Wallet Balance Adjusted (${diffText})`,
        `An administrator adjusted your account balance. Note: "${reason}". New balance: ৳${newBalance}.`,
        "/dashboard/wallet"
      )
    } catch {}

    // Revalidate paths
    revalidatePath("/admin/credits")
    revalidatePath("/admin/users")
    revalidatePath("/admin")
    revalidatePath("/dashboard/wallet")
    revalidatePath("/dashboard")

    return {
      ok: true,
      data: {
        userId: targetUser.id,
        previousBalance: currentBalance,
        newBalance,
        diff,
        message: `Successfully adjusted balance for ${targetUser.email}. New balance: ৳${newBalance}.`,
      },
    }
  } catch (err: any) {
    console.error("[Credit Adjustment Action Error]:", err)
    return { ok: false, error: err?.message || "Failed to adjust user balance." }
  }
}

export async function cancelExpiredPendingBookingsAction() {
  try {
    await requireAdmin()
    const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000)
    const result = await db
      .update(bookings)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(
        and(
          eq(bookings.status, "pending"),
          sql`${bookings.createdAt} < ${thirtyMinsAgo}`
        )
      )
      .returning({ id: bookings.id })

    revalidatePath("/admin/scrims")
    revalidatePath("/admin")
    return { ok: true, cancelledCount: result.length }
  } catch (err: any) {
    return { ok: false, error: err?.message || "Failed to cancel expired pending bookings" }
  }
}

/**
 * Global Admin Control: Force Turn On All Scrims
 * Sets all active and upcoming scrim lobbies to force_open and registrationOpen=true
 */
export async function forceTurnOnAllScrimsAction(): Promise<{ ok: boolean; count?: number; error?: string }> {
  try {
    const admin = await requireAdmin()
    const { getBangladeshActiveDate, getRoomMultiplier } = await import("@/lib/queries/scrims")
    const { buildAllStandardScrimDefinitions } = await import("@/lib/room-multiplier")
    const activeDate = getBangladeshActiveDate()
    const multiplier = await getRoomMultiplier()
    const standardDefs = buildAllStandardScrimDefinitions(multiplier)

    // 1. Ensure all multiplied standard scrims are inserted into DB if not present
    for (const def of standardDefs) {
      try {
        await db
          .insert(scrims)
          .values({
            id: def.id,
            title: def.name,
            slug: def.slug,
            map: def.map,
            mode: "BATTLE ROYALE",
            startTime: def.time,
            scrimDate: activeDate,
            priceBdt: def.priceBdt,
            prizePoolBdt: def.prizePoolBdt,
            maxTeams: 12,
            bannerUrl: def.bannerUrl || "/images/scrim-1.jpg",
            category: def.category || "Daily Scrims",
            status: "force_open",
            registrationOpen: true,
          })
          .onConflictDoNothing()
      } catch {}
    }

    // 2. Update all active/upcoming non-trashed scrims to force_open (syncing scrimDate to at least activeDate)
    const updated = await db
      .update(scrims)
      .set({
        status: "force_open",
        registrationOpen: true,
        scrimDate: sql`GREATEST(COALESCE(${scrims.scrimDate}, ${activeDate}), ${activeDate})`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(scrims.isTrashed, false),
          ne(scrims.status, "deleted"),
          ne(scrims.status, "permanently_deleted"),
          ne(scrims.status, "completed")
        )
      )
      .returning({ id: scrims.id })

    // Clear conflicting per-tier force_off overrides so global Force Turn On takes full effect
    await db
      .insert(settings)
      .values({ key: "room_tier_overrides", value: "{}", updatedAt: new Date() })
      .onConflictDoUpdate({ target: settings.key, set: { value: "{}", updatedAt: new Date() } })

    await logActivity(admin.id, "admin", "force_turn_on_all_scrims", "All Lobbies", {
      count: updated.length,
    })

    revalidatePath("/admin/scrims")
    revalidatePath("/admin")
    revalidatePath("/scrims")
    revalidatePath("/")

    return { ok: true, count: updated.length }
  } catch (err: any) {
    console.error("[Force Turn On All Scrims Error]:", err)
    return { ok: false, error: err?.message || "Failed to force turn on all scrims" }
  }
}

/**
 * Global Admin Control: Force Turn Off All Scrims
 * Sets all active and upcoming scrim lobbies to registration_closed and registrationOpen=false
 */
export async function forceTurnOffAllScrimsAction(): Promise<{ ok: boolean; count?: number; error?: string }> {
  try {
    const admin = await requireAdmin()
    const { getBangladeshActiveDate, getRoomMultiplier } = await import("@/lib/queries/scrims")
    const { buildAllStandardScrimDefinitions } = await import("@/lib/room-multiplier")
    const activeDate = getBangladeshActiveDate()
    const multiplier = await getRoomMultiplier()
    const standardDefs = buildAllStandardScrimDefinitions(multiplier)

    // 1. Ensure all multiplied standard scrims are inserted into DB if not present
    for (const def of standardDefs) {
      try {
        await db
          .insert(scrims)
          .values({
            id: def.id,
            title: def.name,
            slug: def.slug,
            map: def.map,
            mode: "BATTLE ROYALE",
            startTime: def.time,
            scrimDate: activeDate,
            priceBdt: def.priceBdt,
            prizePoolBdt: def.prizePoolBdt,
            maxTeams: 12,
            bannerUrl: def.bannerUrl || "/images/scrim-1.jpg",
            category: def.category || "Daily Scrims",
            status: "registration_closed",
            registrationOpen: false,
          })
          .onConflictDoNothing()
      } catch {}
    }

    // 2. Update all active non-trashed scrims to registration_closed (syncing scrimDate to at least activeDate)
    const updated = await db
      .update(scrims)
      .set({
        status: "registration_closed",
        registrationOpen: false,
        scrimDate: sql`GREATEST(COALESCE(${scrims.scrimDate}, ${activeDate}), ${activeDate})`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(scrims.isTrashed, false),
          ne(scrims.status, "deleted"),
          ne(scrims.status, "permanently_deleted"),
          ne(scrims.status, "completed")
        )
      )
      .returning({ id: scrims.id })

    // Clear conflicting per-tier force_on overrides so global Force Turn Off takes full effect
    await db
      .insert(settings)
      .values({ key: "room_tier_overrides", value: "{}", updatedAt: new Date() })
      .onConflictDoUpdate({ target: settings.key, set: { value: "{}", updatedAt: new Date() } })

    await logActivity(admin.id, "admin", "force_turn_off_all_scrims", "All Lobbies", {
      count: updated.length,
    })

    revalidatePath("/admin/scrims")
    revalidatePath("/admin")
    revalidatePath("/scrims")
    revalidatePath("/")

    return { ok: true, count: updated.length }
  } catch (err: any) {
    console.error("[Force Turn Off All Scrims Error]:", err)
    return { ok: false, error: err?.message || "Failed to force turn off all scrims" }
  }
}

/**
 * Global Admin Control: Normal Mode
 * Reverts all active scrim lobbies from Force Turn On / Force Turn Off back to schedule-based behavior ("upcoming", registrationOpen=true).
 */
export async function normalModeAllScrimsAction(): Promise<{ ok: boolean; count?: number; error?: string }> {
  try {
    const admin = await requireAdmin()
    const { getBangladeshActiveDate, getRoomMultiplier } = await import("@/lib/queries/scrims")
    const { buildAllStandardScrimDefinitions } = await import("@/lib/room-multiplier")
    const activeDate = getBangladeshActiveDate()
    const multiplier = await getRoomMultiplier()
    const standardDefs = buildAllStandardScrimDefinitions(multiplier)

    for (const def of standardDefs) {
      try {
        await db
          .insert(scrims)
          .values({
            id: def.id,
            title: def.name,
            slug: def.slug,
            map: def.map,
            mode: "BATTLE ROYALE",
            startTime: def.time,
            scrimDate: activeDate,
            priceBdt: def.priceBdt,
            prizePoolBdt: def.prizePoolBdt,
            maxTeams: 12,
            bannerUrl: def.bannerUrl || "/images/scrim-1.jpg",
            category: def.category || "Daily Scrims",
            status: "upcoming",
            registrationOpen: true,
          })
          .onConflictDoNothing()
      } catch {}
    }

    const updated = await db
      .update(scrims)
      .set({
        status: "upcoming",
        registrationOpen: true,
        scrimDate: sql`GREATEST(COALESCE(${scrims.scrimDate}, ${activeDate}), ${activeDate})`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(scrims.isTrashed, false),
          ne(scrims.status, "deleted"),
          ne(scrims.status, "permanently_deleted"),
          ne(scrims.status, "completed"),
          ne(scrims.status, "not_hosted")
        )
      )
      .returning({ id: scrims.id })

    // Clear all per-tier overrides when returning all scrims to Normal Mode
    await db
      .insert(settings)
      .values({ key: "room_tier_overrides", value: "{}", updatedAt: new Date() })
      .onConflictDoUpdate({ target: settings.key, set: { value: "{}", updatedAt: new Date() } })

    await logActivity(admin.id, "admin", "normal_mode_all_scrims", "All Lobbies", {
      count: updated.length,
    })

    revalidatePath("/admin/scrims")
    revalidatePath("/admin")
    revalidatePath("/scrims")
    revalidatePath("/")

    return { ok: true, count: updated.length }
  } catch (err: any) {
    console.error("[Normal Mode All Scrims Error]:", err)
    return { ok: false, error: err?.message || "Failed to switch scrims to Normal Mode" }
  }
}

/**
 * Admin Action: Remove individual registered team from a scrim
 * Cancels/deletes the booking record, frees up the slot count,
 * optionally reopens registration if scrim was full, logs activity, and notifies user.
 */
export async function removeTeamFromScrimAction(
  bookingId: string,
  scrimId?: string
): Promise<{ ok: boolean; message?: string; error?: string; remainingCount?: number }> {
  try {
    const admin = await requireAdmin()
    if (!bookingId) {
      return { ok: false, error: "Booking ID is required." }
    }

    // 1. Fetch booking record
    const target = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1)

    if (target.length === 0) {
      return { ok: false, error: "Team booking record not found." }
    }

    const bookingRow = target[0]
    const effectiveScrimId = scrimId || bookingRow.scrimId

    // 2. Mark any associated payments as cancelled
    await db
      .update(payments)
      .set({ status: "cancelled" })
      .where(eq(payments.bookingId, bookingId))

    // 3. Remove any pending image requests for this team
    await db
      .delete(imageRequests)
      .where(eq(imageRequests.bookingId, bookingId))

    // 4. Delete the booking record cleanly from database
    await db.delete(bookings).where(eq(bookings.id, bookingId))

    // 5. Query remaining confirmed teams for this scrim
    const remainingTeams = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(
        and(
          or(eq(bookings.scrimId, effectiveScrimId), eq(bookings.scrimId, bookingRow.scrimId)),
          eq(bookings.status, "confirmed"),
          eq(bookings.isTrashed, false),
          eq(bookings.isArchived, false)
        )
      )

    const remainingCount = remainingTeams.length

    // 6. If scrim was full and registration was closed, reopen registration if match hasn't started
    const scrimRow = await db
      .select()
      .from(scrims)
      .where(or(eq(scrims.id, effectiveScrimId), eq(scrims.slug, effectiveScrimId)))
      .limit(1)

    if (scrimRow.length > 0) {
      const s = scrimRow[0]
      if (
        !s.registrationOpen &&
        s.status !== "completed" &&
        s.status !== "not_hosted" &&
        s.status !== "registration_closed" &&
        remainingCount < s.maxTeams
      ) {
        await db
          .update(scrims)
          .set({ registrationOpen: true, updatedAt: new Date() })
          .where(eq(scrims.id, s.id))
      }
    }

    // 7. Audit log & user notification
    await logActivity(admin.id, "admin", "remove_team_from_scrim", bookingRow.teamName, {
      bookingId,
      scrimId: effectiveScrimId,
      teamName: bookingRow.teamName,
      captainName: bookingRow.captainName,
      captainUid: bookingRow.captainUid,
      slotNumber: bookingRow.slotNumber,
      userId: bookingRow.userId,
    })

    try {
      const { notifyUser } = await import("@/lib/notify")
      await notifyUser(
        bookingRow.userId,
        "booking",
        "Team Registration Removed",
        `Your team "${bookingRow.teamName}" was removed from the scrim roster by platform administration.`,
        "/dashboard/scrims"
      )
    } catch {}

    // 8. Revalidate all relevant Next.js routes
    revalidatePath("/admin/scrims")
    revalidatePath("/admin")
    revalidatePath("/dashboard/scrims")
    revalidatePath("/scrims")
    if (scrimRow[0]?.slug) {
      revalidatePath(`/scrims/${scrimRow[0].slug}`)
    }
    revalidatePath("/")

    return {
      ok: true,
      message: `Team "${bookingRow.teamName}" has been successfully removed from this scrim.`,
      remainingCount,
    }
  } catch (err: any) {
    console.error("[removeTeamFromScrimAction] Error:", err)
    return { ok: false, error: err?.message || "Failed to remove team from scrim" }
  }
}

/**
 * Admin Action: Configure exact Room Multiplier (1..10) across BOTH Daily and Friday Scrims.
 * Automatically opens/generates X room instances and keeps legacy `show_room2` in sync.
 */
export async function setRoomMultiplierAction(
  multiplierInput: number
): Promise<{ ok: boolean; multiplier?: number; error?: string }> {
  try {
    const admin = await requireAdmin()
    const { clampRoomMultiplier } = await import("@/lib/room-multiplier")
    const multiplier = clampRoomMultiplier(multiplierInput)

    await Promise.all([
      db
        .insert(settings)
        .values({ key: "room_multiplier", value: String(multiplier), updatedAt: new Date() })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: String(multiplier), updatedAt: new Date() },
        }),
      db
        .insert(settings)
        .values({ key: "show_room2", value: multiplier >= 2 ? "true" : "false", updatedAt: new Date() })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value: multiplier >= 2 ? "true" : "false", updatedAt: new Date() },
        }),
    ])

    await logActivity(admin.id, "admin", "set_room_multiplier", `Room Multiplier: ${multiplier}x`, {
      multiplier,
    })

    revalidatePath("/admin/scrims")
    revalidatePath("/admin/results")
    revalidatePath("/admin/iceberg")
    revalidatePath("/admin")
    revalidatePath("/scrims")
    revalidatePath("/")

    return { ok: true, multiplier }
  } catch (err: any) {
    console.error("[setRoomMultiplierAction] Error:", err)
    return { ok: false, error: err?.message || "Failed to update room multiplier" }
  }
}

/**
 * Admin Action: Apply Force Turn On, Force Turn Off, or Normal Mode to a specific room tier (Room X)
 * across all matching Daily and Friday lobbies in that room tier.
 */
export async function setRoomTierModeAction(
  roomNumberInput: number,
  mode: "normal" | "force_on" | "force_off"
): Promise<{
  ok: boolean
  roomNumber?: number
  mode?: string
  count?: number
  overrides?: import("@/lib/room-multiplier").RoomTierOverrides
  error?: string
}> {
  try {
    const admin = await requireAdmin()
    const {
      clampRoomMultiplier,
      buildAllStandardScrimDefinitions,
      getScrimRoomNumber,
    } = await import("@/lib/room-multiplier")
    const {
      getBangladeshActiveDate,
      getRoomMultiplier,
      getRoomTierOverrides,
    } = await import("@/lib/queries/scrims")

    const roomNumber = clampRoomMultiplier(roomNumberInput)
    if (mode !== "normal" && mode !== "force_on" && mode !== "force_off") {
      return { ok: false, error: "Invalid room mode" }
    }

    const activeDate = getBangladeshActiveDate()
    const [multiplier, currentOverrides] = await Promise.all([
      getRoomMultiplier(),
      getRoomTierOverrides(),
    ])

    const nextOverrides = { ...currentOverrides }
    if (mode === "normal") {
      delete nextOverrides[String(roomNumber)]
    } else {
      nextOverrides[String(roomNumber)] = mode
    }

    await db
      .insert(settings)
      .values({
        key: "room_tier_overrides",
        value: JSON.stringify(nextOverrides),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: JSON.stringify(nextOverrides), updatedAt: new Date() },
      })

    const targetStatus =
      mode === "force_on" ? "force_open" : mode === "force_off" ? "registration_closed" : "upcoming"
    const targetRegOpen = mode !== "force_off"

    const effectiveMax = Math.max(multiplier, roomNumber)
    const defsForTier = buildAllStandardScrimDefinitions(effectiveMax).filter(
      (d) => d.roomNumber === roomNumber
    )

    // Ensure DB rows exist for this room tier and update their status immediately
    const tierIds = new Set<string>()
    for (const def of defsForTier) {
      tierIds.add(def.id)
      try {
        await db
          .insert(scrims)
          .values({
            id: def.id,
            title: def.name,
            slug: def.slug,
            map: def.map,
            mode: "BATTLE ROYALE",
            startTime: def.time,
            scrimDate: activeDate,
            category: def.category || "Daily Scrims",
            priceBdt: def.priceBdt,
            prizePoolBdt: def.prizePoolBdt,
            maxTeams: 12,
            bannerUrl: def.bannerUrl || "/images/scrim-1.jpg",
            status: targetStatus,
            registrationOpen: targetRegOpen,
          })
          .onConflictDoNothing()
      } catch {}
    }

    // Also find any custom/existing DB scrims belonging to this room tier
    const allDbScrims = await db
      .select({ id: scrims.id, slug: scrims.slug, title: scrims.title, status: scrims.status, isTrashed: scrims.isTrashed })
      .from(scrims)
    for (const row of allDbScrims) {
      if (row.isTrashed || row.status === "deleted" || row.status === "permanently_deleted") continue
      if (getScrimRoomNumber(row) === roomNumber) {
        tierIds.add(row.id)
      }
    }

    const idList = Array.from(tierIds)
    let updatedCount = 0
    if (idList.length > 0) {
      const updated = await db
        .update(scrims)
        .set({
          status: targetStatus,
          registrationOpen: targetRegOpen,
          scrimDate: sql`GREATEST(COALESCE(${scrims.scrimDate}, ${activeDate}), ${activeDate})`,
          updatedAt: new Date(),
        })
        .where(
          and(
            inArray(scrims.id, idList),
            eq(scrims.isTrashed, false),
            ne(scrims.status, "deleted"),
            ne(scrims.status, "permanently_deleted"),
            ne(scrims.status, "completed"),
            ne(scrims.status, "not_hosted")
          )
        )
        .returning({ id: scrims.id })
      updatedCount = updated.length
    }

    await logActivity(admin.id, "admin", `room_tier_${mode}`, `Room ${roomNumber} Lobbies`, {
      roomNumber,
      mode,
      count: updatedCount,
    })

    revalidatePath("/admin/scrims")
    revalidatePath("/admin")
    revalidatePath("/scrims")
    revalidatePath("/")

    return { ok: true, roomNumber, mode, count: updatedCount, overrides: nextOverrides }
  } catch (err: any) {
    console.error("[setRoomTierModeAction] Error:", err)
    return { ok: false, error: err?.message || "Failed to update room tier mode" }
  }
}

/**
 * Admin Action: Save Schedule Shutdown & Date-Range Target Registration Window.
 */
export async function saveScheduleOverrideAction(
  input: unknown
): Promise<{
  ok: boolean
  config?: import("@/lib/schedule-override").ScheduleOverrideConfig
  error?: string
}> {
  try {
    const admin = await requireAdmin()
    const { scheduleOverrideSchema } = await import("@/lib/schedule-override")
    const parsed = scheduleOverrideSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message || "Invalid schedule override configuration." }
    }

    const payload = {
      ...parsed.data,
      updatedAt: new Date().toISOString(),
    }
    const serialized = JSON.stringify(payload)

    await db
      .insert(settings)
      .values({ key: "schedule_override_config", value: serialized, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: serialized, updatedAt: new Date() },
      })

    await logActivity(
      admin.id,
      "admin",
      "update_schedule_override",
      payload.enabled ? "enabled" : "disabled",
      payload
    )

    revalidatePath("/admin/scrims")
    revalidatePath("/admin")
    revalidatePath("/scrims")
    revalidatePath("/")

    return { ok: true, config: payload }
  } catch (err: any) {
    console.error("[saveScheduleOverrideAction] Error:", err)
    return { ok: false, error: err?.message || "Failed to save schedule override." }
  }
}

/**
 * Admin Quick Action: Immediately turn off Schedule Shutdown / Registration Window override
 * and restore normal schedule operation.
 */
export async function disableScheduleOverrideAction(): Promise<{
  ok: boolean
  config?: import("@/lib/schedule-override").ScheduleOverrideConfig
  error?: string
}> {
  try {
    const admin = await requireAdmin()
    const { getScheduleOverrideConfig } = await import("@/lib/queries/scrims")
    const current = await getScheduleOverrideConfig()
    const payload = {
      ...current,
      enabled: false,
      updatedAt: new Date().toISOString(),
    }
    const serialized = JSON.stringify(payload)

    await db
      .insert(settings)
      .values({ key: "schedule_override_config", value: serialized, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: serialized, updatedAt: new Date() },
      })

    await logActivity(admin.id, "admin", "disable_schedule_override", "Restored Normal Schedule")

    revalidatePath("/admin/scrims")
    revalidatePath("/admin")
    revalidatePath("/scrims")
    revalidatePath("/")

    return { ok: true, config: payload }
  } catch (err: any) {
    console.error("[disableScheduleOverrideAction] Error:", err)
    return { ok: false, error: err?.message || "Failed to restore normal schedule." }
  }
}

/**
 * Admin Action: Save site-wide Background color-changing interval and palette configuration.
 */
export async function saveBackgroundThemeConfigAction(
  input: unknown
): Promise<{ ok: boolean; config?: import("@/lib/background-config").BackgroundThemeConfig; error?: string }> {
  try {
    const admin = await requireAdmin()
    const { backgroundThemeConfigSchema } = await import("@/lib/background-config")
    const parsed = backgroundThemeConfigSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message || "Invalid background configuration." }
    }

    const payload = {
      ...parsed.data,
      updatedAt: new Date().toISOString(),
    }
    const serialized = JSON.stringify(payload)

    await db
      .insert(settings)
      .values({ key: "background_theme_config", value: serialized, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: serialized, updatedAt: new Date() },
      })

    await logActivity(admin.id, "admin", "update_background_theme", "Background Settings", {
      delaySeconds: payload.delaySeconds,
      transitionSeconds: payload.transitionSeconds,
      builtInCount: payload.enabledBuiltInPhases.length,
      customCount: payload.customColors.length,
    })

    revalidatePath("/admin/background")
    revalidatePath("/", "layout")

    return { ok: true, config: payload }
  } catch (err: any) {
    console.error("[saveBackgroundThemeConfigAction] Error:", err)
    return { ok: false, error: err?.message || "Failed to save background settings." }
  }
}




