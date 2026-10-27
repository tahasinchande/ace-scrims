"use server"

import { randomUUID } from "crypto"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { userDefaultInfo } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { requireUser } from "@/lib/session"

const defaultInfoSchema = z.object({
  teamName: z.string().trim().max(40).optional().default(""),
  teamTag: z.string().trim().max(10).optional().default(""),
  captainName: z.string().trim().max(40).optional().default(""),
  captainUid: z.string().trim().max(30).optional().default(""),
  phone: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || /^(\+?880|0)1[3-9]\d{8}$/.test(val), {
      message: "Please enter a valid Bangladeshi WhatsApp number (e.g. 01XXXXXXXXX)",
    })
    .default(""),
  paymentMethod: z.enum(["bKash", "Nagad", "Tap", "Balance"]).default("bKash"),
  paymentNumber: z.string().trim().max(50).optional().default(""),
  teamMembersDriveLink: z.string().trim().optional().default(""),
  teamLeaderImageUrl: z.string().trim().optional().default(""),
})

export type SaveDefaultInfoResult = {
  ok: boolean
  error?: string
  fieldErrors?: Record<string, string>
}

/**
 * Saves or updates permanent squad details for the authenticated user.
 */
export async function saveUserDefaultInfo(
  input: z.infer<typeof defaultInfoSchema>
): Promise<SaveDefaultInfoResult> {
  let sessionUser
  try {
    sessionUser = await requireUser()
  } catch {
    return { ok: false, error: "Please sign in to save your default squad information." }
  }

  const parsed = defaultInfoSchema.safeParse(input)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (typeof key === "string" && !fieldErrors[key]) {
        fieldErrors[key] = issue.message
      }
    }
    return { ok: false, error: "Please correct the highlighted fields.", fieldErrors }
  }

  const data = parsed.data

  try {
    const existing = await db
      .select({ id: userDefaultInfo.id })
      .from(userDefaultInfo)
      .where(eq(userDefaultInfo.userId, sessionUser.id))
      .limit(1)

    if (existing.length > 0) {
      await db
        .update(userDefaultInfo)
        .set({
          teamName: data.teamName || null,
          teamTag: data.teamTag || null,
          captainName: data.captainName || null,
          captainUid: data.captainUid || null,
          phone: data.phone || null,
          paymentMethod: data.paymentMethod,
          paymentNumber: data.paymentNumber || null,
          teamMembersDriveLink: data.teamMembersDriveLink || null,
          teamLeaderImageUrl: data.teamLeaderImageUrl || null,
          updatedAt: new Date(),
        })
        .where(eq(userDefaultInfo.userId, sessionUser.id))
    } else {
      await db.insert(userDefaultInfo).values({
        id: randomUUID(),
        userId: sessionUser.id,
        teamName: data.teamName || null,
        teamTag: data.teamTag || null,
        captainName: data.captainName || null,
        captainUid: data.captainUid || null,
        phone: data.phone || null,
        paymentMethod: data.paymentMethod,
        paymentNumber: data.paymentNumber || null,
        teamMembersDriveLink: data.teamMembersDriveLink || null,
        teamLeaderImageUrl: data.teamLeaderImageUrl || null,
      })
    }

    revalidatePath("/dashboard/info-setup")
    revalidatePath("/dashboard")
    revalidatePath("/book/[slug]", "page")

    return { ok: true }
  } catch (err: any) {
    console.error("[Database] Failed to save user default info:", err)
    return { ok: false, error: err?.message || "Failed to save info. Please try again." }
  }
}

/**
 * Programmatically auto-saves or updates default squad profile details for a user
 * whenever they submit a valid scrim registration.
 */
export async function autoSaveUserDefaultInfo(
  userId: string,
  details: {
    teamName?: string | null
    teamTag?: string | null
    captainName?: string | null
    captainUid?: string | null
    phone?: string | null
    paymentMethod?: "bKash" | "Nagad" | "Tap" | "Balance"
    paymentNumber?: string | null
    teamMembersDriveLink?: string | null
    teamLeaderImageUrl?: string | null
  }
): Promise<boolean> {
  if (!userId) return false
  try {
    const existing = await db
      .select({ id: userDefaultInfo.id })
      .from(userDefaultInfo)
      .where(eq(userDefaultInfo.userId, userId))
      .limit(1)

    const payload = {
      teamName: details.teamName?.trim() || null,
      teamTag: details.teamTag?.trim() || null,
      captainName: details.captainName?.trim() || null,
      captainUid: details.captainUid?.trim() || null,
      phone: details.phone?.trim() || null,
      paymentMethod: details.paymentMethod || "bKash",
      paymentNumber: details.paymentNumber?.trim() || null,
      teamMembersDriveLink: details.teamMembersDriveLink?.trim() || null,
      teamLeaderImageUrl: details.teamLeaderImageUrl?.trim() || null,
      updatedAt: new Date(),
    }

    if (existing.length > 0) {
      await db
        .update(userDefaultInfo)
        .set(payload)
        .where(eq(userDefaultInfo.userId, userId))
    } else {
      await db.insert(userDefaultInfo).values({
        id: randomUUID(),
        userId,
        ...payload,
      })
    }

    revalidatePath("/dashboard/info-setup")
    revalidatePath("/dashboard")
    revalidatePath("/book/[slug]", "page")
    return true
  } catch (err) {
    console.error("[autoSaveUserDefaultInfo] Non-blocking persistence error:", err)
    return false
  }
}

