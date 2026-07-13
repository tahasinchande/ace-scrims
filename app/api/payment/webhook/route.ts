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
  if (!isValidWebhookKey(req.headers.get(API_KEY_HEADER))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const invoiceId = body.invoice_id as string | undefined
  const metadata = body.metadata as Record<string, string> | undefined
  const paymentId = metadata?.payment_id

  if (!invoiceId || !paymentId) {
    return NextResponse.json({ error: "Missing invoice_id or metadata" }, { status: 400 })
  }

  const outcome = await processPayment(paymentId, invoiceId)
  return NextResponse.json({ ok: true, outcome: outcome.status })
}
