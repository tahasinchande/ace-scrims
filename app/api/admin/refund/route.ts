import { NextRequest, NextResponse } from "next/server"
import { getSessionUser, logActivity } from "@/lib/session"
import { isAdminOrOwner } from "@/lib/roles"
import { db } from "@/lib/db"
import { notHostedTeams, bookings, payments } from "@/lib/db/schema"
import { eq, or } from "drizzle-orm"
import {
  getUddoktaPayConfig,
  verifyPayment,
  API_KEY_HEADER,
  refundPayment,
} from "@/lib/uddoktapay"
import { notifyUser } from "@/lib/notify"
import { revalidatePath } from "next/cache"
import { Agent } from "undici"

// Enforce TLS certificate verification by default; only allow override when explicitly opted in via env
const gatewayDispatcher = new Agent({
  connect: {
    rejectUnauthorized: process.env.UDDOKTAPAY_ALLOW_INSECURE_TLS !== "true",
  },
})

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate Admin User (uses live DB-verified session check)
    const user = await getSessionUser()

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized: Valid session token required." },
        { status: 401 }
      )
    }

    if (user.banned || !isAdminOrOwner(user.role)) {
      return NextResponse.json(
        { ok: false, error: "Forbidden: Admin privileges required." },
        { status: 403 }
      )
    }

    // 2. Parse Incoming Payload
    const body = await req.json().catch(() => ({}))
    const notHostedId = body.notHostedId || body.id
    const incomingInvoiceId = body.invoiceId || body.invoice_id
    const incomingTrxId = body.transactionId || body.transaction_id || body.trx_id
    const incomingAmount = body.amount || body.amountBdt
    const incomingMethod = body.paymentMethod || body.payment_method
    const teamNameFromBody = body.teamName

    // 3. Handle Bulk Refund if Requested
    if (body.bulk || body.action === "bulk") {
      const scrimId = body.scrimId
      if (!scrimId) {
        return NextResponse.json(
          { ok: false, error: "scrimId is required for bulk refund." },
          { status: 400 }
        )
      }
      const { refundAllTeamsForScrim } = await import("@/app/actions/not-hosted")
      const bulkRes = await refundAllTeamsForScrim(scrimId)
      return NextResponse.json(bulkRes, { status: bulkRes.ok ? 200 : 400 })
    }

    if (!notHostedId && !incomingInvoiceId && !incomingTrxId) {
      return NextResponse.json(
        { ok: false, error: "Missing required identifier: notHostedId, invoiceId, or transactionId." },
        { status: 400 }
      )
    }

    // 4. Look up Database Record
    let record = null
    if (notHostedId) {
      const rows = await db
        .select()
        .from(notHostedTeams)
        .where(
          or(
            eq(notHostedTeams.id, notHostedId),
            eq(notHostedTeams.bookingId, notHostedId)
          )
        )
        .limit(1)
      record = rows[0] ?? null
    }

    if (!record && incomingInvoiceId) {
      const rows = await db
        .select()
        .from(notHostedTeams)
        .where(eq(notHostedTeams.invoiceId, incomingInvoiceId))
        .limit(1)
      record = rows[0] ?? null
    }

    // Prevent double refunds
    if (record && record.refundStatus === "refunded") {
      return NextResponse.json(
        {
          ok: false,
          error: `Refund has already been processed for ${record.teamName}. Reference: ${record.refundRef || "Completed"}`,
        },
        { status: 400 }
      )
    }

    // Secondary database lookups for booking and payment
    const bookingId = record?.bookingId || body.bookingId
    let bookingRecord = null
    if (bookingId) {
      const bRows = await db
        .select()
        .from(bookings)
        .where(eq(bookings.id, bookingId))
        .limit(1)
      bookingRecord = bRows[0] ?? null
    }

    let paymentRecord = null
    if (record?.paymentId) {
      const pRows = await db
        .select()
        .from(payments)
        .where(eq(payments.id, record.paymentId))
        .limit(1)
      paymentRecord = pRows[0] ?? null
    } else if (incomingInvoiceId || record?.invoiceId) {
      const targetInvoice = incomingInvoiceId || record?.invoiceId
      const pRows = await db
        .select()
        .from(payments)
        .where(eq(payments.invoiceId, targetInvoice))
        .limit(1)
      paymentRecord = pRows[0] ?? null
    }

    // 5. Consolidate Payment Identifiers
    const invoiceId =
      incomingInvoiceId ||
      record?.invoiceId ||
      paymentRecord?.invoiceId ||
      bookingRecord?.invoiceId ||
      null

    let transactionId =
      incomingTrxId ||
      record?.transactionId ||
      paymentRecord?.transactionId ||
      bookingRecord?.transactionId ||
      null

    let paymentMethod =
      incomingMethod ||
      record?.paymentMethod ||
      paymentRecord?.method ||
      "bkash"

    const amount = Number(
      incomingAmount ||
      record?.amountBdt ||
      paymentRecord?.amountBdt ||
      35
    )

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { ok: false, error: "Refund amount must be a valid positive number." },
        { status: 400 }
      )
    }

    const teamName = record?.teamName || teamNameFromBody || "Squad"
    const productName = record?.scrimTitle || "Scrim Match Entry Fee"

    // 6. Automatic Verification Fallback if Transaction ID or Method is missing
    if ((!transactionId || !paymentMethod) && invoiceId) {
      try {
        const verified = await verifyPayment(invoiceId)
        if (verified) {
          if (verified.transactionId) {
            transactionId = verified.transactionId
          }
          if (verified.paymentMethod) {
            paymentMethod = verified.paymentMethod
          }
          // Cache verified transactionId and paymentMethod into the database
          if (record?.id) {
            await db
              .update(notHostedTeams)
              .set({
                transactionId: transactionId || record.transactionId,
                paymentMethod: paymentMethod || record.paymentMethod,
                senderNumber: verified.senderNumber || record.senderNumber,
                updatedAt: new Date(),
              })
              .where(eq(notHostedTeams.id, record.id))
              .catch(() => {})
          }
          if (bookingRecord?.id && transactionId) {
            await db
              .update(bookings)
              .set({ transactionId, updatedAt: new Date() })
              .where(eq(bookings.id, bookingRecord.id))
              .catch(() => {})
          }
          if (paymentRecord?.id && transactionId) {
            await db
              .update(payments)
              .set({ transactionId, updatedAt: new Date() })
              .where(eq(payments.id, paymentRecord.id))
              .catch(() => {})
          }
        }
      } catch (verErr) {
        console.warn("[Refund Route] Automatic invoice verification warning:", verErr)
      }
    }

    // 7. Verify Gateway Configuration
    const config = getUddoktaPayConfig()
    if (!config || !config.apiKey) {
      return NextResponse.json(
        {
          ok: false,
          error: "Payment gateway is not configured. Please set UDDOKTAPAY_API_KEY and UDDOKTAPAY_BASE_URL.",
        },
        { status: 400 }
      )
    }

    if (!transactionId && !invoiceId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Neither Transaction ID nor Invoice ID could be found for this team. Automatic refund cannot proceed.",
        },
        { status: 400 }
      )
    }

    // 8. Construct Exact UddoktaPay Refund API Payload
    const normalizedMethod = (paymentMethod || "bkash").trim().toLowerCase()
    const refundPayload: Record<string, any> = {
      amount: String(amount),
      product_name: productName,
      reason: "Match Not Hosted / Cancelled",
      payment_method: normalizedMethod,
    }

    if (transactionId) {
      refundPayload.transaction_id = transactionId.trim()
      refundPayload.trx_id = transactionId.trim()
    }

    if (invoiceId) {
      refundPayload.invoice_id = invoiceId.trim()
      if (!transactionId) {
        refundPayload.transaction_id = invoiceId.trim()
        refundPayload.trx_id = invoiceId.trim()
      }
    }

    // 9. Call UddoktaPay Refund API Endpoint
    let baseUrl = config.baseUrl.replace(/\/+$/, "")
    if (baseUrl.endsWith("/api")) {
      baseUrl = baseUrl.replace(/\/api$/, "")
    }
    const refundEndpoint = `${baseUrl}/api/refund-payment`

    let gatewayRes: Response
    let responseText = ""
    try {
      gatewayRes = await fetch(refundEndpoint, {
        method: "POST",
        headers: {
          [API_KEY_HEADER]: config.apiKey.trim(),
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(refundPayload),
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
        // @ts-ignore - undici dispatcher for self-hosted instances
        dispatcher: gatewayDispatcher,
      } as any)

      responseText = await gatewayRes.text()
    } catch (fetchErr) {
      console.error("[Refund Gateway Fetch Exception]:", fetchErr)
      const errorMsg =
        fetchErr instanceof Error
          ? fetchErr.message
          : "Could not establish connection with payment gateway refund server."
      return NextResponse.json(
        {
          ok: false,
          error: `Gateway connection failure: ${errorMsg}`,
        },
        { status: 502 }
      )
    }

    // 10. Parse Response JSON
    let gatewayData: any = null
    try {
      gatewayData = JSON.parse(responseText)
    } catch {
      gatewayData = { message: responseText }
    }

    // Determine success condition based on status and response flags
    const isGatewaySuccess =
      gatewayRes.ok &&
      gatewayData &&
      gatewayData.status !== false &&
      gatewayData.status !== "ERROR" &&
      !gatewayData.error

    if (!isGatewaySuccess) {
      // Extract detailed error reason from gateway response
      let extractedError =
        gatewayData?.message ||
        gatewayData?.error ||
        (gatewayData?.errors
          ? typeof gatewayData.errors === "object"
            ? Object.values(gatewayData.errors).flat().join(", ")
            : String(gatewayData.errors)
          : null) ||
        `Payment gateway refund API returned status ${gatewayRes.status}`

      if (typeof extractedError === "string") {
        extractedError = extractedError.trim()
      }

      // Record failure state in database so admin has clear feedback on record
      if (record?.id) {
        await db
          .update(notHostedTeams)
          .set({
            refundStatus: "failed",
            refundError: extractedError,
            updatedAt: new Date(),
          })
          .where(eq(notHostedTeams.id, record.id))
          .catch(() => {})
      }

      return NextResponse.json(
        {
          ok: false,
          error: extractedError,
          status: gatewayRes.status,
          raw: gatewayData,
        },
        { status: 400 }
      )
    }

    // 11. Process Successful Refund in Database
    const refundRef =
      gatewayData?.refund_ref ||
      gatewayData?.refund_id ||
      gatewayData?.transaction_id ||
      gatewayData?.trx_id ||
      `RFD-${Date.now().toString().slice(-6)}`

    if (record?.id) {
      await db
        .update(notHostedTeams)
        .set({
          refundStatus: "refunded",
          refundRef,
          refundError: null,
          transactionId: transactionId || record.transactionId,
          invoiceId: invoiceId || record.invoiceId,
          updatedAt: new Date(),
        })
        .where(eq(notHostedTeams.id, record.id))
    }

    if (bookingRecord?.id) {
      await db
        .update(bookings)
        .set({
          status: "cancelled",
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, bookingRecord.id))
        .catch(() => {})
    }

    if (paymentRecord?.id) {
      await db
        .update(payments)
        .set({
          status: "refunded",
          updatedAt: new Date(),
        })
        .where(eq(payments.id, paymentRecord.id))
        .catch(() => {})
    } else if (invoiceId) {
      await db
        .update(payments)
        .set({
          status: "refunded",
          updatedAt: new Date(),
        })
        .where(eq(payments.invoiceId, invoiceId))
        .catch(() => {})
    }

    // Notify player
    try {
      const targetUserId = record?.userId || bookingRecord?.userId
      if (targetUserId) {
        await notifyUser(
          targetUserId,
          "refund",
          `Refund processed for ${record?.scrimTitle || "Scrim Match"}`,
          `Your entry fee of ৳${amount} for squad "${teamName}" has been refunded to your payment account. Reference: ${refundRef}`,
          "/dashboard"
        )
      }
    } catch (notifErr) {
      console.warn("[Refund Route] Notification warning:", notifErr)
    }

    // Log admin activity
    try {
      await logActivity(user.id, user.role, "auto_refund_team", teamName, {
        notHostedId: record?.id,
        bookingId: record?.bookingId || bookingId,
        transactionId,
        invoiceId,
        refundRef,
        amount,
      })
    } catch (logErr) {
      console.warn("[Refund Route] Activity log warning:", logErr)
    }

    revalidatePath("/admin/not-hosted")
    revalidatePath("/admin/scrims")
    revalidatePath("/dashboard")

    return NextResponse.json({
      ok: true,
      message: `Refund of ৳${amount} processed successfully for ${teamName}. Ref: ${refundRef}`,
      refundRef,
      data: gatewayData,
    })
  } catch (err) {
    console.error("[Refund Route Critical Exception]:", err)
    const errMessage = err instanceof Error ? err.message : "Internal Server Error"
    return NextResponse.json(
      {
        ok: false,
        error: `Refund processing error: ${errMessage}`,
      },
      { status: 500 }
    )
  }
}
