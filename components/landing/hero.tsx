"use client"

import Link from "next/link"
import { motion } from "motion/react"
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

export function Hero({ stats }: { stats: { scrimsTonight: number; totalTeams: number; totalPrize: number } }) {
  const { t } = useLanguage()
  const { mode, setMode } = useViewMode()

  // Animation variants
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: mode === "3d" ? 0.1 : 0.05,
        delayChildren: 0.05,
      },
    },
  }

  const itemFadeUp = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  }

  return (
    <section className="relative min-h-[90svh] w-full max-w-full overflow-x-clip overflow-hidden bg-transparent">
      {/* 3D Mode specific laser sweepers and kinetic glow */}
      {mode === "3d" && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden w-full max-w-full">
          <div className="absolute inset-0 bg-gradient-to-r from-[#030407]/60 via-transparent to-transparent z-[1]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#030407]/70 via-transparent to-transparent z-[1]" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-500/50 to-transparent z-[2]" />
          <motion.div
            animate={{
              x: ["-100%", "200%"],
            }}
            transition={{
              duration: 7,
              repeat: Infinity,
              ease: "linear",
            }}
            className="absolute top-1/3 left-0 w-1/3 h-[2px] bg-gradient-to-r from-transparent via-orange-500 to-transparent blur-sm z-[2]"
          />
          <div className="absolute -left-20 top-1/4 size-96 rounded-full bg-orange-600/20 blur-[100px] z-[1]" />
        </div>
      )}

      {/* 2D Static Mode subtle ambient glows */}
      {mode === "2d" && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden bg-gradient-to-b from-orange-950/10 via-transparent to-transparent z-[1]" />
      )}

      <div className="relative z-10 mx-auto flex min-h-[86svh] max-w-6xl items-center px-4 py-16 md:px-6 w-full overflow-hidden">
        <div className="w-full max-w-full">
          {/* Headline & Action CTAs */}
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="flex max-w-3xl flex-col justify-center w-full"
          >
            {/* Top Status & 2D / 3D Selection Toggle */}
            <motion.div variants={itemFadeUp} className="flex flex-wrap items-center gap-2.5 mb-7">
              <Badge variant="outline" className="glass gap-2 rounded-lg border-orange-500/30 bg-orange-950/35 px-3 py-1.5 text-xs font-semibold text-orange-300 shadow-lg shadow-orange-500/10 tabular-nums">
                <Flame className="size-3.5 text-amber-400" aria-hidden />
                {stats.scrimsTonight ?? 0} {t("scrims_tonight", "Scrims Live Tonight")}
              </Badge>

              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-950/30 px-3 py-1 text-xs font-semibold text-emerald-300">
                <ShieldCheck className="size-3.5 text-emerald-400" />
                Anti-Cheat Active
              </span>

              {/* 2D / 3D Mode Selector Switch */}
              <div
                className="inline-flex items-center rounded-xl border border-white/[0.1] bg-[#070a14]/75 p-0.5 backdrop-blur-xl shadow-md"
                role="group"
                aria-label="View Mode Selector"
              >
                <button
                  type="button"
                  onClick={() => setMode("2d")}
                  className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                    mode === "2d"
                      ? "bg-gradient-to-r from-orange-500 to-amber-500 text-zinc-950 shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                  title="Switch to 2D Static Mode"
                >
                  <Layers className="size-3" />
                  2D Static
                </button>
                <button
                  type="button"
                  onClick={() => setMode("3d")}
                  className={`inline-flex items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                    mode === "3d"
                      ? "bg-gradient-to-r from-orange-500 to-amber-500 text-zinc-950 shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                  title="Switch to 3D Cyber Mode"
                >
                  <Boxes className="size-3" />
                  3D Cyber
                </button>
              </div>
            </motion.div>

            {/* Titles */}
            <motion.h1 variants={itemFadeUp} className="font-display text-4xl font-semibold leading-[1.03] tracking-[-0.035em] sm:text-6xl md:text-7xl">
              <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500 bg-clip-text text-transparent font-semibold block drop-shadow-sm">
                {t("hero_title", "ACE SCRIMS")}
              </span>
            </motion.h1>

            <motion.h2 variants={itemFadeUp} className="mt-3 font-display text-2xl font-semibold leading-[1.12] tracking-[-0.03em] text-foreground sm:text-4xl md:text-5xl">
              {t("hero_h2", "DOMINATE THE LOBBY EVERY NIGHT")}
            </motion.h2>

            <motion.p variants={itemFadeUp} className="mt-5 max-w-2xl text-base leading-relaxed text-zinc-300/85 text-pretty md:text-lg">
              {t("hero_subtitle", "Bangladesh's most competitive Free Fire scrims. Daily competitive lobbies, instant booking, automated gateway payments, and cash prize pool. Your squad vs the best.")}
            </motion.p>

            {/* Action Buttons */}
            <motion.div variants={itemFadeUp} className="mt-8 flex flex-wrap items-center gap-3.5">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-xl px-7 font-semibold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-zinc-950 shadow-lg shadow-orange-500/20 transition-all duration-200"
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
                className="glass h-12 rounded-xl border-white/[0.12] px-7 font-semibold text-foreground hover:border-orange-500/45 hover:bg-white/[0.06] transition-all duration-200"
              >
                <Link href="/results">{t("view_results", "View Results")}</Link>
              </Button>

              {/* Quick 2D / 3D toggle indicator info */}
              <span className="text-xs text-zinc-400 hidden sm:inline-flex items-center gap-1.5 pl-1">
                <Sparkles className="size-3.5 text-orange-400" />
                Mode: <strong className="font-semibold text-zinc-200">{mode === "2d" ? "2D Static" : "3D Cyber Experience"}</strong>
              </span>
            </motion.div>

            {/* Institutional Gradient Stats Cards */}
            <motion.dl variants={itemFadeUp} className="mt-10 grid max-w-xl grid-cols-3 gap-3 sm:gap-4">
              <div className="dc-surface dc-card-hover rounded-2xl p-4 sm:p-4.5">
                <dt className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400">
                  <Zap className="size-3.5 text-orange-400" aria-hidden />
                  {t("scrims_tonight", "Nightly")}
                </dt>
                <dd className="mt-1.5 font-display text-xl sm:text-2xl font-semibold tracking-tight text-foreground tabular-nums">{stats.scrimsTonight || 12}</dd>
              </div>

              <div className="dc-surface dc-card-hover rounded-2xl p-4 sm:p-4.5">
                <dt className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400">
                  <Users className="size-3.5 text-amber-400" aria-hidden />
                  {t("team_slots", "Teams")}
                </dt>
                <dd className="mt-1.5 font-display text-xl sm:text-2xl font-semibold tracking-tight text-foreground tabular-nums">{stats.totalTeams || 144}</dd>
              </div>

              <div className="dc-surface dc-card-hover rounded-2xl p-4 sm:p-4.5">
                <dt className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400">
                  <Trophy className="size-3.5 text-amber-400" aria-hidden />
                  {t("scrim_format", "Format")}
                </dt>
                <dd className="mt-1.5 font-display text-sm sm:text-base font-semibold tracking-tight text-amber-300 leading-snug">
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
