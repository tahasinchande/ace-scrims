import type { Metadata } from "next"
import Link from "next/link"
import { Handshake, ArrowUpRight, Sparkles } from "lucide-react"
import { SiteHeader } from "@/components/site/site-header"
import { SiteFooter } from "@/components/site/site-footer"
import { PartnershipTicker } from "@/components/site/partnership-ticker"
import { Button } from "@/components/ui/button"
import { getSessionUser } from "@/lib/session"
import { getPublicSiteSettings } from "@/lib/queries/settings"
import {
  getActivePartnershipItems,
  getPartnershipMarqueeSettings,
} from "@/lib/queries/partnerships"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Official Partnerships & Collaborations",
  description:
    "Explore Ace Scrims official esports partners, community collaborators, and brand sponsors powering daily competitive Free Fire scrims.",
}

export default async function PartnershipsPage() {
  const [user, siteSettings, items, marqueeSettings] = await Promise.all([
    getSessionUser().catch(() => null),
    getPublicSiteSettings().catch(() => undefined),
    getActivePartnershipItems(),
    getPartnershipMarqueeSettings(),
  ])

  return (
    <>
      <SiteHeader
        user={user ? { name: user.name, role: user.role } : null}
        settings={siteSettings}
      />
      <main className="flex-1 w-full overflow-x-hidden pt-20 pb-20">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 md:px-6 pb-10">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              <span className="inline-block h-px w-6 bg-primary/80" aria-hidden />
              <span>Ace Scrims Ecosystem</span>
            </div>
            <h1 className="font-display text-4xl font-semibold tracking-[-0.03em] text-foreground sm:text-5xl">
              {marqueeSettings.heading}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              {marqueeSettings.subheading ||
                "Official esports communities, brands, and creators collaborating with Ace Scrims across Bangladesh."}
            </p>
          </div>
        </section>

        {/* Continuous Borderless Infinite Marquee Showcase */}
        {items.length > 0 && (
          <PartnershipTicker
            items={items}
            marqueeSettings={{ ...marqueeSettings, enabled: true }}
            compact
          />
        )}

        {/* Partner Directory Grid */}
        <section className="mx-auto max-w-6xl px-4 md:px-6 pt-12">
          {items.length === 0 ? (
            <div className="dc-surface rounded-2xl p-12 text-center space-y-3">
              <Handshake className="mx-auto size-10 text-primary/70" />
              <h2 className="font-display text-xl font-semibold tracking-tight">
                Partnership Announcements Coming Soon
              </h2>
              <p className="mx-auto max-w-md text-sm text-muted-foreground">
                Interested in partnering with Ace Scrims for tournaments, sponsorships, or creator
                collaborations? Reach out to our team.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => {
                const cardInner = (
                  <div className="dc-surface dc-card-hover flex h-full flex-col justify-between gap-4 rounded-2xl p-6">
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex size-14 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] p-2 overflow-hidden">
                          {item.logoUrl ? (
                            <img
                              src={item.logoUrl}
                              alt={item.partnerName}
                              className="h-full w-full object-contain"
                              loading="lazy"
                            />
                          ) : (
                            <Handshake className="size-6 text-primary" />
                          )}
                        </div>
                        {item.badgeText && (
                          <span className="rounded-lg border border-primary/25 bg-primary/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-primary">
                            {item.badgeText}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
                          {item.partnerName}
                        </h2>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {item.headline}
                        </p>
                        {item.tagline && (
                          <p className="text-xs font-semibold text-primary/90 pt-1">
                            {item.tagline}
                          </p>
                        )}
                      </div>
                    </div>

                    {item.linkUrl && (
                      <div className="flex items-center gap-1.5 border-t border-white/[0.07] pt-3 text-xs font-semibold tracking-wide text-primary">
                        <span>Visit Partner</span>
                        <ArrowUpRight className="size-3.5" />
                      </div>
                    )}
                  </div>
                )

                if (!item.linkUrl) {
                  return <div key={item.id}>{cardInner}</div>
                }
                const isExternal = /^https?:\/\//i.test(item.linkUrl)
                return isExternal ? (
                  <a
                    key={item.id}
                    href={item.linkUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block h-full"
                  >
                    {cardInner}
                  </a>
                ) : (
                  <Link key={item.id} href={item.linkUrl} className="block h-full">
                    {cardInner}
                  </Link>
                )
              })}
            </div>
          )}

          {/* Creator / Brand Collaboration CTA */}
          <div className="dc-surface mt-12 flex flex-col items-start justify-between gap-5 rounded-3xl border-white/[0.1] p-6 sm:flex-row sm:items-center sm:p-8">
            <div className="space-y-1.5">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                <Sparkles className="size-3.5" /> Partner With Us
              </p>
              <h3 className="font-display text-2xl font-semibold tracking-tight text-foreground">
                Want to collaborate with Ace Scrims?
              </h3>
              <p className="text-sm text-muted-foreground">
                Content creators can apply directly for an official referral code &amp; Creator Wallet.
              </p>
            </div>
            <Button asChild size="lg" className="h-11 rounded-xl px-6 shrink-0 font-semibold">
              <Link href="/creators">Apply as Creator</Link>
            </Button>
          </div>
        </section>
      </main>
      <SiteFooter settings={siteSettings} />
    </>
  )
}
