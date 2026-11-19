import { type NextRequest, NextResponse } from "next/server"
import { db, ensureSchemaReady } from "@/lib/db"
import { payments } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { processPayment } from "@/lib/payment-processor"

/**
 * Shared callback handler for both GET (redirect_url return_type=GET) and POST redirects.
 * UddoktaPay passes invoice_id & optional transaction params — we always re-verify server-side.
 */
async function handleCallback(
  req: NextRequest,
  extraParams: Record<string, string | null> = {},
) {
  const url = req.nextUrl
  const fallbackOrigin = url.origin
  let isWallet =
    url.searchParams.get("type") === "wallet" || extraParams.type === "wallet"

  try {
    await ensureSchemaReady()

    const paymentId = url.searchParams.get("pid") || extraParams.pid
    const invoiceId = url.searchParams.get("invoice_id") || url.searchParams.get("invoiceId") || extraParams.invoice_id
    const callbackStatus = (url.searchParams.get("status") || extraParams.status || "").trim().toLowerCase()

    if (!paymentId) {
      return NextResponse.redirect(
        new URL(
          isWallet ? "/dashboard/wallet?status=failed" : "/payment/result?status=failed",
          fallbackOrigin,
        ),
      )
    }

    if (callbackStatus === "cancelled" || callbackStatus === "canceled") {
      return NextResponse.redirect(
        new URL(
          isWallet ? "/dashboard/wallet?status=cancelled" : "/payment/result?status=cancelled",
          fallbackOrigin,
        ),
      )
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
      return NextResponse.redirect(
        new URL(
          isWallet ? "/dashboard/wallet?status=failed" : "/payment/result?status=failed",
          fallbackOrigin,
        ),
      )
    }

    isWallet =
      isWallet ||
      payment.bookingId === "wallet_deposit" ||
      payment.scrimId === "wallet_deposit"

    const effectiveInvoice = invoiceId ?? payment.invoiceId
    if (!effectiveInvoice) {
      return NextResponse.redirect(
        new URL(
          isWallet ? "/dashboard/wallet?status=pending" : "/payment/result?status=pending",
          fallbackOrigin,
        ),
      )
    }

    const callbackTrxId =
      url.searchParams.get("transaction_id") ||
      url.searchParams.get("trx_id") ||
      url.searchParams.get("trxid") ||
      extraParams.transaction_id ||
      extraParams.trx_id ||
      extraParams.trxid ||
      null

    const outcome = await processPayment(paymentId, effectiveInvoice, callbackTrxId)

    switch (outcome.status) {
      case "confirmed":
      case "already-confirmed":
        return NextResponse.redirect(
          new URL(
            isWallet ? "/dashboard/wallet?status=success" : "/payment/result?status=success",
            fallbackOrigin,
          ),
        )
      case "pending":
        return NextResponse.redirect(
          new URL(
            isWallet ? "/dashboard/wallet?status=pending" : "/payment/result?status=pending",
            fallbackOrigin,
          ),
        )
      default:
        return NextResponse.redirect(
          new URL(
            isWallet ? "/dashboard/wallet?status=failed" : "/payment/result?status=failed",
            fallbackOrigin,
          ),
        )
    }
  } catch (err) {
    console.error("[Payment Callback] Unexpected error:", err)
    return NextResponse.redirect(
      new URL(
        isWallet ? "/dashboard/wallet?status=pending" : "/payment/result?status=pending",
        fallbackOrigin,
      ),
    )
  }
}

export async function GET(req: NextRequest) {
  return handleCallback(req)
}

export async function POST(req: NextRequest) {
  const extra: Record<string, string | null> = {}
  try {
    const contentType = req.headers.get("content-type") || ""
    if (contentType.includes("application/json")) {
      const json = (await req.json()) as Record<string, unknown>
      for (const key of ["pid", "invoice_id", "invoiceId", "transaction_id", "trx_id", "trxid", "type", "status"]) {
        if (typeof json[key] === "string") {
          extra[key === "invoiceId" ? "invoice_id" : key] = json[key] as string
        }
      }
    } else {
      const form = await req.formData()
      for (const key of ["pid", "invoice_id", "invoiceId", "transaction_id", "trx_id", "trxid", "type", "status"]) {
        const val = form.get(key)
        if (typeof val === "string") {
          extra[key === "invoiceId" ? "invoice_id" : key] = val
        }
      }
    }
  } catch {
    // Fallback to query params only
  }
  return handleCallback(req, extra)
}
