import { db } from "@/lib/db"
import { userDefaultInfo, type UserDefaultInfo } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

/**
 * Fetch permanent default squad and payout information saved by the user.
 */
export async function getUserDefaultInfo(userId: string): Promise<UserDefaultInfo | null> {
  if (!userId) return null
  try {
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
