"use client"

import Link from "next/link"
import { Handshake, ArrowUpRight } from "lucide-react"
import type { PartnershipItem } from "@/lib/db/schema"

function TickerSegment({ items, duplicate }: { items: PartnershipItem[]; duplicate?: boolean }) {
  return (
    <div
      className="flex shrink-0 items-center gap-6 pr-6"
      aria-hidden={duplicate ? "true" : undefined}
    >
      {items.map((item) => {
        const inner = (
          <span className="inline-flex items-center gap-2.5 whitespace-nowrap rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs transition-colors hover:border-primary/40 hover:bg-primary/10">
            {item.logoUrl ? (
              <img
                src={item.logoUrl}
                alt={item.partnerName}
                className="h-5 w-auto max-w-[76px] object-contain"
                loading="lazy"
              />
            ) : (
              <Handshake className="size-3.5 shrink-0 text-primary" />
            )}
            {item.badgeText && (
              <span className="rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-primary">
                {item.badgeText}
              </span>
            )}
            <span className="font-heading text-sm font-bold tracking-wide text-foreground">
              {item.partnerName}
            </span>
            <span className="text-border">•</span>
            <span className="text-xs font-medium text-muted-foreground">{item.headline}</span>
            {item.tagline && (
              <span className="hidden sm:inline text-[11px] text-primary/90 font-medium">
                — {item.tagline}
              </span>
            )}
            {item.linkUrl && (
              <ArrowUpRight className="size-3.5 shrink-0 text-primary/80" />
            )}
          </span>
        )

        if (!item.linkUrl) {
          return <div key={`${duplicate ? "dup-" : ""}${item.id}`}>{inner}</div>
        }

        const isExternal = /^https?:\/\//i.test(item.linkUrl)
        if (isExternal) {
          return (
            <a
              key={`${duplicate ? "dup-" : ""}${item.id}`}
              href={item.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              tabIndex={duplicate ? -1 : undefined}
              className="focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded-lg"
            >
              {inner}
            </a>
          )
        }

        return (
          <Link
            key={`${duplicate ? "dup-" : ""}${item.id}`}
            href={item.linkUrl}
            tabIndex={duplicate ? -1 : undefined}
            className="focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary rounded-lg"
          >
            {inner}
          </Link>
        )
      })}
    </div>
  )
}

export function PartnershipTicker({ items }: { items: PartnershipItem[] }) {
  if (!items || items.length === 0) return null

  // Repeat short lists so the ticker track always fills wide screens seamlessly
  const baseItems =
    items.length === 1
      ? [items[0], items[0], items[0], items[0]]
      : items.length === 2
        ? [...items, ...items]
        : items

  const durationSec = Math.max(22, baseItems.length * 9)

  return (
    <section
      aria-label="Official Partnerships and Collaborations"
      className="relative z-20 w-full border-y border-white/10 bg-[#070a12]/80 backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2 sm:px-6">
        <div className="hidden sm:flex shrink-0 items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
          <Handshake className="size-3.5" />
          <span>Partners</span>
        </div>

        <div className="partnership-marquee-wrap relative flex-1 overflow-hidden">
          <div
            className="partnership-marquee-track flex w-max items-center"
            style={{ ["--marquee-duration" as string]: `${durationSec}s` }}
          >
            <TickerSegment items={baseItems} />
            <TickerSegment items={baseItems} duplicate />
          </div>
        </div>
      </div>
    </section>
  )
}
