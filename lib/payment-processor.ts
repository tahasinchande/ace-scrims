import "server-only"

import { randomUUID } from "crypto"
import { db } from "@/lib/db"
import { bookings, payments, scrims, user, walletTransactions } from "@/lib/db/schema"
import { and, eq, or, sql } from "drizzle-orm"
import { verifyPayment } from "@/lib/uddoktapay"
import { notifyUser } from "@/lib/notify"
import { sendBookingConfirmationEmail } from "@/lib/email"
import { resolveOrEnsureScrim } from "@/lib/queries/scrims"

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

export type ProcessOutcome =
  | { status: "confirmed" }
  | { status: "already-confirmed" }
  | { status: "pending" }
  | { status: "failed"; reason: string }

/**
 * Verifies an invoice with UddoktaPay server-to-server and, when COMPLETED,
 * atomically confirms the booking. Idempotent: safe to call from both the
 * webhook and the redirect callback for the same invoice.
 */
export async function processPayment(
  paymentId: string,
  invoiceId: string,
  directTrxId?: string | null,
): Promise<ProcessOutcome> {
  const existingRows = await db
    .select()
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1)
  const payment = existingRows[0]
  if (!payment) return { status: "failed", reason: "Payment record not found" }
  if (payment.status === "completed") return { status: "already-confirmed" }

  // Never trust callback params — re-verify with the gateway
  const verified = await verifyPayment(invoiceId)
  if (!verified) {
    await db
      .update(payments)
      .set({ invoiceId, updatedAt: new Date() })
      .where(eq(payments.id, paymentId))
      .catch(() => {})
    return { status: "pending" }
  }

  if (verified.status === "PENDING") {
    await db
      .update(payments)
      .set({ invoiceId, updatedAt: new Date() })
      .where(eq(payments.id, paymentId))
    return { status: "pending" }
  }

  if (verified.status !== "COMPLETED") {
    await db
      .update(payments)
      .set({ status: "failed", invoiceId, rawPayload: verified.raw, updatedAt: new Date() })
      .where(eq(payments.id, paymentId))
    await db
      .update(bookings)
      .set({ status: "failed", updatedAt: new Date() })
      .where(and(eq(bookings.id, payment.bookingId), eq(bookings.status, "pending")))
    return { status: "failed", reason: "Payment was not completed" }
  }

  // Cross-check: metadata payment_id must match, amount must match
  if (verified.metadata?.payment_id && verified.metadata.payment_id !== paymentId) {
    return { status: "failed", reason: "Metadata mismatch" }
  }
  const paidAmount = Number.parseFloat(verified.amount ?? "0")
  if (Number.isNaN(paidAmount) || paidAmount + 0.001 < payment.amountBdt) {
    await db
      .update(payments)
      .set({ status: "failed", invoiceId, rawPayload: verified.raw, updatedAt: new Date() })
      .where(eq(payments.id, paymentId))
    return { status: "failed", reason: "Amount mismatch" }
  }

  const trxId =
    verified.transactionId ||
    directTrxId ||
    ((verified.raw as any)?.trx_id as string) ||
    ((verified.raw as any)?.trxid as string) ||
    ((verified.raw as any)?.transaction_id as string) ||
    ((verified.raw as any)?.transactionId as string) ||
    null

  const isWalletDeposit = payment.scrimId === "wallet_deposit" || payment.bookingId === "wallet_deposit"

  if (isWalletDeposit) {
    let depositConfirmed = false
    await db.transaction(async (tx) => {
      const updated = await tx
        .update(payments)
        .set({
          status: "completed",
          invoiceId,
          transactionId: trxId,
          method: verified.paymentMethod ?? null,
          senderNumber: verified.senderNumber ?? null,
          rawPayload: verified.raw,
          updatedAt: new Date(),
        })
        .where(and(eq(payments.id, paymentId), sql`${payments.status} != 'completed'`))
        .returning({ id: payments.id })

      if (updated.length === 0) return

      depositConfirmed = true

      const userRow = await tx
        .select({ balance: user.balance })
        .from(user)
        .where(eq(user.id, payment.userId))
        .limit(1)

      const balBefore = userRow[0]?.balance ?? 0
      const balAfter = balBefore + payment.amountBdt

      await tx
        .update(user)
        .set({
          balance: sql`${user.balance} + ${payment.amountBdt}`,
          updatedAt: new Date(),
        })
        .where(eq(user.id, payment.userId))

      await tx.insert(walletTransactions).values({
        id: randomUUID(),
        userId: payment.userId,
        type: "deposit",
        amountBdt: payment.amountBdt,
        balanceBefore: balBefore,
        balanceAfter: balAfter,
        description: `Wallet Deposit via ${verified.paymentMethod || "Online Payment"}`,
        referenceId: invoiceId,
        status: "completed",
      })
    })

    if (!depositConfirmed) {
      return { status: "already-confirmed" }
    }

    try {
      await notifyUser(
        payment.userId,
        "payment",
        "Wallet Funds Added!",
        `৳${payment.amountBdt} has been added to your wallet balance. You can now use your balance to register for scrims instantly.`,
        "/dashboard/wallet"
      )
    } catch {}

    const { revalidatePath } = await import("next/cache")
    try {
      revalidatePath("/dashboard")
      revalidatePath("/dashboard/wallet")
    } catch {}

    return { status: "confirmed" }
  }

  const { getBangladeshActiveDate } = await import("@/lib/queries/scrims")
  const { revalidatePath } = await import("next/cache")
  const scrim = await resolveOrEnsureScrim(payment.scrimId)
  const targetScrimDate = scrim?.scrimDate || getBangladeshActiveDate()

  let slotNumber = 1
  let confirmedNow = false
  let refundedToWalletReason: string | null = null

  // Atomic database transaction to prevent slot assignment race conditions, overbooking, and duplicate squads
  await db.transaction(async (tx) => {
    // 1. Idempotently update payment status
    const updated = await tx
      .update(payments)
      .set({
        status: "completed",
        invoiceId,
        transactionId: trxId,
        method: verified.paymentMethod ?? null,
        senderNumber: verified.senderNumber ?? null,
        rawPayload: verified.raw,
        updatedAt: new Date(),
      })
      .where(and(eq(payments.id, paymentId), sql`${payments.status} != 'completed'`))
      .returning({ id: payments.id })

    if (updated.length === 0) {
      return
    }

    // Lock user row first, then scrim row so concurrent gateway callbacks serialize cleanly without deadlocks
    await tx.execute(sql`SELECT "id" FROM "user" WHERE "id" = ${payment.userId} FOR UPDATE`)
    if (scrim?.id) {
      await tx.execute(sql`SELECT "id" FROM "scrims" WHERE "id" = ${scrim.id} FOR UPDATE`)
    }

    // 2. Load pending booking details to validate duplicates & capacity
    const pendingBookingRows = await tx
      .select({
        id: bookings.id,
        teamName: bookings.teamName,
        captainUid: bookings.captainUid,
        userId: bookings.userId,
      })
      .from(bookings)
      .where(eq(bookings.id, payment.bookingId))
      .limit(1)

    const pendingBooking = pendingBookingRows[0]
    const normTeam = pendingBooking?.teamName?.trim().toLowerCase() ?? ""
    const normUid = pendingBooking?.captainUid?.trim() ?? ""
    const maxCap = scrim?.maxTeams ?? 12
    const canonicalScrimId = scrim?.id || payment.scrimId
    const canonicalScrimSlug = scrim?.slug || payment.scrimId

    const [dupRows, confirmedSlotRows] = await Promise.all([
      pendingBooking
        ? tx
            .select({ id: bookings.id })
            .from(bookings)
            .where(
              and(
                or(eq(bookings.scrimId, canonicalScrimId), eq(bookings.scrimId, canonicalScrimSlug)),
                eq(bookings.scrimDate, targetScrimDate),
                eq(bookings.status, "confirmed"),
                eq(bookings.isTrashed, false),
                eq(bookings.isArchived, false),
                sql`${bookings.id} != ${payment.bookingId}`,
                or(
                  eq(bookings.userId, payment.userId),
                  sql`LOWER(TRIM(${bookings.teamName})) = ${normTeam}`,
                  sql`TRIM(${bookings.captainUid}) = ${normUid}`
                )
              )
            )
            .limit(1)
        : Promise.resolve([]),
      tx
        .select({ slotNumber: bookings.slotNumber })
        .from(bookings)
        .where(
          and(
            or(eq(bookings.scrimId, canonicalScrimId), eq(bookings.scrimId, canonicalScrimSlug)),
            eq(bookings.scrimDate, targetScrimDate),
            eq(bookings.status, "confirmed"),
            eq(bookings.isTrashed, false),
            eq(bookings.isArchived, false)
          )
        ),
    ])

    async function refundToWalletInTx(reason: string) {
      refundedToWalletReason = reason
      const userRow = await tx
        .select({ balance: user.balance })
        .from(user)
        .where(eq(user.id, payment.userId))
        .limit(1)
      const balBefore = userRow[0]?.balance ?? 0
      const balAfter = balBefore + payment.amountBdt

      await tx
        .update(user)
        .set({
          balance: sql`${user.balance} + ${payment.amountBdt}`,
          updatedAt: new Date(),
        })
        .where(eq(user.id, payment.userId))

      await tx.insert(walletTransactions).values({
        id: randomUUID(),
        userId: payment.userId,
        type: "refund",
        amountBdt: payment.amountBdt,
        balanceBefore: balBefore,
        balanceAfter: balAfter,
        description: reason,
        referenceId: invoiceId,
        status: "completed",
      })

      await tx
        .update(bookings)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(bookings.id, payment.bookingId))
    }

    const currentConfirmedCount = confirmedSlotRows.length
    if (dupRows.length > 0 || currentConfirmedCount >= maxCap) {
      await refundToWalletInTx(
        dupRows.length > 0
          ? "Duplicate squad registration detected after payment — refunded to your Ace Scrims wallet."
          : "Lobby filled up before payment completed — amount refunded automatically to your Ace Scrims wallet."
      )
      return
    }

    slotNumber = pickLowestFreeSlot(confirmedSlotRows.map((r) => r.slotNumber))

    // 3. Confirm the booking record under a SAVEPOINT so SQL 23505 triggers automatic wallet refund cleanly
    await tx.execute(sql`SAVEPOINT confirm_booking_sp`)
    try {
      await tx
        .update(bookings)
        .set({
          scrimId: canonicalScrimId,
          status: "confirmed",
          slotNumber,
          scrimDate: targetScrimDate,
          transactionId: trxId,
          invoiceId,
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, payment.bookingId))
      await tx.execute(sql`RELEASE SAVEPOINT confirm_booking_sp`)
    } catch (confirmErr) {
      if (isUniqueViolationError(confirmErr)) {
        await tx.execute(sql`ROLLBACK TO SAVEPOINT confirm_booking_sp`)
        await refundToWalletInTx(
          "Duplicate squad registration or slot conflict detected after payment — refunded to your Ace Scrims wallet."
        )
        return
      }
      throw confirmErr
    }

    confirmedNow = true

    // 4. Auto-close registration and turn off Iceberg Safety Override if lobby reached maxTeams for today
    if (scrim && currentConfirmedCount + 1 >= scrim.maxTeams) {
      await tx
        .update(scrims)
        .set({
          registrationOpen: false,
          icebergEnabled: false,
          icebergShowAllFilled: false,
          updatedAt: new Date(),
        })
        .where(or(eq(scrims.id, scrim.id), eq(scrims.slug, scrim.slug)))
    }
  })

  if (refundedToWalletReason) {
    try {
      await notifyUser(
        payment.userId,
        "payment",
        "Booking Refunded to Wallet",
        refundedToWalletReason,
        "/dashboard/wallet"
      )
      revalidatePath("/dashboard/wallet")
      revalidatePath("/dashboard/scrims")
    } catch {}
    return { status: "failed", reason: refundedToWalletReason }
  }

  if (!confirmedNow) {
    return { status: "already-confirmed" }
  }

  // Notify user in-app (non-blocking)
  try {
    await notifyUser(
      payment.userId,
      "payment",
      "Payment successful",
      scrim
        ? `Your slot #${slotNumber} for "${scrim.title}" (${scrim.startTime}) is confirmed. Room details will appear in your dashboard before the match.`
        : "Your scrim booking is confirmed.",
      "/dashboard/scrims",
    )
  } catch (notifyErr) {
    console.warn("[Payment Processor] notifyUser error:", notifyErr)
  }

  // Send Booking Confirmation Transactional Email (awaited inside try/catch for serverless reliability)
  try {
    const [bookingDetails, userDetails] = await Promise.all([
      db.select({ teamName: bookings.teamName, captainName: bookings.captainName }).from(bookings).where(eq(bookings.id, payment.bookingId)).limit(1),
      db.select({ email: user.email, name: user.name }).from(user).where(eq(user.id, payment.userId)).limit(1),
    ])

    const targetEmail = userDetails[0]?.email
    if (targetEmail && scrim) {
      const emailSent = await sendBookingConfirmationEmail({
        to: targetEmail,
        recipientName: userDetails[0]?.name || bookingDetails[0]?.captainName || "Player",
        teamName: bookingDetails[0]?.teamName || "Your Squad",
        scrimTitle: scrim.title,
        startTime: scrim.startTime,
        slotNumber,
        amountBdt: payment.amountBdt,
      })
      if (!emailSent) {
        console.warn(`[Payment Processor] Booking confirmation email returned false for ${targetEmail}`)
      }
    }
  } catch (emailQueryErr) {
    console.warn("[Payment Processor] Failed sending booking confirmation email:", emailQueryErr)
  }

  // Flush cached views so /scrims and homepage immediately show fresh slot state
  try {
    revalidatePath("/scrims")
    if (scrim?.slug) revalidatePath(`/scrims/${scrim.slug}`)
    revalidatePath("/")
    revalidatePath("/dashboard/scrims")
    revalidatePath("/dashboard/wallet")
    revalidatePath("/admin/scrims")
    revalidatePath("/admin")
    revalidatePath("/admin/payments")
  } catch {}

  return { status: "confirmed" }
}
