import "server-only"

import { randomUUID } from "crypto"
import { db } from "@/lib/db"
import { bookings, payments, scrims, user, walletTransactions } from "@/lib/db/schema"
import { and, eq, or, sql } from "drizzle-orm"
import { verifyPayment } from "@/lib/uddoktapay"
import { notifyUser } from "@/lib/notify"
import { sendBookingConfirmationEmail } from "@/lib/email"
import { resolveOrEnsureScrim } from "@/lib/queries/scrims"

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
  if (!verified) return { status: "failed", reason: "Gateway verification failed" }

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

  // Atomic database transaction to prevent slot assignment race conditions
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

    confirmedNow = true

    // 2. Assign the next slot number for THIS TARGET SCRIM DATE atomically
    const slotRows = await tx
      .select({
        next: sql<number>`COALESCE(MAX(${bookings.slotNumber}), 0)::int + 1`,
      })
      .from(bookings)
      .where(
        and(
          or(
            eq(bookings.scrimId, payment.scrimId),
            eq(bookings.scrimId, scrim?.slug || payment.scrimId)
          ),
          eq(bookings.scrimDate, targetScrimDate),
          eq(bookings.status, "confirmed"),
          eq(bookings.isTrashed, false),
          eq(bookings.isArchived, false)
        )
      )

    slotNumber = slotRows[0]?.next ?? 1

    // 3. Confirm the booking record
    await tx
      .update(bookings)
      .set({
        status: "confirmed",
        slotNumber,
        scrimDate: targetScrimDate,
        transactionId: trxId,
        invoiceId,
        updatedAt: new Date(),
      })
      .where(eq(bookings.id, payment.bookingId))

    // 4. Auto-close registration if lobby reached maxTeams for today
    if (scrim) {
      const countRows = await tx
        .select({ confirmed: sql<number>`COUNT(*)::int` })
        .from(bookings)
        .where(
          and(
            or(
              eq(bookings.scrimId, payment.scrimId),
              eq(bookings.scrimId, scrim.slug)
            ),
            eq(bookings.scrimDate, targetScrimDate),
            eq(bookings.status, "confirmed"),
            eq(bookings.isTrashed, false),
            eq(bookings.isArchived, false)
          )
        )

      if ((countRows[0]?.confirmed ?? 0) >= scrim.maxTeams) {
        await tx
          .update(scrims)
          .set({ registrationOpen: false, updatedAt: new Date() })
          .where(or(eq(scrims.id, payment.scrimId), eq(scrims.slug, payment.scrimId)))
      }
    }
  })

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

  // Send Booking Confirmation Transactional Email (resilient try/catch)
  try {
    const [bookingDetails, userDetails] = await Promise.all([
      db.select({ teamName: bookings.teamName, captainName: bookings.captainName }).from(bookings).where(eq(bookings.id, payment.bookingId)).limit(1),
      db.select({ email: user.email, name: user.name }).from(user).where(eq(user.id, payment.userId)).limit(1),
    ])

    const targetEmail = userDetails[0]?.email
    if (targetEmail && scrim) {
      sendBookingConfirmationEmail({
        to: targetEmail,
        recipientName: userDetails[0]?.name || bookingDetails[0]?.captainName || "Player",
        teamName: bookingDetails[0]?.teamName || "Your Squad",
        scrimTitle: scrim.title,
        startTime: scrim.startTime,
        slotNumber,
        amountBdt: payment.amountBdt,
      }).catch((emailErr) => {
        console.error("[Payment Processor] Failed to send booking confirmation email:", emailErr)
      })
    }
  } catch (emailQueryErr) {
    console.warn("[Payment Processor] Could not fetch details for confirmation email:", emailQueryErr)
  }

  // Flush cached views so /scrims and homepage immediately show fresh slot state
  try {
    revalidatePath("/scrims")
    revalidatePath("/")
    revalidatePath("/dashboard/scrims")
    revalidatePath("/admin/scrims")
  } catch {}

  return { status: "confirmed" }
}
