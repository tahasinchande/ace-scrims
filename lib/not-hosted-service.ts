import "server-only"

import { randomUUID } from "crypto"
import { revalidatePath } from "next/cache"
import { db, ensureNotHostedTable } from "@/lib/db"
import { scrims, bookings, payments, notHostedTeams, notifications, user } from "@/lib/db/schema"
import { logActivity } from "@/lib/session"
import { refundPayment } from "@/lib/uddoktapay"
import { getAllSampleScrims } from "@/lib/queries/scrims"
import { isEmailTemplateEnabled, sendScrimNotHostedEmail, sendEmailBatch } from "@/lib/email"
import { eq, and, or, sql, isNull } from "drizzle-orm"

/** Core internal service to mark a scrim as Not Hosted and transfer registered teams */
export async function executeMarkScrimNotHosted(
  scrimId: string,
  performerId = "system",
  performerRole = "system"
) {
  try {
    await ensureNotHostedTable().catch((err) =>
      console.warn("[executeMarkScrimNotHosted] ensureNotHostedTable warning:", err)
    )

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
        await db
          .insert(scrims)
          .values({
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
          })
          .onConflictDoUpdate({
            target: scrims.id,
            set: {
              status: "not_hosted",
              registrationOpen: false,
              updatedAt: new Date(),
            },
          })
        scrimRows = await db.select().from(scrims).where(eq(scrims.id, sample.id)).limit(1)
        scrim = scrimRows[0]
      }
    }

    if (!scrim) return { ok: false, error: "Scrim not found" }

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
    const emailRecipients = new Map<
      string,
      { email: string; recipientName: string; teamName: string; amountBdt: number }
    >()

    for (const row of scrimBookings) {
      const b = row.booking
      const p = row.payment

      const existing = await db
        .select({ id: notHostedTeams.id })
        .from(notHostedTeams)
        .where(eq(notHostedTeams.bookingId, b.id))
        .limit(1)

      let refundStatus = "pending"
      let refundRef: string | null = null
      let refundError: string | null = null
      const amount = p?.amountBdt ?? scrim.priceBdt ?? 35

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
            if (p?.id) {
              await db
                .update(payments)
                .set({ status: "refunded", updatedAt: new Date() })
                .where(eq(payments.id, p.id))
                .catch(() => {})
            }
            await db
              .update(bookings)
              .set({ status: "cancelled", updatedAt: new Date() })
              .where(eq(bookings.id, b.id))
              .catch(() => {})
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

      if (b.userId) {
        try {
          const notifBody =
            refundStatus === "refunded"
              ? `Your squad "${b.teamName}" registration for ${scrim.title} (${scrim.startTime}) was marked as Not Hosted and ৳${amount} has been automatically refunded to your payment account. Ref: ${refundRef}.`
              : `Your squad "${b.teamName}" registration for ${scrim.title} (${scrim.startTime}) has been queued for a full refund because the match was marked as Not Hosted.`

          await db.insert(notifications).values({
            id: randomUUID(),
            userId: b.userId,
            type: "refund",
            title:
              refundStatus === "refunded"
                ? "Scrim Not Hosted — Payment Refunded"
                : "Scrim Match Not Hosted (Refund Pending)",
            body: notifBody,
            href: "/dashboard",
            read: false,
          })
        } catch {}
      }

      const normalizedEmail = row.userEmail?.trim().toLowerCase()
      if (normalizedEmail && normalizedEmail.includes("@") && !emailRecipients.has(normalizedEmail)) {
        emailRecipients.set(normalizedEmail, {
          email: normalizedEmail,
          recipientName: row.userName || b.captainName || "Player",
          teamName: b.teamName,
          amountBdt: amount,
        })
      }
    }

    if (emailRecipients.size > 0 && (await isEmailTemplateEnabled("not_hosted"))) {
      await sendEmailBatch(Array.from(emailRecipients.values()), (r) =>
        sendScrimNotHostedEmail({
          to: r.email,
          recipientName: r.recipientName,
          teamName: r.teamName,
          scrimTitle: scrim.title,
          scrimDate: scrim.scrimDate,
          startTime: scrim.startTime,
          amountBdt: r.amountBdt,
        })
      )
    }

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

    revalidatePath("/")
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

/**
 * Auto-Cancel Under-filled Scrims (Cron / Internal Trigger):
 * Scans upcoming scrims. If a scrim has less than 10 out of 12 slots filled
 * within 15 minutes of start time (or past start time),
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
          and b."isTrashed" = false
          and b."isArchived" = false
        )`,
      })
      .from(scrims)
      .where(and(eq(scrims.status, "upcoming"), isNull(scrims.deletedAt)))

    const cancelledTitles: string[] = []
    let cancelledCount = 0

    const { scrimStartDate } = await import("@/lib/format")

    for (const row of upcoming) {
      const s = row.scrim
      const confirmed = Number(row.confirmedTeams || 0)
      const maxSlots = s.maxTeams || 12
      const threshold = maxSlots >= 12 ? 10 : Math.ceil(maxSlots * 0.8)

      const start = scrimStartDate(s.scrimDate, s.startTime)
      const diffMinutes = (start.getTime() - now.getTime()) / (1000 * 60)

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
