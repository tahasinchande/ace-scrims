import "server-only"

import { asc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { partnershipItems, type PartnershipItem } from "@/lib/db/schema"

export async function getActivePartnershipItems(): Promise<PartnershipItem[]> {
  try {
    return await db
      .select()
      .from(partnershipItems)
      .where(eq(partnershipItems.isActive, true))
      .orderBy(asc(partnershipItems.sortOrder), asc(partnershipItems.createdAt))
  } catch (err) {
    console.warn("[Partnerships] Failed to fetch active partnership items:", err)
    return []
  }
}

export async function getAllPartnershipItems(): Promise<PartnershipItem[]> {
  try {
    return await db
      .select()
      .from(partnershipItems)
      .orderBy(asc(partnershipItems.sortOrder), asc(partnershipItems.createdAt))
  } catch (err) {
    console.warn("[Partnerships] Failed to fetch all partnership items:", err)
    return []
  }
}
