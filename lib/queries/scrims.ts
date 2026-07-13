import "server-only"

import { db } from "@/lib/db"
import { scrims, bookings } from "@/lib/db/schema"
import { and, eq, sql, asc, desc } from "drizzle-orm"
import { scrimStartDate } from "@/lib/format"

export type ScrimWithSlots = typeof scrims.$inferSelect & {
  confirmedTeams: number
}

const confirmedCount = sql<number>`(
  SELECT COUNT(*)::int FROM ${bookings}
  WHERE ${bookings.scrimId} = ${scrims.id}
  AND ${bookings.status} = 'confirmed'
)`.as("confirmedTeams")

function sortByStartTime(list: ScrimWithSlots[]): ScrimWithSlots[] {
  return [...list].sort(
    (a, b) =>
      scrimStartDate(a.scrimDate, a.startTime).getTime() -
      scrimStartDate(b.scrimDate, b.startTime).getTime(),
  )
}

/** All non-completed scrims with confirmed team counts, ordered by start time. */
export async function getActiveScrims(): Promise<ScrimWithSlots[]> {
  const rows = await db
    .select({ scrim: scrims, confirmedTeams: confirmedCount })
    .from(scrims)
    .where(sql`${scrims.status} != 'completed'`)
    .orderBy(asc(scrims.scrimDate))
  return sortByStartTime(rows.map((r) => ({ ...r.scrim, confirmedTeams: r.confirmedTeams })))
}

export async function getScrimBySlug(slug: string): Promise<ScrimWithSlots | null> {
  const rows = await db
    .select({ scrim: scrims, confirmedTeams: confirmedCount })
    .from(scrims)
    .where(eq(scrims.slug, slug))
    .limit(1)
  if (rows.length === 0) return null
  return { ...rows[0].scrim, confirmedTeams: rows[0].confirmedTeams }
}

export async function getScrimById(id: string): Promise<ScrimWithSlots | null> {
  const rows = await db
    .select({ scrim: scrims, confirmedTeams: confirmedCount })
    .from(scrims)
    .where(eq(scrims.id, id))
    .limit(1)
  if (rows.length === 0) return null
  return { ...rows[0].scrim, confirmedTeams: rows[0].confirmedTeams }
}

export async function getAllScrims(): Promise<ScrimWithSlots[]> {
  const rows = await db
    .select({ scrim: scrims, confirmedTeams: confirmedCount })
    .from(scrims)
    .orderBy(desc(scrims.scrimDate), asc(scrims.startTime))
  return rows.map((r) => ({ ...r.scrim, confirmedTeams: r.confirmedTeams }))
}

/** Whether a user already has a non-cancelled booking for a scrim. */
export async function userHasBooking(userId: string, scrimId: string) {
  const rows = await db
    .select({ id: bookings.id, status: bookings.status })
    .from(bookings)
    .where(
      and(
        eq(bookings.userId, userId),
        eq(bookings.scrimId, scrimId),
        sql`${bookings.status} IN ('pending', 'confirmed')`,
      ),
    )
    .limit(1)
  return rows[0] ?? null
}
