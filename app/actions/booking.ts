"use server"

import { randomUUID } from "crypto"
import { z } from "zod"
import { db } from "@/lib/db"
import { bookings, payments, scrims } from "@/lib/db/schema"
import { and, eq, sql } from "drizzle-orm"
import { requireUser } from "@/lib/session"
import { createCharge } from "@/lib/uddoktapay"
import { getScrimById, userHasBooking } from "@/lib/queries/scrims"

const uidRegex = /^\d{6,15}$/
const nameField = z.string().trim().min(2, "Too short").max(40, "Too long")
const uidField = z.string().trim().regex(uidRegex, "UID must be 6-15 digits")

const bookingSchema = z.object({
  scrimId: z.string().min(1),
  teamName: nameField,
  captainName: nameField,
  captainUid: uidField,
  player2Name: nameField,
  player2Uid: uidField,
  player3Name: nameField,
  player3Uid: uidField,
  player4Name: nameField,
  player4Uid: uidField,
  player5Name: z.string().trim().max(40).optional().or(z.literal("")),
  player5Uid: z
    .string()
    .trim()
    .regex(uidRegex, "UID must be 6-15 digits")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .trim()
    .regex(/^(\+?880|0)1[3-9]\d{8}$/, "Enter a valid Bangladeshi phone number"),
  discordTelegram: z.string().trim().max(60).optional().or(z.literal("")),
})

export type BookingFormState = {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
  paymentUrl?: string
}

function getBaseUrl(): string {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return process.env.V0_RUNTIME_URL ?? "http://localhost:3000"
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

  // Player 5 must have both name and UID, or neither
  const p5Name = data.player5Name || ""
  const p5Uid = data.player5Uid || ""
  if ((p5Name && !p5Uid) || (!p5Name && p5Uid)) {
    return {
      ok: false,
      error: "Player 5 needs both a name and a UID, or leave both empty.",
      fieldErrors: { player5Name: "Provide both name and UID, or neither" },
    }
  }

  const scrim = await getScrimById(data.scrimId)
  if (!scrim) return { ok: false, error: "Scrim not found." }
  if (!scrim.registrationOpen || scrim.status === "completed")
    return { ok: false, error: "Registration for this scrim is closed." }
  if (scrim.confirmedTeams >= scrim.maxTeams)
    return { ok: false, error: "This scrim is full. Try another time slot." }

  const existing = await userHasBooking(user.id, scrim.id)
  if (existing?.status === "confirmed")
    return { ok: false, error: "You already have a confirmed booking for this scrim." }

  const bookingId = existing?.id ?? randomUUID()
  const paymentId = randomUUID()

  if (existing) {
    // Reuse the pending booking, update the player info
    await db
      .update(bookings)
      .set({
        teamName: data.teamName,
        captainName: data.captainName,
        captainUid: data.captainUid,
        player2Name: data.player2Name,
        player2Uid: data.player2Uid,
        player3Name: data.player3Name,
        player3Uid: data.player3Uid,
        player4Name: data.player4Name,
        player4Uid: data.player4Uid,
        player5Name: p5Name || null,
        player5Uid: p5Uid || null,
        phone: data.phone,
        discordTelegram: data.discordTelegram || null,
        updatedAt: new Date(),
      })
      .where(and(eq(bookings.id, bookingId), eq(bookings.userId, user.id)))
  } else {
    await db.insert(bookings).values({
      id: bookingId,
      userId: user.id,
      scrimId: scrim.id,
      status: "pending",
      teamName: data.teamName,
      captainName: data.captainName,
      captainUid: data.captainUid,
      player2Name: data.player2Name,
      player2Uid: data.player2Uid,
      player3Name: data.player3Name,
      player3Uid: data.player3Uid,
      player4Name: data.player4Name,
      player4Uid: data.player4Uid,
      player5Name: p5Name || null,
      player5Uid: p5Uid || null,
      phone: data.phone,
      discordTelegram: data.discordTelegram || null,
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
    cancelUrl: `${baseUrl}/payment/cancelled?pid=${paymentId}`,
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
  const rows = await db
    .select({
      confirmed: sql<number>`COUNT(*) FILTER (WHERE ${bookings.status} = 'confirmed')::int`,
    })
    .from(bookings)
    .where(eq(bookings.scrimId, scrimId))
  const scrim = await db
    .select({ maxTeams: scrims.maxTeams })
    .from(scrims)
    .where(eq(scrims.id, scrimId))
    .limit(1)
  return {
    confirmed: rows[0]?.confirmed ?? 0,
    maxTeams: scrim[0]?.maxTeams ?? 12,
  }
}
