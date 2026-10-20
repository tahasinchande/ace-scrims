"use server"

import { db } from "@/lib/db"
import { notices } from "@/lib/db/schema"
import { requireAdmin } from "@/lib/session"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { randomUUID } from "crypto"
import { z } from "zod"

const noticeSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters.").max(120, "Title cannot exceed 120 characters."),
  content: z.string().trim().min(5, "Content description must be at least 5 characters.").max(5000, "Content cannot exceed 5000 characters."),
  category: z.string().trim().default("General"),
  priority: z.enum(["normal", "important", "urgent"]).default("normal"),
  mediaUrl: z.string().trim().optional().nullable(),
  mediaType: z.enum(["none", "image", "video"]).default("none"),
  isPinned: z.boolean().default(false),
})

export async function createNoticeAction(
  prevState: any,
  formData: FormData
): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    const admin = await requireAdmin()

    const rawTitle = (formData.get("title") as string) || ""
    const rawContent = (formData.get("content") as string) || ""
    const rawCategory = (formData.get("category") as string) || "General"
    const rawPriority = (formData.get("priority") as string) || "normal"
    const rawMediaUrl = (formData.get("mediaUrl") as string) || ""
    let rawMediaType = (formData.get("mediaType") as string) || "none"
    const isPinned = formData.get("isPinned") === "true" || formData.get("isPinned") === "on"

    // Auto-detect media type if url is provided and mediaType wasn't explicitly set
    if (rawMediaUrl && rawMediaType === "none") {
      if (
        rawMediaUrl.match(/\.(mp4|webm|mov|mkv)$/i) ||
        rawMediaUrl.includes("youtube.com") ||
        rawMediaUrl.includes("youtu.be") ||
        rawMediaUrl.includes("vimeo.com")
      ) {
        rawMediaType = "video"
      } else {
        rawMediaType = "image"
      }
    }

    const parsed = noticeSchema.safeParse({
      title: rawTitle,
      content: rawContent,
      category: rawCategory,
      priority: rawPriority,
      mediaUrl: rawMediaUrl || null,
      mediaType: rawMediaType,
      isPinned,
    })

    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message || "Validation failed" }
    }

    const data = parsed.data
    const newId = `notice_${Date.now()}_${randomUUID().slice(0, 6)}`

    await db.insert(notices).values({
      id: newId,
      title: data.title,
      content: data.content,
      category: data.category,
      priority: data.priority,
      mediaUrl: data.mediaUrl || null,
      mediaType: data.mediaType,
      isPinned: data.isPinned,
      isPublished: true,
      authorId: admin.id,
      authorName: admin.name || "Ace Scrims Administration",
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    revalidatePath("/admin/notices")
    revalidatePath("/dashboard/notices")
    revalidatePath("/dashboard")
    revalidatePath("/")

    return { ok: true, message: "Notice published successfully!" }
  } catch (err: any) {
    console.error("[createNoticeAction Error]:", err)
    return { ok: false, error: err?.message || "Failed to publish notice" }
  }
}

export async function updateNoticeAction(
  id: string,
  formData: FormData
): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    await requireAdmin()

    if (!id) return { ok: false, error: "Notice ID required" }

    const rawTitle = (formData.get("title") as string) || ""
    const rawContent = (formData.get("content") as string) || ""
    const rawCategory = (formData.get("category") as string) || "General"
    const rawPriority = (formData.get("priority") as string) || "normal"
    const rawMediaUrl = (formData.get("mediaUrl") as string) || ""
    let rawMediaType = (formData.get("mediaType") as string) || "none"
    const isPinned = formData.get("isPinned") === "true" || formData.get("isPinned") === "on"

    if (rawMediaUrl && rawMediaType === "none") {
      if (
        rawMediaUrl.match(/\.(mp4|webm|mov|mkv)$/i) ||
        rawMediaUrl.includes("youtube.com") ||
        rawMediaUrl.includes("youtu.be") ||
        rawMediaUrl.includes("vimeo.com")
      ) {
        rawMediaType = "video"
      } else {
        rawMediaType = "image"
      }
    }

    const parsed = noticeSchema.safeParse({
      title: rawTitle,
      content: rawContent,
      category: rawCategory,
      priority: rawPriority,
      mediaUrl: rawMediaUrl || null,
      mediaType: rawMediaType,
      isPinned,
    })

    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message || "Validation failed" }
    }

    const data = parsed.data

    await db
      .update(notices)
      .set({
        title: data.title,
        content: data.content,
        category: data.category,
        priority: data.priority,
        mediaUrl: data.mediaUrl || null,
        mediaType: data.mediaType,
        isPinned: data.isPinned,
        updatedAt: new Date(),
      })
      .where(eq(notices.id, id))

    revalidatePath("/admin/notices")
    revalidatePath("/dashboard/notices")
    revalidatePath("/dashboard")
    revalidatePath("/")

    return { ok: true, message: "Notice updated successfully!" }
  } catch (err: any) {
    console.error("[updateNoticeAction Error]:", err)
    return { ok: false, error: err?.message || "Failed to update notice" }
  }
}

export async function deleteNoticeAction(
  id: string
): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    await requireAdmin()

    if (!id) return { ok: false, error: "Notice ID required" }

    await db.delete(notices).where(eq(notices.id, id))

    revalidatePath("/admin/notices")
    revalidatePath("/dashboard/notices")
    revalidatePath("/dashboard")
    revalidatePath("/")

    return { ok: true, message: "Notice deleted successfully" }
  } catch (err: any) {
    console.error("[deleteNoticeAction Error]:", err)
    return { ok: false, error: err?.message || "Failed to delete notice" }
  }
}

export async function togglePinNoticeAction(
  id: string,
  currentPinned: boolean
): Promise<{ ok: boolean; message?: string; error?: string }> {
  try {
    await requireAdmin()

    if (!id) return { ok: false, error: "Notice ID required" }

    await db
      .update(notices)
      .set({
        isPinned: !currentPinned,
        updatedAt: new Date(),
      })
      .where(eq(notices.id, id))

    revalidatePath("/admin/notices")
    revalidatePath("/dashboard/notices")
    revalidatePath("/dashboard")
    revalidatePath("/")

    return {
      ok: true,
      message: !currentPinned ? "Notice pinned to top" : "Notice unpinned",
    }
  } catch (err: any) {
    console.error("[togglePinNoticeAction Error]:", err)
    return { ok: false, error: err?.message || "Failed to toggle pin" }
  }
}
