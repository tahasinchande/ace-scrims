import "server-only"

import { asc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { partnershipItems, settings, type PartnershipItem } from "@/lib/db/schema"
import { resolveVerifiedPartnerLogo } from "@/lib/partner-logos"

export type PartnershipMarqueeSettings = {
  enabled: boolean
  heading: string
  subheading: string
  speedSeconds: number
  direction: "left" | "right"
  showBadges: boolean
}

export const PARTNERSHIP_MARQUEE_SETTINGS_KEY = "partnership_marquee_config"

export const DEFAULT_PARTNERSHIP_MARQUEE_SETTINGS: PartnershipMarqueeSettings = {
  enabled: true,
  heading: "Official Partners & Collaborations",
  subheading: "Trusted esports communities, brands, and creators powering RushX Organization.",
  speedSeconds: 24,
  direction: "left",
  showBadges: true,
}

export function sanitizePartnershipMarqueeSettings(
  partial?: Partial<PartnershipMarqueeSettings> | null
): PartnershipMarqueeSettings {
  const merged = { ...DEFAULT_PARTNERSHIP_MARQUEE_SETTINGS, ...(partial ?? {}) }
  const speedRaw = Number(merged.speedSeconds)
  const speedSeconds = Number.isFinite(speedRaw)
    ? Math.min(300, Math.max(1, Math.round(speedRaw * 10) / 10))
    : DEFAULT_PARTNERSHIP_MARQUEE_SETTINGS.speedSeconds

  const rawSubheading =
    typeof merged.subheading === "string"
      ? merged.subheading.trim().replace(/Ace Scrims/gi, "RushX Organization").slice(0, 180)
      : DEFAULT_PARTNERSHIP_MARQUEE_SETTINGS.subheading

  return {
    enabled: Boolean(merged.enabled),
    heading:
      typeof merged.heading === "string" && merged.heading.trim()
        ? merged.heading.trim().replace(/Ace Scrims/gi, "RushX Organization").slice(0, 80)
        : DEFAULT_PARTNERSHIP_MARQUEE_SETTINGS.heading,
    subheading: rawSubheading,
    speedSeconds,
    direction: merged.direction === "right" ? "right" : "left",
    showBadges: Boolean(merged.showBadges),
  }
}

function normalizePartnerItem(item: PartnershipItem): PartnershipItem {
  return {
    ...item,
    logoUrl: resolveVerifiedPartnerLogo(item.partnerName, item.logoUrl),
  }
}

export async function getPartnershipMarqueeSettings(): Promise<PartnershipMarqueeSettings> {
  try {
    const rows = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, PARTNERSHIP_MARQUEE_SETTINGS_KEY))
      .limit(1)
    if (!rows[0]?.value) return { ...DEFAULT_PARTNERSHIP_MARQUEE_SETTINGS }
    const parsed = JSON.parse(rows[0].value) as Partial<PartnershipMarqueeSettings>
    return sanitizePartnershipMarqueeSettings(parsed)
  } catch {
    return { ...DEFAULT_PARTNERSHIP_MARQUEE_SETTINGS }
  }
}

export async function savePartnershipMarqueeSettings(
  next: Partial<PartnershipMarqueeSettings>
): Promise<PartnershipMarqueeSettings> {
  const sanitized = sanitizePartnershipMarqueeSettings(next)
  const serialized = JSON.stringify(sanitized)
  await db
    .insert(settings)
    .values({
      key: PARTNERSHIP_MARQUEE_SETTINGS_KEY,
      value: serialized,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: settings.key,
      set: {
        value: serialized,
        updatedAt: new Date(),
      },
    })
  return sanitized
}

export async function getActivePartnershipItems(): Promise<PartnershipItem[]> {
  try {
    const rows = await db
      .select()
      .from(partnershipItems)
      .where(eq(partnershipItems.isActive, true))
      .orderBy(asc(partnershipItems.sortOrder), asc(partnershipItems.createdAt))
    return rows.map(normalizePartnerItem)
  } catch (err) {
    console.warn("[Partnerships] Failed to fetch active partnership items:", err)
    return []
  }
}

export async function getAllPartnershipItems(): Promise<PartnershipItem[]> {
  try {
    const rows = await db
      .select()
      .from(partnershipItems)
      .orderBy(asc(partnershipItems.sortOrder), asc(partnershipItems.createdAt))
    return rows.map(normalizePartnerItem)
  } catch (err) {
    console.warn("[Partnerships] Failed to fetch all partnership items:", err)
    return []
  }
}
