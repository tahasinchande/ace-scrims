import "server-only"

import { db } from "@/lib/db"
import { settings } from "@/lib/db/schema"

export type PublicSiteSettings = {
  discordUrl: string
  facebookUrl: string
  youtubeUrl: string
  tiktokUrl: string
  whatsappChannelUrl: string
  telegramUrl: string
  instagramUrl: string
  supportPhone: string
  supportWhatsapp: string
  championRushWhatsappUrl: string
  supportKoriUrl: string
  showRoom2: boolean
  maintenanceMode: boolean
  announcement: string
  logoUrl: string
}

export async function getPublicSiteSettings(): Promise<PublicSiteSettings> {
  try {
    const rows = await db.select().from(settings)
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))

    return {
      discordUrl: map.discord_url || "https://discord.gg/aKF4hMuhmA",
      facebookUrl: map.facebook_url || "https://facebook.com/acescrims",
      youtubeUrl: map.youtube_url || "",
      tiktokUrl: map.tiktok_url || "https://www.tiktok.com/@acescrims",
      whatsappChannelUrl: map.whatsapp_channel_url || "https://whatsapp.com/channel/0029Va9xyz",
      telegramUrl: map.telegram_url || "",
      instagramUrl: map.instagram_url || "",
      supportPhone: map.support_phone || "+8801831510108",
      supportWhatsapp: map.support_whatsapp || "+8801831510108",
      championRushWhatsappUrl: map.champion_rush_whatsapp_url || "https://whatsapp.com/channel/0029Vb7Bq9w42DcT1O2b0s3V",
      supportKoriUrl: map.support_kori_url || "https://www.supportkori.com/acescrims",
      showRoom2: map.show_room2 === "true",
      maintenanceMode: map.maintenance_mode === "true",
      announcement: map.announcement || "",
      logoUrl: map.site_logo_url || "/icon.svg",
    }
  } catch (err) {
    console.warn("[Settings Query] Error fetching site settings:", err)
    return {
      discordUrl: "https://discord.gg/aKF4hMuhmA",
      facebookUrl: "https://facebook.com/acescrims",
      youtubeUrl: "",
      tiktokUrl: "https://www.tiktok.com/@acescrims",
      whatsappChannelUrl: "https://whatsapp.com/channel/0029Va9xyz",
      telegramUrl: "",
      instagramUrl: "",
      supportPhone: "+8801831510108",
      supportWhatsapp: "+8801831510108",
      championRushWhatsappUrl: "https://whatsapp.com/channel/0029Vb7Bq9w42DcT1O2b0s3V",
      supportKoriUrl: "https://www.supportkori.com/acescrims",
      showRoom2: false,
      maintenanceMode: false,
      announcement: "",
      logoUrl: "/icon.svg",
    }
  }
}
