"use server"

import { randomUUID } from "crypto"
import { revalidatePath } from "next/cache"
import { asc, eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/lib/db"
import { partnershipItems } from "@/lib/db/schema"
import { requireAdmin, logActivity } from "@/lib/session"
import { isSafeHttpOrRelativeUrl } from "@/lib/url-safety"
import {
  savePartnershipMarqueeSettings,
  type PartnershipMarqueeSettings,
} from "@/lib/queries/partnerships"

const partnershipSchema = z.object({
  partnerName: z.string().trim().min(2, "Partner name is required").max(80),
  headline: z.string().trim().min(2, "Announcement text is required").max(160),
  tagline: z.string().trim().max(120).optional().or(z.literal("")),
  badgeText: z.string().trim().max(32).optional().or(z.literal("")),
  logoUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || isSafeHttpOrRelativeUrl(v, { allowImageDataUri: true }), {
      message: "Logo URL must be a valid https:// or relative image path.",
    }),
  linkUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || isSafeHttpOrRelativeUrl(v), {
      message: "Link URL must be a valid https:// or relative path.",
    }),
  isActive: z.boolean().optional(),
})

const marqueeSettingsSchema = z.object({
  enabled: z.boolean(),
  heading: z.string().trim().min(2, "Section heading is required").max(80),
  subheading: z.string().trim().max(180),
  speedSeconds: z.coerce.number().int().min(10).max(90),
  direction: z.enum(["left", "right"]),
  showBadges: z.boolean(),
})

function revalidatePartnershipPaths() {
  revalidatePath("/")
  revalidatePath("/partnerships")
  revalidatePath("/scrims")
  revalidatePath("/admin/partnerships")
}

export async function updatePartnershipMarqueeSettingsAction(
  input: PartnershipMarqueeSettings
) {
  const admin = await requireAdmin()
  const parsed = marqueeSettingsSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid marquee settings.",
    }
  }

  const saved = await savePartnershipMarqueeSettings(parsed.data)
  await logActivity(admin.id, admin.role, "partnerships.marquee_settings.update", "partnership_marquee_config", {
    enabled: saved.enabled,
    speedSeconds: saved.speedSeconds,
    direction: saved.direction,
  })
  revalidatePartnershipPaths()
  return { ok: true as const, settings: saved }
}

export async function createPartnershipItemAction(input: {
  partnerName: string
  headline: string
  tagline?: string
  badgeText?: string
  logoUrl?: string
  linkUrl?: string
  isActive?: boolean
}) {
  const admin = await requireAdmin()
  const parsed = partnershipSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid item." }
  }

  const existing = await db
    .select({ sortOrder: partnershipItems.sortOrder })
    .from(partnershipItems)
    .orderBy(asc(partnershipItems.sortOrder))
  const nextOrder =
    existing.length > 0 ? Math.max(...existing.map((e) => Number(e.sortOrder || 0))) + 1 : 0

  const id = randomUUID()
  await db.insert(partnershipItems).values({
    id,
    partnerName: parsed.data.partnerName,
    headline: parsed.data.headline,
    tagline: parsed.data.tagline || null,
    badgeText: parsed.data.badgeText || null,
    logoUrl: parsed.data.logoUrl || null,
    linkUrl: parsed.data.linkUrl || null,
    isActive: parsed.data.isActive ?? true,
    sortOrder: nextOrder,
  })

  await logActivity(admin.id, admin.role, "partnerships.create", id, {
    partnerName: parsed.data.partnerName,
  })
  revalidatePartnershipPaths()
  return { ok: true as const, id }
}

export async function updatePartnershipItemAction(
  id: string,
  input: {
    partnerName: string
    headline: string
    tagline?: string
    badgeText?: string
    logoUrl?: string
    linkUrl?: string
    isActive?: boolean
  }
) {
  const admin = await requireAdmin()
  const parsed = partnershipSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid item." }
  }

  await db
    .update(partnershipItems)
    .set({
      partnerName: parsed.data.partnerName,
      headline: parsed.data.headline,
      tagline: parsed.data.tagline || null,
      badgeText: parsed.data.badgeText || null,
      logoUrl: parsed.data.logoUrl || null,
      linkUrl: parsed.data.linkUrl || null,
      ...(typeof parsed.data.isActive === "boolean" ? { isActive: parsed.data.isActive } : {}),
      updatedAt: new Date(),
    })
    .where(eq(partnershipItems.id, id))

  await logActivity(admin.id, admin.role, "partnerships.update", id, {
    partnerName: parsed.data.partnerName,
  })
  revalidatePartnershipPaths()
  return { ok: true as const }
}

export async function togglePartnershipItemAction(id: string, isActive: boolean) {
  const admin = await requireAdmin()
  await db
    .update(partnershipItems)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(partnershipItems.id, id))

  await logActivity(admin.id, admin.role, "partnerships.toggle", id, { isActive })
  revalidatePartnershipPaths()
  return { ok: true as const }
}

export async function reorderPartnershipItemAction(id: string, direction: "up" | "down") {
  const admin = await requireAdmin()
  const all = await db
    .select({ id: partnershipItems.id, sortOrder: partnershipItems.sortOrder })
    .from(partnershipItems)
    .orderBy(asc(partnershipItems.sortOrder), asc(partnershipItems.createdAt))

  const idx = all.findIndex((item) => item.id === id)
  if (idx === -1) return { ok: false as const, error: "Item not found." }
  const swapIdx = direction === "up" ? idx - 1 : idx + 1
  if (swapIdx < 0 || swapIdx >= all.length) return { ok: true as const }

  const reordered = [...all]
  const [moved] = reordered.splice(idx, 1)
  reordered.splice(swapIdx, 0, moved)

  await Promise.all(
    reordered.map((item, newOrder) =>
      db
        .update(partnershipItems)
        .set({ sortOrder: newOrder, updatedAt: new Date() })
        .where(eq(partnershipItems.id, item.id))
    )
  )

  await logActivity(admin.id, admin.role, "partnerships.reorder", id, { direction })
  revalidatePartnershipPaths()
  return { ok: true as const }
}

export async function deletePartnershipItemAction(id: string) {
  const admin = await requireAdmin()
  await db.delete(partnershipItems).where(eq(partnershipItems.id, id))
  await logActivity(admin.id, admin.role, "partnerships.delete", id)
  revalidatePartnershipPaths()
  return { ok: true as const }
}
