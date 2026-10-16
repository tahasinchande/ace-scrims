import "server-only"

import { db } from "@/lib/db"
import { bookings, payments, scrims, results, notifications, settings, reports } from "@/lib/db/schema"
import { and, desc, eq, inArray, sql } from "drizzle-orm"
import { scrimStartDate } from "@/lib/format"

export async function getMainWhatsappUrl(): Promise<string> {
  try {
    const row = await db.select().from(settings).where(eq(settings.key, "whatsapp_channel_url")).limit(1)
    if (row.length > 0 && row[0].value?.trim()) {
      return row[0].value.trim()
    }
  } catch (e) {
    console.warn("[Settings] Could not fetch whatsapp_channel_url:", e)
  }
  return "https://whatsapp.com/channel/0029Va9xyz"
}

export async function getChampionRushWhatsappUrl(): Promise<string> {
  try {
    const row = await db.select().from(settings).where(eq(settings.key, "champion_rush_whatsapp_url")).limit(1)
    if (row.length > 0 && row[0].value?.trim()) {
      return row[0].value.trim()
    }
  } catch (e) {
    console.warn("[Settings] Could not fetch champion_rush_whatsapp_url:", e)
  }
  return "https://whatsapp.com/channel/0029Vb7Bq9w42DcT1O2b0s3V"
}

export async function getChampionRush3pmWhatsappUrl(): Promise<string> {
  try {
    const row = await db.select().from(settings).where(eq(settings.key, "champion_rush_3pm_whatsapp_url")).limit(1)
    if (row.length > 0 && row[0].value?.trim()) {
      return row[0].value.trim()
    }
  } catch (e) {
    console.warn("[Settings] Could not fetch champion_rush_3pm_whatsapp_url:", e)
  }
  return "https://whatsapp.com/channel/0029Vb7Bq9w42DcT1O2b0s3V"
}

export type UserBooking = typeof bookings.$inferSelect & {
  scrim: typeof scrims.$inferSelect | null
  result: typeof results.$inferSelect | null
}

/** All confirmed bookings for a user with their scrim and (if the team won) result. */
export async function getUserBookings(userId: string): Promise<UserBooking[]> {
  const rows = await db
    .select({ booking: bookings, scrim: scrims })
    .from(bookings)
    .leftJoin(scrims, eq(bookings.scrimId, scrims.id))
    .where(and(eq(bookings.userId, userId), eq(bookings.status, "confirmed"), eq(bookings.isTrashed, false)))
    .orderBy(desc(bookings.createdAt))

  if (rows.length === 0) return []

  const { ALL_STANDARD_SCRIM_DEFINITIONS, getBangladeshActiveDate } = await import("@/lib/queries/scrims")
  const activeDate = getBangladeshActiveDate()

  const scrimIds = [...new Set(rows.map((r) => r.booking.scrimId))]
  const resultRows = scrimIds.length > 0
    ? await db
        .select()
        .from(results)
        .where(inArray(results.scrimId, scrimIds))
    : []

  return rows.map((r) => {
    let scrimData = r.scrim
    if (!scrimData) {
      const def = ALL_STANDARD_SCRIM_DEFINITIONS.find((d) => d.id === r.booking.scrimId || d.slug === r.booking.scrimId)
      if (def) {
        scrimData = {
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
          description: "Competitive Free Fire lobby.",
          rules: null,
          roomId: null,
          roomPassword: null,
          roomPublished: false,
          status: "upcoming",
          registrationOpen: true,
          hidden: false,
          deletedAt: null,
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as typeof scrims.$inferSelect
      }
    }

    return {
      ...r.booking,
      scrim: scrimData,
      result:
        resultRows.find(
          (res) =>
            res.scrimId === r.booking.scrimId &&
            (res.winningTeam.toLowerCase() === r.booking.teamName.toLowerCase() ||
              res.winningTeam.toLowerCase().includes(r.booking.teamName.toLowerCase()) ||
              r.booking.teamName.toLowerCase().includes(res.winningTeam.toLowerCase())),
        ) ?? resultRows.find((res) => res.scrimId === r.booking.scrimId) ?? null,
    }
  })
}

export function splitBookings(list: UserBooking[]) {
  const now = Date.now()
  const upcoming: UserBooking[] = []
  const past: UserBooking[] = []

  for (const b of list) {
    // 1. If booking was cancelled or refunded
    if (b.status === "cancelled" || b.status === "refunded") {
      past.push(b)
      continue
    }

    // 2. Explicitly completed, not hosted, or deleted scrims
    if (b.scrim?.status === "completed" || b.scrim?.status === "not_hosted" || b.scrim?.status === "deleted") {
      past.push(b)
      continue
    }

    // 3. If match result has been published for this scrim, it is completed
    if (b.result) {
      past.push(b)
      continue
    }

    // 4. If scrim is upcoming, live, or in_progress, it belongs in upcoming
    if (
      b.scrim?.status === "upcoming" ||
      b.scrim?.status === "live" ||
      b.scrim?.status === "in_progress"
    ) {
      upcoming.push(b)
      continue
    }

    if (!b.scrim) {
      // Fallback: If no scrim metadata could be found, check booking creation time
      const bookingAgeMs = now - new Date(b.createdAt).getTime()
      if (bookingAgeMs > 12 * 60 * 60 * 1000) {
        past.push(b)
      } else {
        upcoming.push(b)
      }
      continue
    }

    // 5. Determine duration based on scrim type
    const isLongLobby =
      b.scrim.title?.toLowerCase().includes("champion") ||
      b.scrim.title?.toLowerCase().includes("blast") ||
      b.scrim.id?.includes("10pm-champion")
    const scrimDurationMs = isLongLobby ? 3 * 60 * 60 * 1000 : 2 * 60 * 60 * 1000

    const start = scrimStartDate(b.scrim.scrimDate, b.scrim.startTime)
    const endTime = start.getTime() + scrimDurationMs

    // Only move to past once the match duration has passed AND start time is in the past
    if (now > endTime) {
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

/** All reports submitted by the user, newest first, with optional scrim title. */
export async function getUserReports(userId: string) {
  const rows = await db
    .select({
      report: reports,
      scrimTitle: scrims.title,
    })
    .from(reports)
    .leftJoin(scrims, eq(reports.scrimId, scrims.id))
    .where(eq(reports.userId, userId))
    .orderBy(desc(reports.createdAt))

  return rows.map((r) => ({
    ...r.report,
    scrimTitle: r.scrimTitle,
  }))
}
