import "server-only"

import { randomUUID } from "crypto"
import { db } from "@/lib/db"
import { notifications, bookings, activityLogs } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

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

/** Notify every user with a confirmed booking for a scrim. */
export async function notifyScrimParticipants(
  scrimId: string,
  type: string,
  title: string,
  body?: string,
  href?: string,
) {
  const rows = await db
    .select({ userId: bookings.userId, status: bookings.status })
    .from(bookings)
    .where(eq(bookings.scrimId, scrimId))
  const userIds = [...new Set(rows.filter((r) => r.status === "confirmed").map((r) => r.userId))]
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
