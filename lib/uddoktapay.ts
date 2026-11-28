import "server-only"
import { Agent, fetch as undiciFetch } from "undici"

/**
 * UddoktaPay / Paymently official API client
 *
 * Env:
 * - UDDOKTAPAY_API_KEY          — merchant API key (also used to verify webhooks)
 * - UDDOKTAPAY_BASE_URL         — e.g. https://pay.rushxorg.online/api (no trailing slash)
 * - UDDOKTAPAY_PAYMENT_LINK_URL — direct payment link fallback
 */

const API_KEY_HEADER = "RT-UDDOKTAPAY-API-KEY"
const GATEWAY_TIMEOUT_MS = 15000

// Dispatcher for undiciFetch fallback ONLY if the host uses a self-signed/custom TLS certificate.
// Never pass this dispatcher to Node's global fetch(), which uses its own internal undici version
// and throws UND_ERR_INVALID_ARG ("invalid onRequestStart method") with npm undici Agents.
const gatewayDispatcher = new Agent({
  connect: {
    rejectUnauthorized: false,
  },
})

function isTlsError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false
  const e = err as { code?: string; message?: string; cause?: { code?: string; message?: string } }
  const code = String(e.code || e.cause?.code || "").toUpperCase()
  const msg = String(e.message || e.cause?.message || "").toUpperCase()
  return (
    code.includes("CERT") ||
    code.includes("TLS") ||
    code.includes("SELF_SIGNED") ||
    msg.includes("CERTIFICATE") ||
    msg.includes("SELF_SIGNED") ||
    msg.includes("TLS")
  )
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function gatewayFetch(url: string, init: RequestInit): Promise<Response> {
  let lastError: unknown

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        ...init,
        cache: "no-store",
        signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
      })

      if (res.status >= 500 && attempt === 0) {
        await sleep(450)
        continue
      }
      return res
    } catch (err) {
      lastError = err
      if (isTlsError(err)) {
        // Fallback strictly using undiciFetch paired with its matching undici Agent
        const res = await undiciFetch(url, {
          method: init.method || "GET",
          headers: init.headers as Record<string, string>,
          body: init.body as string | undefined,
          signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
          dispatcher: gatewayDispatcher,
        })
        return res as unknown as Response
      }

      if (attempt === 0) {
        await sleep(450)
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError || "Gateway request failed"))
}

async function safeParseJson(res: Response): Promise<Record<string, unknown>> {
  const rawText = await res.text().catch(() => "")
  if (!rawText.trim()) return {}
  try {
    const parsed = JSON.parse(rawText)
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : { rawText }
  } catch {
    return { message: rawText.slice(0, 240) }
  }
}

export function getUddoktaPayConfig() {
  const apiKey = (process.env.UDDOKTAPAY_API_KEY || "").trim()
  let baseUrl = (
    process.env.UDDOKTAPAY_BASE_URL ||
    process.env.UDDOKTAPAY_PANEL_URL ||
    "https://pay.rushxorg.online/api"
  )
    ?.trim()
    .replace(/\/+$/, "")
  const paymentLinkUrl =
    (process.env.UDDOKTAPAY_PAYMENT_LINK_URL ||
      "https://pay.rushxorg.online/paymentlink/default/BDT").trim()

  if (!apiKey || !baseUrl) return null
  baseUrl = baseUrl.replace(/\/api$/i, "")
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
  return config?.paymentLinkUrl || "https://pay.rushxorg.online/paymentlink/default/BDT"
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
      error: "Payment gateway is currently unavailable. Please contact support or try again shortly.",
    }
  }
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, error: "Payment amount must be a positive number." }
  }

  const safeFullName = (input.fullName || "RushX Organization Player").trim().slice(0, 80) || "RushX Organization Player"
  const safeEmail = (input.email || "").trim()
  if (!safeEmail || !safeEmail.includes("@")) {
    return { ok: false, error: "A valid account email address is required for checkout." }
  }

  try {
    const res = await gatewayFetch(`${config.baseUrl}/api/checkout-v2`, {
      method: "POST",
      headers: {
        [API_KEY_HEADER]: config.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        full_name: safeFullName,
        email: safeEmail,
        amount: String(Math.round(input.amount)),
        // Explicit BDT currency ensures bKash / Nagad / Rocket / Tap channels load on checkout
        currency: "BDT",
        metadata: input.metadata,
        redirect_url: input.redirectUrl,
        cancel_url: input.cancelUrl,
        webhook_url: input.webhookUrl,
        return_type: "GET",
      }),
    })

    const data = await safeParseJson(res)
    const rawUrl = (data.payment_url || data.url) as string | undefined
    const paymentUrl = typeof rawUrl === "string" ? rawUrl.trim() : ""

    if (!res.ok || !paymentUrl || !/^https?:\/\//i.test(paymentUrl)) {
      const gatewayMsg =
        typeof data.message === "string" && data.message.trim()
          ? data.message.trim()
          : typeof data.error === "string" && data.error.trim()
            ? data.error.trim()
            : `Gateway responded with status ${res.status}.`
      console.warn("[UddoktaPay] createCharge rejected:", {
        status: res.status,
        message: gatewayMsg,
      })
      return {
        ok: false,
        error: `Payment gateway could not initialize checkout (${gatewayMsg}). Please try again or use wallet balance.`,
      }
    }

    return { ok: true, paymentUrl }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[UddoktaPay] createCharge network failure:", msg)
    return {
      ok: false,
      error: "Unable to connect to the payment gateway right now (connection timeout or network error). Please try again in a few seconds.",
    }
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
 * Server-to-server verification of an invoice.
 * Returns null only when the gateway cannot be reached or experiences a 5xx error,
 * allowing callers to keep the payment pending rather than prematurely marking it failed.
 */
export async function verifyPayment(invoiceId: string): Promise<VerifiedPayment | null> {
  const config = getConfig()
  const cleanInvoiceId = (invoiceId || "").trim()
  if (!config || !cleanInvoiceId) return null

  try {
    const res = await gatewayFetch(`${config.baseUrl}/api/verify-payment`, {
      method: "POST",
      headers: {
        [API_KEY_HEADER]: config.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ invoice_id: cleanInvoiceId }),
    })

    const data = await safeParseJson(res)
    if (res.status >= 500) {
      return null
    }

    if (res.status === 400 || res.status === 404 || data.status === false) {
      return { status: "ERROR", raw: data }
    }

    if (!res.ok) return null

    const rawStatus = String(data.status || "").trim().toUpperCase()
    const normalizedStatus: "COMPLETED" | "PENDING" | "ERROR" | null =
      rawStatus === "COMPLETED"
        ? "COMPLETED"
        : rawStatus === "PENDING"
          ? "PENDING"
          : rawStatus === "ERROR" || rawStatus === "FAILED" || rawStatus === "CANCELLED"
            ? "ERROR"
            : null

    if (!normalizedStatus) return null

    return {
      status: normalizedStatus,
      fullName: data.full_name as string | undefined,
      email: data.email as string | undefined,
      amount: data.amount !== undefined && data.amount !== null ? String(data.amount) : undefined,
      invoiceId: (data.invoice_id || data.invoiceId) as string | undefined,
      paymentMethod: (data.payment_method || data.paymentMethod || data.method) as string | undefined,
      senderNumber: (data.sender_number || data.senderNumber) as string | undefined,
      transactionId: (data.transaction_id || data.trx_id || data.trxid || data.transactionId) as string | undefined,
      metadata: data.metadata as Record<string, string> | undefined,
      raw: data,
    }
  } catch (err) {
    console.warn("[UddoktaPay] verifyPayment connection error:", err instanceof Error ? err.message : err)
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
    const endpoint = `${config.baseUrl}/api/refund-payment`
    const res = await gatewayFetch(endpoint, {
      method: "POST",
      headers: {
        [API_KEY_HEADER]: config.apiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    })

    const data = await safeParseJson(res)
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
      (data?.refund_ref as string | undefined) ||
      (data?.refund_id as string | undefined) ||
      (data?.transaction_id as string | undefined) ||
      (data?.trx_id as string | undefined) ||
      `RFD-${Date.now().toString().slice(-6)}`

    return {
      ok: true,
      message: String(data?.message || "Refund processed successfully."),
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
