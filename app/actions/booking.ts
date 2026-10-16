"use server"

import { randomUUID } from "crypto"
import { z } from "zod"
import { db } from "@/lib/db"
import { bookings, payments, scrims } from "@/lib/db/schema"
import { and, eq, or, sql } from "drizzle-orm"
import { requireUser } from "@/lib/session"
import { createCharge } from "@/lib/uddoktapay"
import { getScrimById, userHasBooking, getBangladeshActiveDate } from "@/lib/queries/scrims"

const bookingSchema = z.object({
  scrimId: z.string().min(1),
  teamName: z.string().trim().min(2, "Team Name must be at least 2 characters").max(40),
  teamTag: z.string().trim().min(1, "Team Tag is required").max(10),
  captainName: z.string().trim().min(2, "Team Leader Name is required").max(40),
  captainUid: z.string().trim().min(5, "Team Leader UID must be at least 5 digits").max(30),
  phone: z
    .string()
    .trim()
    .regex(/^(\+?880|0)1[3-9]\d{8}$/, "Enter a valid Bangladeshi WhatsApp number"),
  teamLeaderImageUrl: z.string().min(1, "Team Leader image is required. Please upload a waist-up photo."),
  paymentMethod: z.enum(["bKash", "Nagad", "Tap"]).default("bKash"),
  paymentNumber: z.string().trim().min(5, "Payment Number is required for prizepool disbursement").max(30),
  teamMembersDriveLink: z.string().trim().optional().transform((val) => val || ""),
})

export type BookingFormState = {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
  paymentUrl?: string
}

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    const raw = process.env.NEXT_PUBLIC_APP_URL.trim().replace(/\/$/, "")
    if (raw && !raw.includes("localhost") && !raw.includes("vercel.app")) {
      return raw.startsWith("http") ? raw : `https://${raw}`
    }
  }
  if (process.env.BETTER_AUTH_URL) {
    const raw = process.env.BETTER_AUTH_URL.trim().replace(/\/$/, "")
    if (raw && !raw.includes("localhost") && !raw.includes("vercel.app")) {
      return raw.startsWith("http") ? raw : `https://${raw}`
    }
  }
  return "https://www.acescrims.online"
}

export async function createBooking(
  _prev: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  let user
  try {
    user = await requireUser()
  } catch {
    return { ok: false, error: "Please sign in to book a scrim." }
  }

  if (!user.emailVerified) {
    return {
      ok: false,
      error: "You must verify your email address before booking a scrim. Please check your inbox or visit /verify-email to verify.",
    }
  }

  const parsed = bookingSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message
    }
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors }
  }
  const data = parsed.data

  const scrim = await getScrimById(data.scrimId)
  if (!scrim) return { ok: false, error: "Scrim not found." }

  const isForcedOpen = scrim.status === "force_open" || scrim.status === "force_turn_on"
  if (!isForcedOpen && (!scrim.registrationOpen || scrim.status === "completed" || scrim.status === "not_hosted" || scrim.status === "registration_closed"))
    return { ok: false, error: "Registration for this scrim is closed." }

  if (!isForcedOpen && scrim.scrimDate && scrim.startTime) {
    try {
      const { scrimStartDate } = await import("@/lib/format")
      const start = scrimStartDate(scrim.scrimDate, scrim.startTime)
      if (new Date() >= start) {
        return { ok: false, error: "Registration for this scrim has closed as the match start time has passed." }
      }
    } catch {
      // Ignore parse error
    }
  }

  if (scrim.confirmedTeams >= scrim.maxTeams)
    return { ok: false, error: "This scrim is full. Try another time slot." }

  const activeDate = getBangladeshActiveDate()
  const targetDate = activeDate
  const existing = await userHasBooking(user.id, scrim.id, targetDate)
  if (existing?.status === "confirmed")
    return { ok: false, error: "You already have a confirmed booking for this scrim today." }

  const bookingId = existing?.id ?? randomUUID()
  const paymentId = randomUUID()
  const teamTag = data.teamTag

  if (existing) {
    // Reuse the pending booking, update the team info
    await db
      .update(bookings)
      .set({
        teamName: data.teamName,
        captainName: data.captainName,
        captainUid: data.captainUid,
        player2Name: "N/A",
        player2Uid: "N/A",
        player3Name: "N/A",
        player3Uid: "N/A",
        player4Name: "N/A",
        player4Uid: "N/A",
        player5Name: null,
        player5Uid: null,
        phone: data.phone,
        discordTelegram: teamTag,
        scrimDate: targetDate,
        teamLeaderImageUrl: data.teamLeaderImageUrl,
        paymentMethod: data.paymentMethod,
        paymentNumber: data.paymentNumber,
        teamMembersDriveLink: data.teamMembersDriveLink || null,
        updatedAt: new Date(),
      })
      .where(and(eq(bookings.id, bookingId), eq(bookings.userId, user.id)))
  } else {
    await db.insert(bookings).values({
      id: bookingId,
      userId: user.id,
      scrimId: scrim.id,
      scrimDate: targetDate,
      status: "pending",
      teamName: data.teamName,
      captainName: data.captainName,
      captainUid: data.captainUid,
      player2Name: "N/A",
      player2Uid: "N/A",
      player3Name: "N/A",
      player3Uid: "N/A",
      player4Name: "N/A",
      player4Uid: "N/A",
      player5Name: null,
      player5Uid: null,
      phone: data.phone,
      discordTelegram: teamTag,
      teamLeaderImageUrl: data.teamLeaderImageUrl,
      paymentMethod: data.paymentMethod,
      paymentNumber: data.paymentNumber,
      teamMembersDriveLink: data.teamMembersDriveLink || null,
    })
  }

  const baseUrl = getBaseUrl()
  const charge = await createCharge({
    fullName: data.captainName,
    email: user.email,
    amount: scrim.priceBdt,
    metadata: {
      payment_id: paymentId,
      booking_id: bookingId,
      scrim_id: scrim.id,
      user_id: user.id,
    },
    redirectUrl: `${baseUrl}/payment/callback?pid=${paymentId}`,
    cancelUrl: `${baseUrl}/payment/result?status=cancelled`,
    webhookUrl: `${baseUrl}/api/payment/webhook`,
  })

  if (!charge.ok) return { ok: false, error: charge.error }

  await db.insert(payments).values({
    id: paymentId,
    userId: user.id,
    bookingId,
    scrimId: scrim.id,
    amountBdt: scrim.priceBdt,
    status: "pending",
  })

  return { ok: true, paymentUrl: charge.paymentUrl }
}

export async function cancelPendingBooking(bookingId: string): Promise<void> {
  const user = await requireUser()
  await db
    .update(bookings)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(
      and(
        eq(bookings.id, bookingId),
        eq(bookings.userId, user.id),
        eq(bookings.status, "pending"),
      ),
    )
}

/** Confirmed bookings count and live status used for polling live slots. */
export async function getScrimSlots(scrimId: string) {
  try {
    const { archivePreviousDayBookings } = await import("@/lib/queries/scrims")
    await archivePreviousDayBookings().catch(() => {})
    const activeDate = getBangladeshActiveDate()

    const scrimRow = await db
      .select({
        id: scrims.id,
        slug: scrims.slug,
        maxTeams: scrims.maxTeams,
        registrationOpen: scrims.registrationOpen,
        status: scrims.status,
        scrimDate: scrims.scrimDate,
        startTime: scrims.startTime,
      })
      .from(scrims)
      .where(or(eq(scrims.id, scrimId), eq(scrims.slug, scrimId)))
      .limit(1)

    const targetId = scrimRow[0]?.id || scrimId
    const targetSlug = scrimRow[0]?.slug || scrimId

    const rows = await db
      .select({
        confirmed: sql<number>`COUNT(*) FILTER (WHERE ${bookings.status} = 'confirmed' AND ${bookings.isTrashed} = false AND ${bookings.isArchived} = false)::int`,
      })
      .from(bookings)
      .where(
        and(
          or(eq(bookings.scrimId, targetId), eq(bookings.scrimId, targetSlug)),
          eq(bookings.scrimDate, activeDate)
        )
      )

    const confirmed = rows[0]?.confirmed ?? 0
    const maxTeams = scrimRow[0]?.maxTeams ?? 12
    const isNewDay = !scrimRow[0]?.scrimDate || scrimRow[0]?.scrimDate < activeDate
    const rawStatus = isNewDay && (scrimRow[0]?.status === "completed" || scrimRow[0]?.status === "registration_closed")
      ? "upcoming"
      : (scrimRow[0]?.status || "upcoming")
    const rawRegOpen = isNewDay ? true : (scrimRow[0]?.registrationOpen ?? true)
    const isFull = confirmed >= maxTeams

    return {
      confirmed,
      maxTeams,
      registrationOpen: rawRegOpen && !isFull && rawStatus !== "not_hosted",
      status: isFull && rawStatus === "upcoming" ? "registration_closed" : rawStatus,
    }
  } catch {
    return { confirmed: 0, maxTeams: 12, registrationOpen: true, status: "upcoming" }
  }
}

/** Returns live slot counts and registration status for all active scrims */
export async function getLiveScrimSlotsMap(): Promise<
  Record<string, { confirmed: number; maxTeams: number; registrationOpen: boolean; status: string }>
> {
  try {
    const { archivePreviousDayBookings } = await import("@/lib/queries/scrims")
    await archivePreviousDayBookings().catch(() => {})
    const activeDate = getBangladeshActiveDate()

    const [bookingCounts, scrimRows] = await Promise.all([
      db
        .select({
          scrimId: bookings.scrimId,
          count: sql<number>`COUNT(*) FILTER (WHERE ${bookings.status} = 'confirmed' AND ${bookings.isTrashed} = false AND ${bookings.isArchived} = false)::int`,
        })
        .from(bookings)
        .where(eq(bookings.scrimDate, activeDate))
        .groupBy(bookings.scrimId),
      db
        .select({
          id: scrims.id,
          slug: scrims.slug,
          maxTeams: scrims.maxTeams,
          registrationOpen: scrims.registrationOpen,
          status: scrims.status,
          scrimDate: scrims.scrimDate,
          startTime: scrims.startTime,
        })
        .from(scrims),
    ])

    const countMap: Record<string, number> = {}
    for (const b of bookingCounts) {
      countMap[b.scrimId] = Number(b.count)
    }

    const resultMap: Record<string, { confirmed: number; maxTeams: number; registrationOpen: boolean; status: string }> = {}

    for (const s of scrimRows) {
      const c1 = countMap[s.id] || 0
      const c2 = s.slug ? countMap[s.slug] || 0 : 0
      const totalConfirmed = c1 + c2
      const maxTeams = s.maxTeams || 12

      const isNewDay = !s.scrimDate || s.scrimDate < activeDate
      const rawStatus = isNewDay && (s.status === "completed" || s.status === "registration_closed")
        ? "upcoming"
        : (s.status || "upcoming")
      const rawRegOpen = isNewDay ? true : (s.registrationOpen ?? true)
      const isFull = totalConfirmed >= maxTeams

      const item = {
        confirmed: totalConfirmed,
        maxTeams,
        registrationOpen: rawRegOpen && !isFull && rawStatus !== "not_hosted",
        status: isFull && rawStatus === "upcoming" ? "registration_closed" : rawStatus,
      }

      resultMap[s.id] = item
      if (s.slug) resultMap[s.slug] = item
    }

    const { ALL_STANDARD_SCRIM_DEFINITIONS } = await import("@/lib/queries/scrims")
    for (const def of ALL_STANDARD_SCRIM_DEFINITIONS) {
      if (!resultMap[def.id]) {
        const item = {
          confirmed: 0,
          maxTeams: 12,
          registrationOpen: true,
          status: "upcoming",
        }
        resultMap[def.id] = item
        if (def.slug) resultMap[def.slug] = item
      }
    }

    return resultMap
  } catch {
    return {}
  }
}

/** Fetches fresh daily scrims state synchronized with daily reset */
export async function getLiveActiveScrimsAction() {
  const { archivePreviousDayBookings, getBangladeshActiveDate, getActiveScrims } = await import("@/lib/queries/scrims")
  await archivePreviousDayBookings().catch(() => {})
  const activeDate = getBangladeshActiveDate()
  const scrims = await getActiveScrims()
  return { activeDate, scrims }
}
