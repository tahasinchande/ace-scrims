"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "motion/react"
import { Button } from "@/components/ui/button"
import {
  ChevronRight,
  Users,
  Zap,
  Trophy,
  Layers,
  Boxes,
} from "lucide-react"
import { useLanguage } from "@/lib/language"
import { useViewMode } from "@/lib/view-mode"
import { BRAND } from "@/lib/brand"

const DEEPCHARTS_EASE = [0.16, 1, 0.3, 1] as const

export function Hero({ stats }: { stats: { scrimsTonight: number; totalTeams: number; totalPrize: number } }) {
  const { t } = useLanguage()
  const { mode, setMode } = useViewMode()
  const prefersReducedMotion = useReducedMotion()

  const container = {
    hidden: { opacity: prefersReducedMotion ? 1 : 0 },
    show: {
      opacity: 1,
      transition: prefersReducedMotion
        ? { duration: 0 }
        : {
            staggerChildren: 0.08,
            delayChildren: 0.04,
          },
    },
  }

  const itemFadeUp = {
    hidden: prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: prefersReducedMotion
        ? { duration: 0 }
        : { duration: 0.56, ease: DEEPCHARTS_EASE },
    },
  }

  return (
    <section className="relative min-h-[88svh] w-full max-w-full overflow-x-clip overflow-hidden bg-transparent">
      {/* 3D Mode atmospheric sweep framing */}
      {mode === "3d" && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden w-full max-w-full">
          <div className="absolute inset-0 bg-gradient-to-r from-[#040610]/52 via-transparent to-transparent z-[1]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#040610]/38 via-transparent to-transparent z-[1]" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-300/30 to-transparent z-[2]" />
          {!prefersReducedMotion && (
            <motion.div
              animate={{
                x: ["-100%", "200%"],
              }}
              transition={{
                duration: 7,
                repeat: Infinity,
                ease: "linear",
              }}
              className="absolute top-1/3 left-0 w-1/3 h-[2px] bg-gradient-to-r from-transparent via-cyan-300/35 to-transparent blur-sm z-[2]"
            />
          )}
        </div>
      )}

      {/* 2D Ambient Mode — open transparent framing so full-viewport dynamic color shifting shines cleanly */}
      {mode === "2d" && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden bg-gradient-to-b from-black/8 via-transparent to-transparent z-[1]" />
      )}

      <div className="relative z-10 mx-auto flex min-h-[86svh] max-w-6xl items-center px-4 py-16 md:px-6 w-full overflow-hidden">
        <div className="w-full max-w-full">
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="flex max-w-3xl flex-col justify-center w-full"
          >
            {/* Clean unboxed editorial metadata line + segmented 2D / 3D switch (zero micro-pill clutter) */}
            <motion.div variants={itemFadeUp} className="flex flex-wrap items-center gap-x-5 gap-y-3 mb-6">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-[13px] font-medium text-slate-200/90 tabular-nums">
                <span className="font-semibold text-white">
                  {stats.scrimsTonight ?? 0} {t("scrims_tonight", "Scrims Live Tonight")}
                </span>
                <span className="text-violet-300/60" aria-hidden="true">·</span>
                <span className="text-cyan-200/90">Mobile-Only Fair Play</span>
              </div>

              {/* 2D / 3D Mode Selector Switch */}
              <div
                className="inline-flex items-center rounded-xl border border-violet-300/20 bg-[#080c1d]/75 p-0.5 backdrop-blur-md shadow-lg"
                role="group"
                aria-label="View Mode Selector"
              >
                <button
                  type="button"
                  onClick={() => setMode("2d")}
                  className={`rushx-btn-splash inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
                    mode === "2d"
                      ? "bg-gradient-to-r from-violet-500 to-indigo-600 text-white shadow-sm"
                      : "text-slate-300 hover:text-white"
                  }`}
                  title="Switch to 2D Dynamic Ambient Mode"
                >
                  <Layers className="size-3.5" />
                  2D Ambient
                </button>
                <button
                  type="button"
                  onClick={() => setMode("3d")}
                  className={`rushx-btn-splash inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
                    mode === "3d"
                      ? "bg-gradient-to-r from-violet-500 to-indigo-600 text-white shadow-sm"
                      : "text-slate-300 hover:text-white"
                  }`}
                  title="Switch to 3D Cyber Mode"
                >
                  <Boxes className="size-3.5" />
                  3D Cyber
                </button>
              </div>
            </motion.div>

            {/* Primary H1: Transparent RushX ORGANIZATION Brand Artwork */}
            <motion.h1
              variants={itemFadeUp}
              className="font-display text-4xl font-black leading-none tracking-tight sm:text-6xl md:text-7xl"
            >
              <span className="sr-only">{t("hero_title", BRAND.name)}</span>
              <span className="relative block max-w-[330px] sm:max-w-[520px] md:max-w-[640px] -ml-0.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={BRAND.assets.fullWordmark}
                  alt={BRAND.name}
                  className="block w-full h-auto max-h-[80px] sm:max-h-[112px] md:max-h-[132px] object-contain object-left drop-shadow-[0_6px_28px_rgba(139,92,246,0.28)] select-none"
                />
              </span>
            </motion.h1>

            {/* Preserved Headline Structure & Typography (Rajdhani Extrabold) */}
            <motion.h2
              variants={itemFadeUp}
              className="mt-2 font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-4xl md:text-5xl"
            >
              {t("hero_h2", "DOMINATE THE LOBBY EVERY NIGHT")}
            </motion.h2>

            <motion.p
              variants={itemFadeUp}
              className="mt-5 max-w-2xl text-base leading-relaxed text-slate-200/85 text-pretty md:text-lg"
            >
              {t(
                "hero_subtitle",
                "Bangladesh's most competitive Free Fire scrims. Daily competitive lobbies, instant booking, automated gateway payments, and cash prize pool. Your squad vs the best."
              )}
            </motion.p>

            {/* Action Buttons */}
            <motion.div variants={itemFadeUp} className="mt-8 flex flex-wrap items-center gap-4">
              <Button
                asChild
                size="lg"
                className="h-12 px-8 font-display text-sm font-bold tracking-wide"
              >
                <Link
                  href="#schedule"
                  onClick={(e) => {
                    const el = document.getElementById("schedule")
                    if (el) {
                      e.preventDefault()
                      el.scrollIntoView({ behavior: "smooth" })
                    }
                  }}
                >
                  {t("browse_scrims", "Browse Scrims")}
                  <ChevronRight className="size-4 ml-1" />
                </Link>
              </Button>

              <Button
                asChild
                size="lg"
                variant="outline"
                className="glass h-12 border-violet-300/20 px-8 font-semibold hover:border-violet-400/50 hover:bg-violet-500/12 text-foreground transition-all duration-200"
              >
                <Link href="/results">{t("view_results", "View Results")}</Link>
              </Button>

              <span className="text-xs text-slate-300/80 hidden sm:inline-flex items-center gap-1.5 pl-1">
                Mode:{" "}
                <strong className="font-semibold text-white">
                  {mode === "2d" ? "2D Dynamic Ambient" : "3D Cyber Experience"}
                </strong>
              </span>
            </motion.div>

            {/* Luminous Obsidian-Indigo Stats Strip */}
            <motion.dl variants={itemFadeUp} className="mt-10 grid max-w-xl grid-cols-3 gap-3 sm:gap-4">
              <div className="dc-surface dc-card-hover rushx-box-splash rounded-xl p-3.5 sm:p-4">
                <dt className="flex items-center gap-1.5 text-xs font-medium text-violet-200/90">
                  <Zap className="size-3.5 text-violet-400" aria-hidden />
                  {t("scrims_tonight", "Nightly")}
                </dt>
                <dd className="mt-1 font-display text-xl sm:text-2xl font-bold text-white tabular-nums">
                  {stats.scrimsTonight || 12}
                </dd>
              </div>

              <div className="dc-surface dc-card-hover rushx-box-splash rounded-xl p-3.5 sm:p-4">
                <dt className="flex items-center gap-1.5 text-xs font-medium text-cyan-200/90">
                  <Users className="size-3.5 text-cyan-400" aria-hidden />
                  {t("team_slots", "Teams")}
                </dt>
                <dd className="mt-1 font-display text-xl sm:text-2xl font-bold text-white tabular-nums">
                  {stats.totalTeams || 144}
                </dd>
              </div>

              <div className="dc-surface dc-card-hover rushx-box-splash rounded-xl p-3.5 sm:p-4">
                <dt className="flex items-center gap-1.5 text-xs font-medium text-violet-200/90">
                  <Trophy className="size-3.5 text-cyan-300" aria-hidden />
                  {t("scrim_format", "Format")}
                </dt>
                <dd className="mt-1 font-display text-sm sm:text-base font-bold text-cyan-200 leading-tight">
                  {t("matches_per_scrim", "3 matches per scrim")}
                </dd>
              </div>
            </motion.dl>
          </motion.div>
        </div>
      </div>
    </section>
  )
}
