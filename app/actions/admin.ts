"use server"

import { randomUUID } from "crypto"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { scrims, user, settings, notifications, bookings } from "@/lib/db/schema"
import { requireAdmin } from "@/lib/session"
import { logActivity } from "@/lib/notify"
import { eq, ne, and } from "drizzle-orm"
import { z } from "zod"
import { put } from "@vercel/blob"

// ─────────────────────────────────────────────────────────────────────────
// Admin-only actions. Every function begins with requireAdmin().
// ─────────────────────────────────────────────────────────────────────────

const scrimSchema = z.object({
  title: z.string().trim().min(3).max(80),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  rules: z.string().trim().max(4000).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  map: z.enum(["Bermuda", "Purgatory", "Kalahari", "Alpine", "NeXTerra"]),
  mode: z.string().trim().min(2).max(40),
  startTime: z.string().trim().min(4).max(10),
  priceBdt: z.coerce.number().int().min(0).max(10000),
  prizePoolBdt: z.coerce.number().int().min(0).max(1000000),
  maxTeams: z.coerce.number().int().min(2).max(48),
})

function slugify(title: string) {
  return `${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}-${randomUUID().slice(0, 6)}`
}

async function maybeUploadBanner(formData: FormData): Promise<string | null> {
  const file = formData.get("banner")
  if (file instanceof File && file.size > 0) {
    if (file.size > 4 * 1024 * 1024) throw new Error("Banner must be under 4MB")
    if (!file.type.startsWith("image/")) throw new Error("Banner must be an image")
    const blob = await put(`banners/${randomUUID()}-${file.name}`, file, { access: "public" })
    return blob.url
  }
  return null
}

function parseScrimForm(formData: FormData) {
  return scrimSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    rules: formData.get("rules"),
    notes: formData.get("notes"),
    map: formData.get("map"),
    mode: formData.get("mode"),
    startTime: formData.get("startTime"),
    priceBdt: formData.get("priceBdt"),
    prizePoolBdt: formData.get("prizePoolBdt"),
    maxTeams: formData.get("maxTeams"),
  })
}

export async function createScrim(_prev: unknown, formData: FormData) {
  try {
    const admin = await requireAdmin()
    const parsed = parseScrimForm(formData)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
    }
    const bannerUrl = await maybeUploadBanner(formData)
    const d = parsed.data

    await db.insert(scrims).values({
      id: randomUUID(),
      title: d.title,
      slug: slugify(d.title),
      description: d.description || null,
      rules: d.rules || null,
      notes: d.notes || null,
      map: d.map,
      mode: d.mode,
      startTime: d.startTime,
      scrimDate: new Date().toISOString().slice(0, 10),
      priceBdt: d.priceBdt,
      prizePoolBdt: d.prizePoolBdt,
      maxTeams: d.maxTeams,
      bannerUrl,
    })

    await logActivity(admin.id, "admin", "create_scrim", d.title)
    revalidatePath("/admin/scrims")
    revalidatePath("/scrims")
    revalidatePath("/")
    return { ok: true, error: null }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" }
  }
}

export async function updateScrim(_prev: unknown, formData: FormData) {
  try {
    const admin = await requireAdmin()
    const scrimId = String(formData.get("scrimId") ?? "")
    if (!scrimId) return { ok: false, error: "Missing scrim ID" }
    const parsed = parseScrimForm(formData)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
    }
    const bannerUrl = await maybeUploadBanner(formData)
    const d = parsed.data

    await db
      .update(scrims)
      .set({
        title: d.title,
        description: d.description || null,
        rules: d.rules || null,
        notes: d.notes || null,
        map: d.map,
        mode: d.mode,
        startTime: d.startTime,
        priceBdt: d.priceBdt,
        prizePoolBdt: d.prizePoolBdt,
        maxTeams: d.maxTeams,
        ...(bannerUrl ? { bannerUrl } : {}),
        updatedAt: new Date(),
      })
      .where(eq(scrims.id, scrimId))

    await logActivity(admin.id, "admin", "update_scrim", d.title)
    revalidatePath("/admin/scrims")
    revalidatePath("/scrims")
    revalidatePath("/")
    return { ok: true, error: null }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" }
  }
}

export async function deleteScrim(scrimId: string) {
  const admin = await requireAdmin()
  // Refuse to delete a scrim that has confirmed bookings — cancel it instead.
  const confirmed = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(and(eq(bookings.scrimId, scrimId), eq(bookings.status, "confirmed")))
    .limit(1)
  if (confirmed.length > 0) {
    throw new Error("Cannot delete a scrim with confirmed bookings")
  }
  await db.delete(scrims).where(eq(scrims.id, scrimId))
  await logActivity(admin.id, "admin", "delete_scrim", scrimId)
  revalidatePath("/admin/scrims")
  revalidatePath("/scrims")
  revalidatePath("/")
}

export async function toggleRegistration(scrimId: string, open: boolean) {
  const admin = await requireAdmin()
  await db
    .update(scrims)
    .set({ registrationOpen: open, updatedAt: new Date() })
    .where(eq(scrims.id, scrimId))
  await logActivity(admin.id, "admin", open ? "open_registration" : "close_registration", scrimId)
  revalidatePath("/admin/scrims")
  revalidatePath("/scrims")
  revalidatePath("/")
}

// ── User management ─────────────────────────────────────────────────────

export async function setUserRole(userId: string, role: "user" | "moderator" | "admin") {
  const admin = await requireAdmin()
  if (userId === admin.id) throw new Error("You cannot change your own role")
  await db.update(user).set({ role, updatedAt: new Date() }).where(eq(user.id, userId))
  await logActivity(admin.id, "admin", "set_role", userId, { role })
  revalidatePath("/admin/users")
}

export async function setUserBanned(userId: string, banned: boolean) {
  const admin = await requireAdmin()
  if (userId === admin.id) throw new Error("You cannot ban yourself")
  await db.update(user).set({ banned, updatedAt: new Date() }).where(eq(user.id, userId))
  await logActivity(admin.id, "admin", banned ? "ban_user" : "unban_user", userId)
  revalidatePath("/admin/users")
}

// ── Settings & announcements ────────────────────────────────────────────

export async function setSetting(key: string, value: string) {
  const admin = await requireAdmin()
  const allowed = ["announcement", "discord_url", "facebook_url", "support_phone"]
  if (!allowed.includes(key)) throw new Error("Unknown setting")
  await db
    .insert(settings)
    .values({ key, value, updatedAt: new Date() })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } })
  await logActivity(admin.id, "admin", "update_setting", key)
  revalidatePath("/")
  revalidatePath("/admin/settings")
}

const broadcastSchema = z.object({
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().max(500).optional().or(z.literal("")),
})

export async function broadcastNotification(_prev: unknown, formData: FormData) {
  try {
    const admin = await requireAdmin()
    const parsed = broadcastSchema.safeParse({
      title: formData.get("title"),
      body: formData.get("body"),
    })
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
    }
    const users = await db
      .select({ id: user.id })
      .from(user)
      .where(ne(user.banned, true))
    if (users.length > 0) {
      await db.insert(notifications).values(
        users.map((u) => ({
          id: randomUUID(),
          userId: u.id,
          type: "announcement",
          title: parsed.data.title,
          body: parsed.data.body || null,
        })),
      )
    }
    await logActivity(admin.id, "admin", "broadcast", parsed.data.title)
    revalidatePath("/dashboard/notifications")
    return { ok: true, error: null }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" }
  }
}
