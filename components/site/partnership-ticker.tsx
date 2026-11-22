"use client"

import Link from "next/link"
import { Handshake, ArrowUpRight } from "lucide-react"
import type { PartnershipItem } from "@/lib/db/schema"
import type { PartnershipMarqueeSettings } from "@/lib/queries/partnerships"

function deduplicatePartners(items: PartnershipItem[]): PartnershipItem[] {
  const seenIds = new Set<string>()
  const seenNames = new Set<string>()
  const unique: PartnershipItem[] = []

  for (const item of items) {
    const idKey = (item.id || "").trim().toLowerCase()
    const nameKey = (item.partnerName || "").trim().toLowerCase().replace(/\s+/g, " ")
    if (!nameKey) continue
    if (seenIds.has(idKey) || seenNames.has(nameKey)) continue
    seenIds.add(idKey)
    seenNames.add(nameKey)
    unique.push(item)
  }

  return unique
}

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
      className="flex min-w-full shrink-0 items-center justify-around gap-12 sm:gap-16 lg:gap-20 pr-12 sm:pr-16 lg:pr-20"
      aria-hidden={duplicate ? "true" : undefined}
    >
      {items.map((item, idx) => {
        const content = (
          <div className="group inline-flex items-center gap-3.5 py-2 transition-opacity duration-200 hover:opacity-100 opacity-90">
            {item.logoUrl ? (
              <img
                src={item.logoUrl}
                alt={item.partnerName}
                className="h-9 w-auto max-w-[110px] sm:h-10 object-contain shrink-0 transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <Handshake className="size-6 shrink-0 text-primary/90" aria-hidden />
            )}

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 whitespace-nowrap">
                <span className="font-display text-base sm:text-lg font-semibold tracking-tight text-foreground/95 transition-colors group-hover:text-primary">
                  {item.partnerName}
                </span>
                {showBadges && item.badgeText && (
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-primary/85 whitespace-nowrap">
                    · {item.badgeText}
                  </span>
                )}
                {item.linkUrl && (
                  <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground/75 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
                )}
              </div>

              {(item.headline || item.tagline) && (
                <span className="text-xs font-semibold text-muted-foreground/85 whitespace-nowrap max-w-[260px] truncate">
                  {item.headline || item.tagline}
                </span>
              )}
            </div>

            <span
              className="ml-6 sm:ml-10 h-4 w-px bg-white/[0.1] shrink-0"
              aria-hidden
            />
          </div>
        )

        const key = `${duplicate ? "dup" : "main"}-${item.id}-${idx}`
        if (!item.linkUrl) {
          return (
            <div key={key} className="shrink-0">
              {content}
            </div>
          )
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
              className="shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60 rounded-md"
            >
              {content}
            </a>
          )
        }

        return (
          <Link
            key={key}
            href={item.linkUrl}
            tabIndex={duplicate ? -1 : undefined}
            className="shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60 rounded-md"
          >
            {content}
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

  const uniqueItems = deduplicatePartners(items)
  if (uniqueItems.length === 0) return null

  const heading = marqueeSettings?.heading || "Official Partners & Collaborations"
  const subheading =
    marqueeSettings?.subheading ??
    "Trusted esports communities, brands, and creators powering Ace Scrims."
  const speedSeconds = Math.min(90, Math.max(12, Number(marqueeSettings?.speedSeconds || 30)))
  const direction = marqueeSettings?.direction === "right" ? "right" : "left"
  const showBadges = marqueeSettings?.showBadges !== false

  return (
    <section
      aria-label={heading}
      className={`relative z-10 w-full overflow-hidden ${
        compact
          ? "py-6"
          : "py-14 sm:py-16 border-y border-white/[0.06] bg-gradient-to-b from-[#060912]/70 via-[#080c17]/60 to-[#050810]/70 backdrop-blur-md"
      }`}
    >
      {!compact && (
        <div className="mx-auto max-w-6xl px-4 md:px-6 mb-9 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              <span className="inline-block h-px w-6 bg-primary/80" aria-hidden />
              <span>Partnerships</span>
            </div>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
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
            className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-primary hover:text-orange-300 transition-colors shrink-0"
          >
            View All Partners <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      )}

      {/* Seamless borderless infinite marquee — deduplicated per pass, never pauses on hover or focus */}
      <div className="partnership-marquee-wrap relative w-full overflow-hidden py-2">
        <div
          className={`partnership-marquee-track flex items-center ${
            direction === "right" ? "partnership-marquee-reverse" : ""
          }`}
          style={{ ["--marquee-duration" as string]: `${speedSeconds}s` }}
        >
          <MarqueeTrackGroup items={uniqueItems} showBadges={showBadges} />
          <MarqueeTrackGroup items={uniqueItems} showBadges={showBadges} duplicate />
        </div>
      </div>
    </section>
  )
}
