import "server-only"

import { db } from "@/lib/db"
import { results, scrims } from "@/lib/db/schema"
import { desc, eq, gte, lt, sql, and } from "drizzle-orm"
import { getBangladeshActiveDate, isFridayScrimsActive, ALL_STANDARD_SCRIM_DEFINITIONS } from "./scrims"
import { resolveImageUrl, resolveImageUrls } from "@/lib/image-url"

export type ResultWithScrim = typeof results.$inferSelect & {
  scrimTitle: string | null
  scrimTime: string | null
  scrimMap: string | null
}

/** Helper to resolve scrim details from standard definitions if not found in db */
function resolveScrimDetails(scrimId: string | null) {
  if (!scrimId) return null
  return ALL_STANDARD_SCRIM_DEFINITIONS.find(
    (d) => d.id === scrimId || d.slug === scrimId || scrimId.includes(d.slug)
  )
}

/** Compute the cutoff Date for public result retention (7:00 PM BD time cutoff on standard days, 3:00 PM BD time on Fridays) */
export async function getActiveResultCutoffDate(): Promise<Date> {
  const isFriday = await isFridayScrimsActive()
  const activeDateStr = getBangladeshActiveDate() // e.g. "2026-08-12"
  const [year, month, day] = activeDateStr.split("-").map(Number)
  
  // Friday first scrim: 3:00 PM BD time (UTC+6) = 09:00 UTC
  // Daily first scrim: 7:00 PM BD time (UTC+6) = 13:00 UTC
  const firstScrimUtcHour = isFriday ? 9 : 13
  const todayFirstScrimTime = new Date(Date.UTC(year, month - 1, day, firstScrimUtcHour, 0, 0))
  const now = new Date()
  
  // If current time is before 1st scrim start time today, cutoff is yesterday's 1st scrim start time
  if (now.getTime() < todayFirstScrimTime.getTime()) {
    todayFirstScrimTime.setUTCDate(todayFirstScrimTime.getUTCDate() - 1)
  }
  return todayFirstScrimTime
}

/** Automatically delete previous day results once the 1st scrim of today starts */
export async function pruneOldResultsAtScrimStartTime() {
  try {
    const isFriday = await isFridayScrimsActive()
    const activeDateStr = getBangladeshActiveDate()
    const [year, month, day] = activeDateStr.split("-").map(Number)
    const firstScrimUtcHour = isFriday ? 9 : 13
    const todayFirstScrimTime = new Date(Date.UTC(year, month - 1, day, firstScrimUtcHour, 0, 0))
    const now = new Date()

    // When the 1st scrim of the day starts (7 PM daily, 3 PM Friday), delete results created before that
    if (now.getTime() >= todayFirstScrimTime.getTime()) {
      await db.delete(results).where(lt(results.createdAt, todayFirstScrimTime))
    }
  } catch (err) {
    console.warn("[Results Pruning] Error pruning previous day results:", err)
  }
}

export async function getRecentResults(limit = 50, includeHistorical = false): Promise<ResultWithScrim[]> {
  try {
    await pruneOldResultsAtScrimStartTime()
    const cutoff = await getActiveResultCutoffDate()
    
    let query = db
      .select({
        result: results,
        scrimTitle: scrims.title,
        scrimTime: scrims.startTime,
        scrimMap: scrims.map,
      })
      .from(results)
      .leftJoin(scrims, eq(results.scrimId, scrims.id))

    const notTrashed = and(eq(results.isTrashed, false), sql`${results.deletedAt} IS NULL`)

    if (!includeHistorical) {
      query = query.where(and(notTrashed, gte(results.createdAt, cutoff))) as typeof query
    } else {
      query = query.where(notTrashed) as typeof query
    }

    const rows = await query
      .orderBy(desc(results.createdAt))
      .limit(limit)

    const list = rows.map((r) => {
      let title = r.scrimTitle
      let time = r.scrimTime
      let map = r.scrimMap

      if ((!title || !time) && r.result.scrimId) {
        const def = resolveScrimDetails(r.result.scrimId)
        if (def) {
          if (!title) title = def.name
          if (!time) time = def.time
          if (!map) map = def.map
        }
      }

      const normalizedScreenshot = resolveImageUrl(r.result.screenshotUrl, "")
      const normalizedImgs = resolveImageUrls(r.result.imageUrls as string[])

      return {
        ...r.result,
        screenshotUrl: normalizedScreenshot || (normalizedImgs[0] ?? null),
        imageUrls: normalizedImgs.length > 0 ? normalizedImgs : normalizedScreenshot ? [normalizedScreenshot] : [],
        scrimTitle: title,
        scrimTime: time,
        scrimMap: map,
      }
    })
    
    if (list.length === 0) {
      return []
    }
    return list
  } catch (err) {
    console.warn("[Queries] Database error in getRecentResults:", err)
    return []
  }
}

export async function getResultsByScrimId(scrimId: string): Promise<ResultWithScrim[]> {
  try {
    const rows = await db
      .select({
        result: results,
        scrimTitle: scrims.title,
        scrimTime: scrims.startTime,
        scrimMap: scrims.map,
      })
      .from(results)
      .leftJoin(scrims, eq(results.scrimId, scrims.id))
      .where(and(eq(results.scrimId, scrimId), eq(results.isTrashed, false), sql`${results.deletedAt} IS NULL`))
      .orderBy(desc(results.createdAt))

    return rows.map((r) => {
      let title = r.scrimTitle
      let time = r.scrimTime
      let map = r.scrimMap

      if ((!title || !time) && r.result.scrimId) {
        const def = resolveScrimDetails(r.result.scrimId)
        if (def) {
          if (!title) title = def.name
          if (!time) time = def.time
          if (!map) map = def.map
        }
      }

      const normalizedScreenshot = resolveImageUrl(r.result.screenshotUrl, "")
      const normalizedImgs = resolveImageUrls(r.result.imageUrls as string[])

      return {
        ...r.result,
        screenshotUrl: normalizedScreenshot || (normalizedImgs[0] ?? null),
        imageUrls: normalizedImgs.length > 0 ? normalizedImgs : normalizedScreenshot ? [normalizedScreenshot] : [],
        scrimTitle: title,
        scrimTime: time,
        scrimMap: map,
      }
    })
  } catch (err) {
    console.warn("[Queries] Database error in getResultsByScrimId:", err)
    return []
  }
}

export type LeaderboardEntry = {
  teamName: string
  wins: number
  totalKills: number
  totalPrizeBdt: number
}

export async function getLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
  try {
    const rows = await db
      .select({
        teamName: results.winningTeam,
        wins: sql<number>`COUNT(*) FILTER (WHERE ${results.placement} = 1)::int`,
        totalKills: sql<number>`COALESCE(SUM(${results.kills}), 0)::int`,
        totalPrizeBdt: sql<number>`COALESCE(SUM(${results.prizeBdt}), 0)::int`,
      })
      .from(results)
      .where(and(eq(results.isTrashed, false), sql`${results.deletedAt} IS NULL`))
      .groupBy(results.winningTeam)
      .orderBy(
        sql`COUNT(*) FILTER (WHERE ${results.placement} = 1) DESC`,
        sql`COALESCE(SUM(${results.kills}), 0) DESC`,
      )
      .limit(limit)
    if (rows.length === 0) return SAMPLE_LEADERBOARD
    return rows
  } catch (err) {
    console.warn("[Queries] Database error in getLeaderboard:", err)
    return SAMPLE_LEADERBOARD
  }
}

const SAMPLE_LEADERBOARD: LeaderboardEntry[] = [
  { teamName: "Team Vipers", wins: 12, totalKills: 142, totalPrizeBdt: 4800 },
  { teamName: "Black Mamba Esports", wins: 9, totalKills: 118, totalPrizeBdt: 3600 },
  { teamName: "Apex Predators", wins: 7, totalKills: 94, totalPrizeBdt: 2800 },
  { teamName: "Royal Esports", wins: 5, totalKills: 72, totalPrizeBdt: 2000 },
]


