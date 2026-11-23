"use server"

import { randomUUID } from "crypto"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { db, ensureSchemaReady } from "@/lib/db"
import { userDefaultInfo } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { requireUser } from "@/lib/session"
import { getActivePayoutMethods } from "@/lib/queries/payout-methods"
import { isSafeHttpOrRelativeUrl } from "@/lib/url-safety"

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
  paymentMethod: z.string().trim().min(1).max(30).default("bKash"),
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

  if (data.teamMembersDriveLink && !isSafeHttpOrRelativeUrl(data.teamMembersDriveLink)) {
    return { ok: false, error: "Invalid Drive link URL.", fieldErrors: { teamMembersDriveLink: "Must be a valid HTTP/HTTPS link." } }
  }
  if (data.teamLeaderImageUrl && !isSafeHttpOrRelativeUrl(data.teamLeaderImageUrl, { allowImageDataUri: true })) {
    return { ok: false, error: "Invalid Team Leader image URL." }
  }

  try {
    await ensureSchemaReady()
    const activeMethods = await getActivePayoutMethods()
    const matchedMethod = activeMethods.find(
      (m) =>
        m.code.toLowerCase() === data.paymentMethod.toLowerCase() ||
        m.name.toLowerCase() === data.paymentMethod.toLowerCase()
    )

    if (!matchedMethod) {
      return {
        ok: false,
        error: "Selected payout method is not currently available.",
        fieldErrors: { paymentMethod: "Please select an active payout method." },
      }
    }

    const canonicalMethod = matchedMethod.code
    const normalizedPaymentNumber = matchedMethod.requiresAccountNumber
      ? data.paymentNumber
      : data.paymentNumber || "RushX Organization Account Balance"

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
          paymentMethod: canonicalMethod,
          paymentNumber: normalizedPaymentNumber || null,
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
        paymentMethod: canonicalMethod,
        paymentNumber: normalizedPaymentNumber || null,
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

