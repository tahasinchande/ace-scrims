"use server"

import { randomUUID } from "crypto"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { imageRequests, bookings, scrims, user } from "@/lib/db/schema"
import { eq, and, desc } from "drizzle-orm"
import { getSessionUser, requireUser } from "@/lib/session"
import { notifyUser } from "@/lib/notify"
import { sendMvpImageRequestEmail } from "@/lib/email"

export type ImageRequestState = {
  ok: boolean
  message?: string
  error?: string
}

export type RequestTeamImageOptions = {
  mvpPlayerName?: string | null
  requestType?: string | null
  scrimDate?: string | null
}

/**
 * Admin action: Request MVP image or winner assets from a registered team
 */
export async function requestTeamImage(
  bookingId: string,
  optionsOrMvpName?: RequestTeamImageOptions | string
): Promise<ImageRequestState> {
  const admin = await getSessionUser()
  if (!admin || (admin.role !== "admin" && admin.role !== "moderator")) {
    return { ok: false, error: "Unauthorized. Staff privileges required." }
  }

  const options: RequestTeamImageOptions =
    typeof optionsOrMvpName === "string"
      ? { mvpPlayerName: optionsOrMvpName }
      : optionsOrMvpName || {}

  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1)

  if (!booking) {
    return { ok: false, error: "Booking not found." }
  }

  const [scrim] = await db
    .select()
    .from(scrims)
    .where(eq(scrims.id, booking.scrimId))
    .limit(1)

  const scrimTitle = scrim?.title || "Match Scrim"
  const mvpPlayerName = options.mvpPlayerName?.trim() || null
  const requestType = options.requestType || "MVP Image"
  const scrimDate = options.scrimDate?.trim() || booking.scrimDate || null

  // Check if an open/pending request already exists for this booking
  const existingRequests = await db
    .select()
    .from(imageRequests)
    .where(and(eq(imageRequests.bookingId, bookingId), eq(imageRequests.status, "pending")))
    .limit(1)

  const requestId = existingRequests[0]?.id || randomUUID()

  if (existingRequests.length === 0) {
    await db.insert(imageRequests).values({
      id: requestId,
      scrimId: booking.scrimId,
      scrimTitle,
      bookingId: booking.id,
      userId: booking.userId,
      teamName: booking.teamName,
      captainName: booking.captainName,
      captainUid: booking.captainUid,
      mvpPlayerName,
      scrimDate,
      status: "pending",
      requestType,
      requestedBy: admin.id,
      requestedAt: new Date(),
    })
  } else {
    // Update existing pending request with new MVP player name or request type
    await db
      .update(imageRequests)
      .set({
        mvpPlayerName: mvpPlayerName || existingRequests[0].mvpPlayerName,
        requestType,
        scrimDate: scrimDate || existingRequests[0].scrimDate,
        updatedAt: new Date(),
      })
      .where(eq(imageRequests.id, existingRequests[0].id))
  }

  // Update booking record
  await db
    .update(bookings)
    .set({
      imageRequested: true,
      imageRequestedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, booking.id))

  // Send automated email notification to user
  const [userRecord] = await db
    .select({ email: user.email, name: user.name })
    .from(user)
    .where(eq(user.id, booking.userId))
    .limit(1)

  if (userRecord?.email) {
    try {
      await sendMvpImageRequestEmail({
        to: userRecord.email,
        recipientName: userRecord.name || booking.captainName,
        teamName: booking.teamName,
        scrimTitle,
        mvpPlayerName,
        requestType,
        scrimDate,
      })
    } catch (e) {
      console.warn("[requestTeamImage] Email sending error:", e)
    }
  }

  // Notify user in app
  const targetLabel = mvpPlayerName ? `for player "${mvpPlayerName}" (${booking.teamName})` : `for squad "${booking.teamName}"`
  await notifyUser(
    booking.userId,
    "image_request",
    `${requestType} Requested!`,
    `Congratulations! Management has requested a waist-up banner photo ${targetLabel} from ${scrimTitle}${scrimDate ? ` (${scrimDate})` : ""}. Please upload it on your Dashboard.`,
    "/dashboard/image-requests"
  )

  revalidatePath("/admin/scrims")
  revalidatePath("/admin/history")
  revalidatePath("/admin/image-requests")
  revalidatePath("/admin/results")
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/image-requests")

  return {
    ok: true,
    message: `${requestType} requested for "${booking.teamName}"${mvpPlayerName ? ` (Player: ${mvpPlayerName})` : ""}. Notification sent.`,
  }
}

/**
 * User action: Submit photos for a pending image request
 */
export async function submitPendingImageRequest(payload: {
  requestId: string
  teamName: string
  playerUid: string
  playerName?: string | null
  mvpPlayerName?: string | null
  imageUrls: string[]
  notes?: string
}): Promise<ImageRequestState> {
  const currentUser = await requireUser()

  if (!payload.requestId) {
    return { ok: false, error: "Missing request ID." }
  }
  if (!payload.teamName.trim()) {
    return { ok: false, error: "Team Name is required." }
  }
  if (!payload.playerUid.trim()) {
    return { ok: false, error: "Player UID is required." }
  }
  if (!payload.imageUrls || payload.imageUrls.length === 0) {
    return { ok: false, error: "Please upload at least one image." }
  }

  const [request] = await db
    .select()
    .from(imageRequests)
    .where(and(eq(imageRequests.id, payload.requestId), eq(imageRequests.userId, currentUser.id)))
    .limit(1)

  if (!request) {
    return { ok: false, error: "Image request not found or you are not authorized to submit for it." }
  }

  const submittedPlayer = payload.playerName?.trim() || payload.mvpPlayerName?.trim() || null

  await db
    .update(imageRequests)
    .set({
      submittedTeamName: payload.teamName.trim(),
      submittedPlayerUid: payload.playerUid.trim(),
      submittedPlayerName: submittedPlayer,
      uploadedImageUrls: payload.imageUrls,
      notes: payload.notes?.trim() || null,
      status: "submitted",
      submittedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(imageRequests.id, request.id))

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/image-requests")
  revalidatePath("/admin/scrims")
  revalidatePath("/admin/history")
  revalidatePath("/admin/image-requests")
  revalidatePath("/admin/results")

  return {
    ok: true,
    message: "Image submitted successfully! Our production team will craft your banner showcase.",
  }
}

/**
 * Fetch pending image requests for a user
 */
export async function getUserPendingImageRequests(userId: string) {
  try {
    const rows = await db
      .select()
      .from(imageRequests)
      .where(and(eq(imageRequests.userId, userId), eq(imageRequests.status, "pending")))
      .orderBy(desc(imageRequests.requestedAt))
    return rows
  } catch (err) {
    console.error("[Image Requests] Failed to fetch for user:", err)
    return []
  }
}

/**
 * Fetch all image requests for a specific user (both pending and completed)
 */
export async function getUserAllImageRequests(userId: string) {
  try {
    const rows = await db
      .select()
      .from(imageRequests)
      .where(eq(imageRequests.userId, userId))
      .orderBy(desc(imageRequests.requestedAt))
    return rows
  } catch (err) {
    console.error("[Image Requests] Failed to fetch all user requests:", err)
    return []
  }
}

/**
 * Fetch all image requests for admin management
 */
export async function getAllImageRequests() {
  try {
    const rows = await db
      .select()
      .from(imageRequests)
      .orderBy(desc(imageRequests.requestedAt))
    return rows
  } catch (err) {
    console.error("[Image Requests] Failed to fetch all:", err)
    return []
  }
}
