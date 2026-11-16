"use server"

import { randomUUID } from "crypto"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { tutorials } from "@/lib/db/schema"
import { requireAdmin } from "@/lib/session"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { parseVideoEmbed } from "@/lib/video-parser"
import { isSafeHttpOrRelativeUrl } from "@/lib/url-safety"

const tutorialSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(150),
  description: z.string().trim().max(2000).optional().nullable(),
  videoUrl: z.string().trim().min(5, "A valid video URL is required"),
})

export type TutorialResult = {
  ok: boolean
  error: string | null
}

/**
 * Creates a new tutorial video.
 * Bypasses file transfers entirely on the server to prevent Vercel 413 Payload Too Large errors.
 * Accepts the final Cloudinary / video URL as a string.
 */
export async function addTutorial(_prev: unknown, formData: FormData): Promise<TutorialResult> {
  try {
    const admin = await requireAdmin()

    const rawTitle = formData.get("title")
    const rawDescription = formData.get("description")
    const rawUrl = formData.get("videoUrl") || formData.get("urlInput")

    const parsed = tutorialSchema.safeParse({
      title: typeof rawTitle === "string" ? rawTitle : "",
      description: typeof rawDescription === "string" && rawDescription.trim().length > 0 ? rawDescription.trim() : null,
      videoUrl: typeof rawUrl === "string" ? rawUrl : "",
    })

    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return { ok: false, error: issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid tutorial data" }
    }

    const normalizedUrl = parseVideoEmbed(parsed.data.videoUrl).embedUrl || parsed.data.videoUrl
    if (!isSafeHttpOrRelativeUrl(normalizedUrl) || !isSafeHttpOrRelativeUrl(parsed.data.videoUrl)) {
      return { ok: false, error: "Invalid video URL scheme. Only HTTP/HTTPS or relative paths are allowed." }
    }

    await db.insert(tutorials).values({
      id: randomUUID(),
      title: parsed.data.title,
      description: parsed.data.description,
      videoUrl: normalizedUrl,
      publishedBy: admin.id,
    })

    revalidatePath("/tutorial")
    revalidatePath("/admin/tutorials")
    return { ok: true, error: null }
  } catch (e) {
    console.error("[Tutorials Action] Failed to add tutorial:", e)
    return { ok: false, error: e instanceof Error ? e.message : "Failed to add tutorial" }
  }
}

/**
 * Updates an existing tutorial video.
 * Accepts title, description, and the final video URL string.
 */
export async function updateTutorial(tutorialId: string, formData: FormData): Promise<TutorialResult> {
  try {
    await requireAdmin()

    const rawTitle = formData.get("title")
    const rawDescription = formData.get("description")
    const rawUrl = formData.get("videoUrl") || formData.get("urlInput")

    const parsed = tutorialSchema.safeParse({
      title: typeof rawTitle === "string" ? rawTitle : "",
      description: typeof rawDescription === "string" && rawDescription.trim().length > 0 ? rawDescription.trim() : null,
      videoUrl: typeof rawUrl === "string" ? rawUrl : "",
    })

    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return { ok: false, error: issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid tutorial data" }
    }

    const normalizedUrl = parseVideoEmbed(parsed.data.videoUrl).embedUrl || parsed.data.videoUrl
    if (!isSafeHttpOrRelativeUrl(normalizedUrl) || !isSafeHttpOrRelativeUrl(parsed.data.videoUrl)) {
      return { ok: false, error: "Invalid video URL scheme. Only HTTP/HTTPS or relative paths are allowed." }
    }

    await db
      .update(tutorials)
      .set({
        title: parsed.data.title,
        description: parsed.data.description,
        videoUrl: normalizedUrl,
      })
      .where(eq(tutorials.id, tutorialId))

    revalidatePath("/tutorial")
    revalidatePath("/admin/tutorials")
    return { ok: true, error: null }
  } catch (e) {
    console.error("[Tutorials Action] Failed to update tutorial:", e)
    return { ok: false, error: e instanceof Error ? e.message : "Failed to update tutorial" }
  }
}

/**
 * Deletes a tutorial video by ID.
 */
export async function deleteTutorial(tutorialId: string): Promise<TutorialResult> {
  try {
    await requireAdmin()
    await db.delete(tutorials).where(eq(tutorials.id, tutorialId))
    revalidatePath("/tutorial")
    revalidatePath("/admin/tutorials")
    return { ok: true, error: null }
  } catch (e) {
    console.error("[Tutorials Action] Failed to delete tutorial:", e)
    return { ok: false, error: e instanceof Error ? e.message : "Failed to delete tutorial" }
  }
}
