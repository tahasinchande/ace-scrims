"use client"

import Link from "next/link"
import { motion, useReducedMotion } from "motion/react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ChevronRight,
  Users,
  Zap,
  Flame,
  Trophy,
  ShieldCheck,
  Layers,
  Sparkles,
  Boxes,
} from "lucide-react"
import { useLanguage } from "@/lib/language"
import { useViewMode } from "@/lib/view-mode"
import { BRAND } from "@/lib/brand"

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
            staggerChildren: mode === "3d" ? 0.09 : 0.06,
            delayChildren: 0.04,
          },
    },
  }

  const itemFadeUp = {
    hidden: prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 },
    show: {
      opacity: 1,
      y: 0,
      transition: prefersReducedMotion
        ? { duration: 0 }
        : { duration: 0.42, ease: [0.22, 1, 0.36, 1] as const },
    },
  }

  return (
    <section className="relative min-h-[90svh] w-full max-w-full overflow-x-clip overflow-hidden bg-transparent">
      {/* 3D Mode specific laser sweepers and subtle glass framing */}
      {mode === "3d" && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden w-full max-w-full">
          <div className="absolute inset-0 bg-gradient-to-r from-[#030407]/52 via-transparent to-transparent z-[1]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#030407]/45 via-transparent to-transparent z-[1]" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent z-[2]" />
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
              className="absolute top-1/3 left-0 w-1/3 h-[2px] bg-gradient-to-r from-transparent via-white/30 to-transparent blur-sm z-[2]"
            />
          )}
        </div>
      )}

      {/* 2D Ambient Mode — transparent overlay so the full-page sequential color-shifting canvas shines through */}
      {mode === "2d" && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden bg-gradient-to-b from-black/10 via-transparent to-transparent z-[1]" />
      )}

      <div className="relative z-10 mx-auto flex min-h-[88svh] max-w-6xl items-center px-4 py-16 md:px-6 w-full overflow-hidden">
        <div className="w-full max-w-full">
          {/* Headline & Action CTAs */}
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="flex max-w-3xl flex-col justify-center w-full"
          >
            {/* Top Status & 2D / 3D Selection Toggle */}
            <motion.div variants={itemFadeUp} className="flex flex-wrap items-center gap-2.5 mb-6">
              <Badge
                variant="outline"
                className="glass gap-2 rounded-md border-orange-500/40 bg-orange-950/40 px-3 py-1.5 text-orange-300 shadow-lg shadow-orange-500/10 tabular-nums"
              >
                <Flame className="size-3.5 text-amber-400" aria-hidden />
                {stats.scrimsTonight ?? 0} {t("scrims_tonight", "Scrims Live Tonight")}
              </Badge>

              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-emerald-500/35 bg-emerald-950/35 px-2.5 py-1 text-[11px] font-semibold text-emerald-400">
                <ShieldCheck className="size-3.5 text-emerald-400" />
                Anti-Cheat Active
              </span>

              {/* 2D / 3D Mode Selector Switch */}
              <div
                className="inline-flex items-center rounded-lg border border-white/[0.12] bg-black/55 p-0.5 backdrop-blur-md shadow-md"
                role="group"
                aria-label="View Mode Selector"
              >
                <button
                  type="button"
                  onClick={() => setMode("2d")}
                  className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                    mode === "2d"
                      ? "bg-gradient-to-r from-orange-500 to-amber-500 text-black shadow-sm"
                      : "text-zinc-300 hover:text-white"
                  }`}
                  title="Switch to 2D Ambient Mode"
                >
                  <Layers className="size-3" />
                  2D Ambient
                </button>
                <button
                  type="button"
                  onClick={() => setMode("3d")}
                  className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                    mode === "3d"
                      ? "bg-gradient-to-r from-orange-500 to-amber-500 text-black shadow-sm"
                      : "text-zinc-300 hover:text-white"
                  }`}
                  title="Switch to 3D Cyber Mode"
                >
                  <Boxes className="size-3" />
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
                <img
                  src={BRAND.assets.fullWordmark}
                  alt={BRAND.name}
                  className="block w-full h-auto max-h-[80px] sm:max-h-[112px] md:max-h-[132px] object-contain object-left drop-shadow-[0_4px_24px_rgba(255,255,255,0.2)] select-none"
                />
              </span>
            </motion.h1>

            {/* Preserved Previous Headline Structure & Typography (Rajdhani Extrabold) */}
            <motion.h2
              variants={itemFadeUp}
              className="mt-2 font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-4xl md:text-5xl"
            >
              {t("hero_h2", "DOMINATE THE LOBBY EVERY NIGHT")}
            </motion.h2>

            <motion.p
              variants={itemFadeUp}
              className="mt-5 max-w-2xl text-base leading-relaxed text-zinc-200/85 text-pretty md:text-lg"
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
                className="h-12 px-8 font-display font-bold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-black shadow-lg shadow-orange-500/25 transition-all duration-200"
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
                className="glass h-12 border-white/[0.16] px-8 font-semibold hover:border-orange-500/60 hover:bg-orange-500/10 text-foreground transition-all duration-200"
              >
                <Link href="/results">{t("view_results", "View Results")}</Link>
              </Button>

              {/* Quick 2D / 3D toggle indicator info */}
              <span className="text-xs text-zinc-300/85 hidden sm:inline-flex items-center gap-1.5 pl-1">
                <Sparkles className="size-3.5 text-orange-400" />
                Mode:{" "}
                <strong className="font-semibold text-foreground">
                  {mode === "2d" ? "2D Dynamic Ambient" : "3D Cyber Experience"}
                </strong>
              </span>
            </motion.div>

            {/* Institutional Gradient Stats Cards */}
            <motion.dl variants={itemFadeUp} className="mt-10 grid max-w-xl grid-cols-3 gap-3 sm:gap-4">
              <div className="dc-surface dc-card-hover rounded-xl p-3.5 sm:p-4">
                <dt className="flex items-center gap-1.5 text-xs font-medium text-orange-300/90">
                  <Zap className="size-3.5 text-orange-400" aria-hidden />
                  {t("scrims_tonight", "Nightly")}
                </dt>
                <dd className="mt-1 font-display text-xl sm:text-2xl font-bold text-foreground tabular-nums">
                  {stats.scrimsTonight || 12}
                </dd>
              </div>

              <div className="dc-surface dc-card-hover rounded-xl p-3.5 sm:p-4">
                <dt className="flex items-center gap-1.5 text-xs font-medium text-orange-300/90">
                  <Users className="size-3.5 text-amber-400" aria-hidden />
                  {t("team_slots", "Teams")}
                </dt>
                <dd className="mt-1 font-display text-xl sm:text-2xl font-bold text-foreground tabular-nums">
                  {stats.totalTeams || 144}
                </dd>
              </div>

              <div className="dc-surface dc-card-hover rounded-xl p-3.5 sm:p-4">
                <dt className="flex items-center gap-1.5 text-xs font-medium text-orange-300/90">
                  <Trophy className="size-3.5 text-amber-400" aria-hidden />
                  {t("scrim_format", "Format")}
                </dt>
                <dd className="mt-1 font-display text-sm sm:text-base font-bold text-amber-400 leading-tight">
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
