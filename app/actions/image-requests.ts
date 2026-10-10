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

/**
 * Admin action: Request MVP image from a registered team
 */
export async function requestTeamImage(bookingId: string): Promise<ImageRequestState> {
  const admin = await getSessionUser()
  if (!admin || (admin.role !== "admin" && admin.role !== "moderator")) {
    return { ok: false, error: "Unauthorized. Staff privileges required." }
  }

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
      status: "pending",
      requestType: "MVP Image",
      requestedBy: admin.id,
      requestedAt: new Date(),
    })
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
      })
    } catch (e) {
      console.warn("[requestTeamImage] Email sending error:", e)
    }
  }

  // Notify user in app
  await notifyUser(
    booking.userId,
    "image_request",
    "MVP Image Requested!",
    `Congratulations! Management has requested an MVP waist-up banner photo for "${booking.teamName}" (${scrimTitle}). Please upload it on your Dashboard.`,
    "/dashboard/image-requests"
  )

  revalidatePath("/admin/scrims")
  revalidatePath("/admin/results")
  revalidatePath("/dashboard")
  revalidatePath("/dashboard/image-requests")

  return {
    ok: true,
    message: `MVP image requested for "${booking.teamName}". Email notification sent to user.`,
  }
}

/**
 * User action: Submit photos for a pending image request
 */
export async function submitPendingImageRequest(payload: {
  requestId: string
  teamName: string
  playerUid: string
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

  await db
    .update(imageRequests)
    .set({
      submittedTeamName: payload.teamName.trim(),
      submittedPlayerUid: payload.playerUid.trim(),
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
