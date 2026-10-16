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
    return NextResponse.redirect(new URL("/payment/result?status=failed", url.origin))
  }

  // Ownership / existence check
  const rows = await db
    .select({
      id: payments.id,
      status: payments.status,
      invoiceId: payments.invoiceId,
      bookingId: payments.bookingId,
      scrimId: payments.scrimId,
    })
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1)
  const payment = rows[0]
  if (!payment) {
    return NextResponse.redirect(new URL("/payment/result?status=failed", url.origin))
  }

  const effectiveInvoice = invoiceId ?? payment.invoiceId
  if (!effectiveInvoice) {
    return NextResponse.redirect(new URL("/payment/result?status=pending", url.origin))
  }

  const callbackTrxId =
    url.searchParams.get("transaction_id") ||
    url.searchParams.get("trx_id") ||
    url.searchParams.get("trxid")

  const outcome = await processPayment(paymentId, effectiveInvoice, callbackTrxId)

  const isWallet =
    url.searchParams.get("type") === "wallet" ||
    payment.bookingId === "wallet_deposit" ||
    payment.scrimId === "wallet_deposit"

  switch (outcome.status) {
    case "confirmed":
    case "already-confirmed":
      if (isWallet) {
        return NextResponse.redirect(new URL("/dashboard/wallet?status=success", url.origin))
      }
      return NextResponse.redirect(new URL("/payment/result?status=success", url.origin))
    case "pending":
      if (isWallet) {
        return NextResponse.redirect(new URL("/dashboard/wallet?status=pending", url.origin))
      }
      return NextResponse.redirect(new URL("/payment/result?status=pending", url.origin))
    default:
      if (isWallet) {
        return NextResponse.redirect(new URL("/dashboard/wallet?status=failed", url.origin))
      }
      return NextResponse.redirect(new URL("/payment/result?status=failed", url.origin))
  }
}
