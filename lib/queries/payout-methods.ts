import "server-only"

import { db, ensureSchemaReady } from "@/lib/db"
import { payoutMethods, type PayoutMethod } from "@/lib/db/schema"
import { asc, eq } from "drizzle-orm"

export const DEFAULT_PAYOUT_METHODS: PayoutMethod[] = [
  {
    id: "pm-bkash",
    name: "bKash",
    code: "bKash",
    label: "bKash Personal",
    description: "Mobile financial service personal account",
    accentColor: "#E2136E",
    requiresAccountNumber: true,
    isActive: true,
    sortOrder: 1,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  },
  {
    id: "pm-nagad",
    name: "Nagad",
    code: "Nagad",
    label: "Nagad Personal",
    description: "Mobile financial service personal account",
    accentColor: "#F7941D",
    requiresAccountNumber: true,
    isActive: true,
    sortOrder: 2,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  },
  {
    id: "pm-rocket",
    name: "Rocket",
    code: "Rocket",
    label: "Rocket Personal",
    description: "Dutch-Bangla Mobile Banking (Rocket)",
    accentColor: "#8C3494",
    requiresAccountNumber: true,
    isActive: true,
    sortOrder: 3,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  },
  {
    id: "pm-tap",
    name: "Tap",
    code: "Tap",
    label: "Tap Personal",
    description: "Trust Axiata Pay digital wallet",
    accentColor: "#00A19D",
    requiresAccountNumber: true,
    isActive: true,
    sortOrder: 4,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  },
  {
    id: "pm-balance",
    name: "Balance",
    code: "Balance",
    label: "Ace Scrims Wallet",
    description: "Instant wallet credit for 1-click scrim booking",
    accentColor: "#10B981",
    requiresAccountNumber: false,
    isActive: true,
    sortOrder: 5,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  },
]

export async function getAllPayoutMethods(): Promise<PayoutMethod[]> {
  try {
    await ensureSchemaReady()
    const rows = await db
      .select()
      .from(payoutMethods)
      .orderBy(asc(payoutMethods.sortOrder), asc(payoutMethods.createdAt))

    if (rows.length === 0) {
      return DEFAULT_PAYOUT_METHODS
    }
    return rows
  } catch (err) {
    console.warn("[PayoutMethods] Failed to query payout methods, using defaults:", err)
    return DEFAULT_PAYOUT_METHODS
  }
}

export async function getActivePayoutMethods(): Promise<PayoutMethod[]> {
  try {
    await ensureSchemaReady()
    const rows = await db
      .select()
      .from(payoutMethods)
      .where(eq(payoutMethods.isActive, true))
      .orderBy(asc(payoutMethods.sortOrder), asc(payoutMethods.createdAt))

    if (rows.length === 0) {
      return DEFAULT_PAYOUT_METHODS
    }
    return rows
  } catch (err) {
    console.warn("[PayoutMethods] Failed to query active payout methods, using defaults:", err)
    return DEFAULT_PAYOUT_METHODS
  }
}
