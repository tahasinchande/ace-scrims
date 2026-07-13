import "server-only"

import { db } from "@/lib/db"
import { bookings, payments, scrims } from "@/lib/db/schema"
import { and, eq, sql } from "drizzle-orm"
import { verifyPayment } from "@/lib/uddoktapay"
import { notifyUser } from "@/lib/notify"

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

  // Idempotent completion — only the first caller flips pending -> completed
  const updated = await db
    .update(payments)
    .set({
      status: "completed",
      invoiceId,
      transactionId: verified.transactionId ?? null,
      method: verified.paymentMethod ?? null,
      senderNumber: verified.senderNumber ?? null,
      rawPayload: verified.raw,
      updatedAt: new Date(),
    })
    .where(and(eq(payments.id, paymentId), sql`${payments.status} != 'completed'`))
    .returning({ id: payments.id })
  if (updated.length === 0) return { status: "already-confirmed" }

  // Assign the next slot number and confirm the booking
  const slotRows = await db
    .select({
      next: sql<number>`COALESCE(MAX(${bookings.slotNumber}), 0)::int + 1`,
    })
    .from(bookings)
    .where(and(eq(bookings.scrimId, payment.scrimId), eq(bookings.status, "confirmed")))
  const slotNumber = slotRows[0]?.next ?? 1

  await db
    .update(bookings)
    .set({ status: "confirmed", slotNumber, updatedAt: new Date() })
    .where(eq(bookings.id, payment.bookingId))

  const scrimRows = await db
    .select({ title: scrims.title, startTime: scrims.startTime, maxTeams: scrims.maxTeams })
    .from(scrims)
    .where(eq(scrims.id, payment.scrimId))
    .limit(1)
  const scrim = scrimRows[0]

  await notifyUser(
    payment.userId,
    "payment",
    "Payment successful",
    scrim
      ? `Your slot #${slotNumber} for "${scrim.title}" (${scrim.startTime}) is confirmed. Room details will appear in your dashboard before the match.`
      : "Your scrim booking is confirmed.",
    "/dashboard/scrims",
  )

  // Auto-close registration when the lobby fills up
  if (scrim) {
    const countRows = await db
      .select({ confirmed: sql<number>`COUNT(*)::int` })
      .from(bookings)
      .where(and(eq(bookings.scrimId, payment.scrimId), eq(bookings.status, "confirmed")))
    if ((countRows[0]?.confirmed ?? 0) >= scrim.maxTeams) {
      await db
        .update(scrims)
        .set({ registrationOpen: false, updatedAt: new Date() })
        .where(eq(scrims.id, payment.scrimId))
    }
  }

  return { status: "confirmed" }
}
