"use client"

export const dynamic = "force-dynamic"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { motion, AnimatePresence } from "motion/react"
import { useRouter } from "next/navigation"
import {
  ShieldAlert,
  RefreshCw,
  Trophy,
  Flame,
  CheckCircle,
  Home,
  ChevronLeft,
  ChevronRight,
  Boxes,
  Layers,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useViewMode } from "@/lib/view-mode"

const SCRIM_SLIDES = [
  { id: 1, title: "3 PM SCRIM ROOM 1", time: "3:00 PM", map: "Bermuda", image: "/images/scrim-1.jpg" },
  { id: 2, title: "3 PM SCRIM ROOM 2", time: "3:00 PM", map: "Purgatory", image: "/images/scrim-2.jpg" },
  { id: 3, title: "4 PM SCRIM ROOM 1", time: "4:00 PM", map: "Kalahari", image: "/images/scrim-3.jpg" },
  { id: 4, title: "4 PM SCRIM ROOM 2", time: "4:00 PM", map: "Bermuda", image: "/images/scrim-4.jpg" },
  { id: 5, title: "5 PM SCRIM ROOM 1", time: "5:00 PM", map: "Purgatory", image: "/images/scrim-5.jpg" },
  { id: 6, title: "5 PM SCRIM ROOM 2", time: "5:00 PM", map: "Kalahari", image: "/images/scrim-6.jpg" },
  { id: 7, title: "7 PM SCRIM ROOM 1", time: "7:00 PM", map: "Bermuda", image: "/images/scrim-7.jpg" },
  { id: 8, title: "7 PM SCRIM ROOM 2", time: "7:00 PM", map: "Purgatory", image: "/images/scrim-8.jpg" },
  { id: 9, title: "8 PM SCRIM ROOM 1", time: "8:00 PM", map: "Kalahari", image: "/images/scrim-9.jpg" },
  { id: 10, title: "8 PM SCRIM ROOM 2", time: "8:00 PM", map: "Bermuda", image: "/images/scrim-10.jpg" },
  { id: 11, title: "9 PM SCRIM ROOM 1", time: "9:00 PM", map: "Purgatory", image: "/images/scrim-11.jpg" },
  { id: 12, title: "9 PM SCRIM ROOM 2", time: "9:00 PM", map: "Kalahari", image: "/images/scrim-12.jpg" },
  { id: 13, title: "10 PM SCRIM ROOM 1", time: "10:00 PM", map: "Bermuda", image: "/images/bermuda.jpg" },
  { id: 14, title: "10 PM SCRIM ROOM 2", time: "10:00 PM", map: "Purgatory", image: "/images/purgatory.jpg" },
  { id: 15, title: "11 PM SCRIM ROOM 1", time: "11:00 PM", map: "Kalahari", image: "/images/kalahari.jpg" },
  { id: 16, title: "11 PM SCRIM ROOM 2", time: "11:00 PM", map: "Bermuda", image: "/images/nexterra.jpg" },
  { id: 17, title: "12 AM SCRIM ROOM 1", time: "12:00 AM", map: "Purgatory", image: "/images/alpine.jpg" },
  { id: 18, title: "12 AM SCRIM ROOM 2", time: "12:00 AM", map: "Kalahari", image: "/images/scrim_squad_clash_1786956645507.jpg" },
]

const SLIDE_DURATION = 4000 // 4 seconds per slide

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
    scale: 0.95,
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
    scale: 1,
    transition: {
      x: { type: "spring" as const, stiffness: 260, damping: 26 },
      opacity: { duration: 0.35 },
      scale: { duration: 0.35 },
    },
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 80 : -80,
    opacity: 0,
    scale: 1.05,
    transition: {
      x: { type: "spring" as const, stiffness: 260, damping: 26 },
      opacity: { duration: 0.3 },
    },
  }),
}

export default function MaintenancePage() {
  const router = useRouter()
  const { mode, setMode } = useViewMode()
  const [[page, direction], setPage] = useState<[number, number]>([0, 0])
  const [checking, setChecking] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [isPaused, setIsPaused] = useState(false)
  const [progress, setProgress] = useState(0)

  const currentSlide = ((page % SCRIM_SLIDES.length) + SCRIM_SLIDES.length) % SCRIM_SLIDES.length
  const slide = SCRIM_SLIDES[currentSlide]

  const paginate = useCallback((newDirection: number) => {
    setPage(([prevPage]) => [prevPage + newDirection, newDirection])
    setProgress(0)
  }, [])

  // Verify whether maintenance is still on
  const checkStatusAndRedirect = useCallback(async (isManualClick = false) => {
    try {
      if (isManualClick) setChecking(true)
      const res = await fetch(`/api/maintenance/status?t=${Date.now()}`, {
        cache: "no-store",
      })
      if (res.ok) {
        const data = await res.json()
        if (!data.maintenance) {
          // Maintenance mode turned off! Return to homepage immediately
          window.location.href = "/"
          return
        }
      }
      if (isManualClick) {
        setStatusMessage("Maintenance is still active. Upgrades in progress...")
        setTimeout(() => setStatusMessage(null), 4000)
      }
    } catch {
      // Fallback
    } finally {
      if (isManualClick) setChecking(false)
    }
  }, [])

  // Auto poll status & auto slide
  useEffect(() => {
    checkStatusAndRedirect(false)

    const pollTimer = setInterval(() => {
      checkStatusAndRedirect(false)
    }, 4000)

    return () => {
      clearInterval(pollTimer)
    }
  }, [checkStatusAndRedirect])

  // Smooth Auto Slideshow timer
  useEffect(() => {
    if (isPaused) return

    const intervalStep = 50
    const slideTimer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          paginate(1)
          return 0
        }
        return prev + (intervalStep / SLIDE_DURATION) * 100
      })
    }, intervalStep)

    return () => clearInterval(slideTimer)
  }, [isPaused, paginate])

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-transparent text-foreground flex flex-col items-center justify-center p-4 sm:p-6">

      {/* Ambient Lighting Layer */}
      <div className="pointer-events-none fixed inset-0 bg-radial-gradient from-transparent via-[#040814]/45 to-[#030610]/85 z-[1]" />
      <div
        className="pointer-events-none absolute -left-20 top-1/4 size-96 rounded-full blur-[140px] z-[1]"
        style={{ background: "rgba(var(--rushx-primary-rgb), 0.18)" }}
      />
      <div
        className="pointer-events-none absolute -right-20 bottom-1/4 size-96 rounded-full blur-[140px] z-[1]"
        style={{ background: "rgba(var(--rushx-accent-rgb), 0.15)" }}
      />

      <main className="dc-surface rushx-box-splash relative z-10 flex max-w-xl w-full flex-col items-center text-center gap-6 rounded-3xl p-6 sm:p-8 shadow-2xl">
        {/* Top 3D / 2D Switch & Status */}
        <div className="flex w-full items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">
            Live Upgrade
          </span>

          <div
            className="inline-flex items-center rounded-full border border-white/[0.12] bg-[#060c1d]/75 p-0.5 backdrop-blur-md shadow-md"
            role="group"
            aria-label="View Mode Selector"
          >
            <button
              type="button"
              onClick={() => setMode("2d")}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold transition-all ${
                mode === "2d"
                  ? "rushx-primary-btn text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="Switch to 2D Dynamic Mode"
            >
              <Layers className="size-3" />
              2D
            </button>
            <button
              type="button"
              onClick={() => setMode("3d")}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold transition-all ${
                mode === "3d"
                  ? "rushx-primary-btn text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="Switch to 3D Cyber Mode"
            >
              <Boxes className="size-3" />
              3D Cyber
            </button>
          </div>
        </div>

        {/* Status Icon */}
        <ShieldAlert className="size-11 text-accent" />

        <div className="flex flex-col gap-2">
          <p className="font-display text-xs font-bold uppercase tracking-widest text-accent">
            SYSTEM MAINTENANCE IN PROGRESS
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-black uppercase tracking-wide text-balance text-foreground">
            Upgrading RushX Organization Infrastructure
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">
            RushX Organization is currently carrying out routine system upgrades for upcoming scrim lobbies. Registrations will reopen shortly!
          </p>
          <p className="font-semibold text-accent text-xs mt-1">
            সাইটটি বর্তমানে রক্ষণাবেক্ষণের অধীনে আছে। শীঘ্রই আজকের স্ক্রিম লবিগুলোর বুকিং চালু হবে।
          </p>
        </div>

        {/* Scrim Slideshow Widget with Motion Transitions & Auto Slideshow */}
        <div
          className="dc-metric-cell w-full overflow-hidden rounded-3xl p-3 sm:p-4 shadow-2xl relative group"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Progress Bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-white/10 z-30 overflow-hidden">
            <motion.div
              className="h-full"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, rgb(var(--rushx-primary-rgb)), rgb(var(--rushx-accent-rgb)))",
              }}
              transition={{ ease: "linear" }}
            />
          </div>

          <div className="relative h-48 sm:h-52 w-full rounded-2xl overflow-hidden bg-[#060916] flex items-center justify-center">
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
                  src={slide.image}
                  alt={slide.title}
                  fill
                  priority
                  unoptimized
                  className="object-cover object-center"
                />

                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#050712] via-[#050712]/60 to-transparent pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#050712]/80 via-transparent to-transparent pointer-events-none" />
              </motion.div>
            </AnimatePresence>

            {/* Overlay Title & Details */}
            <div className="absolute inset-0 p-4 sm:p-5 flex flex-col justify-end text-left z-20 pointer-events-none">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1 rounded-md bg-violet-500/20 border border-violet-400/35 px-2 py-0.5 text-[10px] font-bold text-violet-200 uppercase backdrop-blur-md">
                  <Flame className="size-3" />
                  Slot #{slide.id}
                </span>
                <span className="text-[10px] text-slate-300 font-semibold bg-[#060916]/75 px-2 py-0.5 rounded-md border border-white/10 backdrop-blur-md">
                  Map: {slide.map}
                </span>
              </div>
              <h3 className="font-display text-lg sm:text-xl font-bold text-white uppercase tracking-wide flex items-center gap-2 drop-shadow-md">
                <Trophy className="size-4 text-cyan-300 shrink-0" />
                {slide.title}
              </h3>
              <p className="text-xs text-slate-300 font-medium">Daily Schedule: {slide.time} BANGLADESH TIME</p>
            </div>

            {/* Slideshow Control Arrows */}
            <div className="absolute top-3 right-3 z-30 flex items-center gap-1">
              <button
                type="button"
                onClick={() => paginate(-1)}
                className="size-7 rounded-lg bg-[#060916]/75 hover:bg-[#060916] text-slate-300 hover:text-white border border-white/15 flex items-center justify-center backdrop-blur-md transition-colors"
                aria-label="Previous scrim"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => paginate(1)}
                className="size-7 rounded-lg bg-[#060916]/75 hover:bg-[#060916] text-slate-300 hover:text-white border border-white/15 flex items-center justify-center backdrop-blur-md transition-colors"
                aria-label="Next scrim"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>

          {/* Dots Indicator */}
          <div className="flex items-center justify-center gap-1.5 mt-3">
            {SCRIM_SLIDES.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  const diff = idx - currentSlide
                  if (diff !== 0) paginate(diff)
                }}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  idx === currentSlide ? "w-6 bg-gradient-to-r from-violet-500 to-cyan-400" : "w-1.5 bg-white/25 hover:bg-white/50"
                }`}
                aria-label={`Go to scrim slide ${idx + 1}`}
              />
            ))}
          </div>
        </div>

        {statusMessage && (
          <p className="text-xs text-amber-300 font-semibold bg-amber-950/40 border border-amber-500/30 rounded-lg px-3 py-2 animate-fade-in">
            {statusMessage}
          </p>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full pt-1">
          <Button
            onClick={() => checkStatusAndRedirect(true)}
            disabled={checking}
            className="w-full font-display font-bold uppercase h-11"
          >
            <RefreshCw className={`size-4 mr-2 ${checking ? "animate-spin" : ""}`} />
            {checking ? "Checking System..." : "Try Again / Check Status"}
          </Button>

          <Button
            variant="outline"
            onClick={() => {
              window.location.href = "/"
            }}
            className="w-full sm:w-auto font-display font-semibold uppercase h-11"
          >
            <Home className="size-4 mr-2 text-cyan-300" />
            Homepage
          </Button>
        </div>
      </main>
    </div>
  )
}
