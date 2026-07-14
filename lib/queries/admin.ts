import "server-only"

import { db } from "@/lib/db"
import { scrims, bookings, payments, results, user, activityLogs } from "@/lib/db/schema"
import { eq, desc, and, gte, sql, count } from "drizzle-orm"

/** Today's revenue, bookings, totals for the admin analytics cards. */
export async function getAdminStats() {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const [revenueToday, bookingsToday, totalUsers, totalBookings, revenueAll, activeScrims] =
    await Promise.all([
      db
        .select({ total: sql<number>`coalesce(sum(${payments.amountBdt}), 0)` })
        .from(payments)
        .where(and(eq(payments.status, "completed"), gte(payments.createdAt, todayStart))),
      db
        .select({ n: count() })
        .from(bookings)
        .where(and(eq(bookings.status, "confirmed"), gte(bookings.createdAt, todayStart))),
      db.select({ n: count() }).from(user),
      db.select({ n: count() }).from(bookings).where(eq(bookings.status, "confirmed")),
      db
        .select({ total: sql<number>`coalesce(sum(${payments.amountBdt}), 0)` })
        .from(payments)
        .where(eq(payments.status, "completed")),
      db.select({ n: count() }).from(scrims).where(eq(scrims.status, "upcoming")),
    ])

  return {
    revenueToday: Number(revenueToday[0]?.total ?? 0),
    bookingsToday: bookingsToday[0]?.n ?? 0,
    totalUsers: totalUsers[0]?.n ?? 0,
    totalBookings: totalBookings[0]?.n ?? 0,
    revenueAll: Number(revenueAll[0]?.total ?? 0),
    activeScrims: activeScrims[0]?.n ?? 0,
  }
}

/** All scrims with confirmed + pending team counts, newest first. */
export async function getAdminScrims() {
  const rows = await db
    .select({
      scrim: scrims,
      confirmedTeams: sql<number>`(
        select count(*) from bookings b
        where b."scrimId" = ${scrims.id} and b.status = 'confirmed'
      )`,
      pendingTeams: sql<number>`(
        select count(*) from bookings b
        where b."scrimId" = ${scrims.id} and b.status = 'pending'
      )`,
    })
    .from(scrims)
    .orderBy(desc(scrims.createdAt))
  return rows.map((r) => ({
    ...r.scrim,
    confirmedTeams: Number(r.confirmedTeams),
    pendingTeams: Number(r.pendingTeams),
  }))
}

/** Every booking (any status) grouped by scrim id, for the team roster dialogs. */
export async function getAllBookingsByScrim() {
  const rows = await db
    .select({ booking: bookings, userEmail: user.email })
    .from(bookings)
    .leftJoin(user, eq(bookings.userId, user.id))
    .orderBy(bookings.slotNumber, bookings.createdAt)

  const grouped: Record<string, ((typeof rows)[number]["booking"] & { userEmail: string | null })[]> = {}
  for (const r of rows) {
    const key = r.booking.scrimId
    if (!grouped[key]) grouped[key] = []
    grouped[key].push({ ...r.booking, userEmail: r.userEmail })
  }
  return grouped
}

export async function getAdminUsers() {
  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      banned: user.banned,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    })
    .from(user)
    .orderBy(desc(user.createdAt))
    .limit(200)
}

export async function getAdminPayments() {
  return db
    .select({
      payment: payments,
      teamName: bookings.teamName,
      scrimTitle: scrims.title,
      userEmail: user.email,
    })
    .from(payments)
    .leftJoin(bookings, eq(payments.bookingId, bookings.id))
    .leftJoin(scrims, eq(payments.scrimId, scrims.id))
    .leftJoin(user, eq(payments.userId, user.id))
    .orderBy(desc(payments.createdAt))
    .limit(200)
}

export async function getAdminResults() {
  return db
    .select({ result: results, scrimTitle: scrims.title, startTime: scrims.startTime })
    .from(results)
    .leftJoin(scrims, eq(results.scrimId, scrims.id))
    .orderBy(desc(results.createdAt))
    .limit(100)
}

export async function getAdminBookingsForScrim(scrimId: string) {
  return db
    .select()
    .from(bookings)
    .where(eq(bookings.scrimId, scrimId))
    .orderBy(bookings.slotNumber)
}

export async function getActivityLogs() {
  return db
    .select({
      log: activityLogs,
      actorName: user.name,
    })
    .from(activityLogs)
    .leftJoin(user, eq(activityLogs.actorId, user.id))
    .orderBy(desc(activityLogs.createdAt))
    .limit(200)
}
