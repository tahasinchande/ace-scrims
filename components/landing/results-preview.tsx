"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { motion, useReducedMotion } from "motion/react"
import { Button } from "@/components/ui/button"
import { SectionHeading } from "@/components/landing/sections"
import { Trophy, ChevronRight, X, Eye } from "lucide-react"
import { bdt, formatDate } from "@/lib/format"
import { resolveImageUrl } from "@/lib/image-url"

const DEEPCHARTS_EASE = [0.16, 1, 0.3, 1] as const

export type ResultPreview = {
  id: string
  winningTeam: string
  kills: number
  prizeBdt: number
  matchDate: string
  scrimTitle: string | null
  category?: string | null
  screenshotUrl?: string | null
  imageUrls?: string[] | null
}

export function ResultsPreview({ results }: { results: ResultPreview[] }) {
  const displayResults = results && results.length > 0 ? results : []
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const prefersReducedMotion = useReducedMotion()

  return (
    <section className="mx-auto max-w-6xl px-4 py-20 md:px-6" aria-labelledby="results-heading">
      <SectionHeading
        eyebrow="Recent Champions"
        title="Top 3 & Match Champions"
        subtitle="Every result is published with kills, prize pool, and official Top 3 Face Banners."
      />
      {displayResults.length === 0 ? (
        <div className="dc-surface flex flex-col items-center justify-center rounded-2xl border border-dashed border-[rgba(var(--rushx-soft-rgb),0.28)] p-12 text-center">
          <Trophy className="size-10 text-accent/60 mb-3" />
          <h3 className="font-display text-lg font-bold text-foreground">No match results published yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            Official match results and podium face banners will appear here as soon as upcoming scrim rooms conclude.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {displayResults.map((r, i) => {
            const rawBanner =
              Array.isArray(r.imageUrls) && r.imageUrls.length > 0
                ? r.imageUrls[0]
                : r.screenshotUrl || null
            const bannerImage = rawBanner ? resolveImageUrl(rawBanner) : null

            return (
              <motion.div
                key={r.id}
                initial={prefersReducedMotion ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 18, scale: 0.988 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, amount: "some" }}
                transition={{
                  duration: prefersReducedMotion ? 0 : 0.5,
                  delay: prefersReducedMotion ? 0 : i * 0.06,
                  ease: DEEPCHARTS_EASE,
                }}
                className="dc-surface dc-card-hover rushx-box-splash flex flex-col gap-4 rounded-2xl p-5 overflow-hidden"
              >
                <div className="flex items-center gap-3">
                  <Trophy
                    className={`size-5 shrink-0 ${
                      i === 0
                        ? "text-amber-300"
                        : i === 1
                          ? "text-slate-300"
                          : "text-accent"
                    }`}
                    aria-hidden
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display font-bold text-foreground text-base">{r.winningTeam}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.scrimTitle ?? "Scrim"} · {formatDate(r.matchDate)}
                    </p>
                  </div>

                  <div className="text-right shrink-0 tabular-nums">
                    <p className="font-display font-bold text-accent">{bdt(r.prizeBdt)}</p>
                    <p className="text-xs text-muted-foreground">{r.kills} kills</p>
                  </div>
                </div>

                {bannerImage && (
                  <div className="relative group overflow-hidden rounded-xl border border-white/10 bg-black/40 h-40">
                    <Image
                      src={bannerImage}
                      alt={`${r.winningTeam} Top 3 Face Banner`}
                      fill
                      unoptimized
                      className="object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <button
                      type="button"
                      onClick={() => setLightboxImage(bannerImage)}
                      className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-semibold gap-1.5 cursor-pointer"
                    >
                      <Eye className="size-4 text-accent" />
                      <span>View Banner</span>
                    </button>
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      )}

      <div className="mt-8 text-center">
        <Button asChild variant="outline" className="glass bg-transparent hover:border-[rgba(var(--rushx-soft-rgb),0.5)] hover:bg-[rgba(var(--rushx-primary-rgb),0.12)]">
          <Link href="/results">
            Full Results &amp; Leaderboard
            <ChevronRight className="size-4" />
          </Link>
        </Button>
      </div>

      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full overflow-hidden rounded-2xl border border-violet-300/20 bg-[#080c1c] p-2 shadow-2xl">
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute top-4 right-4 z-10 rounded-full bg-black/70 p-2 text-white hover:bg-black cursor-pointer"
              aria-label="Close banner preview"
            >
              <X className="size-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxImage}
              alt="Full Size Top 3 Face Banner"
              className="w-full max-h-[85vh] object-contain rounded-xl"
            />
          </div>
        </div>
      )}
    </section>
  )
}
