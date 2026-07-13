"use server"

import { db } from "@/lib/db"
import { notifications, user as userTable } from "@/lib/db/schema"
import { and, eq } from "drizzle-orm"
import { requireUser } from "@/lib/session"
import { revalidatePath } from "next/cache"
import { z } from "zod"

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

export async function updateProfileName(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const user = await requireUser()
  const parsed = nameSchema.safeParse(formData.get("name"))
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid name" }
  }
  await db
    .update(userTable)
    .set({ name: parsed.data, updatedAt: new Date() })
    .where(eq(userTable.id, user.id))
  revalidatePath("/dashboard/settings")
  return { ok: true, message: "Profile updated." }
}
