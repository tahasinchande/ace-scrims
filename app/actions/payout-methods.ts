"use server"

import { randomUUID } from "crypto"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { db, ensureSchemaReady } from "@/lib/db"
import { payoutMethods, type PayoutMethod } from "@/lib/db/schema"
import { eq, ne, and } from "drizzle-orm"
import { requireAdmin, logActivity } from "@/lib/session"

const payoutMethodSchema = z.object({
  name: z.string().trim().min(2, "Method name must be at least 2 characters").max(40),
  code: z
    .string()
    .trim()
    .min(2, "Code must be at least 2 characters")
    .max(30)
    .regex(/^[a-zA-Z0-9_-]+$/, "Code may only contain letters, numbers, underscores, or hyphens"),
  label: z.string().trim().min(2, "Display label is required").max(60),
  description: z.string().trim().max(160).optional().default(""),
  accentColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Accent color must be a valid 6-digit hex color")
    .default("#f97316"),
  requiresAccountNumber: z.boolean().default(true),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(999).default(10),
})

export type PayoutMethodActionResult = {
  ok: boolean
  error?: string
  method?: PayoutMethod
}

function revalidatePayoutPaths() {
  revalidatePath("/admin/settings")
  revalidatePath("/dashboard/info-setup")
  revalidatePath("/book/[slug]", "page")
  revalidatePath("/dashboard")
}

export async function createPayoutMethodAction(
  input: z.input<typeof payoutMethodSchema>
): Promise<PayoutMethodActionResult> {
  try {
    const admin = await requireAdmin()
    await ensureSchemaReady()

    const parsed = payoutMethodSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message || "Invalid payout method data." }
    }

    const data = parsed.data
    const existing = await db
      .select({ id: payoutMethods.id })
      .from(payoutMethods)
      .where(eq(payoutMethods.code, data.code))
      .limit(1)

    if (existing.length > 0) {
      return { ok: false, error: `A payout method with code "${data.code}" already exists.` }
    }

    const newMethod: PayoutMethod = {
      id: `pm_${randomUUID().slice(0, 8)}`,
      name: data.name,
      code: data.code,
      label: data.label,
      description: data.description || null,
      accentColor: data.accentColor,
      requiresAccountNumber: data.requiresAccountNumber,
      isActive: data.isActive,
      sortOrder: data.sortOrder,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await db.insert(payoutMethods).values(newMethod)
    await logActivity(admin.id, admin.role, "create_payout_method", data.code, { name: data.name })
    revalidatePayoutPaths()

    return { ok: true, method: newMethod }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to create payout method." }
  }
}

export async function updatePayoutMethodAction(
  id: string,
  input: z.input<typeof payoutMethodSchema>
): Promise<PayoutMethodActionResult> {
  try {
    const admin = await requireAdmin()
    await ensureSchemaReady()

    if (!id) return { ok: false, error: "Missing payout method ID." }

    const parsed = payoutMethodSchema.safeParse(input)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message || "Invalid payout method data." }
    }

    const data = parsed.data

    const conflict = await db
      .select({ id: payoutMethods.id })
      .from(payoutMethods)
      .where(and(eq(payoutMethods.code, data.code), ne(payoutMethods.id, id)))
      .limit(1)

    if (conflict.length > 0) {
      return { ok: false, error: `Another payout method already uses code "${data.code}".` }
    }

    const [updated] = await db
      .update(payoutMethods)
      .set({
        name: data.name,
        code: data.code,
        label: data.label,
        description: data.description || null,
        accentColor: data.accentColor,
        requiresAccountNumber: data.requiresAccountNumber,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
        updatedAt: new Date(),
      })
      .where(eq(payoutMethods.id, id))
      .returning()

    if (!updated) {
      return { ok: false, error: "Payout method not found." }
    }

    await logActivity(admin.id, admin.role, "update_payout_method", data.code, { id, name: data.name })
    revalidatePayoutPaths()

    return { ok: true, method: updated }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to update payout method." }
  }
}

export async function togglePayoutMethodActiveAction(
  id: string,
  nextActive: boolean
): Promise<PayoutMethodActionResult> {
  try {
    const admin = await requireAdmin()
    await ensureSchemaReady()

    if (!nextActive) {
      const otherActive = await db
        .select({ id: payoutMethods.id })
        .from(payoutMethods)
        .where(and(eq(payoutMethods.isActive, true), ne(payoutMethods.id, id)))
        .limit(1)

      if (otherActive.length === 0) {
        return { ok: false, error: "At least one payout method must remain active." }
      }
    }

    const [updated] = await db
      .update(payoutMethods)
      .set({ isActive: nextActive, updatedAt: new Date() })
      .where(eq(payoutMethods.id, id))
      .returning()

    if (!updated) return { ok: false, error: "Payout method not found." }

    await logActivity(admin.id, admin.role, "toggle_payout_method", updated.code, { isActive: nextActive })
    revalidatePayoutPaths()

    return { ok: true, method: updated }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to update status." }
  }
}

export async function deletePayoutMethodAction(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const admin = await requireAdmin()
    await ensureSchemaReady()

    const otherActive = await db
      .select({ id: payoutMethods.id })
      .from(payoutMethods)
      .where(and(eq(payoutMethods.isActive, true), ne(payoutMethods.id, id)))
      .limit(1)

    if (otherActive.length === 0) {
      return { ok: false, error: "Cannot delete the last active payout method." }
    }

    const [deleted] = await db
      .delete(payoutMethods)
      .where(eq(payoutMethods.id, id))
      .returning({ code: payoutMethods.code })

    if (!deleted) return { ok: false, error: "Payout method not found." }

    await logActivity(admin.id, admin.role, "delete_payout_method", deleted.code, { id })
    revalidatePayoutPaths()

    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to delete payout method." }
  }
}
