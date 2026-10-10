import "server-only"

import { randomUUID } from "crypto"
import { db } from "@/lib/db"
import { notifications, bookings, activityLogs, scrims } from "@/lib/db/schema"
import { eq, or, and, inArray } from "drizzle-orm"

export async function notifyUser(
  userId: string,
  type: string,
  title: string,
  body?: string,
  href?: string,
) {
  await db.insert(notifications).values({
    id: randomUUID(),
    userId,
    type,
    title,
    body: body ?? null,
    href: href ?? null,
  })
}

/** Notify every user with a confirmed booking for a scrim on the active date. */
export async function notifyScrimParticipants(
  scrimId: string,
  type: string,
  title: string,
  body?: string,
  href?: string,
  targetDate?: string,
) {
  const { getBangladeshActiveDate } = await import("@/lib/queries/scrims")
  const activeDate = targetDate || getBangladeshActiveDate()

  const scrimRow = await db
    .select({ id: scrims.id, slug: scrims.slug })
    .from(scrims)
    .where(or(eq(scrims.id, scrimId), eq(scrims.slug, scrimId)))
    .limit(1)
  const idOrSlug = scrimRow[0] ? [scrimRow[0].id, scrimRow[0].slug] : [scrimId]

  const rows = await db
    .select({ userId: bookings.userId, status: bookings.status })
    .from(bookings)
    .where(
      and(
        inArray(bookings.scrimId, idOrSlug),
        eq(bookings.status, "confirmed"),
        eq(bookings.isTrashed, false),
        eq(bookings.isArchived, false),
        eq(bookings.scrimDate, activeDate)
      )
    )
  const userIds = [...new Set(rows.map((r) => r.userId))]
  if (userIds.length === 0) return
  await db.insert(notifications).values(
    userIds.map((userId) => ({
      id: randomUUID(),
      userId,
      type,
      title,
      body: body ?? null,
      href: href ?? null,
    })),
  )
}

export async function logActivity(
  actorId: string | null,
  actorRole: string | null,
  action: string,
  target?: string,
  meta?: Record<string, unknown>,
) {
  await db.insert(activityLogs).values({
    id: randomUUID(),
    actorId,
    actorRole,
    action,
    target: target ?? null,
    meta: meta ?? null,
  })
}
