"use client"

import Link from "next/link"
import { MessageCircle, HelpCircle } from "lucide-react"
import { FacebookIcon, DiscordIcon, WhatsAppIcon, YouTubeIcon, TelegramIcon, InstagramIcon, TikTokIcon, SupportKoriIcon } from "@/components/site/brand-icons"
import { useLanguage } from "@/lib/language"
import { Button } from "@/components/ui/button"
import { AceScrimsBrandLogo } from "@/components/site/brand-logo"
import { LiveSupportButton } from "@/components/site/live-support-button"

export type FooterSettings = {
  discordUrl?: string
  facebookUrl?: string
  youtubeUrl?: string
  tiktokUrl?: string
  supportKoriUrl?: string
  whatsappChannelUrl?: string
  telegramUrl?: string
  instagramUrl?: string
  supportPhone?: string
  supportWhatsapp?: string
}

export function SiteFooter({ settings }: { settings?: FooterSettings }) {
  const { t } = useLanguage()

  const discord = settings?.discordUrl || "https://discord.gg/aKF4hMuhmA"
  const facebook = settings?.facebookUrl || "https://facebook.com/acescrims"
  const whatsappChannel = settings?.whatsappChannelUrl || "https://whatsapp.com/channel/0029Va9xyz"
  const youtube = settings?.youtubeUrl || ""
  const tiktok = settings?.tiktokUrl || "https://www.tiktok.com/@acescrims"
  const supportKori = settings?.supportKoriUrl || "https://www.supportkori.com/ace_scrims"
  const telegram = settings?.telegramUrl || ""
  const instagram = settings?.instagramUrl || ""
  const supportPhone = settings?.supportPhone || "+8801831510108"
  const supportWhatsapp = settings?.supportWhatsapp || "+8801831510108"
  const cleanPhone = supportPhone.replace(/[^0-9+]/g, "")
  const cleanWaNumber = supportWhatsapp.replace(/[^0-9]/g, "")

  return (
    <footer className="border-t border-border/50 bg-card/40">
      <div className="mx-auto max-w-6xl px-4 py-12 md:px-6">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="flex flex-col gap-3">
            <Link href="/" className="flex items-center gap-2" aria-label="Ace Scrims home">
              <AceScrimsBrandLogo size="md" />
            </Link>
            <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
              {t("brand_desc", "Bangladesh's premium Free Fire scrim platform. Daily competitive squad scrim lobbies.")}
            </p>

            <div className="mt-2 flex flex-wrap gap-2">
              {discord && (
                <a
                  href={discord}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex size-9 items-center justify-center rounded-lg border border-border bg-card text-[#5865F2] transition-colors hover:border-[#5865F2] hover:bg-[#5865F2]/10"
                  aria-label="Join our Discord"
                  title="Discord Community"
                >
                  <DiscordIcon className="size-4" />
                </a>
              )}
              {whatsappChannel && (
                <a
                  href={whatsappChannel}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex size-9 items-center justify-center rounded-lg border border-border bg-card text-[#25D366] transition-colors hover:border-[#25D366] hover:bg-[#25D366]/10"
                  aria-label="Join WhatsApp Channel"
                  title="WhatsApp Channel"
                >
                  <WhatsAppIcon className="size-4" />
                </a>
              )}
              {facebook && (
                <a
                  href={facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex size-9 items-center justify-center rounded-lg border border-border bg-card text-[#1877F2] transition-colors hover:border-[#1877F2] hover:bg-[#1877F2]/10"
                  aria-label="Follow us on Facebook"
                  title="Facebook Page"
                >
                  <FacebookIcon className="size-4" />
                </a>
              )}
              {tiktok && (
                <a
                  href={tiktok}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex size-9 items-center justify-center rounded-lg border border-border bg-card text-[#EE1D52] transition-colors hover:border-[#EE1D52] hover:bg-[#EE1D52]/10"
                  aria-label="Follow us on TikTok"
                  title="TikTok"
                >
                  <TikTokIcon className="size-4" />
                </a>
              )}
              {supportKori && (
                <a
                  href={supportKori}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex size-9 items-center justify-center rounded-lg border border-border bg-card text-[#FF813F] transition-colors hover:border-[#FF813F] hover:bg-[#FF813F]/10"
                  aria-label="Support on SupportKori"
                  title="SupportKori (Buy Me A Coffee)"
                >
                  <SupportKoriIcon className="size-4" />
                </a>
              )}
              {youtube && (
                <a
                  href={youtube}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex size-9 items-center justify-center rounded-lg border border-border bg-card text-[#FF0000] transition-colors hover:border-[#FF0000] hover:bg-[#FF0000]/10"
                  aria-label="Subscribe on YouTube"
                  title="YouTube Channel"
                >
                  <YouTubeIcon className="size-4" />
                </a>
              )}
              {telegram && (
                <a
                  href={telegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex size-9 items-center justify-center rounded-lg border border-border bg-card text-[#229ED9] transition-colors hover:border-[#229ED9] hover:bg-[#229ED9]/10"
                  aria-label="Join Telegram"
                  title="Telegram Channel"
                >
                  <TelegramIcon className="size-4" />
                </a>
              )}
              {instagram && (
                <a
                  href={instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex size-9 items-center justify-center rounded-lg border border-border bg-card text-[#E4405F] transition-colors hover:border-[#E4405F] hover:bg-[#E4405F]/10"
                  aria-label="Follow on Instagram"
                  title="Instagram"
                >
                  <InstagramIcon className="size-4" />
                </a>
              )}
            </div>
          </div>

          <nav className="flex flex-col gap-2" aria-label="Platform">
            <h3 className="mb-1 font-display text-sm font-bold uppercase tracking-wider text-foreground">
              {t("platform", "Platform")}
            </h3>
            <Link href="/scrims" className="text-sm text-muted-foreground hover:text-foreground">
              {t("nav_scrims", "Scrims")}
            </Link>
            <Link href="/results" className="text-sm text-muted-foreground hover:text-foreground">
              {t("nav_results", "Results")}
            </Link>
            <Link href="/tutorial" className="text-sm text-muted-foreground hover:text-foreground">
              {t("nav_tutorial", "Tutorial Video")}
            </Link>
            <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
              {t("nav_dashboard", "Dashboard")}
            </Link>
            <Link href="/report" className="text-sm text-muted-foreground hover:text-foreground">
              Submit a Report
            </Link>
          </nav>

          <nav className="flex flex-col gap-2" aria-label="Legal">
            <h3 className="mb-1 font-display text-sm font-bold uppercase tracking-wider text-foreground">
              {t("legal", "Legal & Policy")}
            </h3>
            <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground">
              {t("nav_terms", "Terms of Service")}
            </Link>
            <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground">
              {t("nav_privacy", "Privacy Policy")}
            </Link>
            <Link href="/refund-policy" className="text-sm text-muted-foreground hover:text-foreground">
              {t("nav_refund", "Refund Policy")}
            </Link>
          </nav>

          <div className="flex flex-col gap-2">
            <h3 className="mb-1 font-display text-sm font-bold uppercase tracking-wider text-foreground">
              {t("direct_support", "Direct Support")}
            </h3>
            <div className="flex flex-col gap-2 mt-1">
              <LiveSupportButton
                variant="footer"
                label={t("live_support", "Live Support")}
              />
              <a
                href={`https://wa.me/${cleanWaNumber || "8801831510108"}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs font-semibold text-emerald-400 hover:underline px-1 py-1"
              >
                <WhatsAppIcon className="size-4 text-emerald-400" />
                <span>WhatsApp Support</span>
              </a>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-border/40 pt-6 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} Ace Scrims. All rights reserved.</p>
          <p>Built for Bangladesh Free Fire competitive esports community.</p>
        </div>
      </div>
    </footer>
  )
}
