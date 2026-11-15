"use server"

import { randomUUID } from "crypto"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { bookings, payments, notHostedTeams, notifications } from "@/lib/db/schema"
import { requireAdmin, logActivity } from "@/lib/session"
import { refundPayment, verifyPayment } from "@/lib/uddoktapay"
import { notifyUser } from "@/lib/notify"
import { executeMarkScrimNotHosted } from "@/lib/not-hosted-service"
import { eq, and, or } from "drizzle-orm"

/** Admin action to mark a scrim as Not Hosted and transfer registered teams */
export async function markScrimNotHosted(scrimId: string) {
  const admin = await requireAdmin()
  return executeMarkScrimNotHosted(scrimId, admin.id, admin.role)
}

/** Admin action to Bulk Refund all registered teams for a specific non-hosted scrim */
export async function refundAllTeamsForScrim(scrimId: string) {
  try {
    const admin = await requireAdmin()

    // 1. Get all pending teams for this scrim
    const pendingTeams = await db
      .select()
      .from(notHostedTeams)
      .where(
        and(
          eq(notHostedTeams.scrimId, scrimId),
          eq(notHostedTeams.refundStatus, "pending")
        )
      )

    if (pendingTeams.length === 0) {
      return { ok: true, count: 0, message: "All teams for this scrim have already been refunded." }
    }

    let successCount = 0
    const errors: string[] = []

    for (const team of pendingTeams) {
      // Find associated payment and booking to extract transactionId, invoiceId, method, and amount
      let paymentRecord = null
      if (team.paymentId) {
        const pRows = await db
          .select()
          .from(payments)
          .where(eq(payments.id, team.paymentId))
          .limit(1)
        paymentRecord = pRows[0] ?? null
      }
      if (!paymentRecord && team.bookingId) {
        const pRows = await db
          .select()
          .from(payments)
          .where(eq(payments.bookingId, team.bookingId))
          .limit(1)
        paymentRecord = pRows[0] ?? null
      }

      let bookingRecord = null
      if (team.bookingId) {
        const bRows = await db
          .select()
          .from(bookings)
          .where(eq(bookings.id, team.bookingId))
          .limit(1)
        bookingRecord = bRows[0] ?? null
      }

      const transactionId =
        team.transactionId ||
        paymentRecord?.transactionId ||
        (bookingRecord as any)?.transactionId ||
        team.invoiceId ||
        paymentRecord?.invoiceId ||
        (bookingRecord as any)?.invoiceId ||
        null
      const invoiceId =
        team.invoiceId ||
        paymentRecord?.invoiceId ||
        (bookingRecord as any)?.invoiceId ||
        null
      const paymentId = team.paymentId || paymentRecord?.id || null
      const paymentMethod = team.paymentMethod || paymentRecord?.method || "bkash"
      const amount = team.amountBdt || paymentRecord?.amountBdt || 35

      let refundRef: string | null = null
      let refundError: string | null = null

      try {
        const gatewayRes = await refundPayment({
          transactionId,
          invoiceId,
          paymentId,
          paymentMethod,
          amount,
          productName: team.scrimTitle || "Scrim Match Entry Fee",
          reason: "Match Not Hosted / Cancelled",
        })

        if (gatewayRes.ok) {
          refundRef = gatewayRes.refundRef || `RFD-BULK-${Date.now().toString().slice(-6)}`
        } else {
          refundError = gatewayRes.message || "Automated payment gateway refund request failed"
        }
      } catch (gwErr: any) {
        refundError = gwErr?.message || "Failed to communicate with payment gateway refund API"
      }

      if (refundRef) {
        // Update notHostedTeams record as refunded
        await db
          .update(notHostedTeams)
          .set({
            refundStatus: "refunded",
            refundRef,
            refundError: null,
            updatedAt: new Date(),
          })
          .where(eq(notHostedTeams.id, team.id))

        // Update payments table if paymentId present
        const pid = team.paymentId || paymentRecord?.id
        if (pid) {
          await db
            .update(payments)
            .set({ status: "refunded", updatedAt: new Date() })
            .where(eq(payments.id, pid))
        }

        // Update booking status
        if (team.bookingId) {
          await db
            .update(bookings)
            .set({ status: "cancelled", updatedAt: new Date() })
            .where(eq(bookings.id, team.bookingId))
        }

        // Send in-app notification to the team's user account
        if (team.userId) {
          try {
            await db.insert(notifications).values({
              id: randomUUID(),
              userId: team.userId,
              type: "refund",
              title: "Scrim Match Not Hosted — Entry Fee Refunded",
              body: `Your registered squad "${team.teamName}" for ${team.scrimTitle} (${team.scrimDate} ${team.scrimTime}) was refunded ৳${amount}. Ref: ${refundRef}.`,
              href: "/dashboard",
              read: false,
            })
          } catch (notifErr) {
            console.warn("[Bulk Refund] Notification creation failed:", notifErr)
          }
        }

        successCount++
      } else {
        // Record failure
        await db
          .update(notHostedTeams)
          .set({
            refundStatus: "failed",
            refundError: refundError || "Payment gateway refund failed",
            updatedAt: new Date(),
          })
          .where(eq(notHostedTeams.id, team.id))

        errors.push(`${team.teamName}: ${refundError}`)
      }
    }

    await logActivity(admin.id, admin.role, "bulk_refund_scrim", scrimId, {
      teamsRefunded: successCount,
      failedCount: errors.length,
    })

    revalidatePath("/admin/not-hosted")
    revalidatePath("/admin/scrims")
    revalidatePath("/dashboard")

    return {
      ok: successCount > 0 || errors.length === 0,
      count: successCount,
      message:
        errors.length > 0
          ? `${successCount} team(s) refunded. ${errors.length} failed: ${errors.slice(0, 2).join("; ")}`
          : `Bulk refund completed! ${successCount} team(s) refunded successfully to their payment accounts.`,
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to execute bulk refund" }
  }
}

/** Admin action to process refund for a single team via Uddoktapay using database saved trxid */
export async function processTeamRefund(bookingIdOrTeamId: string) {
  try {
    const admin = await requireAdmin()

    // 1. Find the notHostedTeams record by teamId or bookingId
    const rows = await db
      .select()
      .from(notHostedTeams)
      .where(
        or(
          eq(notHostedTeams.id, bookingIdOrTeamId),
          eq(notHostedTeams.bookingId, bookingIdOrTeamId)
        )
      )
      .limit(1)

    const record = rows[0]
    if (!record) return { ok: false, error: "Team record not found for refund" }

    if (record.refundStatus === "refunded") {
      return { ok: false, error: "Refund has already been processed for this team." }
    }

    const bookingId = record.bookingId || bookingIdOrTeamId

    // 2. Query booking record from DB
    let bookingRecord = null
    if (bookingId) {
      const bRows = await db
        .select()
        .from(bookings)
        .where(eq(bookings.id, bookingId))
        .limit(1)
      bookingRecord = bRows[0] ?? null
    }

    // 3. Query payment record from DB
    let paymentRecord = null
    if (record.paymentId) {
      const pRows = await db
        .select()
        .from(payments)
        .where(eq(payments.id, record.paymentId))
        .limit(1)
      paymentRecord = pRows[0] ?? null
    }
    if (!paymentRecord && bookingId) {
      const pRows = await db
        .select()
        .from(payments)
        .where(eq(payments.bookingId, bookingId))
        .limit(1)
      paymentRecord = pRows[0] ?? null
    }

    // 4. Extract saved trxid and invoiceId from database models
    let savedTrxId =
      record.transactionId ||
      paymentRecord?.transactionId ||
      bookingRecord?.transactionId ||
      null

    const invoiceId =
      record.invoiceId ||
      paymentRecord?.invoiceId ||
      bookingRecord?.invoiceId ||
      null

    let paymentMethod = record.paymentMethod || paymentRecord?.method || "bkash"

    // If trxId was not in DB but invoiceId is, re-verify with gateway once to retrieve and persist trxId
    if (!savedTrxId && invoiceId) {
      try {
        const verified = await verifyPayment(invoiceId)
        if (verified) {
          if (verified.transactionId) {
            savedTrxId = verified.transactionId
          }
          if (verified.paymentMethod) {
            paymentMethod = verified.paymentMethod
          }
          if (record.id) {
            await db
              .update(notHostedTeams)
              .set({
                transactionId: savedTrxId || record.transactionId,
                paymentMethod: paymentMethod || record.paymentMethod,
                senderNumber: verified.senderNumber || record.senderNumber,
              })
              .where(eq(notHostedTeams.id, record.id))
              .catch(() => {})
          }
          if (bookingRecord?.id && savedTrxId) {
            await db
              .update(bookings)
              .set({ transactionId: savedTrxId })
              .where(eq(bookings.id, bookingRecord.id))
              .catch(() => {})
          }
          if (paymentRecord?.id && savedTrxId) {
            await db
              .update(payments)
              .set({ transactionId: savedTrxId })
              .where(eq(payments.id, paymentRecord.id))
              .catch(() => {})
          }
        }
      } catch (verifyErr) {
        console.error("[Auto-Refund] Verification fallback error:", verifyErr)
      }
    }

    const paymentId = record.paymentId || paymentRecord?.id || null
    const amount = record.amountBdt || paymentRecord?.amountBdt || 35

    if (!savedTrxId && !invoiceId) {
      return {
        ok: false,
        error: "No transaction ID or invoice ID found in database for this team. Cannot automate refund.",
      }
    }

    // 5. Call UddoktaPay refund API strictly using the database value
    const gatewayRes = await refundPayment({
      transactionId: savedTrxId,
      invoiceId,
      paymentId,
      paymentMethod,
      amount,
      productName: record.scrimTitle || "Scrim Match Entry Fee",
      reason: "Match Not Hosted / Cancelled",
    })

    if (!gatewayRes.ok) {
      const errorMsg = gatewayRes.message || "Failed to trigger automated gateway refund"
      await db
        .update(notHostedTeams)
        .set({
          refundStatus: "failed",
          refundError: errorMsg,
          updatedAt: new Date(),
        })
        .where(eq(notHostedTeams.id, record.id))

      return { ok: false, error: errorMsg }
    }

    const refundRef = gatewayRes.refundRef || `RFD-${Date.now().toString().slice(-6)}`

    await db
      .update(notHostedTeams)
      .set({
        refundStatus: "refunded",
        refundRef,
        refundError: null,
        transactionId: savedTrxId || record.transactionId,
        invoiceId: invoiceId || record.invoiceId,
        updatedAt: new Date(),
      })
      .where(eq(notHostedTeams.id, record.id))

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
    }

    // Notify player
    try {
      const userId = record.userId || bookingRecord?.userId
      if (userId) {
        await notifyUser(
          userId,
          "refund",
          `Refund processed for ${record.scrimTitle || "Scrim Match"}`,
          `Your entry fee of ৳${amount} for squad "${record.teamName}" has been refunded to your payment account. Ref: ${refundRef}`,
          "/dashboard"
        )
      }
    } catch {}

    await logActivity(admin.id, admin.role, "auto_refund_team", record.teamName, {
      notHostedId: record.id,
      bookingId: record.bookingId,
      transactionId: savedTrxId,
      refundRef,
      amount,
    })

    revalidatePath("/admin/not-hosted")
    revalidatePath("/admin/scrims")
    revalidatePath("/dashboard")
    return { ok: true, message: `Refund of ৳${amount} processed successfully for ${record.teamName}.` }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to process refund" }
  }
}

/** Admin action to mark a refund as completed manually */
export async function markRefundManual(notHostedId: string, refundRef: string) {
  try {
    const admin = await requireAdmin()

    const rows = await db.select().from(notHostedTeams).where(eq(notHostedTeams.id, notHostedId)).limit(1)
    const record = rows[0]
    if (!record) return { ok: false, error: "Record not found" }

    if (record.refundStatus === "refunded") {
      return { ok: false, error: "Refund is already marked as refunded." }
    }

    const refStr = refundRef.trim() || `MANUAL-RFD-${Date.now().toString().slice(-6)}`

    await db
      .update(notHostedTeams)
      .set({
        refundStatus: "refunded",
        refundRef: refStr,
        refundError: null,
        updatedAt: new Date(),
      })
      .where(eq(notHostedTeams.id, notHostedId))

    if (record.paymentId) {
      await db.update(payments).set({ status: "refunded", updatedAt: new Date() }).where(eq(payments.id, record.paymentId))
    }

    if (record.userId) {
      try {
        await db.insert(notifications).values({
          id: randomUUID(),
          userId: record.userId,
          type: "refund",
          title: "Scrim Entry Fee Refunded (Manual Verification)",
          body: `Your squad "${record.teamName}" for ${record.scrimTitle} refund of ৳${record.amountBdt} was processed. Ref: ${refStr}.`,
          href: "/dashboard",
          read: false,
        })
      } catch {}
    }

    await logActivity(admin.id, admin.role, "manual_refund", notHostedId, {
      teamName: record.teamName,
      refundRef: refStr,
    })

    revalidatePath("/admin/not-hosted")
    revalidatePath("/dashboard")
    return { ok: true, message: "Team marked as Refunded successfully." }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update refund status" }
  }
}

export async function deleteNotHostedTeam(id: string): Promise<{ ok: boolean; error: string | null }> {
  try {
    const admin = await requireAdmin()
    await db.delete(notHostedTeams).where(eq(notHostedTeams.id, id))
    await logActivity(admin.id, admin.role, "delete_not_hosted_team", id)
    revalidatePath("/admin/not-hosted")
    return { ok: true, error: null }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to delete team" }
  }
}

export async function bulkDeleteNotHostedTeams(ids: string[]): Promise<{ ok: boolean; count: number; error: string | null }> {
  try {
    const admin = await requireAdmin()
    if (!ids || ids.length === 0) return { ok: true, count: 0, error: null }
    let count = 0
    for (const id of ids) {
      await db.delete(notHostedTeams).where(eq(notHostedTeams.id, id))
      count++
    }
    await logActivity(admin.id, admin.role, "bulk_delete_not_hosted_teams", `Deleted ${count} not hosted records`)
    revalidatePath("/admin/not-hosted")
    return { ok: true, count, error: null }
  } catch (e) {
    return { ok: false, count: 0, error: e instanceof Error ? e.message : "Failed to bulk delete teams" }
  }
}
