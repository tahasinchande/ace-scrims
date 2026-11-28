import { Suspense } from "react"
import { getSessionUser, checkMaintenanceMode } from "@/lib/session"
import { getActiveScrims } from "@/lib/queries/scrims"
import { sanitizePublicScrim } from "@/lib/iceberg"
import { getRecentResults } from "@/lib/queries/results"
import { getPublicSiteSettings } from "@/lib/queries/settings"
import { buildShowcaseSummary } from "@/lib/queries/showcase"
import { SiteHeader } from "@/components/site/site-header"
import { SiteFooter } from "@/components/site/site-footer"
import { SupportKoriBanner } from "@/components/site/supportkori-banner"
import { Hero } from "@/components/landing/hero"
import { Features, HowItWorks, WhyChooseUs, Faq, Contact, SectionHeading } from "@/components/landing/sections"
import { Top3FaceBannersSection, type Top3BannerItem } from "@/components/landing/top3-face-banners"
import { MvpFaceBannersSection, type MvpBannerItem } from "@/components/landing/mvp-face-banners"
import {
  OverallStandingsBannersSection,
  type OverallStandingsBannerItem,
} from "@/components/landing/overall-standings-banners"
import { classifyResultBannerType } from "@/lib/results-classification"
import { HomeScrimsGrid } from "@/components/site/home-scrims-grid"
import { PartnershipTickerBar } from "@/components/site/partnership-ticker-bar"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function HomePage() {
  await checkMaintenanceMode()

  const [user, scrims, results, settings] = await Promise.all([
    getSessionUser().catch(() => null),
    getActiveScrims().catch(() => []),
    getRecentResults(36, true).catch(() => []),
    getPublicSiteSettings().catch(() => undefined),
  ])

  // Strictly separate results into 3 mutually-exclusive showcases:
  // 1. Overall Standings  2. Top 3 Face Banners  3. MVP Face Banners
  const overallStandingsBanners: OverallStandingsBannerItem[] = []
  const top3Banners: Top3BannerItem[] = []
  const mvpBanners: MvpBannerItem[] = []

  for (const r of results) {
    const urls =
      Array.isArray(r.imageUrls) && r.imageUrls.length > 0
        ? (r.imageUrls as string[])
        : r.screenshotUrl
          ? [r.screenshotUrl]
          : []
    if (urls.length === 0) continue

    const bannerType = classifyResultBannerType({
      category: r.category,
      mvpPlayerName: r.mvpPlayerName,
      mvpTeamName: r.mvpTeamName,
      winnerTeamName: r.winningTeam,
      screenshotUrl: urls[0],
    })

    for (let idx = 0; idx < urls.length; idx++) {
      const url = urls[idx]
      const bannerId = `${r.id}-${idx}`

      if (bannerType === "overall") {
        if (overallStandingsBanners.length < 10) {
          overallStandingsBanners.push({
            id: bannerId,
            winningTeam: r.winningTeam,
            scrimTitle: r.scrimTitle,
            matchDate: r.matchDate,
            category: r.category || "Overall Standing Banner",
            imageUrl: url,
          })
        }
      } else if (bannerType === "mvp") {
        if (mvpBanners.length < 10) {
          mvpBanners.push({
            id: bannerId,
            playerName: r.mvpPlayerName || undefined,
            teamName: r.mvpTeamName || r.winningTeam,
            scrimTitle: r.scrimTitle,
            matchDate: r.matchDate,
            kills: r.kills,
            imageUrl: url,
          })
        }
      } else if (bannerType === "top3") {
        if (top3Banners.length < 10) {
          top3Banners.push({
            id: bannerId,
            winningTeam: r.winningTeam,
            scrimTitle: r.scrimTitle,
            matchDate: r.matchDate,
            kills: r.kills,
            prizeBdt: r.prizeBdt,
            category: r.category || "Top 3 Face Banner",
            imageUrl: url,
          })
        }
      }
    }
  }

  const numberWords: Record<number, string> = {
    1: "One",
    2: "Two",
    3: "Three",
    4: "Four",
    5: "Five",
    6: "Six",
    7: "Seven",
    8: "Eight",
    9: "Nine",
    10: "Ten",
    11: "Eleven",
    12: "Twelve",
  }

  const scrimCount = scrims.length
  const countWord = numberWords[scrimCount] || (scrimCount > 0 ? `${scrimCount}` : "")
  const scheduleTitle = scrimCount > 0
    ? `${countWord} ${scrimCount === 1 ? "lobby" : "lobbies"}. Pick your hour.`
    : "Daily lobbies. Pick your hour."

  const stats = {
    scrimsTonight: scrimCount,
    totalTeams: scrims.reduce((s, x) => s + (x.maxTeams || 12), 0),
    totalPrize: scrims.reduce((s, x) => s + (x.prizePoolBdt || 0), 0),
  }
  const showcase = buildShowcaseSummary(scrims, settings)

  return (
    <>
      <SiteHeader user={user ? { name: user.name, role: user.role } : null} settings={settings} />
      <main className="w-full max-w-full overflow-x-clip flex-1">
        <Hero stats={stats} showcase={showcase} />

        <section id="schedule" className="mx-auto max-w-6xl px-4 py-20 md:px-6 scroll-mt-20" aria-labelledby="tonight-heading">
          <SectionHeading
            eyebrow="Tonight's Schedule"
            title={scheduleTitle}
            subtitle={
              scrimCount > 0
                ? showcase.timeWindow
                  ? `Live lobbies open (${showcase.timeWindow}) — pick your slot before teams fill up.`
                  : "Browse live lobbies managed by RushX admins. Book before slots fill."
                : "New competitive lobbies will be listed soon. Book before they fill."
            }
          />
          <HomeScrimsGrid initialScrims={scrims.map((s) => sanitizePublicScrim(s))} />
        </section>

        {/* Infinite Marquee Partners Section — directly above How It Works */}
        <Suspense fallback={null}>
          <PartnershipTickerBar />
        </Suspense>

        <HowItWorks showcase={showcase} />
        <Features showcase={showcase} />
        <WhyChooseUs showcase={showcase} />

        {/* Three strictly separated result showcases preserving original dimensions */}
        <OverallStandingsBannersSection banners={overallStandingsBanners} />
        <Top3FaceBannersSection banners={top3Banners} />
        <MvpFaceBannersSection banners={mvpBanners} />

        <Faq showcase={showcase} />
        <Contact settings={settings} />

        {/* SupportKori Banner downside of homepage (auto-hides if removed in Settings) */}
        <SupportKoriBanner supportKoriUrl={settings ? settings.supportKoriUrl : undefined} />
      </main>
      <SiteFooter settings={settings} />
    </>
  )
}
