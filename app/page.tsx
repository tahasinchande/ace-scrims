import { Suspense } from "react"
import { getSessionUser } from "@/lib/session"
import { getActiveScrims } from "@/lib/queries/scrims"
import { getRecentResults } from "@/lib/queries/results"
import { SiteHeader } from "@/components/site/site-header"
import { SiteFooter } from "@/components/site/site-footer"
import { AnnouncementBanner } from "@/components/site/announcement-banner"
import { Hero } from "@/components/landing/hero"
import { Features, HowItWorks, WhyChooseUs, Faq, Contact, SectionHeading } from "@/components/landing/sections"
import { ResultsPreview } from "@/components/landing/results-preview"
import { ScrimCard } from "@/components/site/scrim-card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ChevronRight } from "lucide-react"

export default async function HomePage() {
  const [user, scrims, results] = await Promise.all([
    getSessionUser().catch(() => null),
    getActiveScrims().catch(() => []),
    getRecentResults(3).catch(() => []),
  ])

  const stats = {
    scrimsTonight: scrims.length || 6,
    totalTeams: scrims.reduce((s, x) => s + x.maxTeams, 0) || 72,
    totalPrize: scrims.reduce((s, x) => s + x.prizePoolBdt, 0) || 2400,
  }

  return (
    <>
      <Suspense fallback={null}>
        <AnnouncementBanner />
      </Suspense>
      <SiteHeader user={user ? { name: user.name, role: user.role } : null} />
      <main>
        <Hero stats={stats} />

        <section className="mx-auto max-w-6xl px-4 py-20 md:px-6" aria-labelledby="tonight-heading">
          <SectionHeading
            eyebrow="Tonight's Schedule"
            title="Six lobbies. Pick your hour."
            subtitle="Every scrim runs for one hour with 12 team slots. Book before they fill."
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {scrims.slice(0, 6).map((s) => (
              <ScrimCard key={s.id} scrim={s} />
            ))}
          </div>
          {scrims.length > 6 && (
            <div className="mt-8 text-center">
              <Button asChild variant="outline" className="glass bg-transparent">
                <Link href="/scrims">
                  All scrims
                  <ChevronRight className="size-4" />
                </Link>
              </Button>
            </div>
          )}
        </section>

        <HowItWorks />
        <Features />
        <WhyChooseUs />
        <ResultsPreview
          results={results.map((r) => ({
            id: r.id,
            winningTeam: r.winningTeam,
            kills: r.kills,
            prizeBdt: r.prizeBdt,
            matchDate: r.matchDate,
            scrimTitle: r.scrimTitle,
          }))}
        />
        <Faq />
        <Contact />
      </main>
      <SiteFooter />
    </>
  )
}
