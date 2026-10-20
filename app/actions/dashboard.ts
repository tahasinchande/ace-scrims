"use server"

import { db } from "@/lib/db"
import { notifications, user as userTable } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { requireUser } from "@/lib/session"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { saveUploadedFile } from "@/lib/upload"

export async function markNotificationRead(id: string): Promise<void> {
  const user = await requireUser()
  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.id, id), eq(notifications.userId, user.id)))
  revalidatePath("/dashboard/notifications")
}

export async function markAllNotificationsRead(): Promise<void> {
  const user = await requireUser()
  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.userId, user.id), eq(notifications.read, false)))
  revalidatePath("/dashboard/notifications")
}

const nameSchema = z.string().trim().min(2, "Name too short").max(50, "Name too long")

export type ProfileState = { ok: boolean; error?: string; message?: string }

export async function updateProfile(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  let userId: string | undefined
  try {
    const user = await requireUser()
    userId = user.id

    const parsed = nameSchema.safeParse(formData.get("name"))
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid display name" }
    }

    const removeAvatar = formData.get("removeAvatar") === "true"
    const avatarUrlInput = formData.get("avatarUrl") as string | null
    const avatarFile = formData.get("avatar")

    let updatedImageUrl: string | null | undefined = undefined

    if (removeAvatar) {
      updatedImageUrl = null
    } else if (typeof avatarUrlInput === "string" && avatarUrlInput.trim().length > 0) {
      const trimmedUrl = avatarUrlInput.trim()
      // Guard against oversized raw Base64 data strings being saved to the database
      if (trimmedUrl.startsWith("data:") && trimmedUrl.length > 500 * 1024) {
        return {
          ok: false,
          error: "Direct image payload exceeds safe database limits. Please upload via cloud storage.",
        }
      }
      updatedImageUrl = trimmedUrl
    } else if (avatarFile && avatarFile instanceof File && avatarFile.size > 0) {
      // Validate file size limit (10MB)
      if (avatarFile.size > 10 * 1024 * 1024) {
        return { ok: false, error: "Profile picture must be under 10MB." }
      }
      // Validate file type
      if (!avatarFile.type.startsWith("image/")) {
        return { ok: false, error: "Only image files (JPG, PNG, WEBP) are allowed." }
      }

      try {
        const uploadedUrl = await saveUploadedFile(avatarFile, "avatars")
        if (uploadedUrl.startsWith("data:") && uploadedUrl.length > 500 * 1024) {
          return {
            ok: false,
            error: "Image is too large for local storage. Please configure cloud storage or use a smaller image.",
          }
        }
        updatedImageUrl = uploadedUrl
      } catch (uploadErr: any) {
        console.error("[Update Profile] Avatar save error:", uploadErr)
        return {
          ok: false,
          error: uploadErr?.message || "Failed to process and store the uploaded avatar image.",
        }
      }
    }

    const updatePayload: { name: string; updatedAt: Date; image?: string | null } = {
      name: parsed.data,
      updatedAt: new Date(),
    }

    if (updatedImageUrl !== undefined) {
      updatePayload.image = updatedImageUrl
    }

    await db
      .update(userTable)
      .set(updatePayload)
      .where(eq(userTable.id, user.id))

    revalidatePath("/dashboard/settings")
    revalidatePath("/dashboard")
    return { ok: true, message: "Profile updated successfully." }
  } catch (err: any) {
    console.error("[Update Profile Server Action Error]", {
      userId,
      message: err?.message,
      stack: err?.stack,
      rawError: err,
    })
    return {
      ok: false,
      error: err?.message || "Failed to update profile due to an internal server error.",
    }
  }
}

// Helper for updating display name directly
export async function updateProfileName(name: string): Promise<ProfileState> {
  const fd = new FormData()
  fd.append("name", name)
  return updateProfile({ ok: true }, fd)
}

