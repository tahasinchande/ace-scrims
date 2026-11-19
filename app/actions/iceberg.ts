"use server"

import { revalidatePath } from "next/cache"
import { and, eq, gte, or, sql } from "drizzle-orm"
import { db, ensureSchemaReady } from "@/lib/db"
import { bookings, scrims } from "@/lib/db/schema"
import { requireAdmin } from "@/lib/session"
import { logActivity } from "@/lib/notify"
import {
  getBangladeshActiveDate,
  isDailyWeekdayScrim,
  isFridayScrimsActive,
  isFridayTournament,
  isRoom2Enabled,
  resolveOrEnsureScrim,
} from "@/lib/queries/scrims"
import { getAdminScrims } from "@/lib/queries/admin"

async function getActiveScheduleScrimIds(): Promise<string[]> {
  const [all, isFriday, showRoom2] = await Promise.all([
    getAdminScrims(),
    isFridayScrimsActive(),
    isRoom2Enabled(),
  ])

  return all
    .filter((s) => {
      if (s.status === "deleted" || s.isTrashed) return false
      const isFri = isFridayTournament(s)
      const isDaily = isDailyWeekdayScrim(s)
      if (isFriday) {
        if (isDaily && !isFri) return false
      } else {
        if (isFri) return false
        if (!showRoom2 && (s.id.includes("r2") || s.slug.includes("room-2"))) return false
      }
      return true
    })
    .map((s) => s.id)
}

async function getRealConfirmedForScrim(
  scrimId: string,
  scrimSlug: string,
  activeDate: string,
): Promise<number> {
  const rows = await db
    .select({
      count: sql<number>`COUNT(*)::int`,
    })
    .from(bookings)
    .where(
      and(
        or(eq(bookings.scrimId, scrimId), eq(bookings.scrimId, scrimSlug)),
        eq(bookings.status, "confirmed"),
        eq(bookings.isTrashed, false),
        eq(bookings.isArchived, false),
        gte(bookings.scrimDate, activeDate),
      ),
    )
  return Number(rows[0]?.count ?? 0)
}

function revalidateIcebergPaths(slug?: string | null) {
  revalidatePath("/admin/iceberg")
  revalidatePath("/admin/scrims")
  revalidatePath("/scrims")
  revalidatePath("/")
  if (slug) {
    revalidatePath(`/scrims/${slug}`)
  }
}

export async function updateScrimIcebergAction(input: {
  scrimIds: string[]
  selectAllActive?: boolean
  enabled: boolean
  icebergAmount: number
  icebergThreshold: number
  resetBaseline?: boolean
  showAllFilled?: boolean
}): Promise<{
  ok: boolean
  updatedCount: number
  skippedFullTitles: string[]
  error?: string
}> {
  try {
    const admin = await requireAdmin()
    await ensureSchemaReady()

    const targetIds = input.selectAllActive
      ? await getActiveScheduleScrimIds()
      : Array.from(new Set(input.scrimIds.filter(Boolean)))

    if (targetIds.length === 0) {
      return { ok: false, updatedCount: 0, skippedFullTitles: [], error: "Please select at least one scrim." }
    }

    const rawAmount = Math.floor(Number(input.icebergAmount))
    const rawThreshold = Math.floor(Number(input.icebergThreshold))

    if (!Number.isFinite(rawAmount) || rawAmount < 0 || rawAmount > 47) {
      return { ok: false, updatedCount: 0, skippedFullTitles: [], error: "Iceberg amount must be between 0 and 47." }
    }
    if (!Number.isFinite(rawThreshold) || rawThreshold < 1 || rawThreshold > 48) {
      return { ok: false, updatedCount: 0, skippedFullTitles: [], error: "Reset threshold must be between 1 and 48." }
    }

    const activeDate = getBangladeshActiveDate()
    const skippedFullTitles: string[] = []
    let updatedCount = 0

    for (const rawId of targetIds) {
      const ensured = await resolveOrEnsureScrim(rawId)
      if (!ensured) continue

      const maxTeams = Math.max(2, ensured.maxTeams || 12)
      const realConfirmed = await getRealConfirmedForScrim(ensured.id, ensured.slug, activeDate)
      const safeAmount = Math.max(0, Math.min(maxTeams - 1, rawAmount))
      const safeThreshold = Math.max(1, Math.min(maxTeams, rawThreshold))

      if ((input.enabled || input.showAllFilled) && realConfirmed >= maxTeams) {
        await db
          .update(scrims)
          .set({
            icebergEnabled: false,
            icebergShowAllFilled: false,
            icebergAmount: safeAmount,
            icebergThreshold: safeThreshold,
            updatedAt: new Date(),
          })
          .where(eq(scrims.id, ensured.id))
        skippedFullTitles.push(ensured.title)
        continue
      }

      const shouldSnapshotBaseline = Boolean(
        input.resetBaseline || (!ensured.icebergEnabled && input.enabled),
      )

      await db
        .update(scrims)
        .set({
          icebergEnabled: Boolean(input.enabled),
          ...(typeof input.showAllFilled === "boolean"
            ? { icebergShowAllFilled: input.showAllFilled }
            : {}),
          icebergAmount: safeAmount,
          icebergThreshold: safeThreshold,
          ...(shouldSnapshotBaseline ? { icebergStartRealCount: realConfirmed } : {}),
          updatedAt: new Date(),
        })
        .where(eq(scrims.id, ensured.id))

      updatedCount++
      revalidateIcebergPaths(ensured.slug)
    }

    await logActivity(
      admin.id,
      "admin",
      input.enabled ? "iceberg_enable_update" : "iceberg_disable_update",
      targetIds.length === 1 ? targetIds[0] : `${targetIds.length} scrims`,
      {
        enabled: input.enabled,
        ...(typeof input.showAllFilled === "boolean" ? { showAllFilled: input.showAllFilled } : {}),
        icebergAmount: rawAmount,
        icebergThreshold: rawThreshold,
        updatedCount,
        skippedFullCount: skippedFullTitles.length,
      },
    )

    revalidateIcebergPaths()

    return {
      ok: true,
      updatedCount,
      skippedFullTitles,
    }
  } catch (err) {
    return {
      ok: false,
      updatedCount: 0,
      skippedFullTitles: [],
      error: err instanceof Error ? err.message : "Failed to update Iceberg settings",
    }
  }
}

export async function setScrimsShowAllFilledAction(input: {
  scrimIds: string[]
  selectAllActive?: boolean
  showAllFilled: boolean
}): Promise<{
  ok: boolean
  updatedCount: number
  skippedFullTitles: string[]
  error?: string
}> {
  try {
    const admin = await requireAdmin()
    await ensureSchemaReady()

    const targetIds = input.selectAllActive
      ? await getActiveScheduleScrimIds()
      : Array.from(new Set(input.scrimIds.filter(Boolean)))

    if (targetIds.length === 0) {
      return { ok: false, updatedCount: 0, skippedFullTitles: [], error: "Please select at least one scrim." }
    }

    const activeDate = getBangladeshActiveDate()
    const skippedFullTitles: string[] = []
    let updatedCount = 0

    for (const rawId of targetIds) {
      const ensured = await resolveOrEnsureScrim(rawId)
      if (!ensured) continue

      const maxTeams = Math.max(2, ensured.maxTeams || 12)
      const realConfirmed = await getRealConfirmedForScrim(ensured.id, ensured.slug, activeDate)

      if (input.showAllFilled && realConfirmed >= maxTeams) {
        await db
          .update(scrims)
          .set({
            icebergEnabled: false,
            icebergShowAllFilled: false,
            updatedAt: new Date(),
          })
          .where(eq(scrims.id, ensured.id))
        skippedFullTitles.push(ensured.title)
        continue
      }

      await db
        .update(scrims)
        .set({
          icebergShowAllFilled: Boolean(input.showAllFilled),
          updatedAt: new Date(),
        })
        .where(eq(scrims.id, ensured.id))

      updatedCount++
      revalidateIcebergPaths(ensured.slug)
    }

    await logActivity(
      admin.id,
      "admin",
      input.showAllFilled ? "iceberg_show_all_filled_on" : "iceberg_show_all_filled_off",
      targetIds.length === 1 ? targetIds[0] : `${targetIds.length} scrims`,
      {
        showAllFilled: Boolean(input.showAllFilled),
        updatedCount,
        skippedFullCount: skippedFullTitles.length,
      },
    )

    revalidateIcebergPaths()

    return {
      ok: true,
      updatedCount,
      skippedFullTitles,
    }
  } catch (err) {
    return {
      ok: false,
      updatedCount: 0,
      skippedFullTitles: [],
      error: err instanceof Error ? err.message : "Failed to update Show All Slots Filled",
    }
  }
}

export async function fluctuateIcebergAction(input: {
  scrimIds: string[]
  selectAllActive?: boolean
  minAmount?: number
  maxAmount?: number
  icebergThreshold?: number
}): Promise<{
  ok: boolean
  updatedCount: number
  skippedFullTitles: string[]
  error?: string
}> {
  try {
    const admin = await requireAdmin()
    await ensureSchemaReady()

    const targetIds = input.selectAllActive
      ? await getActiveScheduleScrimIds()
      : Array.from(new Set(input.scrimIds.filter(Boolean)))

    if (targetIds.length === 0) {
      return { ok: false, updatedCount: 0, skippedFullTitles: [], error: "Please select at least one scrim to fluctuate." }
    }

    const minBound = Math.max(1, Math.min(10, Math.floor(Number(input.minAmount ?? 5))))
    const maxBound = Math.max(minBound, Math.min(11, Math.floor(Number(input.maxAmount ?? 9))))
    const thresholdOverride =
      typeof input.icebergThreshold === "number" && Number.isFinite(input.icebergThreshold)
        ? Math.max(1, Math.min(12, Math.floor(input.icebergThreshold)))
        : null

    const activeDate = getBangladeshActiveDate()
    const skippedFullTitles: string[] = []
    let updatedCount = 0

    for (const rawId of targetIds) {
      const ensured = await resolveOrEnsureScrim(rawId)
      if (!ensured) continue

      const maxTeams = Math.max(2, ensured.maxTeams || 12)
      const realConfirmed = await getRealConfirmedForScrim(ensured.id, ensured.slug, activeDate)

      if (realConfirmed >= maxTeams) {
        await db
          .update(scrims)
          .set({ icebergEnabled: false, icebergShowAllFilled: false, updatedAt: new Date() })
          .where(eq(scrims.id, ensured.id))
        skippedFullTitles.push(ensured.title)
        continue
      }

      const capMax = Math.min(maxTeams - 1, maxBound)
      const capMin = Math.min(capMax, minBound)
      const candidates: number[] = []
      for (let n = capMin; n <= capMax; n++) {
        if (n !== ensured.icebergAmount || capMin === capMax) {
          candidates.push(n)
        }
      }
      const nextAmount = candidates[Math.floor(Math.random() * candidates.length)] ?? capMin

      await db
        .update(scrims)
        .set({
          icebergEnabled: true,
          icebergAmount: nextAmount,
          ...(thresholdOverride !== null ? { icebergThreshold: thresholdOverride } : {}),
          icebergStartRealCount: realConfirmed,
          updatedAt: new Date(),
        })
        .where(eq(scrims.id, ensured.id))

      updatedCount++
      revalidateIcebergPaths(ensured.slug)
    }

    await logActivity(
      admin.id,
      "admin",
      "iceberg_fluctuate",
      targetIds.length === 1 ? targetIds[0] : `${targetIds.length} scrims`,
      { minBound, maxBound, thresholdOverride, updatedCount, skippedFullCount: skippedFullTitles.length },
    )

    revalidateIcebergPaths()

    return {
      ok: true,
      updatedCount,
      skippedFullTitles,
    }
  } catch (err) {
    return {
      ok: false,
      updatedCount: 0,
      skippedFullTitles: [],
      error: err instanceof Error ? err.message : "Failed to fluctuate Iceberg numbers",
    }
  }
}

export async function resetIcebergCycleAction(input: {
  scrimIds: string[]
  selectAllActive?: boolean
}): Promise<{ ok: boolean; updatedCount: number; error?: string }> {
  try {
    const admin = await requireAdmin()
    await ensureSchemaReady()

    const targetIds = input.selectAllActive
      ? await getActiveScheduleScrimIds()
      : Array.from(new Set(input.scrimIds.filter(Boolean)))

    if (targetIds.length === 0) {
      return { ok: false, updatedCount: 0, error: "Please select at least one scrim." }
    }

    const activeDate = getBangladeshActiveDate()
    let updatedCount = 0

    for (const rawId of targetIds) {
      const ensured = await resolveOrEnsureScrim(rawId)
      if (!ensured) continue

      const realConfirmed = await getRealConfirmedForScrim(ensured.id, ensured.slug, activeDate)
      await db
        .update(scrims)
        .set({
          icebergStartRealCount: realConfirmed,
          updatedAt: new Date(),
        })
        .where(eq(scrims.id, ensured.id))

      updatedCount++
      revalidateIcebergPaths(ensured.slug)
    }

    await logActivity(
      admin.id,
      "admin",
      "iceberg_reset_cycle",
      `${updatedCount} scrims`,
    )

    revalidateIcebergPaths()
    return { ok: true, updatedCount }
  } catch (err) {
    return {
      ok: false,
      updatedCount: 0,
      error: err instanceof Error ? err.message : "Failed to reset Iceberg cycle",
    }
  }
}
