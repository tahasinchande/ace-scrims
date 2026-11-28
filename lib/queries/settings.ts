import "server-only"

import { db } from "@/lib/db"
import { settings } from "@/lib/db/schema"
import { BRAND } from "@/lib/brand"
import { DEFAULT_TOP_AD_CONFIG, parseTopAdConfig, type TopAdConfig } from "@/lib/top-ad"
import {
  DEFAULT_BACKGROUND_THEME_CONFIG,
  parseBackgroundThemeConfig,
  type BackgroundThemeConfig,
} from "@/lib/background-config"
import { parseRoomMultiplier } from "@/lib/room-multiplier"
import {
  DEFAULT_SCHEDULE_OVERRIDE_CONFIG,
  parseScheduleOverrideConfig,
  type ScheduleOverrideConfig,
} from "@/lib/schedule-override"

export type PublicSiteSettings = {
  discordUrl: string
  facebookUrl: string
  youtubeUrl: string
  tiktokUrl: string
  whatsappChannelUrl: string
  telegramUrl: string
  instagramUrl: string
  supportWhatsapp: string
  championRushWhatsappUrl: string
  championRush3pmWhatsappUrl: string
  supportKoriUrl: string
  showRoom2: boolean
  roomMultiplier: number
  scheduleOverride: ScheduleOverrideConfig
  backgroundConfig: BackgroundThemeConfig
  maintenanceMode: boolean
  announcement: string
  topAd: TopAdConfig
  logoUrl: string
  showcaseTimeWindow: string
  showcaseFormatLabel: string
  showcasePayoutSla: string
  showcaseHighlightNote: string
}

export async function getPublicSiteSettings(): Promise<PublicSiteSettings> {
  try {
    const rows = await db.select().from(settings)
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
    const rawLogo = (map.site_logo_url || "").trim()
    const resolvedLogo =
      !rawLogo || rawLogo === "/icon.svg" ? BRAND.assets.symbol : rawLogo
    const topAd = parseTopAdConfig(map.top_ad_config, map.announcement)
    const roomMultiplier = parseRoomMultiplier(map.room_multiplier, map.show_room2)
    const scheduleOverride = parseScheduleOverrideConfig(map.schedule_override_config)
    const backgroundConfig = parseBackgroundThemeConfig(map.background_theme_config)

    const hasKey = (key: string) => Object.prototype.hasOwnProperty.call(map, key)
    const getLink = (key: string, fallback: string) =>
      hasKey(key) ? (map[key] ?? "").trim() : fallback

    return {
      discordUrl: getLink("discord_url", "https://discord.gg/aKF4hMuhmA"),
      facebookUrl: getLink("facebook_url", "https://facebook.com/rushxorg"),
      youtubeUrl: getLink("youtube_url", ""),
      tiktokUrl: getLink("tiktok_url", "https://www.tiktok.com/@rushxorg"),
      whatsappChannelUrl: getLink("whatsapp_channel_url", "https://whatsapp.com/channel/0029Va9xyz"),
      telegramUrl: getLink("telegram_url", ""),
      instagramUrl: getLink("instagram_url", ""),
      supportWhatsapp: getLink("support_whatsapp", "+8801831510108"),
      championRushWhatsappUrl: getLink("champion_rush_whatsapp_url", "https://whatsapp.com/channel/0029Vb7Bq9w42DcT1O2b0s3V"),
      championRush3pmWhatsappUrl: getLink("champion_rush_3pm_whatsapp_url", "https://whatsapp.com/channel/0029Vb7Bq9w42DcT1O2b0s3V"),
      supportKoriUrl: getLink("support_kori_url", "https://www.supportkori.com/rushxorg"),
      showRoom2: roomMultiplier >= 2,
      roomMultiplier,
      scheduleOverride,
      backgroundConfig,
      maintenanceMode: map.maintenance_mode === "true",
      announcement: map.announcement || "",
      topAd,
      logoUrl: resolvedLogo,
      showcaseTimeWindow: (map.showcase_time_window || "").trim(),
      showcaseFormatLabel: (map.showcase_format_label || "").trim(),
      showcasePayoutSla: (map.showcase_payout_sla || "").trim(),
      showcaseHighlightNote: (map.showcase_highlight_note || "").trim(),
    }
  } catch (err) {
    console.warn("[Settings Query] Error fetching site settings:", err)
    return {
      discordUrl: "https://discord.gg/aKF4hMuhmA",
      facebookUrl: "https://facebook.com/rushxorg",
      youtubeUrl: "",
      tiktokUrl: "https://www.tiktok.com/@rushxorg",
      whatsappChannelUrl: "https://whatsapp.com/channel/0029Va9xyz",
      telegramUrl: "",
      instagramUrl: "",
      supportWhatsapp: "+8801831510108",
      championRushWhatsappUrl: "https://whatsapp.com/channel/0029Vb7Bq9w42DcT1O2b0s3V",
      championRush3pmWhatsappUrl: "https://whatsapp.com/channel/0029Vb7Bq9w42DcT1O2b0s3V",
      supportKoriUrl: "https://www.supportkori.com/rushxorg",
      showRoom2: false,
      roomMultiplier: 1,
      scheduleOverride: { ...DEFAULT_SCHEDULE_OVERRIDE_CONFIG },
      backgroundConfig: { ...DEFAULT_BACKGROUND_THEME_CONFIG },
      maintenanceMode: false,
      announcement: "",
      topAd: { ...DEFAULT_TOP_AD_CONFIG },
      logoUrl: BRAND.assets.symbol,
      showcaseTimeWindow: "",
      showcaseFormatLabel: "",
      showcasePayoutSla: "",
      showcaseHighlightNote: "",
    }
  }
}
