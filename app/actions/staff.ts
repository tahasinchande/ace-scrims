"use server"

import { randomUUID } from "crypto"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { scrims, results, bookings, user } from "@/lib/db/schema"
import { requireStaff, requireAdmin } from "@/lib/session"
import { notifyScrimParticipants, logActivity } from "@/lib/notify"
import { eq, and, or } from "drizzle-orm"
import { z } from "zod"
import { put } from "@vercel/blob"
import { sendRoomCredentialsEmail, sendMatchResultPublishedEmail } from "@/lib/email"

// ─────────────────────────────────────────────────────────────────────────
// Staff actions: available to BOTH moderators and admins.
// Moderators may ONLY publish room credentials and results.
// ─────────────────────────────────────────────────────────────────────────

const roomSchema = z.object({
  scrimId: z.string().min(1),
  roomId: z.string().trim().min(1, "Room ID is required").max(50),
  roomPassword: z.string().trim().min(1, "Password is required").max(50),
})

import { resolveOrEnsureScrim } from "@/lib/queries/scrims"

export async function publishRoom(_prev: unknown, formData: FormData) {
  try {
    const staff = await requireStaff()
    const parsed = roomSchema.safeParse({
      scrimId: formData.get("scrimId"),
      roomId: formData.get("roomId"),
      roomPassword: formData.get("roomPassword"),
    })
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
    }
    const { scrimId, roomId, roomPassword } = parsed.data

    const scrim = await resolveOrEnsureScrim(scrimId)
    if (!scrim) return { ok: false, error: "Scrim not found" }

    const isUpdated = Boolean(scrim.roomPublished && scrim.roomId)

    await db
      .update(scrims)
      .set({ roomId, roomPassword, roomPublished: true, updatedAt: new Date() })
      .where(eq(scrims.id, scrim.id))

    await notifyScrimParticipants(
      scrim.id,
      "room",
      isUpdated ? `Room details updated for ${scrim.title}` : `Room details published for ${scrim.title}`,
      isUpdated
        ? `Room ID and password for the ${scrim.startTime} scrim have been updated in your dashboard.`
        : `Room ID and password for the ${scrim.startTime} scrim are now visible in your dashboard.`,
      "/dashboard/scrims",
    )
    await logActivity(staff.id, staff.role, isUpdated ? "update_room" : "publish_room", scrim.title)

    // Send Room ID & Password Release/Update Email to confirmed teams
    try {
      const confirmedBookings = await db
        .select({
          bookingId: bookings.id,
          teamName: bookings.teamName,
          captainName: bookings.captainName,
          slotNumber: bookings.slotNumber,
          userEmail: user.email,
          userName: user.name,
        })
        .from(bookings)
        .leftJoin(user, eq(bookings.userId, user.id))
        .where(
          and(
            or(eq(bookings.scrimId, scrim.id), eq(bookings.scrimId, scrim.slug)),
            eq(bookings.status, "confirmed"),
            eq(bookings.isTrashed, false),
            eq(bookings.isArchived, false),
            eq(bookings.scrimDate, scrim.scrimDate)
          )
        )

      const emailPromises = confirmedBookings
        .filter((b) => Boolean(b.userEmail))
        .map((b) =>
          sendRoomCredentialsEmail({
            to: b.userEmail!,
            recipientName: b.userName || b.captainName || "Captain",
            teamName: b.teamName,
            scrimTitle: scrim.title,
            startTime: scrim.startTime,
            slotNumber: b.slotNumber,
            roomId,
            roomPassword,
            isUpdated,
          }).catch((err) =>
            console.error(`[Staff Action] Error delivering room credentials email to ${b.userEmail}:`, err)
          )
        )

      await Promise.allSettled(emailPromises)
    } catch (emailDispatchErr) {
      console.warn("[Staff Action] Could not query confirmed participants for room release email:", emailDispatchErr)
    }

    revalidatePath("/admin/scrims")
    revalidatePath("/dashboard/scrims")
    return { ok: true, error: null }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" }
  }
}

export async function unpublishRoom(scrimId: string): Promise<{ ok: boolean; error: string | null }> {
  try {
    const staff = await requireStaff()
    await db
      .update(scrims)
      .set({ roomPublished: false, updatedAt: new Date() })
      .where(eq(scrims.id, scrimId))
    await logActivity(staff.id, staff.role, "unpublish_room", scrimId)
    revalidatePath("/admin/scrims")
    revalidatePath("/dashboard/scrims")
    return { ok: true, error: null }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to unpublish room" }
  }
}

import { saveUploadedFile } from "@/lib/upload"

const resultSchema = z.object({
  scrimId: z.string().min(1),
  winningTeam: z.string().trim().min(1, "Winning team is required").max(100),
  kills: z.coerce.number().int().min(0).max(200),
  prizeBdt: z.coerce.number().int().min(0).max(100000),
  placement: z.coerce.number().int().min(1).max(12),
  category: z.string().default("Top 3 Prize Pool"),
})

export async function publishResult(_prev: unknown, formData: FormData) {
  try {
    const staff = await requireStaff()
    const parsed = resultSchema.safeParse({
      scrimId: formData.get("scrimId"),
      winningTeam: formData.get("winningTeam"),
      kills: formData.get("kills"),
      prizeBdt: formData.get("prizeBdt"),
      placement: formData.get("placement"),
      category: formData.get("category") || "Top 3 Prize Pool",
    })
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
    }

    const scrim = await resolveOrEnsureScrim(parsed.data.scrimId)
    if (!scrim) return { ok: false, error: "Scrim not found" }

    // Multi-image upload handling
    const uploadedUrls: string[] = []
    const imageUrlsJson = formData.get("imageUrlsJson") as string | null
    if (imageUrlsJson) {
      try {
        const parsedUrls = JSON.parse(imageUrlsJson)
        if (Array.isArray(parsedUrls)) {
          uploadedUrls.push(...parsedUrls.filter((u): u is string => typeof u === "string"))
        }
      } catch {}
    }

    if (uploadedUrls.length === 0) {
      const files = formData.getAll("screenshots")
      const legacyFile = formData.get("screenshot")

      const filesToUpload: File[] = []
      if (Array.isArray(files)) {
        for (const f of files) {
          if (f instanceof File && f.size > 0) filesToUpload.push(f)
        }
      }
      if (filesToUpload.length === 0 && legacyFile instanceof File && legacyFile.size > 0) {
        filesToUpload.push(legacyFile)
      }

      for (const f of filesToUpload) {
        if (f.size > 10 * 1024 * 1024) return { ok: false, error: "Image file must be under 10MB" }
        if (!f.type.startsWith("image/")) return { ok: false, error: "All files must be images" }
        const url = await saveUploadedFile(f, "results")
        uploadedUrls.push(url)
      }
    }

    const primaryScreenshotUrl = uploadedUrls[0] || null
    const mvpPlayerName = (formData.get("mvpPlayerName") as string | null)?.trim() || null
    const mvpTeamName = (formData.get("mvpTeamName") as string | null)?.trim() || null
    const customMatchDate = (formData.get("matchDate") as string | null)?.trim() || scrim.scrimDate

    await db.insert(results).values({
      id: randomUUID(),
      scrimId: scrim.id,
      winningTeam: parsed.data.winningTeam,
      mvpPlayerName,
      mvpTeamName,
      kills: parsed.data.kills,
      prizeBdt: parsed.data.prizeBdt,
      placement: parsed.data.placement,
      category: parsed.data.category,
      screenshotUrl: primaryScreenshotUrl,
      imageUrls: uploadedUrls,
      isTrashed: false,
      matchDate: customMatchDate,
      publishedBy: staff.id,
    })

    // Only update live scrim status to completed if publishing results for today's active date.
    // Historical matches published from the archive do not conflict with the active day's live scrim.
    const { getBangladeshActiveDate } = await import("@/lib/queries/scrims")
    const activeDate = getBangladeshActiveDate()
    if (customMatchDate === activeDate) {
      await db
        .update(scrims)
        .set({ status: "completed", updatedAt: new Date() })
        .where(eq(scrims.id, scrim.id))
    }

    await notifyScrimParticipants(
      scrim.id,
      "result",
      `Results published for ${scrim.title}`,
      `${parsed.data.winningTeam} won in ${parsed.data.category}. Check the results page.`,
      "/results",
    )

    // Query confirmed registered teams and their user accounts for email notifications
    try {
      const confirmedBookings = await db
        .select({
          bookingId: bookings.id,
          teamName: bookings.teamName,
          captainName: bookings.captainName,
          userId: bookings.userId,
          userEmail: user.email,
          userName: user.name,
        })
        .from(bookings)
        .innerJoin(user, eq(bookings.userId, user.id))
        .where(
          and(
            or(eq(bookings.scrimId, scrim.id), eq(bookings.scrimId, scrim.slug)),
            eq(bookings.status, "confirmed"),
            eq(bookings.isTrashed, false),
            eq(bookings.scrimDate, customMatchDate)
          )
        )

      // Deduplicate recipients by email address
      const recipientMap = new Map<string, { email: string; name: string; teamName: string }>()
      for (const b of confirmedBookings) {
        if (b.userEmail && b.userEmail.includes("@")) {
          const normalized = b.userEmail.trim().toLowerCase()
          if (!recipientMap.has(normalized)) {
            recipientMap.set(normalized, {
              email: normalized,
              name: b.userName || b.captainName || "Player",
              teamName: b.teamName,
            })
          }
        }
      }

      if (recipientMap.size > 0) {
        console.log(`[publishResult] Sending match result emails to ${recipientMap.size} confirmed team recipient(s)...`)
        const emailJobs = Array.from(recipientMap.values()).map(async (recipient) => {
          try {
            const sent = await sendMatchResultPublishedEmail({
              to: recipient.email,
              recipientName: recipient.name,
              teamName: recipient.teamName,
              scrimTitle: scrim.title,
              winningTeam: parsed.data.winningTeam,
              kills: parsed.data.kills,
              prizeBdt: parsed.data.prizeBdt,
              placement: parsed.data.placement,
              category: parsed.data.category,
            })
            if (!sent) {
              console.error(`[publishResult Email] Delivery returned false for ${recipient.email}`)
            }
          } catch (emailErr) {
            console.error(`[publishResult Email] Caught exception dispatching result email to ${recipient.email}:`, emailErr)
          }
        })

        // Properly await all emails so Vercel serverless execution does not terminate prematurely
        await Promise.all(emailJobs)
        console.log(`[publishResult] Completed match result email dispatch for ${scrim.title}.`)
      }
    } catch (teamQueryErr) {
      console.error("[publishResult] Failed to query registered teams for result email notification:", teamQueryErr)
    }

    await logActivity(staff.id, staff.role, "publish_result", scrim.title, {
      winner: parsed.data.winningTeam,
      category: parsed.data.category,
    })

    revalidatePath("/admin/results")
    revalidatePath("/results")
    revalidatePath("/dashboard/results")
    return { ok: true, error: null }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" }
  }
}

export async function markPrizeSent(resultId: string) {
  const admin = await requireAdmin()
  await db.update(results).set({ prizeStatus: "sent" }).where(eq(results.id, resultId))
  await logActivity(admin.id, admin.role, "prize_sent", resultId)
  revalidatePath("/admin/results")
  revalidatePath("/dashboard/results")
}

const updateResultSchema = z.object({
  id: z.string().min(1),
  winningTeam: z.string().trim().min(1, "Winning team is required").max(100),
  kills: z.coerce.number().int().min(0).max(200),
  prizeBdt: z.coerce.number().int().min(0).max(100000),
  placement: z.coerce.number().int().min(1).max(12),
  category: z.string().default("Top 3 Prize Pool"),
  prizeStatus: z.enum(["pending", "sent"]).optional(),
})

export async function updateResult(_prev: unknown, formData: FormData) {
  try {
    const staff = await requireStaff()
    const parsed = updateResultSchema.safeParse({
      id: formData.get("id"),
      winningTeam: formData.get("winningTeam"),
      kills: formData.get("kills"),
      prizeBdt: formData.get("prizeBdt"),
      placement: formData.get("placement"),
      category: formData.get("category") || "Top 3 Prize Pool",
      prizeStatus: formData.get("prizeStatus") || "pending",
    })
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
    }

    const { id, winningTeam, kills, prizeBdt, placement, category, prizeStatus } = parsed.data

    const rows = await db.select().from(results).where(eq(results.id, id)).limit(1)
    const existing = rows[0]
    if (!existing) return { ok: false, error: "Result record not found" }

    // Multi-image upload handling if new screenshots provided
    const uploadedUrls: string[] = []
    const imageUrlsJson = formData.get("imageUrlsJson") as string | null
    if (imageUrlsJson) {
      try {
        const parsedUrls = JSON.parse(imageUrlsJson)
        if (Array.isArray(parsedUrls)) {
          uploadedUrls.push(...parsedUrls.filter((u): u is string => typeof u === "string"))
        }
      } catch {}
    }

    let finalImageUrls = (existing.imageUrls as string[]) || []
    if (uploadedUrls.length > 0) {
      finalImageUrls = uploadedUrls
    }

    const primaryScreenshotUrl = finalImageUrls[0] || existing.screenshotUrl
    const mvpPlayerName = (formData.get("mvpPlayerName") as string | null)?.trim() || existing.mvpPlayerName
    const mvpTeamName = (formData.get("mvpTeamName") as string | null)?.trim() || existing.mvpTeamName

    await db
      .update(results)
      .set({
        winningTeam,
        mvpPlayerName,
        mvpTeamName,
        kills,
        prizeBdt,
        placement,
        category,
        prizeStatus: prizeStatus || existing.prizeStatus,
        screenshotUrl: primaryScreenshotUrl,
        imageUrls: finalImageUrls,
      })
      .where(eq(results.id, id))

    await logActivity(staff.id, staff.role, "update_result", id, {
      winner: winningTeam,
      category,
    })

    revalidatePath("/admin/results")
    revalidatePath("/results")
    revalidatePath("/dashboard/results")
    return { ok: true, error: null }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update result" }
  }
}

export async function deleteResult(resultId: string) {
  try {
    const staff = await requireStaff()
    await db
      .update(results)
      .set({
        isTrashed: true,
        deletedAt: new Date(),
      })
      .where(eq(results.id, resultId))
    await logActivity(staff.id, staff.role, "soft_delete_result", resultId)
    revalidatePath("/admin/results")
    revalidatePath("/admin/trash")
    revalidatePath("/results")
    revalidatePath("/dashboard/results")
    return { ok: true, error: null }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to delete result" }
  }
}

export async function deleteBroadcast(notificationId: string) {
  try {
    const staff = await requireStaff()
    const { notifications } = await import("@/lib/db/schema")
    await db.delete(notifications).where(eq(notifications.id, notificationId))
    await logActivity(staff.id, staff.role, "delete_broadcast", notificationId)
    revalidatePath("/dashboard/notifications")
    revalidatePath("/admin/announcements")
    return { ok: true, error: null }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to delete broadcast" }
  }
}
