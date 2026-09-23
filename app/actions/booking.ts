"use server"

import { randomUUID } from "crypto"
import { z } from "zod"
import { db } from "@/lib/db"
import { bookings, payments, scrims } from "@/lib/db/schema"
import { and, eq, or, sql } from "drizzle-orm"
import { requireUser } from "@/lib/session"
import { createCharge } from "@/lib/uddoktapay"
import { getScrimById, userHasBooking } from "@/lib/queries/scrims"

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
  paymentNumber: z.string().trim().min(5, "Payment Number is required (bKash or Nagad number used)").max(30),
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
  if (!scrim.registrationOpen || scrim.status === "completed" || scrim.status === "not_hosted")
    return { ok: false, error: "Registration for this scrim is closed." }
  if (scrim.confirmedTeams >= scrim.maxTeams)
    return { ok: false, error: "This scrim is full. Try another time slot." }

  const existing = await userHasBooking(user.id, scrim.id)
  if (existing?.status === "confirmed")
    return { ok: false, error: "You already have a confirmed booking for this scrim." }

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
        scrimDate: scrim.scrimDate,
        teamLeaderImageUrl: data.teamLeaderImageUrl,
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
      scrimDate: scrim.scrimDate,
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

/** Confirmed bookings count used for polling live slots. */
export async function getScrimSlots(scrimId: string) {
  try {
    const scrimRow = await db
      .select({ id: scrims.id, slug: scrims.slug, maxTeams: scrims.maxTeams, scrimDate: scrims.scrimDate })
      .from(scrims)
      .where(or(eq(scrims.id, scrimId), eq(scrims.slug, scrimId)))
      .limit(1)

    const targetId = scrimRow[0]?.id || scrimId
    const targetSlug = scrimRow[0]?.slug || scrimId
    const targetDate = scrimRow[0]?.scrimDate

    const rows = await db
      .select({
        confirmed: sql<number>`COUNT(*) FILTER (WHERE ${bookings.status} = 'confirmed')::int`,
      })
      .from(bookings)
      .where(
        and(
          or(eq(bookings.scrimId, targetId), eq(bookings.scrimId, targetSlug)),
          targetDate ? or(eq(bookings.scrimDate, targetDate), sql`${bookings.scrimDate} IS NULL`) : sql`TRUE`
        )
      )

    return {
      confirmed: rows[0]?.confirmed ?? 0,
      maxTeams: scrimRow[0]?.maxTeams ?? 12,
    }
  } catch {
    return { confirmed: 0, maxTeams: 12 }
  }
}
