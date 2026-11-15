"use server"

import { randomUUID } from "crypto"
import { z } from "zod"
import { db } from "@/lib/db"
import { bookings, payments, scrims, user as userTable, walletTransactions } from "@/lib/db/schema"
import { and, eq, or, sql, gte } from "drizzle-orm"
import { requireUser } from "@/lib/session"
import { createCharge } from "@/lib/uddoktapay"
import { getScrimById, userHasBooking, getBangladeshActiveDate } from "@/lib/queries/scrims"

function isUniqueViolationError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false
  const e = err as { code?: string; cause?: { code?: string } }
  return e.code === "23505" || e.cause?.code === "23505"
}

function pickLowestFreeSlot(slotNumbers: Array<number | null>): number {
  const used = new Set<number>(
    slotNumbers.filter((n): n is number => typeof n === "number" && Number.isInteger(n) && n >= 1)
  )
  let candidate = 1
  while (used.has(candidate)) {
    candidate++
  }
  return candidate
}

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
  paymentMethod: z.enum(["bKash", "Nagad", "Tap", "Balance"]).default("bKash"),
  paymentNumber: z.string().trim().max(50).optional().default(""),
  teamMembersDriveLink: z.string().trim().optional().transform((val) => val || ""),
}).refine(
  (val) => {
    if (val.paymentMethod === "Balance") return true
    return Boolean(val.paymentNumber && val.paymentNumber.length >= 5)
  },
  {
    message: "Payment Number is required for prize pool disbursement",
    path: ["paymentNumber"],
  }
)

export type BookingFormState = {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
  paymentUrl?: string
  paidWithBalance?: boolean
  redirectUrl?: string
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
  if (data.paymentMethod === "Balance" && !data.paymentNumber) {
    data.paymentNumber = "Ace Scrims Account Balance"
  }

  // Auto-persist squad details to user profile ("Info Setup") so future registrations auto-populate
  try {
    const { autoSaveUserDefaultInfo } = await import("@/lib/queries/user-info")
    await autoSaveUserDefaultInfo(user.id, {
      teamName: data.teamName,
      teamTag: data.teamTag,
      captainName: data.captainName,
      captainUid: data.captainUid,
      phone: data.phone,
      paymentMethod: data.paymentMethod,
      paymentNumber: data.paymentNumber,
      teamLeaderImageUrl: data.teamLeaderImageUrl,
      teamMembersDriveLink: data.teamMembersDriveLink,
    })
  } catch (autoErr) {
    console.error("[AutoSave] Failed to trigger auto-save:", autoErr)
  }

  const { resolveOrEnsureScrim } = await import("@/lib/queries/scrims")
  await resolveOrEnsureScrim(data.scrimId).catch(() => {})

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
  const targetDate = scrim.scrimDate && scrim.scrimDate >= activeDate ? scrim.scrimDate : activeDate
  const existing = await userHasBooking(user.id, scrim.id, targetDate)
  if (existing?.status === "confirmed")
    return { ok: false, error: "You already have a confirmed booking for this scrim today." }

  const normalizedTeamName = data.teamName.trim().toLowerCase()
  const normalizedCaptainUid = data.captainUid.trim()

  const duplicateSquad = await db
    .select({ id: bookings.id, userId: bookings.userId, teamName: bookings.teamName })
    .from(bookings)
    .where(
      and(
        or(eq(bookings.scrimId, scrim.id), eq(bookings.scrimId, scrim.slug)),
        eq(bookings.scrimDate, targetDate),
        eq(bookings.status, "confirmed"),
        eq(bookings.isTrashed, false),
        eq(bookings.isArchived, false),
        or(
          eq(bookings.userId, user.id),
          sql`LOWER(TRIM(${bookings.teamName})) = ${normalizedTeamName}`,
          sql`TRIM(${bookings.captainUid}) = ${normalizedCaptainUid}`
        )
      )
    )
    .limit(1)

  if (duplicateSquad.length > 0) {
    return {
      ok: false,
      error:
        duplicateSquad[0].userId === user.id
          ? "You already have a confirmed booking for this scrim today."
          : `Squad "${duplicateSquad[0].teamName}" or Captain UID is already registered for this lobby today.`,
    }
  }

  const bookingId = existing?.id ?? randomUUID()
  const paymentId = randomUUID()
  const teamTag = data.teamTag

  // 1. Fetch user live balance
  const userRow = await db
    .select({ balance: userTable.balance })
    .from(userTable)
    .where(eq(userTable.id, user.id))
    .limit(1)
  const currentBalance = userRow[0]?.balance ?? 0

  // 2. If user has sufficient balance: automatically deduct from wallet, log transaction & confirm booking instantly
  if (currentBalance >= scrim.priceBdt) {
    let confirmedSlotNumber = 1
    let balanceDeducted = false
    let txRejectionError: string | null = null

    try {
      await db.transaction(async (tx) => {
        // Lock the scrim row to serialize concurrent registrations for the same lobby
        await tx.execute(sql`SELECT "id" FROM "scrims" WHERE "id" = ${scrim.id} FOR UPDATE`)

        // Re-verify inside transaction: no duplicate user/squad/UID & lobby still has slots
        const [dupInTx, slotRows] = await Promise.all([
          tx
            .select({ id: bookings.id, userId: bookings.userId, teamName: bookings.teamName })
            .from(bookings)
            .where(
              and(
                or(eq(bookings.scrimId, scrim.id), eq(bookings.scrimId, scrim.slug)),
                eq(bookings.scrimDate, targetDate),
                eq(bookings.status, "confirmed"),
                eq(bookings.isTrashed, false),
                eq(bookings.isArchived, false),
                or(
                  eq(bookings.userId, user.id),
                  sql`LOWER(TRIM(${bookings.teamName})) = ${normalizedTeamName}`,
                  sql`TRIM(${bookings.captainUid}) = ${normalizedCaptainUid}`
                )
              )
            )
            .limit(1),
          tx
            .select({ slotNumber: bookings.slotNumber })
            .from(bookings)
            .where(
              and(
                or(eq(bookings.scrimId, scrim.id), eq(bookings.scrimId, scrim.slug)),
                eq(bookings.scrimDate, targetDate),
                eq(bookings.status, "confirmed"),
                eq(bookings.isTrashed, false),
                eq(bookings.isArchived, false)
              )
            ),
        ])

        if (dupInTx.length > 0) {
          txRejectionError =
            dupInTx[0].userId === user.id
              ? "You already have a confirmed booking for this scrim today."
              : `Squad "${dupInTx[0].teamName}" or Captain UID is already registered for this lobby today.`
          return
        }

        const confirmedCount = slotRows.length
        if (confirmedCount >= scrim.maxTeams) {
          txRejectionError = "This lobby just reached maximum capacity. Please choose another time slot."
          return
        }

        // Atomic deduction: ensure balance >= priceBdt at the moment of update
        const updateBalResult = await tx
          .update(userTable)
          .set({
            balance: sql`${userTable.balance} - ${scrim.priceBdt}`,
            updatedAt: new Date(),
          })
          .where(and(eq(userTable.id, user.id), gte(userTable.balance, scrim.priceBdt)))
          .returning({ newBalance: userTable.balance })

        if (updateBalResult.length === 0) {
          return // insufficient balance or concurrent deduction
        }

        balanceDeducted = true
        const newBal = updateBalResult[0].newBalance

        confirmedSlotNumber = pickLowestFreeSlot(slotRows.map((r) => r.slotNumber))
        const walletTrxId = `WALLET_${randomUUID().slice(0, 8).toUpperCase()}`

        if (existing) {
          await tx
            .update(bookings)
            .set({
              scrimId: scrim.id,
              status: "confirmed",
              slotNumber: confirmedSlotNumber,
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
              transactionId: walletTrxId,
              updatedAt: new Date(),
            })
            .where(and(eq(bookings.id, bookingId), eq(bookings.userId, user.id)))
        } else {
          await tx.insert(bookings).values({
            id: bookingId,
            userId: user.id,
            scrimId: scrim.id,
            scrimDate: targetDate,
            status: "confirmed",
            slotNumber: confirmedSlotNumber,
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
            transactionId: walletTrxId,
          })
        }

        await tx.insert(payments).values({
          id: paymentId,
          userId: user.id,
          bookingId,
          scrimId: scrim.id,
          amountBdt: scrim.priceBdt,
          method: "wallet_balance",
          transactionId: walletTrxId,
          status: "completed",
        })

        await tx.insert(walletTransactions).values({
          id: randomUUID(),
          userId: user.id,
          type: "scrim_registration",
          amountBdt: scrim.priceBdt,
          balanceBefore: currentBalance,
          balanceAfter: newBal,
          description: `Scrim Registration: "${scrim.title}" (${scrim.startTime}) — Slot #${confirmedSlotNumber}`,
          referenceId: bookingId,
          status: "completed",
        })

        if (confirmedCount + 1 >= scrim.maxTeams) {
          await tx
            .update(scrims)
            .set({ registrationOpen: false, updatedAt: new Date() })
            .where(or(eq(scrims.id, scrim.id), eq(scrims.slug, scrim.slug)))
        }
      })
    } catch (txErr) {
      if (isUniqueViolationError(txErr)) {
        return {
          ok: false,
          error: "This account, squad name, or Captain UID already has a confirmed slot in this lobby.",
        }
      }
      throw txErr
    }

    if (txRejectionError) {
      return { ok: false, error: txRejectionError }
    }

    if (balanceDeducted) {
      try {
        const { notifyUser } = await import("@/lib/notify")
        await notifyUser(
          user.id,
          "booking",
          "Scrim Slot Confirmed (Paid with Balance)",
          `৳${scrim.priceBdt} was deducted from your wallet balance. Slot #${confirmedSlotNumber} for "${scrim.title}" (${scrim.startTime}) is confirmed!`,
          "/dashboard/scrims"
        )
      } catch {}

      try {
        const { sendBookingConfirmationEmail } = await import("@/lib/email")
        const emailSent = await sendBookingConfirmationEmail({
          to: user.email,
          recipientName: data.captainName || user.name,
          teamName: data.teamName,
          scrimTitle: scrim.title,
          startTime: scrim.startTime,
          slotNumber: confirmedSlotNumber,
          amountBdt: scrim.priceBdt,
        })
        if (!emailSent) {
          console.warn(`[Booking] Confirmation email delivery returned false for ${user.email}`)
        }
      } catch (emailErr) {
        console.error("[Booking] Confirmation email failed:", emailErr)
      }

      try {
        const { revalidatePath } = await import("next/cache")
        revalidatePath("/scrims")
        revalidatePath(`/scrims/${scrim.slug}`)
        revalidatePath("/")
        revalidatePath("/dashboard/scrims")
        revalidatePath("/dashboard/wallet")
        revalidatePath("/dashboard/info-setup")
        revalidatePath("/dashboard")
        revalidatePath("/admin/scrims")
        revalidatePath("/admin")
      } catch {}

      return {
        ok: true,
        paidWithBalance: true,
        redirectUrl: "/dashboard/scrims?booked=true",
      }
    }
  }

  // 3. If balance is insufficient: gracefully redirect user to pay for that scrim via UddoktaPay
  if (existing) {
    // Reuse the pending booking, update the team info
    await db
      .update(bookings)
      .set({
        scrimId: scrim.id,
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
