import { Suspense } from "react"
import { getSessionUser, checkMaintenanceMode } from "@/lib/session"
import { getActiveScrims } from "@/lib/queries/scrims"
import { sanitizePublicScrim } from "@/lib/iceberg"
import { getRecentResults } from "@/lib/queries/results"
import { getPublicSiteSettings } from "@/lib/queries/settings"
import { SiteHeader } from "@/components/site/site-header"
import { SiteFooter } from "@/components/site/site-footer"
import { SupportKoriBanner } from "@/components/site/supportkori-banner"
import { AnnouncementBanner } from "@/components/site/announcement-banner"
import { Hero } from "@/components/landing/hero"
import { Features, HowItWorks, WhyChooseUs, Faq, Contact, SectionHeading } from "@/components/landing/sections"
import { Top3FaceBannersSection, type Top3BannerItem } from "@/components/landing/top3-face-banners"
import { MvpFaceBannersSection, type MvpBannerItem } from "@/components/landing/mvp-face-banners"
import { HomeScrimsGrid } from "@/components/site/home-scrims-grid"
import { PartnershipTickerBar } from "@/components/site/partnership-ticker-bar"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function HomePage() {
  await checkMaintenanceMode()

  const [user, scrims, results, settings] = await Promise.all([
    getSessionUser().catch(() => null),
    getActiveScrims().catch(() => []),
    getRecentResults(6, true).catch(() => []),
    getPublicSiteSettings().catch(() => undefined),
  ])

  // Extract all banners from results
  const allBanners = results.flatMap((r) => {
    const urls = Array.isArray(r.imageUrls) && r.imageUrls.length > 0
      ? (r.imageUrls as string[])
      : r.screenshotUrl
        ? [r.screenshotUrl]
        : []
    const isMvp = (r.category || "").toLowerCase().includes("mvp") || Boolean(r.mvpPlayerName)
    return urls.map((url, idx) => ({
      id: `${r.id}-${idx}`,
      winningTeam: r.winningTeam,
      mvpPlayerName: r.mvpPlayerName,
      mvpTeamName: r.mvpTeamName,
      scrimTitle: r.scrimTitle,
      matchDate: r.matchDate,
      kills: r.kills,
      prizeBdt: r.prizeBdt,
      category: r.category || (isMvp ? "MVP Face Banner" : "Top 3 Face Banner"),
      imageUrl: url,
      isMvp,
    }))
  })

  // Separate into exactly two distinct collections: "Top 3 Face Banners" and "MVP Face Banners"
  const top3Banners: Top3BannerItem[] = allBanners
    .filter((b) => !b.isMvp)
    .slice(0, 8)

  const mvpBanners: MvpBannerItem[] = allBanners
    .filter((b) => b.isMvp)
    .map((b) => ({
      id: b.id,
      playerName: b.mvpPlayerName || undefined,
      teamName: b.mvpTeamName || b.winningTeam,
      scrimTitle: b.scrimTitle,
      matchDate: b.matchDate,
      kills: b.kills,
      imageUrl: b.imageUrl,
    }))
    .slice(0, 8)

  const displayTop3Banners: Top3BannerItem[] = top3Banners
  const displayMvpBanners: MvpBannerItem[] = mvpBanners

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

  return (
    <>
      <Suspense fallback={null}>
        <AnnouncementBanner />
      </Suspense>
      <SiteHeader user={user ? { name: user.name, role: user.role } : null} settings={settings} />
      <main className="w-full max-w-full overflow-x-hidden flex-1">
        <Hero stats={stats} />

        <section id="schedule" className="mx-auto max-w-6xl px-4 py-20 md:px-6 scroll-mt-20" aria-labelledby="tonight-heading">
          <SectionHeading
            eyebrow="Tonight's Schedule"
            title={scheduleTitle}
            subtitle={
              scrimCount > 0
                ? "Every scrim runs for one hour with 12 team slots. Book before they fill."
                : "New competitive lobbies will be listed soon. Book before they fill."
            }
          />
          <HomeScrimsGrid initialScrims={scrims.map((s) => sanitizePublicScrim(s))} />
        </section>

        {/* Infinite Marquee Partners Section — directly above How It Works */}
        <Suspense fallback={null}>
          <PartnershipTickerBar />
        </Suspense>

        <HowItWorks />
        <Features />
        <WhyChooseUs />
        
        {/* Two distinct sections with dynamic image sizing preserving original dimensions */}
        <Top3FaceBannersSection banners={displayTop3Banners} />
        <MvpFaceBannersSection banners={displayMvpBanners} />

        <Faq />
        <Contact settings={settings} />

        {/* SupportKori Banner downside of homepage */}
        <SupportKoriBanner supportKoriUrl={settings?.supportKoriUrl} />
      </main>
      <SiteFooter settings={settings} />
    </>
  )
}
