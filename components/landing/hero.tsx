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
              <Badge variant="outline" className="glass gap-2 rounded-md border-orange-500/40 bg-orange-950/45 px-3 py-1.5 text-orange-300 shadow-lg shadow-orange-500/10 tabular-nums">
                <Flame className="size-3.5 text-amber-400" aria-hidden />
                {stats.scrimsTonight ?? 0} {t("scrims_tonight", "Scrims Live Tonight")}
              </Badge>

              <span className="hidden sm:inline-flex items-center gap-1.5 rounded-md border border-emerald-500/35 bg-emerald-950/35 px-2.5 py-1 text-[11px] font-semibold text-emerald-400">
                <ShieldCheck className="size-3.5 text-emerald-400" />
                Anti-Cheat Active
              </span>

              {/* 2D / 3D Mode Selector Switch */}
              <div
                className="inline-flex items-center rounded-lg border border-orange-500/35 bg-black/65 p-0.5 backdrop-blur-md shadow-md"
                role="group"
                aria-label="View Mode Selector"
              >
                <button
                  type="button"
                  onClick={() => setMode("2d")}
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                    mode === "2d"
                      ? "bg-gradient-to-r from-orange-500 to-amber-500 text-black shadow-sm"
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
                  className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                    mode === "3d"
                      ? "bg-gradient-to-r from-orange-500 to-amber-500 text-black shadow-sm"
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
            <motion.h1 variants={itemFadeUp} className="font-display text-4xl font-black leading-none tracking-tight sm:text-6xl md:text-7xl">
              <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-rose-500 bg-clip-text text-transparent font-black block drop-shadow-md">
                {t("hero_title", "ACE SCRIMS")}
              </span>
            </motion.h1>

            <motion.h2 variants={itemFadeUp} className="mt-2 font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-4xl md:text-5xl">
              {t("hero_h2", "DOMINATE THE LOBBY EVERY NIGHT")}
            </motion.h2>

            <motion.p variants={itemFadeUp} className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground text-pretty md:text-lg">
              {t("hero_subtitle", "Bangladesh's most competitive Free Fire scrims. Daily competitive lobbies, instant booking, automated gateway payments, and cash prize pool. Your squad vs the best.")}
            </motion.p>

            {/* Action Buttons */}
            <motion.div variants={itemFadeUp} className="mt-8 flex flex-wrap items-center gap-4">
              <Button
                asChild
                size="lg"
                className="h-12 px-8 font-display font-bold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-black shadow-lg shadow-orange-500/25 transition-all duration-200"
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
                className="glass h-12 border-orange-500/30 px-8 font-semibold bg-black/40 hover:border-orange-500/60 hover:bg-orange-500/10 text-foreground transition-all duration-200"
              >
                <Link href="/results">{t("view_results", "View Results")}</Link>
              </Button>

              {/* Quick 2D / 3D toggle indicator info */}
              <span className="text-xs text-muted-foreground hidden sm:inline-flex items-center gap-1.5 pl-1">
                <Sparkles className="size-3 text-orange-400" />
                Mode: <strong className="text-foreground">{mode === "2d" ? "2D Static" : "3D Cyber Experience"}</strong>
              </span>
            </motion.div>

            {/* Cyber Stats Cards */}
            <motion.dl variants={itemFadeUp} className="mt-10 grid max-w-lg grid-cols-3 gap-3 sm:gap-4">
              <div className="glass rounded-xl p-3.5 sm:p-4 border border-orange-500/25 bg-black/55 backdrop-blur-md transition-all hover:border-orange-500/45 shadow-lg shadow-black/40">
                <dt className="flex items-center gap-1.5 text-xs font-medium text-orange-300/90">
                  <Zap className="size-3.5 text-orange-400" aria-hidden />
                  {t("scrims_tonight", "Nightly")}
                </dt>
                <dd className="mt-1 font-display text-xl sm:text-2xl font-bold text-foreground tabular-nums">{stats.scrimsTonight || 12}</dd>
              </div>

              <div className="glass rounded-xl p-3.5 sm:p-4 border border-orange-500/25 bg-black/55 backdrop-blur-md transition-all hover:border-orange-500/45 shadow-lg shadow-black/40">
                <dt className="flex items-center gap-1.5 text-xs font-medium text-orange-300/90">
                  <Users className="size-3.5 text-amber-400" aria-hidden />
                  {t("team_slots", "Teams")}
                </dt>
                <dd className="mt-1 font-display text-xl sm:text-2xl font-bold text-foreground tabular-nums">{stats.totalTeams || 144}</dd>
              </div>

              <div className="glass rounded-xl p-3.5 sm:p-4 border border-orange-500/25 bg-black/55 backdrop-blur-md transition-all hover:border-orange-500/45 shadow-lg shadow-black/40">
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
