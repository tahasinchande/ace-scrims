"use client"

import Link from "next/link"
import { Handshake, ArrowUpRight } from "lucide-react"
import type { PartnershipItem } from "@/lib/db/schema"
import type { PartnershipMarqueeSettings } from "@/lib/queries/partnerships"
import { resolveVerifiedPartnerLogo } from "@/lib/partner-logos"
import { Reveal } from "@/components/site/reveal"

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

function MarqueeTrackHalf({
  items,
  repeatCount,
  showBadges,
  duplicate,
}: {
  items: PartnershipItem[]
  repeatCount: number
  showBadges: boolean
  duplicate?: boolean
}) {
  const tiled: Array<{ item: PartnershipItem; passIndex: number; idx: number }> = []
  for (let pass = 0; pass < repeatCount; pass++) {
    items.forEach((item, idx) => {
      tiled.push({ item, passIndex: pass, idx })
    })
  }

  return (
    <div
      className="flex shrink-0 flex-nowrap items-center gap-7 sm:gap-9 pr-7 sm:pr-9"
      aria-hidden={duplicate ? "true" : undefined}
    >
      {tiled.map(({ item, passIndex, idx }) => {
        const resolvedLogo = resolveVerifiedPartnerLogo(item.partnerName, item.logoUrl)
        const content = (
          <div className="group inline-flex items-center gap-3 py-1.5 opacity-90 transition-opacity duration-200 hover:opacity-100">
            {resolvedLogo ? (
              <img
                src={resolvedLogo}
                alt={item.partnerName}
                className="h-8 sm:h-9 w-auto max-w-[120px] object-contain shrink-0 transition-transform duration-300 group-hover:scale-105"
                loading="lazy"
              />
            ) : (
              <Handshake className="size-5 shrink-0 text-primary/90" aria-hidden />
            )}

            <div className="flex flex-col min-w-0 leading-tight">
              <div className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="font-display text-base sm:text-lg font-bold tracking-tight text-foreground/95 transition-colors group-hover:text-primary">
                  {item.partnerName}
                </span>
                {showBadges && item.badgeText && (
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-primary/85 whitespace-nowrap">
                    · {item.badgeText}
                  </span>
                )}
                {item.linkUrl && (
                  <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground/75 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary" />
                )}
              </div>

              {(item.headline || item.tagline) && (
                <span className="text-[11px] font-medium text-muted-foreground/85 whitespace-nowrap max-w-[220px] truncate">
                  {item.headline || item.tagline}
                </span>
              )}
            </div>

            <span
              className="ml-3 sm:ml-4 h-3.5 w-px bg-white/[0.12] shrink-0"
              aria-hidden
            />
          </div>
        )

        const key = `${duplicate ? "half2" : "half1"}-p${passIndex}-${item.id}-${idx}`
        const rawLink = (item.linkUrl || "").trim()
        const isSafeExternal = /^https?:\/\//i.test(rawLink)
        const isSafeInternal = rawLink.startsWith("/") && !rawLink.startsWith("//")
        if (!isSafeExternal && !isSafeInternal) {
          return (
            <div key={key} className="shrink-0">
              {content}
            </div>
          )
        }

        if (isSafeExternal) {
          return (
            <a
              key={key}
              href={rawLink}
              target="_blank"
              rel="noopener noreferrer"
              tabIndex={duplicate || passIndex > 0 ? -1 : undefined}
              className="shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/60 rounded-md"
            >
              {content}
            </a>
          )
        }

        return (
          <Link
            key={key}
            href={rawLink}
            tabIndex={duplicate || passIndex > 0 ? -1 : undefined}
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
    "Trusted esports communities, brands, and creators powering RushX Organization."
  const rawSpeed = Number(marqueeSettings?.speedSeconds)
  const speedSeconds = Number.isFinite(rawSpeed)
    ? Math.min(300, Math.max(1, rawSpeed))
    : 24
  const direction = marqueeSettings?.direction === "right" ? "right" : "left"
  const showBadges = marqueeSettings?.showBadges !== false

  // Ensure each half-track cleanly exceeds viewport width so the 0 -> -50% loop has zero gap or jump
  const repeatCount = Math.max(1, Math.ceil(8 / uniqueItems.length))

  return (
    <section
      aria-label={heading}
      className={`relative z-10 w-full overflow-hidden ${
        compact
          ? "py-4"
          : "py-12 sm:py-14 border-y border-white/[0.06] bg-[#060912]/45 backdrop-blur-md"
      }`}
    >
      <Reveal y={16} duration={0.62}>
        {!compact && (
          <div className="mx-auto max-w-6xl px-4 md:px-6 mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                <span className="inline-block h-px w-6 bg-primary/80" aria-hidden />
                <span>Partnerships</span>
              </div>
              <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
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
              className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-primary hover:text-cyan-300 transition-colors shrink-0"
            >
              View All Partners <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        )}

        {/* Compact, borderless, pixel-seamless infinite marquee — never pauses on hover or focus */}
        <div className="partnership-marquee-wrap relative w-full overflow-hidden py-1.5">
          <div
            className={`partnership-marquee-track flex items-center ${
              direction === "right" ? "partnership-marquee-reverse" : ""
            }`}
            style={{ ["--marquee-duration" as string]: `${speedSeconds}s` }}
          >
            <MarqueeTrackHalf items={uniqueItems} repeatCount={repeatCount} showBadges={showBadges} />
            <MarqueeTrackHalf
              items={uniqueItems}
              repeatCount={repeatCount}
              showBadges={showBadges}
              duplicate
            />
          </div>
        </div>
      </Reveal>
    </section>
  )
}
