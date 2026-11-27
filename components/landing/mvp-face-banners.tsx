"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { motion, AnimatePresence, useReducedMotion } from "motion/react"
import { resolveImageUrl } from "@/lib/image-url"
import { formatDate } from "@/lib/format"
import { Flame, ZoomIn, X, Calendar, ChevronLeft, ChevronRight, Crosshair, Trophy, Pause, Play } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export type MvpBannerItem = {
  id: string
  playerName?: string
  teamName: string
  scrimTitle: string | null
  matchDate: string
  kills?: number
  playerUid?: string
  imageUrl: string
}

export function MvpFaceBannersSection({ banners }: { banners: MvpBannerItem[] }) {
  if (!banners || banners.length === 0) {
    return null
  }
  return <MvpFaceBannersInner banners={banners} />
}

function MvpFaceBannersInner({ banners }: { banners: MvpBannerItem[] }) {
  const count = banners.length
  const prefersReducedMotion = useReducedMotion()

  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [activeLightbox, setActiveLightbox] = useState<string | null>(null)
  const [timerKey, setTimerKey] = useState(0)

  // Clamp index if banners change
  useEffect(() => {
    if (currentIndex >= count) {
      setCurrentIndex(0)
    }
  }, [count, currentIndex])

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % count)
    setTimerKey((k) => k + 1)
  }, [count])

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + count) % count)
    setTimerKey((k) => k + 1)
  }, [count])

  const handleSelect = (idx: number) => {
    setCurrentIndex(idx)
    setTimerKey((k) => k + 1)
  }

  // Exact 5-second automatic slideshow transition
  useEffect(() => {
    if (count <= 1 || isPaused) return

    const timer = setInterval(() => {
      handleNext()
    }, 5000)

    return () => clearInterval(timer)
  }, [count, isPaused, handleNext, timerKey])

  const currentItem = banners[currentIndex] || banners[0]
  const currentImageSrc = resolveImageUrl(currentItem.imageUrl)

  return (
    <section
      id="mvp-banners"
      aria-labelledby="mvp-banners-heading"
      className="mx-auto max-w-6xl px-4 py-16 md:px-6 flex flex-col items-center text-center"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Centered Heading */}
      <motion.div
        initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
        className="flex flex-col items-center text-center max-w-2xl mb-8"
      >
        <div className="inline-flex items-center gap-2 text-accent text-xs font-display font-bold uppercase tracking-wider mb-2">
          <Flame className="size-4 text-accent animate-pulse" />
          <span>Tournament MVPs &amp; Standout Fraggers</span>
        </div>
        <h2
          id="mvp-banners-heading"
          className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold uppercase tracking-tight text-foreground"
        >
          MVP Face Banners
        </h2>
        <p className="text-sm sm:text-base text-muted-foreground mt-2 max-w-xl">
          Spotlighting top fragging match champions and tournament MVPs with original high-resolution face banners.
        </p>
        <div className="mt-4 flex items-center justify-center gap-2">
          <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary font-semibold">
            {count} MVP Showcase{count > 1 ? "s" : ""}
          </Badge>
          {count > 1 && (
            <Badge variant="secondary" className="font-mono text-xs flex items-center gap-1.5">
              <span>Slide {currentIndex + 1} of {count}</span>
              {isPaused ? <Pause className="size-2.5 text-primary" /> : <Play className="size-2.5 text-emerald-400 fill-emerald-400" />}
            </Badge>
          )}
        </div>
      </motion.div>

      {/* Centered Slideshow Stage */}
      <motion.div
        initial={prefersReducedMotion ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.95, y: 22 }}
        whileInView={{ opacity: 1, scale: 1, y: 0 }}
        viewport={{ once: true, margin: "-50px" }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}
        className="relative w-full max-w-4xl flex flex-col items-center"
      >
        {/* Banner Slide Frame */}
        <div className="dc-surface relative w-full rounded-3xl shadow-2xl p-3 sm:p-5 overflow-hidden flex flex-col items-center">
          {/* 5-Second Animated Progress Bar */}
          {count > 1 && !isPaused && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-white/10 overflow-hidden z-30">
              <motion.div
                key={`progress-mvp-${currentIndex}-${timerKey}`}
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 5, ease: "linear" }}
                className="h-full"
                style={{
                  background:
                    "linear-gradient(90deg, rgb(var(--rushx-primary-rgb)) 0%, rgb(var(--rushx-accent-rgb)) 55%, rgb(var(--rushx-soft-rgb)) 100%)",
                  boxShadow: "0 0 10px rgba(var(--rushx-accent-rgb), 0.75)",
                }}
              />
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={currentItem.id || currentIndex}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.45, ease: "easeInOut" }}
              className="w-full flex flex-col items-center"
            >
              {/* Natural Dimension Image Container */}
              <div className="relative group flex items-center justify-center max-w-full min-h-[260px] sm:min-h-[340px] overflow-hidden rounded-2xl bg-black/50 p-2 sm:p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentImageSrc}
                  alt={`${currentItem.playerName || currentItem.teamName} MVP Face Banner`}
                  className="max-h-[520px] w-auto max-w-full rounded-xl object-contain shadow-2xl transition-transform duration-500 ease-out group-hover:scale-[1.02]"
                  loading="lazy"
                />

                {/* Lightbox / Zoom Overlay */}
                <button
                  type="button"
                  onClick={() => setActiveLightbox(currentImageSrc)}
                  aria-label={`View full resolution image for ${currentItem.playerName || currentItem.teamName}`}
                  className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 backdrop-blur-xs rounded-xl cursor-pointer"
                >
                  <span className="flex items-center gap-2 rounded-full bg-black/85 px-4 py-2 text-xs font-semibold text-white border border-white/20 shadow-xl transition-transform duration-200 group-hover:scale-105">
                    <ZoomIn className="size-4 text-accent" /> View Full Original Resolution
                  </span>
                </button>
              </div>

              {/* Centered Slide Caption & Meta */}
              <div className="mt-4 w-full flex flex-col items-center text-center gap-2 px-4 pb-2">
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-xs">
                    #{currentIndex + 1}
                  </span>
                  <h3 className="font-display text-xl sm:text-2xl font-bold text-foreground">
                    {currentItem.playerName ? `${currentItem.playerName}` : currentItem.teamName}
                  </h3>
                  {currentItem.playerName && (
                    <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary font-bold text-xs">
                      {currentItem.teamName}
                    </Badge>
                  )}
                  {currentItem.kills != null && currentItem.kills > 0 && (
                    <Badge variant="secondary" className="font-mono font-bold text-cyan-300 text-xs tabular-nums">
                      <Crosshair className="size-3 mr-1 inline" /> {currentItem.kills} FRAGS
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>{currentItem.scrimTitle || "Daily Scrim"}</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="size-3.5 text-primary/80" />
                    {formatDate(currentItem.matchDate)}
                  </span>
                  {currentItem.playerUid && (
                    <span className="font-mono text-zinc-400">
                      UID: {currentItem.playerUid}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation Controls */}
          {count > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrev}
                aria-label="Previous MVP Banner"
                className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 z-20 flex size-10 items-center justify-center rounded-full bg-black/70 text-white border border-white/20 hover:bg-primary hover:text-white hover:border-primary transition-all duration-200 shadow-lg active:scale-95 cursor-pointer"
              >
                <ChevronLeft className="size-5" />
              </button>

              <button
                type="button"
                onClick={handleNext}
                aria-label="Next MVP Banner"
                className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 z-20 flex size-10 items-center justify-center rounded-full bg-black/70 text-white border border-white/20 hover:bg-primary hover:text-white hover:border-primary transition-all duration-200 shadow-lg active:scale-95 cursor-pointer"
              >
                <ChevronRight className="size-5" />
              </button>
            </>
          )}
        </div>

        {/* Dot Pagination Indicators */}
        {count > 1 && (
          <div className="flex items-center justify-center gap-2 mt-5">
            {banners.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelect(idx)}
                aria-label={`Go to MVP Banner slide ${idx + 1}`}
                className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                  idx === currentIndex
                    ? "w-8 bg-primary shadow-md shadow-primary/30"
                    : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/60"
                }`}
              />
            ))}
          </div>
        )}

        {/* Centered "View Full Leaderboard" Button */}
        <div className="mt-8 flex justify-center">
          <Button
            asChild
            size="lg"
            className="glow-primary px-7 py-6 font-display font-bold uppercase text-xs sm:text-sm tracking-wider gap-2 rounded-xl transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
          >
            <Link href="/results">
              <Trophy className="size-4" />
              <span>View Full Leaderboard</span>
            </Link>
          </Button>
        </div>
      </motion.div>

      {/* Fullscreen Lightbox Modal */}
      {activeLightbox && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setActiveLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setActiveLightbox(null)}
            className="absolute top-4 right-4 z-50 flex size-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors cursor-pointer"
            aria-label="Close image preview"
          >
            <X className="size-6" />
          </button>
          <div className="relative max-h-[92vh] max-w-[92vw] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeLightbox}
              alt="MVP Face Banner Full View"
              className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl shadow-2xl"
            />
          </div>
        </div>
      )}
    </section>
  )
}
