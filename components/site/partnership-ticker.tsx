"use client"

import Link from "next/link"
import { Handshake, ArrowUpRight } from "lucide-react"
import type { PartnershipItem } from "@/lib/db/schema"
import type { PartnershipMarqueeSettings } from "@/lib/queries/partnerships"

function MarqueeTrackGroup({
  items,
  showBadges,
  duplicate,
}: {
  items: PartnershipItem[]
  showBadges: boolean
  duplicate?: boolean
}) {
  return (
    <div
      className="flex shrink-0 items-stretch gap-4 sm:gap-5 pr-4 sm:pr-5"
      aria-hidden={duplicate ? "true" : undefined}
    >
      {items.map((item, idx) => {
        const card = (
          <div className="dc-surface group flex h-full min-w-[240px] sm:min-w-[290px] max-w-[340px] items-center gap-3.5 rounded-2xl border border-white/[0.08] bg-[#0a0e18]/90 px-4 py-3.5 sm:px-5 sm:py-4 transition-colors duration-200 hover:border-primary/40">
            <div className="flex size-11 sm:size-12 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] p-1.5 overflow-hidden">
              {item.logoUrl ? (
                <img
                  src={item.logoUrl}
                  alt={item.partnerName}
                  className="h-full w-full object-contain"
                  loading="lazy"
                />
              ) : (
                <Handshake className="size-5 text-primary" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-display text-sm sm:text-base font-bold uppercase tracking-wide text-foreground truncate">
                  {item.partnerName}
                </span>
                {item.linkUrl && (
                  <ArrowUpRight className="size-3.5 shrink-0 text-primary/80 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                )}
              </div>

              <p className="mt-0.5 text-xs text-muted-foreground truncate">
                {item.headline}
              </p>

              {(showBadges && item.badgeText) || item.tagline ? (
                <div className="mt-1.5 flex items-center gap-2">
                  {showBadges && item.badgeText && (
                    <span className="rounded border border-primary/25 bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-primary whitespace-nowrap">
                      {item.badgeText}
                    </span>
                  )}
                  {item.tagline && (
                    <span className="text-[11px] font-medium text-foreground/75 truncate">
                      {item.tagline}
                    </span>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )

        const key = `${duplicate ? "dup" : "main"}-${item.id}-${idx}`
        if (!item.linkUrl) {
          return <div key={key}>{card}</div>
        }

        const isExternal = /^https?:\/\//i.test(item.linkUrl)
        if (isExternal) {
          return (
            <a
              key={key}
              href={item.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              tabIndex={duplicate ? -1 : undefined}
              className="block rounded-2xl focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              {card}
            </a>
          )
        }

        return (
          <Link
            key={key}
            href={item.linkUrl}
            tabIndex={duplicate ? -1 : undefined}
            className="block rounded-2xl focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            {card}
          </Link>
        )
      })}
    </div>
  )
}

export function PartnershipTicker({
  items,
  marqueeSettings,
  compact = false,
}: {
  items: PartnershipItem[]
  marqueeSettings?: Partial<PartnershipMarqueeSettings>
  compact?: boolean
}) {
  if (!items || items.length === 0) return null
  if (marqueeSettings?.enabled === false) return null

  const heading = marqueeSettings?.heading || "Official Partners & Collaborations"
  const subheading =
    marqueeSettings?.subheading ??
    "Trusted esports communities, brands, and creators powering Ace Scrims."
  const speedSeconds = Math.min(90, Math.max(10, Number(marqueeSettings?.speedSeconds || 30)))
  const direction = marqueeSettings?.direction === "right" ? "right" : "left"
  const showBadges = marqueeSettings?.showBadges !== false

  // Ensure each half-track always has at least 6 items so ultra-wide screens have zero visible gap
  const minItemsPerTrack = 6
  const repeats = Math.max(1, Math.ceil(minItemsPerTrack / items.length))
  const trackItems: PartnershipItem[] = []
  for (let i = 0; i < repeats; i++) {
    trackItems.push(...items)
  }

  return (
    <section
      aria-label={heading}
      className={`relative z-10 w-full overflow-hidden ${
        compact ? "py-4" : "py-14 sm:py-16 border-y border-white/[0.06] bg-[#060911]/65 backdrop-blur-md"
      }`}
    >
      {!compact && (
        <div className="mx-auto max-w-6xl px-4 md:px-6 mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">
              <span className="inline-block h-px w-6 bg-primary" aria-hidden />
              <span>Partnerships</span>
            </div>
            <h2 className="mt-2 font-display text-2xl font-bold uppercase tracking-tight text-foreground sm:text-3xl">
              {heading}
            </h2>
            {subheading && (
              <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground leading-relaxed">
                {subheading}
              </p>
            )}
          </div>
          <Link
            href="/partnerships"
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary hover:underline shrink-0"
          >
            View All Partners <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      )}

      {/* Seamless infinite marquee — never pauses on hover or focus */}
      <div className="partnership-marquee-wrap relative w-full overflow-hidden">
        <div
          className={`partnership-marquee-track flex w-max items-stretch ${
            direction === "right" ? "partnership-marquee-reverse" : ""
          }`}
          style={{ ["--marquee-duration" as string]: `${speedSeconds}s` }}
        >
          <MarqueeTrackGroup items={trackItems} showBadges={showBadges} />
          <MarqueeTrackGroup items={trackItems} showBadges={showBadges} duplicate />
        </div>
      </div>
    </section>
  )
}
