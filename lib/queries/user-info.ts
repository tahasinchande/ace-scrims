import "server-only"

import { randomUUID } from "crypto"
import { db, ensureSchemaReady } from "@/lib/db"
import { userDefaultInfo, type UserDefaultInfo } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

/**
 * Fetch permanent default squad and payout information saved by the user.
 */
export async function getUserDefaultInfo(userId: string): Promise<UserDefaultInfo | null> {
  if (!userId) return null
  try {
    await ensureSchemaReady()
    const rows = await db
      .select()
      .from(userDefaultInfo)
      .where(eq(userDefaultInfo.userId, userId))
      .limit(1)

    return rows[0] || null
  } catch (err) {
    console.warn("[Database] Error querying user default info:", err)
    return null
  }
}

/**
 * Internal server-only helper to auto-save or update default squad profile details
 * when a user submits a valid scrim registration.
 */
export async function autoSaveUserDefaultInfo(
  userId: string,
  details: {
    teamName?: string | null
    teamTag?: string | null
    captainName?: string | null
    captainUid?: string | null
    phone?: string | null
    paymentMethod?: string | null
    paymentNumber?: string | null
    teamMembersDriveLink?: string | null
    teamLeaderImageUrl?: string | null
  }
): Promise<boolean> {
  if (!userId) return false
  try {
    await ensureSchemaReady()
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
      paymentMethod: details.paymentMethod?.trim() || "bKash",
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

    return true
  } catch (err) {
    console.error("[autoSaveUserDefaultInfo] Non-blocking persistence error:", err)
    return false
  }
}
