"use server"

import { randomUUID } from "crypto"
import { revalidatePath } from "next/cache"
import { db, ensureNotHostedTable } from "@/lib/db"
import { scrims, bookings, payments, notHostedTeams, notifications, user } from "@/lib/db/schema"
import { requireAdmin, logActivity } from "@/lib/session"
import { refundPayment, verifyPayment } from "@/lib/uddoktapay"
import { notifyUser } from "@/lib/notify"
import { getAllSampleScrims } from "@/lib/queries/scrims"
import { sendScrimNotHostedEmail } from "@/lib/email"
import { eq, and, or, sql, isNull } from "drizzle-orm"

/** Core internal action to mark a scrim as Not Hosted and transfer registered teams */
export async function executeMarkScrimNotHosted(
  scrimId: string,
  performerId = "system",
  performerRole = "system"
) {
  try {
    // Ensure database table and columns exist
    await ensureNotHostedTable().catch((err) => console.warn("[executeMarkScrimNotHosted] ensureNotHostedTable warning:", err))

    // 1. Get or initialize scrim from DB or standard sample definitions
    let scrimRows = await db
      .select()
      .from(scrims)
      .where(or(eq(scrims.id, scrimId), eq(scrims.slug, scrimId)))
      .limit(1)
    let scrim = scrimRows[0]

    if (!scrim) {
      const samples = getAllSampleScrims()
      const sample = samples.find((s) => s.id === scrimId || s.slug === scrimId)
      if (sample) {
        await db.insert(scrims).values({
          id: sample.id,
          title: sample.title,
          slug: sample.slug,
          map: sample.map,
          startTime: sample.startTime,
          scrimDate: sample.scrimDate,
          priceBdt: sample.priceBdt,
          prizePoolBdt: sample.prizePoolBdt,
          maxTeams: sample.maxTeams,
          bannerUrl: sample.bannerUrl,
          registrationOpen: false,
          status: "not_hosted",
        }).onConflictDoUpdate({
          target: scrims.id,
          set: {
            status: "not_hosted",
            registrationOpen: false,
            updatedAt: new Date(),
          }
        })
        scrimRows = await db.select().from(scrims).where(eq(scrims.id, sample.id)).limit(1)
        scrim = scrimRows[0]
      }
    }

    if (!scrim) return { ok: false, error: "Scrim not found" }

    // 2. Fetch all successfully paid / confirmed teams for this scrim
    const scrimBookings = await db
      .select({
        booking: bookings,
        payment: payments,
        userEmail: user.email,
        userName: user.name,
      })
      .from(bookings)
      .leftJoin(payments, eq(payments.bookingId, bookings.id))
      .leftJoin(user, eq(bookings.userId, user.id))
      .where(
        and(
          or(eq(bookings.scrimId, scrim.id), eq(bookings.scrimId, scrim.slug)),
          eq(bookings.status, "confirmed")
        )
      )

    let count = 0
    for (const row of scrimBookings) {
      const b = row.booking
      const p = row.payment

      // Check if already archived into notHostedTeams
      const existing = await db
        .select({ id: notHostedTeams.id })
        .from(notHostedTeams)
        .where(eq(notHostedTeams.bookingId, b.id))
        .limit(1)

      let refundStatus = "pending"
      let refundRef: string | null = null
      let refundError: string | null = null
      const amount = p?.amountBdt ?? scrim.priceBdt ?? 35

      // Automated Uddoktapay Refund trigger
      if (p?.invoiceId || p?.transactionId || p?.id) {
        try {
          const refundRes = await refundPayment({
            transactionId: p?.transactionId || p?.invoiceId || null,
            invoiceId: p?.invoiceId || null,
            paymentId: p?.id || null,
            paymentMethod: p?.method || "bkash",
            amount,
            productName: scrim.title || "Scrim Match Entry Fee",
            reason: "Match Not Hosted / Cancelled",
          })
          if (refundRes.ok) {
            refundStatus = "refunded"
            refundRef = refundRes.refundRef || `RFD-AUTO-${Date.now().toString().slice(-6)}`
            // Update payment and booking statuses to refunded
            if (p?.id) {
              await db.update(payments).set({ status: "refunded", updatedAt: new Date() }).where(eq(payments.id, p.id)).catch(() => {})
            }
            await db.update(bookings).set({ status: "cancelled", updatedAt: new Date() }).where(eq(bookings.id, b.id)).catch(() => {})
          } else {
            refundError = refundRes.message
          }
        } catch (gwErr: any) {
          refundError = gwErr?.message || "Automated Uddoktapay refund API request failed"
        }
      }

      if (existing.length === 0) {
        await db.insert(notHostedTeams).values({
          id: randomUUID(),
          scrimId: scrim.id,
          scrimTitle: scrim.title,
          scrimDate: scrim.scrimDate,
          scrimTime: scrim.startTime,
          bookingId: b.id,
          userId: b.userId,
          teamName: b.teamName,
          captainName: b.captainName,
          captainUid: b.captainUid,
          phone: b.phone,
          paymentId: p?.id ?? null,
          invoiceId: p?.invoiceId ?? (b as any)?.invoiceId ?? null,
          transactionId: p?.transactionId ?? (b as any)?.transactionId ?? null,
          amountBdt: amount,
          paymentMethod: p?.method ?? "bKash/Nagad",
          senderNumber: p?.senderNumber ?? null,
          refundStatus,
          refundRef,
          refundError,
        })
        count++
      } else if (refundStatus === "refunded") {
        await db
          .update(notHostedTeams)
          .set({
            refundStatus: "refunded",
            refundRef,
            refundError: null,
            updatedAt: new Date(),
          })
          .where(eq(notHostedTeams.bookingId, b.id))
      }

      // Create an informative in-app notification for the user
      if (b.userId) {
        try {
          const notifBody =
            refundStatus === "refunded"
              ? `Your squad "${b.teamName}" registration for ${scrim.title} (${scrim.startTime}) was marked as Not Hosted and ৳${amount} has been automatically refunded via Automated Gateway. Ref: ${refundRef}.`
              : `Your squad "${b.teamName}" registration for ${scrim.title} (${scrim.startTime}) has been queued for a full refund because the match was marked as Not Hosted.`

          await db.insert(notifications).values({
            id: randomUUID(),
            userId: b.userId,
            type: "refund",
            title: refundStatus === "refunded" ? "Scrim Not Hosted — Payment Refunded" : "Scrim Match Not Hosted (Refund Pending)",
            body: notifBody,
            href: "/dashboard",
            read: false,
          })
        } catch {}
      }

      // Send automated email notification to user
      if (row.userEmail) {
        sendScrimNotHostedEmail({
          to: row.userEmail,
          recipientName: row.userName || b.captainName || "Player",
          teamName: b.teamName,
          scrimTitle: scrim.title,
          scrimDate: scrim.scrimDate,
          startTime: scrim.startTime,
          amountBdt: amount,
        }).catch((emailErr) => {
          console.warn(`[executeMarkScrimNotHosted] Failed to send email to ${row.userEmail}:`, emailErr)
        })
      }
    }

    // 3. Mark scrim as not_hosted in database
    await db
      .update(scrims)
      .set({
        status: "not_hosted",
        registrationOpen: false,
        updatedAt: new Date(),
      })
      .where(eq(scrims.id, scrim.id))

    if (performerId !== "system") {
      await logActivity(performerId, performerRole, "mark_scrim_not_hosted", scrim.id, {
        title: scrim.title,
        teamsTransferred: count,
      })
    }

    revalidatePath("/admin/scrims")
    revalidatePath("/admin/not-hosted")
    revalidatePath("/scrims")
    revalidatePath("/dashboard")

    return {
      ok: true,
      count,
      message: `Scrim marked as Not Hosted. ${count} team(s) transferred to the Not Hosted section for refund processing.`,
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to mark scrim as Not Hosted" }
  }
}

/** Admin action to mark a scrim as Not Hosted and transfer registered teams */
export async function markScrimNotHosted(scrimId: string) {
  const admin = await requireAdmin()
  return executeMarkScrimNotHosted(scrimId, admin.id, admin.role)
}

/**
 * Auto-Cancel Under-filled Scrims (Cron / Trigger Action):
 * Scans upcoming scrims. If a scrim has less than 10 out of 12 slots filled
 * (or < 10 confirmed teams) within 15 minutes of start time (or past start time),
 * automatically moves the scrim to "not_hosted" and transfers teams for refund.
 */
export async function autoCancelUnderfilledScrims(): Promise<{
  ok: boolean
  checked: number
  cancelled: number
  scrimTitles: string[]
  error?: string | null
}> {
  try {
    await ensureNotHostedTable().catch(() => {})
    const now = new Date()

    const upcoming = await db
      .select({
        scrim: scrims,
        confirmedTeams: sql<number>`(
          select count(*) from bookings b
          where (b."scrimId" = ${scrims.id} or b."scrimId" = ${scrims.slug})
          and b.status = 'confirmed'
        )`,
      })
      .from(scrims)
      .where(
        and(
          eq(scrims.status, "upcoming"),
          isNull(scrims.deletedAt)
        )
      )

    const cancelledTitles: string[] = []
    let cancelledCount = 0

    const { scrimStartDate } = await import("@/lib/format")

    for (const row of upcoming) {
      const s = row.scrim
      const confirmed = Number(row.confirmedTeams || 0)
      const maxSlots = s.maxTeams || 12
      // Requirement 2: check if a scrim has less than 10 out of 12 slots filled
      const threshold = maxSlots >= 12 ? 10 : Math.ceil(maxSlots * 0.8)

      const start = scrimStartDate(s.scrimDate, s.startTime)
      const diffMinutes = (start.getTime() - now.getTime()) / (1000 * 60)

      // If within 15 minutes of match start (or already past start time) and underfilled:
      if (diffMinutes <= 15 && confirmed < threshold) {
        const res = await executeMarkScrimNotHosted(s.id, "system-autocancel", "system")
        if (res.ok) {
          cancelledCount++
          cancelledTitles.push(s.title)
        }
      }
    }

    if (cancelledCount > 0) {
      revalidatePath("/admin/scrims")
      revalidatePath("/admin/not-hosted")
      revalidatePath("/scrims")
      revalidatePath("/dashboard")
      revalidatePath("/")
    }

    return {
      ok: true,
      checked: upcoming.length,
      cancelled: cancelledCount,
      scrimTitles: cancelledTitles,
    }
  } catch (err: any) {
    console.error("[autoCancelUnderfilledScrims] Error:", err)
    return {
      ok: false,
      checked: 0,
      cancelled: 0,
      scrimTitles: [],
      error: err?.message || "Failed to run auto-cancel",
    }
  }
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
          refundError = gatewayRes.message || "UddoktaPay refund request failed"
        }
      } catch (gwErr: any) {
        refundError = gwErr?.message || "Failed to communicate with UddoktaPay refund API"
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
            refundError: refundError || "UddoktaPay refund failed",
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
          : `Bulk refund completed! ${successCount} team(s) refunded successfully via Automated Gateway.`,
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
      const errorMsg = gatewayRes.message || "Failed to trigger UddoktaPay automated refund"
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
          `Your entry fee of ৳${amount} for squad "${record.teamName}" has been refunded via Automated Gateway. Ref: ${refundRef}`,
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
