"use client"

import { useState, useTransition } from "react"
import { saveAllSiteSettings } from "@/app/actions/admin"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Heart, Coffee } from "lucide-react"
import { toast } from "sonner"
import { useLanguage } from "@/lib/language"

export function SiteSettingsForm({
  discordUrl,
  facebookUrl,
  youtubeUrl = "",
  tiktokUrl = "https://www.tiktok.com/@acescrims",
  whatsappChannelUrl = "https://whatsapp.com/channel/0029Va9xyz",
  telegramUrl = "",
  instagramUrl = "",
  supportWhatsapp = "+8801831510108",
  championRushWhatsappUrl = "https://whatsapp.com/channel/0029Vb7Bq9w42DcT1O2b0s3V",
  championRush3pmWhatsappUrl = "https://whatsapp.com/channel/0029Vb7Bq9w42DcT1O2b0s3V",
  supportKoriUrl = "https://www.supportkori.com/acescrims",
  showRoom2,
  maintenanceMode,
  staffPortalPath,
  fridayScrimsOverride = "auto",
  logoUrl = "/images/brand/rushx-symbol.png",
  showcaseTimeWindow = "",
  showcaseFormatLabel = "",
  showcasePayoutSla = "",
  showcaseHighlightNote = "",
}: {
  discordUrl: string
  facebookUrl: string
  youtubeUrl?: string
  tiktokUrl?: string
  whatsappChannelUrl?: string
  telegramUrl?: string
  instagramUrl?: string
  supportWhatsapp?: string
  championRushWhatsappUrl?: string
  championRush3pmWhatsappUrl?: string
  supportKoriUrl?: string
  showRoom2: boolean
  maintenanceMode: boolean
  staffPortalPath: string
  fridayScrimsOverride?: string
  logoUrl?: string
  showcaseTimeWindow?: string
  showcaseFormatLabel?: string
  showcasePayoutSla?: string
  showcaseHighlightNote?: string
}) {
  const { lang, t } = useLanguage()
  const [discord, setDiscord] = useState(discordUrl)
  const [facebook, setFacebook] = useState(facebookUrl)
  const [youtube, setYoutube] = useState(youtubeUrl)
  const [tiktok, setTiktok] = useState(tiktokUrl || "https://www.tiktok.com/@acescrims")
  const [whatsappChannel, setWhatsappChannel] = useState(whatsappChannelUrl)
  const [telegram, setTelegram] = useState(telegramUrl)
  const [instagram, setInstagram] = useState(instagramUrl)
  const [supportWa, setSupportWa] = useState(supportWhatsapp || "+8801831510108")
  const [championWhatsapp, setChampionWhatsapp] = useState(championRushWhatsappUrl || "https://whatsapp.com/channel/0029Vb7Bq9w42DcT1O2b0s3V")
  const [champion3pmWhatsapp, setChampion3pmWhatsapp] = useState(championRush3pmWhatsappUrl || "https://whatsapp.com/channel/0029Vb7Bq9w42DcT1O2b0s3V")
  const [supportKori, setSupportKori] = useState(supportKoriUrl || "https://www.supportkori.com/acescrims")
  const [room2Enabled, setRoom2Enabled] = useState(showRoom2)
  const [maintEnabled, setMaintEnabled] = useState(maintenanceMode)
  const [staffPath, setStaffPath] = useState(staffPortalPath)
  const [fridayMode, setFridayMode] = useState(fridayScrimsOverride)
  const [siteLogo, setSiteLogo] = useState(logoUrl || "/images/brand/rushx-symbol.png")
  const [scTimeWindow, setScTimeWindow] = useState(showcaseTimeWindow)
  const [scFormatLabel, setScFormatLabel] = useState(showcaseFormatLabel)
  const [scPayoutSla, setScPayoutSla] = useState(showcasePayoutSla)
  const [scHighlightNote, setScHighlightNote] = useState(showcaseHighlightNote)
  const [isPending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      try {
        const res = await saveAllSiteSettings({
          discord_url: discord.trim(),
          facebook_url: facebook.trim(),
          youtube_url: youtube.trim(),
          tiktok_url: tiktok.trim(),
          whatsapp_channel_url: whatsappChannel.trim(),
          telegram_url: telegram.trim(),
          instagram_url: instagram.trim(),
          support_whatsapp: supportWa.trim(),
          champion_rush_whatsapp_url: championWhatsapp.trim(),
          champion_rush_3pm_whatsapp_url: champion3pmWhatsapp.trim(),
          support_kori_url: supportKori.trim(),
          show_room2: room2Enabled ? "true" : "false",
          maintenance_mode: maintEnabled ? "true" : "false",
          staff_portal_path: staffPath.trim() || "/staff-login",
          friday_scrims_override: fridayMode,
          site_logo_url: siteLogo.trim() || "/images/brand/rushx-symbol.png",
          showcase_time_window: scTimeWindow.trim(),
          showcase_format_label: scFormatLabel.trim(),
          showcase_payout_sla: scPayoutSla.trim(),
          showcase_highlight_note: scHighlightNote.trim(),
        })

        if (res.ok) {
          toast.success(lang === "bn" ? "সেটিংস সফলভাবে সংরক্ষণ করা হয়েছে!" : "Settings saved successfully!")
        } else {
          toast.error(res.error || "Failed to save settings")
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to save settings")
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
          {t("settings_title", "Site Settings")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("settings_sub")}
        </p>
      </header>
      <div className="glass flex max-w-2xl flex-col gap-6 rounded-2xl p-6 border border-border">
      {/* Brand & Admin Profile Logo */}
      <div className="flex flex-col gap-3 pb-4 border-b border-border">
        <h3 className="font-display text-base font-bold uppercase tracking-wide text-foreground">
          {lang === "bn" ? "ব্র্যান্ড লোগো ও হেডার আইকন" : "Brand Logo & Header Avatar"}
        </h3>
        <p className="text-xs text-muted-foreground">
          Sets the brand logo rendered across the public header, live chat support, and admin navigation.
        </p>
        <div className="flex items-center gap-4">
          <div className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border/80 bg-zinc-950 p-2 shadow-inner">
            <img
              src={siteLogo || "/images/brand/rushx-symbol.png"}
              alt="Brand Preview"
              className="h-full w-full object-contain"
              onError={(e) => {
                ;(e.currentTarget as HTMLImageElement).src = "/images/brand/rushx-symbol.png"
              }}
            />
          </div>
          <div className="flex-1 flex flex-col gap-1.5">
            <Label htmlFor="site-logo-url" className="text-xs font-semibold">
              Logo / Icon Image URL
            </Label>
            <Input
              id="site-logo-url"
              value={siteLogo}
              onChange={(e) => setSiteLogo(e.target.value)}
              placeholder="/images/brand/rushx-symbol.png or https://..."
              className="text-xs font-mono"
            />
            <div className="flex items-center gap-2 mt-1">
              <button
                type="button"
                onClick={() => setSiteLogo("/images/brand/rushx-symbol.png")}
                className="text-[11px] text-primary hover:underline"
              >
                Use RushX Symbol (/images/brand/rushx-symbol.png)
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Dynamic Public Showcase & Schedule Copy */}
      <div className="flex flex-col gap-3 pb-4 border-b border-border">
        <h3 className="font-display text-base font-bold uppercase tracking-wide text-foreground">
          {lang === "bn" ? "পাবলিক শোকেস ও শিডিউল তথ্য (ডায়নামিক)" : "Public Showcase & Schedule Info (Dynamic)"}
        </h3>
        <p className="text-xs text-muted-foreground">
          Controls public info shown on Sign In, Sign Up, Homepage, and Tutorial pages. Leave blank to automatically calculate live numbers directly from your active scrims.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="showcase-time-window">Schedule Time Window Override</Label>
            <Input
              id="showcase-time-window"
              value={scTimeWindow}
              onChange={(e) => setScTimeWindow(e.target.value)}
              placeholder="Auto-detected from active scrims"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="showcase-payout-sla">Prize Payout Turnaround</Label>
            <Input
              id="showcase-payout-sla"
              value={scPayoutSla}
              onChange={(e) => setScPayoutSla(e.target.value)}
              placeholder="e.g. Fast verified prize payouts"
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="showcase-format-label">Lobby Format Summary</Label>
            <Input
              id="showcase-format-label"
              value={scFormatLabel}
              onChange={(e) => setScFormatLabel(e.target.value)}
              placeholder="e.g. Competitive squad lobbies across official Free Fire maps"
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="showcase-highlight-note">Custom Top Highlight Line (Sign In / Sign Up)</Label>
            <Input
              id="showcase-highlight-note"
              value={scHighlightNote}
              onChange={(e) => setScHighlightNote(e.target.value)}
              placeholder="Leave blank to show live active lobby count automatically"
            />
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <h3 className="font-display text-base font-bold uppercase tracking-wide text-foreground">
          Social Links & Channels
        </h3>
        
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="discord-url" className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#5865F2]" />
              Discord Invite URL
            </Label>
            <Input
              id="discord-url"
              type="url"
              value={discord}
              onChange={(e) => setDiscord(e.target.value)}
              placeholder="https://discord.gg/…"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="facebook-url" className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#1877F2]" />
              Facebook Page / Group URL
            </Label>
            <Input
              id="facebook-url"
              type="url"
              value={facebook}
              onChange={(e) => setFacebook(e.target.value)}
              placeholder="https://facebook.com/…"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tiktok-url" className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#EE1D52]" />
              TikTok Profile URL
            </Label>
            <Input
              id="tiktok-url"
              type="url"
              value={tiktok}
              onChange={(e) => setTiktok(e.target.value)}
              placeholder="https://www.tiktok.com/@…"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="whatsapp-channel-url" className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#25D366]" />
              Main WhatsApp Channel URL
            </Label>
            <Input
              id="whatsapp-channel-url"
              type="url"
              value={whatsappChannel}
              onChange={(e) => setWhatsappChannel(e.target.value)}
              placeholder="https://whatsapp.com/channel/…"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="youtube-url" className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#FF0000]" />
              YouTube Channel URL
            </Label>
            <Input
              id="youtube-url"
              type="url"
              value={youtube}
              onChange={(e) => setYoutube(e.target.value)}
              placeholder="https://youtube.com/@…"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="telegram-url" className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#229ED9]" />
              Telegram Channel / Group URL
            </Label>
            <Input
              id="telegram-url"
              type="url"
              value={telegram}
              onChange={(e) => setTelegram(e.target.value)}
              placeholder="https://t.me/…"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="instagram-url" className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#E4405F]" />
              Instagram Profile URL
            </Label>
            <Input
              id="instagram-url"
              type="url"
              value={instagram}
              onChange={(e) => setInstagram(e.target.value)}
              placeholder="https://instagram.com/…"
            />
          </div>
        </div>
      </div>

      {/* SupportKori Integration */}
      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <div className="flex items-center gap-2">
          <Coffee className="size-4 text-amber-400" />
          <h3 className="font-display text-base font-bold uppercase tracking-wide text-foreground">
            SupportKori Tab Integration (Buy Me A Coffee)
          </h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Customizable link for the SupportKori tab displayed on the downside of the website. Visitors can donate and support RushX Organization.
        </p>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="support-kori-url">SupportKori Custom Page Link</Label>
          <Input
            id="support-kori-url"
            type="url"
            value={supportKori}
            onChange={(e) => setSupportKori(e.target.value)}
            placeholder="https://www.supportkori.com/your-brand"
            className="border-amber-500/30 focus-visible:ring-amber-500"
          />
        </div>
      </div>

      <div className="flex flex-col gap-4 border-t border-border pt-4">
        <h3 className="font-display text-base font-bold uppercase tracking-wide text-foreground">
          Support & Contact Info
        </h3>
        
        <div className="flex flex-col gap-1.5 max-w-sm">
          <Label htmlFor="support-whatsapp">Official Support WhatsApp</Label>
          <Input
            id="support-whatsapp"
            value={supportWa}
            onChange={(e) => setSupportWa(e.target.value)}
            placeholder="+8801831510108"
          />
        </div>
      </div>

      {/* 10 PM Champion Rush WhatsApp Channel Link */}
      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <Label htmlFor="champion-whatsapp-url" className="font-display uppercase text-sm font-bold text-emerald-400 flex items-center gap-2">
          10 PM Champion Rush WhatsApp Channel Link
        </Label>
        <Input
          id="champion-whatsapp-url"
          type="url"
          value={championWhatsapp}
          onChange={(e) => setChampionWhatsapp(e.target.value)}
          placeholder="https://whatsapp.com/channel/..."
          className="border-emerald-500/30 focus-visible:ring-emerald-500"
        />
        <p className="text-xs text-muted-foreground">
          Displayed to registered squads on their Dashboard for the 10 PM Champion Rush 8-match lobby.
        </p>
      </div>

      {/* 3 PM Champion Rush WhatsApp Channel Link */}
      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <Label htmlFor="champion-3pm-whatsapp-url" className="font-display uppercase text-sm font-bold text-emerald-400 flex items-center gap-2">
          3 PM Champion Rush WhatsApp Channel Link
        </Label>
        <Input
          id="champion-3pm-whatsapp-url"
          type="url"
          value={champion3pmWhatsapp}
          onChange={(e) => setChampion3pmWhatsapp(e.target.value)}
          placeholder="https://whatsapp.com/channel/..."
          className="border-emerald-500/30 focus-visible:ring-emerald-500"
        />
        <p className="text-xs text-muted-foreground">
          Displayed to registered squads on their Dashboard for the Friday 3 PM Champion Rush 8-match lobby.
        </p>
      </div>

      {/* Staff Portal Configuration */}
      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <Label htmlFor="staff-portal-path" className="font-display uppercase text-sm font-bold">
          Configurable Staff Portal Entry Path
        </Label>
        <Input
          id="staff-portal-path"
          value={staffPath}
          onChange={(e) => setStaffPath(e.target.value)}
          placeholder="/staff-login"
        />
        <p className="text-xs text-muted-foreground">
          Restricted path for Admin/Moderator authentication. Not advertised on any public navigation.
        </p>
      </div>

      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <Label className="font-display uppercase text-sm font-bold">Lobby & Visibility Toggles</Label>
        
        {/* Friday Scrims Schedule Override */}
        <div className="flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-sm text-foreground">Friday Scrims Schedule Mode</span>
            <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-bold uppercase text-primary">
              {fridayMode === "auto" ? "Auto (Bangladesh Friday)" : fridayMode === "force_on" ? "Forced ON" : "Forced OFF"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Friday Special Blast (3 matches) & 10 PM Champion Rush automatically activate on Fridays, or you can force turn them ON/OFF at any time.
          </p>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <button
              type="button"
              onClick={() => setFridayMode("auto")}
              className={`rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
                fridayMode === "auto"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background hover:bg-secondary"
              }`}
            >
              Automatic (Friday BD)
            </button>
            <button
              type="button"
              onClick={() => setFridayMode("force_on")}
              className={`rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
                fridayMode === "force_on"
                  ? "border-emerald-500 bg-emerald-600 text-white"
                  : "border-border bg-background hover:bg-secondary"
              }`}
            >
              Force Turn ON
            </button>
            <button
              type="button"
              onClick={() => setFridayMode("force_off")}
              className={`rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${
                fridayMode === "force_off"
                  ? "border-destructive bg-destructive text-destructive-foreground"
                  : "border-border bg-background hover:bg-secondary"
              }`}
            >
              Force Turn OFF
            </button>
          </div>
        </div>

        <label className="flex items-center justify-between rounded-xl bg-secondary/60 p-3 cursor-pointer">
          <div className="flex flex-col">
            <span className="font-semibold text-sm">Room 2 Lobbies (Public Visibility)</span>
            <span className="text-xs text-muted-foreground">
              When disabled, Room 2 scrims are hidden from public views (Visible only to Admin/Moderators).
            </span>
          </div>
          <input
            type="checkbox"
            checked={room2Enabled}
            onChange={(e) => setRoom2Enabled(e.target.checked)}
            className="size-5 rounded border-input bg-background accent-primary"
          />
        </label>

        <label className="flex items-center justify-between rounded-xl border border-destructive/40 bg-destructive/10 p-3 cursor-pointer">
          <div className="flex flex-col">
            <span className="font-semibold text-sm text-destructive">Maintenance Mode</span>
            <span className="text-xs text-muted-foreground">
              When enabled, public site visitors see the maintenance page. Admin panel remains accessible.
            </span>
          </div>
          <input
            type="checkbox"
            checked={maintEnabled}
            onChange={(e) => setMaintEnabled(e.target.checked)}
            className="size-5 rounded border-input bg-background accent-destructive"
          />
        </label>
      </div>

      <div>
        <Button onClick={save} disabled={isPending} className="glow-primary font-display font-bold uppercase w-full sm:w-auto">
          {isPending && <Loader2 className="size-4 animate-spin" />}
          {t("settings_save", "Save Settings")}
        </Button>
      </div>
    </div>
    </div>
  )
}
