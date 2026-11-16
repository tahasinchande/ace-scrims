import "server-only"
import { Agent } from "undici"

/**
 * UddoktaPay official API client (Self-hosted on pay.acescrims.online)
 * Docs: https://uddoktapay.readme.io
 *
 * Env:
 * - UDDOKTAPAY_API_KEY          — merchant API key (also used to verify webhooks)
 * - UDDOKTAPAY_BASE_URL         — e.g. https://pay.acescrims.online/api (no trailing slash)
 * - UDDOKTAPAY_PAYMENT_LINK_URL — direct payment link: https://pay.acescrims.online/paymentlink/default/BDT
 */

const API_KEY_HEADER = "RT-UDDOKTAPAY-API-KEY"

// Dispatcher to support self-hosted instances with custom or self-signed TLS certificates
const gatewayDispatcher = new Agent({
  connect: {
    rejectUnauthorized: false,
  },
})

export function getUddoktaPayConfig() {
  const apiKey = (process.env.UDDOKTAPAY_API_KEY || "").trim()
  let baseUrl = (
    process.env.UDDOKTAPAY_BASE_URL ||
    process.env.UDDOKTAPAY_PANEL_URL ||
    "https://pay.acescrims.online/api"
  )?.replace(/\/+$/, "")
  const paymentLinkUrl =
    process.env.UDDOKTAPAY_PAYMENT_LINK_URL ||
    "https://pay.acescrims.online/paymentlink/default/BDT"

  if (!apiKey || !baseUrl) return null
  // Accept both forms: "https://pay.domain.com" and "https://pay.domain.com/api".
  // Endpoints below always append "/api/...", so strip a trailing "/api".
  baseUrl = baseUrl.replace(/\/api$/, "")
  return { apiKey, baseUrl, paymentLinkUrl }
}

function getConfig() {
  return getUddoktaPayConfig()
}

export function isUddoktaPayConfigured(): boolean {
  return getConfig() !== null
}

export function getUddoktaPayPaymentLink(): string {
  const config = getConfig()
  return config?.paymentLinkUrl || "https://pay.acescrims.online/paymentlink/default/BDT"
}

export type CreateChargeInput = {
  fullName: string
  email: string
  amount: number
  metadata: Record<string, string>
  redirectUrl: string
  cancelUrl: string
  webhookUrl: string
}

export type CreateChargeResult =
  | { ok: true; paymentUrl: string }
  | { ok: false; error: string }

export async function createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
  const config = getConfig()
  if (!config) {
    return {
      ok: false,
      error:
        "Payment gateway is not configured. Please set UDDOKTAPAY_API_KEY and UDDOKTAPAY_BASE_URL.",
    }
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, error: "Payment amount must be a positive number." }
  }
  try {
    const res = await fetch(`${config.baseUrl}/api/checkout-v2`, {
      method: "POST",
      headers: {
        [API_KEY_HEADER]: config.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        full_name: input.fullName,
        email: input.email,
        amount: String(input.amount),
        // Without an explicit currency the gateway defaults to USD, where no
        // payment methods are enabled — the Pay button would do nothing.
        currency: "BDT",
        metadata: input.metadata,
        redirect_url: input.redirectUrl,
        cancel_url: input.cancelUrl,
        webhook_url: input.webhookUrl,
        return_type: "GET",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
      // @ts-ignore - undici dispatcher for self-hosted instances
      dispatcher: gatewayDispatcher,
    } as any)
    const data = (await res.json()) as {
      status?: boolean
      message?: string
      payment_url?: string
    }
    if (!res.ok || !data.payment_url) {
      let errorMsg = data.message ?? "Failed to create payment charge."
      return { ok: false, error: errorMsg }
    }
    return { ok: true, paymentUrl: data.payment_url }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `Could not reach the payment gateway (${msg}). Try again.` }
  }
}

export type VerifiedPayment = {
  status: "COMPLETED" | "PENDING" | "ERROR"
  fullName?: string
  email?: string
  amount?: string
  invoiceId?: string
  paymentMethod?: string
  senderNumber?: string
  transactionId?: string
  metadata?: Record<string, string>
  raw: Record<string, unknown>
}

/**
 * Server-to-server verification of an invoice. This is the source of truth —
 * webhook payloads and redirect params are never trusted on their own.
 */
export async function verifyPayment(invoiceId: string): Promise<VerifiedPayment | null> {
  const config = getConfig()
  if (!config) return null
  try {
    const res = await fetch(`${config.baseUrl}/api/verify-payment`, {
      method: "POST",
      headers: {
        [API_KEY_HEADER]: config.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ invoice_id: invoiceId }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
      // @ts-ignore - undici dispatcher for self-hosted instances
      dispatcher: gatewayDispatcher,
    } as any)
    if (!res.ok) return null
    const data = (await res.json()) as Record<string, unknown>
    const status = data.status as string | undefined
    if (status !== "COMPLETED" && status !== "PENDING" && status !== "ERROR") return null
    return {
      status,
      fullName: data.full_name as string | undefined,
      email: data.email as string | undefined,
      amount: data.amount as string | undefined,
      invoiceId: (data.invoice_id || data.invoiceId) as string | undefined,
      paymentMethod: (data.payment_method || data.paymentMethod || data.method) as string | undefined,
      senderNumber: (data.sender_number || data.senderNumber) as string | undefined,
      transactionId: (data.transaction_id || data.trx_id || data.trxid || data.transactionId) as string | undefined,
      metadata: data.metadata as Record<string, string> | undefined,
      raw: data,
    }
  } catch {
    return null
  }
}

/** Constant-time-ish comparison of the webhook API key header. */
export function isValidWebhookKey(headerValue: string | null): boolean {
  const config = getConfig()
  if (!config || !headerValue) return false
  if (headerValue.length !== config.apiKey.length) return false
  let mismatch = 0
  for (let i = 0; i < headerValue.length; i++) {
    mismatch |= headerValue.charCodeAt(i) ^ config.apiKey.charCodeAt(i)
  }
  return mismatch === 0
}

export type RefundPaymentParams = {
  invoiceId?: string | null
  transactionId?: string | null
  paymentId?: string | null
  paymentMethod?: string | null
  amount?: number | null
  productName?: string | null
  reason?: string | null
}

export async function refundPayment(
  paramsOrInvoiceId: string | RefundPaymentParams,
  amountArg?: number
): Promise<{ ok: boolean; message: string; refundRef?: string; raw?: unknown }> {
  const config = getConfig()
  if (!config) return { ok: false, message: "Payment gateway is not configured." }

  const params: RefundPaymentParams =
    typeof paramsOrInvoiceId === "string"
      ? { invoiceId: paramsOrInvoiceId, amount: amountArg }
      : paramsOrInvoiceId

  let trxId = params.transactionId?.trim() || null
  const invId = params.invoiceId?.trim() || null
  const pymId = params.paymentId?.trim() || null
  const amt = Number(params.amount ?? amountArg ?? 35)
  if (!Number.isFinite(amt) || amt <= 0) {
    return { ok: false, message: "Refund amount must be a valid positive number." }
  }
  let method = params.paymentMethod?.trim() || null
  const productName = params.productName?.trim() || "Scrim Match Entry Fee"
  const reason = params.reason?.trim() || "Match Not Hosted / Cancelled"

  // Automatically retrieve transactionId from the database if not provided
  if (!trxId && (invId || pymId)) {
    try {
      const { db } = await import("@/lib/db")
      const { payments, bookings, notHostedTeams } = await import("@/lib/db/schema")
      const { eq } = await import("drizzle-orm")

      if (invId) {
        const pRows = await db
          .select({ transactionId: payments.transactionId })
          .from(payments)
          .where(eq(payments.invoiceId, invId))
          .limit(1)
        if (pRows[0]?.transactionId) {
          trxId = pRows[0].transactionId
        } else {
          const nhRows = await db
            .select({ transactionId: notHostedTeams.transactionId })
            .from(notHostedTeams)
            .where(eq(notHostedTeams.invoiceId, invId))
            .limit(1)
          if (nhRows[0]?.transactionId) {
            trxId = nhRows[0].transactionId
          } else {
            const bRows = await db
              .select({ transactionId: bookings.transactionId })
              .from(bookings)
              .where(eq(bookings.invoiceId, invId))
              .limit(1)
            if (bRows[0]?.transactionId) {
              trxId = bRows[0].transactionId
            }
          }
        }
      }

      if (!trxId && pymId) {
        const pRows = await db
          .select({ transactionId: payments.transactionId })
          .from(payments)
          .where(eq(payments.id, pymId))
          .limit(1)
        if (pRows[0]?.transactionId) {
          trxId = pRows[0].transactionId
        }
      }
    } catch (err) {
      console.warn("[UddoktaPay] Automatic transactionId retrieval error:", err)
    }
  }

  // Automatically retrieve transactionId and paymentMethod from gateway verification if not provided
  if (!trxId && invId) {
    try {
      const verified = await verifyPayment(invId)
      if (verified) {
        if (verified.transactionId) trxId = verified.transactionId
        if (!method && verified.paymentMethod) method = verified.paymentMethod
      }
    } catch (verErr) {
      console.warn("[UddoktaPay] Automatic verification during refund failed:", verErr)
    }
  }

  const payload: Record<string, any> = {
    amount: String(amt),
    product_name: productName,
    reason,
    payment_method: (method || "bkash").toLowerCase(),
  }

  // UddoktaPay refund requires transaction_id/trx_id and/or invoice_id
  if (trxId) {
    payload.transaction_id = trxId
    payload.trx_id = trxId
  }
  if (invId) {
    payload.invoice_id = invId
    if (!trxId) {
      payload.transaction_id = invId
      payload.trx_id = invId
    }
  }
  if (pymId) {
    payload.payment_id = pymId
  }

  try {
    let baseUrl = config.baseUrl.replace(/\/+$/, "")
    if (baseUrl.endsWith("/api")) {
      baseUrl = baseUrl.replace(/\/api$/, "")
    }
    const endpoint = `${baseUrl}/api/refund-payment`

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        [API_KEY_HEADER]: config.apiKey.trim(),
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
      // @ts-ignore - undici dispatcher for self-hosted instances
      dispatcher: gatewayDispatcher,
    } as any)

    const contentType = res.headers.get("content-type") || ""
    let data: any = {}
    if (contentType.includes("application/json")) {
      data = await res.json()
    } else {
      const text = await res.text()
      try {
        data = JSON.parse(text)
      } catch {
        data = { message: text }
      }
    }

    const isSuccess =
      res.ok &&
      data &&
      data.status !== false &&
      data.status !== "ERROR" &&
      !data.error

    if (!isSuccess) {
      const errMsg =
        data?.message ||
        data?.error ||
        (data?.errors
          ? typeof data.errors === "object"
            ? Object.values(data.errors).flat().join(", ")
            : String(data.errors)
          : null) ||
        `Payment gateway refund API returned status ${res.status}.`
      return {
        ok: false,
        message: String(errMsg).trim(),
        raw: data,
      }
    }

    const refundRef =
      data?.refund_ref ||
      data?.refund_id ||
      data?.transaction_id ||
      data?.trx_id ||
      `RFD-${Date.now().toString().slice(-6)}`

    return {
      ok: true,
      message: data?.message || "Refund processed successfully.",
      refundRef,
      raw: data,
    }
  } catch (err) {
    console.error("[Payment Gateway Refund Exception]:", err)
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : "Could not reach payment gateway refund endpoint. Please check connection.",
    }
  }
}

export { API_KEY_HEADER }
