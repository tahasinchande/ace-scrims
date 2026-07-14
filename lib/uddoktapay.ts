import "server-only"

/**
 * UddoktaPay official API client.
 * Docs: https://uddoktapay.readme.io
 *
 * Env:
 * - UDDOKTAPAY_API_KEY   — merchant API key (also used to verify webhooks)
 * - UDDOKTAPAY_BASE_URL  — e.g. https://pay.yourdomain.com (no trailing slash)
 */

const API_KEY_HEADER = "RT-UDDOKTAPAY-API-KEY"

function getConfig() {
  const apiKey = process.env.UDDOKTAPAY_API_KEY
  let baseUrl = process.env.UDDOKTAPAY_BASE_URL?.replace(/\/+$/, "")
  if (!apiKey || !baseUrl) return null
  // Accept both forms: "https://pay.domain.com" and "https://pay.domain.com/api".
  // Endpoints below always append "/api/...", so strip a trailing "/api".
  baseUrl = baseUrl.replace(/\/api$/, "")
  return { apiKey, baseUrl }
}

export function isUddoktaPayConfigured(): boolean {
  return getConfig() !== null
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
    })
    const data = (await res.json()) as {
      status?: boolean
      message?: string
      payment_url?: string
    }
    if (!res.ok || !data.payment_url) {
      return { ok: false, error: data.message ?? "Failed to create payment charge." }
    }
    return { ok: true, paymentUrl: data.payment_url }
  } catch {
    return { ok: false, error: "Could not reach the payment gateway. Try again." }
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
    })
    if (!res.ok) return null
    const data = (await res.json()) as Record<string, unknown>
    const status = data.status as string | undefined
    if (status !== "COMPLETED" && status !== "PENDING" && status !== "ERROR") return null
    return {
      status,
      fullName: data.full_name as string | undefined,
      email: data.email as string | undefined,
      amount: data.amount as string | undefined,
      invoiceId: data.invoice_id as string | undefined,
      paymentMethod: data.payment_method as string | undefined,
      senderNumber: data.sender_number as string | undefined,
      transactionId: data.transaction_id as string | undefined,
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

export { API_KEY_HEADER }
