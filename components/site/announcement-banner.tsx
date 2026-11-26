import { db } from "@/lib/db"
import { settings } from "@/lib/db/schema"
import { inArray } from "drizzle-orm"
import { parseTopAdConfig } from "@/lib/top-ad"
import { TopAdShowcase } from "@/components/site/top-ad-showcase"

export async function AnnouncementBanner() {
  let rawTopAd: string | null = null
  let legacyAnnouncement: string | null = null

  try {
    const rows = await db
      .select()
      .from(settings)
      .where(inArray(settings.key, ["top_ad_config", "announcement"]))
    for (const row of rows) {
      if (row.key === "top_ad_config") rawTopAd = row.value
      if (row.key === "announcement") legacyAnnouncement = row.value
    }
  } catch {
    return null
  }

  const config = parseTopAdConfig(rawTopAd, legacyAnnouncement)
  if (!config.enabled || !config.text.trim()) return null

  return <TopAdShowcase config={config} />
}
