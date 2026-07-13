"use server"

import { randomUUID } from "crypto"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { scrims, results } from "@/lib/db/schema"
import { requireStaff } from "@/lib/session"
import { notifyScrimParticipants, logActivity } from "@/lib/notify"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { put } from "@vercel/blob"

// ─────────────────────────────────────────────────────────────────────────
// Staff actions: available to BOTH moderators and admins.
// Moderators may ONLY publish room credentials and results.
// ─────────────────────────────────────────────────────────────────────────

const roomSchema = z.object({
  scrimId: z.string().min(1),
  roomId: z.string().trim().min(1, "Room ID is required").max(50),
  roomPassword: z.string().trim().min(1, "Password is required").max(50),
})

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

    const rows = await db.select().from(scrims).where(eq(scrims.id, scrimId)).limit(1)
    const scrim = rows[0]
    if (!scrim) return { ok: false, error: "Scrim not found" }

    await db
      .update(scrims)
      .set({ roomId, roomPassword, roomPublished: true, updatedAt: new Date() })
      .where(eq(scrims.id, scrimId))

    await notifyScrimParticipants(
      scrimId,
      "room",
      `Room details published for ${scrim.title}`,
      `Room ID and password for the ${scrim.startTime} scrim are now visible in your dashboard.`,
      "/dashboard/scrims",
    )
    await logActivity(staff.id, staff.role, "publish_room", scrim.title)

    revalidatePath("/admin/scrims")
    revalidatePath("/dashboard/scrims")
    return { ok: true, error: null }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" }
  }
}

export async function unpublishRoom(scrimId: string) {
  const staff = await requireStaff()
  await db
    .update(scrims)
    .set({ roomPublished: false, updatedAt: new Date() })
    .where(eq(scrims.id, scrimId))
  await logActivity(staff.id, staff.role, "unpublish_room", scrimId)
  revalidatePath("/admin/scrims")
  revalidatePath("/dashboard/scrims")
}

const resultSchema = z.object({
  scrimId: z.string().min(1),
  winningTeam: z.string().trim().min(1, "Winning team is required").max(100),
  kills: z.coerce.number().int().min(0).max(200),
  prizeBdt: z.coerce.number().int().min(0).max(100000),
  placement: z.coerce.number().int().min(1).max(12),
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
    })
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
    }

    const rows = await db.select().from(scrims).where(eq(scrims.id, parsed.data.scrimId)).limit(1)
    const scrim = rows[0]
    if (!scrim) return { ok: false, error: "Scrim not found" }

    // Optional screenshot upload (moderators are allowed to upload result proof)
    let screenshotUrl: string | null = null
    const file = formData.get("screenshot")
    if (file instanceof File && file.size > 0) {
      if (file.size > 4 * 1024 * 1024) return { ok: false, error: "Screenshot must be under 4MB" }
      if (!file.type.startsWith("image/")) return { ok: false, error: "Screenshot must be an image" }
      const blob = await put(`results/${randomUUID()}-${file.name}`, file, { access: "public" })
      screenshotUrl = blob.url
    }

    await db.insert(results).values({
      id: randomUUID(),
      scrimId: scrim.id,
      winningTeam: parsed.data.winningTeam,
      kills: parsed.data.kills,
      prizeBdt: parsed.data.prizeBdt,
      placement: parsed.data.placement,
      screenshotUrl,
      matchDate: scrim.scrimDate,
      publishedBy: staff.id,
    })

    await db
      .update(scrims)
      .set({ status: "completed", updatedAt: new Date() })
      .where(eq(scrims.id, scrim.id))

    await notifyScrimParticipants(
      scrim.id,
      "result",
      `Results published for ${scrim.title}`,
      `${parsed.data.winningTeam} won with ${parsed.data.kills} kills. Check the results page.`,
      "/results",
    )
    await logActivity(staff.id, staff.role, "publish_result", scrim.title, {
      winner: parsed.data.winningTeam,
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
  const staff = await requireStaff()
  await db.update(results).set({ prizeStatus: "sent" }).where(eq(results.id, resultId))
  await logActivity(staff.id, staff.role, "prize_sent", resultId)
  revalidatePath("/admin/results")
  revalidatePath("/dashboard/results")
}
