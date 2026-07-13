import "server-only"

import { db } from "@/lib/db"
import { results, scrims } from "@/lib/db/schema"
import { desc, eq, sql } from "drizzle-orm"

export type ResultWithScrim = typeof results.$inferSelect & {
  scrimTitle: string | null
  scrimTime: string | null
  scrimMap: string | null
}

export async function getRecentResults(limit = 50): Promise<ResultWithScrim[]> {
  const rows = await db
    .select({
      result: results,
      scrimTitle: scrims.title,
      scrimTime: scrims.startTime,
      scrimMap: scrims.map,
    })
    .from(results)
    .leftJoin(scrims, eq(results.scrimId, scrims.id))
    .orderBy(desc(results.matchDate), desc(results.createdAt))
    .limit(limit)
  return rows.map((r) => ({
    ...r.result,
    scrimTitle: r.scrimTitle,
    scrimTime: r.scrimTime,
    scrimMap: r.scrimMap,
  }))
}

export type LeaderboardEntry = {
  teamName: string
  wins: number
  totalKills: number
  totalPrizeBdt: number
}

export async function getLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
  const rows = await db
    .select({
      teamName: results.winningTeam,
      wins: sql<number>`COUNT(*) FILTER (WHERE ${results.placement} = 1)::int`,
      totalKills: sql<number>`COALESCE(SUM(${results.kills}), 0)::int`,
      totalPrizeBdt: sql<number>`COALESCE(SUM(${results.prizeBdt}), 0)::int`,
    })
    .from(results)
    .groupBy(results.winningTeam)
    .orderBy(
      sql`COUNT(*) FILTER (WHERE ${results.placement} = 1) DESC`,
      sql`COALESCE(SUM(${results.kills}), 0) DESC`,
    )
    .limit(limit)
  return rows
}
