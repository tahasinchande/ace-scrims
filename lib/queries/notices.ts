import { db } from "@/lib/db"
import { notices, type Notice } from "@/lib/db/schema"
import { desc, eq } from "drizzle-orm"

export async function getAllNotices(onlyPublished = true): Promise<Notice[]> {
  try {
    const baseQuery = db.select().from(notices)
    const list = onlyPublished
      ? await baseQuery.where(eq(notices.isPublished, true)).orderBy(desc(notices.isPinned), desc(notices.createdAt))
      : await baseQuery.orderBy(desc(notices.isPinned), desc(notices.createdAt))

    return list
  } catch (err) {
    console.warn("[Notices Query] Failed to fetch notices from database:", err)
    return []
  }
}

export async function getNoticeById(id: string): Promise<Notice | null> {
  try {
    const rows = await db.select().from(notices).where(eq(notices.id, id)).limit(1)
    return rows[0] || null
  } catch (err) {
    console.warn(`[Notices Query] Failed to fetch notice ${id}:`, err)
    return null
  }
}
