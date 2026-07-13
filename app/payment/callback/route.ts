import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { payments } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { processPayment } from "@/lib/payment-processor"

/**
 * The user lands here after paying (redirect_url with return_type=GET).
 * UddoktaPay appends ?invoice_id=... — we re-verify server-side before
 * showing any success state. The pid param scopes to our payment record.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl
  const paymentId = url.searchParams.get("pid")
  const invoiceId = url.searchParams.get("invoice_id")

  if (!paymentId) {
    return NextResponse.redirect(new URL("/payment/failed", url.origin))
  }

  // Ownership / existence check
  const rows = await db
    .select({ id: payments.id, status: payments.status, invoiceId: payments.invoiceId })
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1)
  const payment = rows[0]
  if (!payment) {
    return NextResponse.redirect(new URL("/payment/failed", url.origin))
  }

  const effectiveInvoice = invoiceId ?? payment.invoiceId
  if (!effectiveInvoice) {
    return NextResponse.redirect(new URL(`/payment/pending?pid=${paymentId}`, url.origin))
  }

  const outcome = await processPayment(paymentId, effectiveInvoice)

  switch (outcome.status) {
    case "confirmed":
    case "already-confirmed":
      return NextResponse.redirect(new URL(`/payment/success?pid=${paymentId}`, url.origin))
    case "pending":
      return NextResponse.redirect(new URL(`/payment/pending?pid=${paymentId}`, url.origin))
    default:
      return NextResponse.redirect(new URL(`/payment/failed?pid=${paymentId}`, url.origin))
  }
}
