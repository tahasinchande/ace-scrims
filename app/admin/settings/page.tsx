import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import { isAdminOrOwner } from "@/lib/roles"
import { db } from "@/lib/db"
import { settings } from "@/lib/db/schema"
import { SiteSettingsForm } from "@/components/admin/site-settings-form"
import { PayoutMethodsManager } from "@/components/admin/payout-methods-manager"
import { getAllPayoutMethods } from "@/lib/queries/payout-methods"

export const dynamic = "force-dynamic"
export const metadata = { title: "Settings — RushX Organization Admin" }

export default async function AdminSettingsPage() {
  const user = await getSessionUser()
  if (user?.banned || !isAdminOrOwner(user?.role)) redirect("/admin/scrims")

  const [rows, payoutMethods] = await Promise.all([
    db.select().from(settings),
    getAllPayoutMethods(),
  ])
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Site Settings</h1>
        <p className="text-sm text-muted-foreground">Community links, TikTok, SupportKori, payout methods, and contact info.</p>
      </header>
      <PayoutMethodsManager initialMethods={payoutMethods} />
      <SiteSettingsForm
        discordUrl={map.discord_url ?? "https://discord.gg/aKF4hMuhmA"}
        facebookUrl={map.facebook_url ?? "https://facebook.com/acescrims"}
        youtubeUrl={map.youtube_url ?? ""}
        tiktokUrl={map.tiktok_url ?? "https://www.tiktok.com/@acescrims"}
        whatsappChannelUrl={map.whatsapp_channel_url ?? "https://whatsapp.com/channel/0029Va9xyz"}
        telegramUrl={map.telegram_url ?? ""}
        instagramUrl={map.instagram_url ?? ""}
        supportWhatsapp={map.support_whatsapp ?? "+8801831510108"}
        championRushWhatsappUrl={map.champion_rush_whatsapp_url ?? "https://whatsapp.com/channel/0029Vb7Bq9w42DcT1O2b0s3V"}
        championRush3pmWhatsappUrl={map.champion_rush_3pm_whatsapp_url ?? "https://whatsapp.com/channel/0029Vb7Bq9w42DcT1O2b0s3V"}
        supportKoriUrl={map.support_kori_url ?? "https://www.supportkori.com/acescrims"}
        showRoom2={map.show_room2 === "true"}
        maintenanceMode={map.maintenance_mode === "true"}
        staffPortalPath={map.staff_portal_path ?? "/staff-login"}
        fridayScrimsOverride={map.friday_scrims_override ?? "auto"}
        logoUrl={map.site_logo_url && map.site_logo_url !== "/icon.svg" ? map.site_logo_url : "/images/brand/rushx-symbol.png"}
        showcaseTimeWindow={map.showcase_time_window ?? ""}
        showcaseFormatLabel={map.showcase_format_label ?? ""}
        showcasePayoutSla={map.showcase_payout_sla ?? ""}
        showcaseHighlightNote={map.showcase_highlight_note ?? ""}
      />
    </div>
  )
}
