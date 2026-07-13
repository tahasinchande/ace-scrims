import "server-only"

import { db } from "@/lib/db"
import { bookings, payments, scrims, results, notifications } from "@/lib/db/schema"
import { and, desc, eq, sql } from "drizzle-orm"
import { scrimStartDate } from "@/lib/format"

export type UserBooking = typeof bookings.$inferSelect & {
  scrim: typeof scrims.$inferSelect | null
  result: typeof results.$inferSelect | null
}

/** All bookings for a user with their scrim and (if the team won) result. */
export async function getUserBookings(userId: string): Promise<UserBooking[]> {
  const rows = await db
    .select({ booking: bookings, scrim: scrims })
    .from(bookings)
    .leftJoin(scrims, eq(bookings.scrimId, scrims.id))
    .where(eq(bookings.userId, userId))
    .orderBy(desc(bookings.createdAt))

  if (rows.length === 0) return []

  const scrimIds = [...new Set(rows.map((r) => r.booking.scrimId))]
  const resultRows = await db
    .select()
    .from(results)
    .where(sql`${results.scrimId} IN ${scrimIds}`)

  return rows.map((r) => ({
    ...r.booking,
    scrim: r.scrim,
    result:
      resultRows.find(
        (res) =>
          res.scrimId === r.booking.scrimId &&
          res.winningTeam.toLowerCase() === r.booking.teamName.toLowerCase(),
      ) ?? null,
  }))
}

export function splitBookings(list: UserBooking[]) {
  const now = Date.now()
  const upcoming: UserBooking[] = []
  const past: UserBooking[] = []
  for (const b of list) {
    if (!b.scrim) {
      past.push(b)
      continue
    }
    const start = scrimStartDate(b.scrim.scrimDate, b.scrim.startTime)
    // A scrim lasts 1 hour; treat it as past an hour after start
    if (start.getTime() + 60 * 60 * 1000 < now || b.scrim.status === "completed") {
      past.push(b)
    } else {
      upcoming.push(b)
    }
  }
  return { upcoming, past }
}

/** Payment history for a user, newest first, with scrim titles. */
export async function getUserPayments(userId: string) {
  return db
    .select({ payment: payments, scrimTitle: scrims.title, scrimTime: scrims.startTime })
    .from(payments)
    .leftJoin(scrims, eq(payments.scrimId, scrims.id))
    .where(eq(payments.userId, userId))
    .orderBy(desc(payments.createdAt))
}

export async function getUserNotifications(userId: string, limit = 50) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
}

export async function getUnreadCount(userId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)))
  return rows[0]?.count ?? 0
}
