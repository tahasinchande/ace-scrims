"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Image from "next/image"
import { motion, AnimatePresence } from "motion/react"
import { Trophy, ChevronLeft, ChevronRight, Eye, Sparkles, X, Flame, Shield, Pause, Play } from "lucide-react"
import { bdt, formatDate } from "@/lib/format"
import { resolveImageUrl } from "@/lib/image-url"
import { Button } from "@/components/ui/button"

export type Top3BannerItem = {
  id: string
  winningTeam: string
  scrimTitle: string | null
  matchDate: string
  kills: number
  prizeBdt: number
  category?: string | null
  imageUrl: string
}

const DEFAULT_BANNERS: Top3BannerItem[] = []

const SLIDE_DURATION = 5000 // 5 seconds per slide

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 100 : -100,
    opacity: 0,
    scale: 0.96,
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
    scale: 1,
    transition: {
      x: { type: "spring" as const, stiffness: 280, damping: 28 },
      opacity: { duration: 0.4 },
      scale: { duration: 0.4 },
    },
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 100 : -100,
    opacity: 0,
    scale: 1.02,
    transition: {
      x: { type: "spring" as const, stiffness: 280, damping: 28 },
      opacity: { duration: 0.35 },
    },
  }),
}

export function Top3BannerSlideshow({ items }: { items?: Top3BannerItem[] }) {
  const banners = items && items.length > 0 ? items : DEFAULT_BANNERS
  if (!banners || banners.length === 0) {
    return null
  }
  const [[page, direction], setPage] = useState<[number, number]>([0, 0])
  const [lightboxImage, setLightboxImage] = useState<string | null>(null)
  const [isPaused, setIsPaused] = useState(false)
  const [progress, setProgress] = useState(0)

  const currentIndex = ((page % banners.length) + banners.length) % banners.length
  const current = banners[currentIndex]

  const paginate = useCallback(
    (newDirection: number) => {
      setPage(([prevPage]) => [prevPage + newDirection, newDirection])
      setProgress(0)
    },
    []
  )

  // Auto-slideshow ticker with progress bar
  useEffect(() => {
    if (isPaused || banners.length <= 1) return

    const intervalStep = 50
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          paginate(1)
          return 0
        }
        return prev + (intervalStep / SLIDE_DURATION) * 100
      })
    }, intervalStep)

    return () => clearInterval(timer)
  }, [isPaused, banners.length, paginate])

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (lightboxImage) return
      if (e.key === "ArrowLeft") paginate(-1)
      if (e.key === "ArrowRight") paginate(1)
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [paginate, lightboxImage])

  return (
    <section
      className="mx-auto max-w-6xl px-4 py-16 md:px-6"
      aria-label="Top 3 Face Banner Showcase"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-primary text-xs font-display font-bold uppercase tracking-wider mb-2">
            <Sparkles className="size-4 animate-pulse text-amber-400" />
            <span>Hall of Fame & Victory Gallery</span>
          </div>
          <h2 className="font-display text-2xl md:text-3xl font-extrabold uppercase tracking-wide text-foreground">
            Top 3 Face Banner Showcase
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Official winner portraits and match highlights featuring top squads, verified stats, and prizes.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setIsPaused(!isPaused)}
            className="flex items-center gap-1.5 rounded-xl border border-border/80 bg-black/50 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white hover:border-primary/50 transition-colors"
            title={isPaused ? "Resume auto slideshow" : "Pause auto slideshow"}
          >
            {isPaused ? <Play className="size-3.5 text-amber-400" /> : <Pause className="size-3.5 text-amber-400" />}
            <span>{isPaused ? "Paused" : "Auto"}</span>
          </button>

          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              onClick={() => paginate(-1)}
              aria-label="Previous Slide"
              className="size-9 rounded-xl glass border-border hover:border-primary/50 hover:bg-primary/10"
            >
              <ChevronLeft className="size-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => paginate(1)}
              aria-label="Next Slide"
              className="size-9 rounded-xl glass border-border hover:border-primary/50 hover:bg-primary/10"
            >
              <ChevronRight className="size-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Slideshow Stage with Smooth Motion Transitions */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-black/80 shadow-2xl backdrop-blur-xl">
        {/* Animated Progress Bar at Top */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-white/10 z-30 overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-violet-500 via-indigo-400 to-cyan-400"
            style={{ width: `${progress}%` }}
            transition={{ ease: "linear" }}
          />
        </div>

        <div className="relative min-h-[380px] sm:min-h-[420px] md:min-h-[460px] w-full flex flex-col justify-end overflow-hidden">
          <AnimatePresence initial={false} custom={direction} mode="popLayout">
            <motion.div
              key={page}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="absolute inset-0 size-full"
            >
              <Image
                src={resolveImageUrl(current.imageUrl)}
                alt={`${current.winningTeam} - ${current.scrimTitle}`}
                fill
                priority
                unoptimized
                className="object-cover object-center"
              />
              {/* Cinematic Vignette Gradients */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/30 to-transparent hidden md:block pointer-events-none" />
            </motion.div>
          </AnimatePresence>

          {/* Banner Meta Overlay Content with Kinetic Entrance */}
          <div className="relative z-10 p-6 md:p-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <motion.div
              key={`text-${currentIndex}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.1 }}
              className="flex flex-col gap-2 max-w-xl"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-xs font-display font-bold uppercase tracking-[0.14em] text-violet-300">
                  <Trophy className="size-3.5 text-cyan-300" />
                  {current.category || "Top 3 Face Banner"}
                </span>
                <span className="text-xs text-slate-300 font-semibold">
                  {formatDate(current.matchDate)}
                </span>
              </div>

              <h3 className="font-display text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-wide text-white drop-shadow-md">
                {current.winningTeam}
              </h3>

              <p className="font-display font-bold text-sm md:text-base text-amber-400/90">
                {current.scrimTitle || "Daily Competitive Scrim"}
              </p>
            </motion.div>

            {/* Stats & Actions */}
            <motion.div
              key={`stats-${currentIndex}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.15 }}
              className="flex items-center gap-3 sm:gap-4 shrink-0 flex-wrap"
            >
              <div className="rounded-2xl border border-white/15 bg-black/70 p-3 sm:p-3.5 backdrop-blur-md text-center min-w-[85px] shadow-lg">
                <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Kills</p>
                <p className="font-display text-lg sm:text-xl font-black text-white">{current.kills}</p>
              </div>

              <div className="rounded-2xl border border-violet-400/35 bg-violet-950/45 p-3 sm:p-3.5 backdrop-blur-md text-center min-w-[95px] shadow-lg">
                <p className="text-[10px] uppercase tracking-wider text-violet-300 font-bold">Prize</p>
                <p className="font-display text-lg sm:text-xl font-black text-emerald-400 tabular-nums">{bdt(current.prizeBdt)}</p>
              </div>

              <Button
                onClick={() => setLightboxImage(resolveImageUrl(current.imageUrl))}
                className="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-display font-bold uppercase gap-2 h-11 px-4 backdrop-blur-md shadow-lg"
              >
                <Eye className="size-4" />
                <span>Full Image</span>
              </Button>
            </motion.div>
          </div>
        </div>

        {/* Slide Indicators with Interactive Click */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 bg-black/70 p-2 rounded-full border border-white/15 backdrop-blur-md">
          {banners.map((_, idx) => (
            <button
              key={idx}
              onClick={() => {
                const diff = idx - currentIndex
                if (diff !== 0) paginate(diff)
              }}
              className={`h-2 rounded-full transition-all duration-300 ${
                currentIndex === idx ? "w-6 bg-gradient-to-r from-violet-500 to-cyan-400" : "w-2 bg-white/40 hover:bg-white/70"
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] w-full overflow-hidden rounded-3xl border border-border bg-card p-2 shadow-2xl">
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-4 right-4 z-10 rounded-full bg-black/80 p-2 text-white hover:bg-black"
              aria-label="Close image preview"
            >
              <X className="size-5" />
            </button>
            <img
              src={lightboxImage}
              alt="Full Size Top 3 Face Banner"
              className="w-full max-h-[85vh] object-contain rounded-2xl"
            />
          </div>
        </div>
      )}
    </section>
  )
}
