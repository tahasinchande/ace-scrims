import { type NextRequest, NextResponse } from "next/server"
import { isValidWebhookKey, API_KEY_HEADER } from "@/lib/uddoktapay"
import { processPayment } from "@/lib/payment-processor"

/**
 * UddoktaPay webhook. Security layers:
 * 1. The RT-UDDOKTAPAY-API-KEY header must equal our API key (constant-time compare).
 * 2. The invoice is ALWAYS re-verified server-to-server via /api/verify-payment —
 *    the webhook body itself is never trusted for payment state.
 * 3. processPayment is idempotent, so replayed webhooks cannot double-confirm.
 */
export async function POST(req: NextRequest) {
  try {
    if (!isValidWebhookKey(req.headers.get(API_KEY_HEADER))) {
      return NextResponse.json({ error: "Unauthorized: Invalid webhook signature", statusCode: 401 }, { status: 401 })
    }

    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload", statusCode: 400 }, { status: 400 })
    }

    const invoiceId = (body.invoice_id || body.invoiceId) as string | undefined
    const metadata = body.metadata as Record<string, string> | undefined
    const paymentId = metadata?.payment_id || (body.payment_id as string | undefined)
    const webhookTrxId =
      (body.transaction_id ||
        body.trx_id ||
        body.trxid ||
        body.transactionId) as string | undefined

    if (!invoiceId || !paymentId) {
      return NextResponse.json({ error: "Missing invoice_id or payment_id in metadata", statusCode: 400 }, { status: 400 })
    }

    const outcome = await processPayment(paymentId, invoiceId, webhookTrxId)
    return NextResponse.json({ ok: true, outcome: outcome.status, statusCode: 200 })
  } catch (err: any) {
    console.error("[Webhook Error]:", err)
    return NextResponse.json({ error: err?.message || "Internal server error", statusCode: 500 }, { status: 500 })
  }
}
