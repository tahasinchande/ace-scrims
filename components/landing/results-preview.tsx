"use client"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { SectionHeading } from "@/components/landing/sections"
import { Trophy, ChevronRight, ExternalLink, X, Eye } from "lucide-react"
import { bdt, formatDate } from "@/lib/format"
import { resolveImageUrl } from "@/lib/image-url"

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

  return (
    <section className="mx-auto max-w-6xl px-4 py-20 md:px-6" aria-labelledby="results-heading">
      <SectionHeading
        eyebrow="Recent Champions"
        title="Top 3 & Match Champions"
        subtitle="Every result is published with kills, prize pool, and official Top 3 Face Banners."
      />
      {displayResults.length === 0 ? (
        <div className="glass flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 p-12 text-center">
          <Trophy className="size-12 text-muted-foreground/40 mb-3" />
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
            <div
              key={r.id}
              className="glass flex flex-col gap-4 rounded-2xl p-5 border border-border/60 hover:border-primary/40 transition-colors overflow-hidden"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-xl font-display text-base font-black ${
                    i === 0
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      : i === 1
                      ? "bg-slate-300/20 text-slate-300 border border-slate-300/30"
                      : "bg-amber-700/20 text-amber-600 border border-amber-700/30"
                  }`}
                  aria-hidden
                >
                  <Trophy className="size-5" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-display font-bold text-foreground text-base">{r.winningTeam}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.scrimTitle ?? "Scrim"} · {formatDate(r.matchDate)}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="font-display font-bold text-primary">{bdt(r.prizeBdt)}</p>
                  <p className="text-xs text-muted-foreground">{r.kills} kills</p>
                </div>
              </div>

              {/* Banner / Screenshot display */}
              {bannerImage && (
                <div className="relative group overflow-hidden rounded-xl border border-border/70 bg-black/40 h-40">
                  <Image
                    src={bannerImage}
                    alt={`${r.winningTeam} Top 3 Face Banner`}
                    fill
                    unoptimized
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <button
                    onClick={() => setLightboxImage(bannerImage)}
                    className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-semibold gap-1.5"
                  >
                    <Eye className="size-4 text-primary" />
                    <span>View Banner</span>
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
      )}

      <div className="mt-8 text-center">
        <Button asChild variant="outline" className="glass bg-transparent hover:border-primary/50 hover:bg-primary/10">
          <Link href="/results">
            Full Results & Leaderboard
            <ChevronRight className="size-4" />
          </Link>
        </Button>
      </div>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full overflow-hidden rounded-2xl border border-border bg-card p-2 shadow-2xl">
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-4 right-4 z-10 rounded-full bg-black/70 p-2 text-white hover:bg-black"
              aria-label="Close banner preview"
            >
              <X className="size-5" />
            </button>
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
