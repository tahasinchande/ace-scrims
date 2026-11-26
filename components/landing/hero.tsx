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
import { useFirstVisitIntro } from "@/lib/intro-motion"
import {
  Reveal,
  MaskedLineReveal,
  VisualReveal,
  RevealStagger,
  RevealItem,
} from "@/components/site/reveal"
import type { LiveShowcaseSummary } from "@/lib/queries/showcase"

export function Hero({
  stats,
  showcase,
}: {
  stats: { scrimsTonight: number; totalTeams: number; totalPrize: number }
  showcase?: LiveShowcaseSummary
}) {
  const { t } = useLanguage()
  const { mode, setMode } = useViewMode()
  const prefersReducedMotion = useReducedMotion()
  const { timing } = useFirstVisitIntro()

  const activeScrims = stats.scrimsTonight ?? 0
  const totalSlots = stats.totalTeams ?? 0
  const formatLine = showcase?.timeWindow || t("matches_per_scrim", "Live Daily Format")

  return (
    <section className="relative min-h-[88svh] w-full max-w-full overflow-x-clip overflow-hidden bg-transparent">
      {/* 3D Mode atmospheric sweep framing */}
      {mode === "3d" && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden w-full max-w-full">
          <div className="absolute inset-0 bg-gradient-to-r from-[#040814]/54 via-transparent to-transparent z-[1]" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#040814]/38 via-transparent to-transparent z-[1]" />
          <div
            className="absolute top-0 left-0 right-0 h-px z-[2]"
            style={{
              background:
                "linear-gradient(to right, transparent, rgba(var(--rushx-soft-rgb), 0.35), transparent)",
            }}
          />
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
              className="absolute top-1/3 left-0 w-1/3 h-[2px] blur-sm z-[2]"
              style={{
                background:
                  "linear-gradient(to right, transparent, rgba(var(--rushx-accent-rgb), 0.42), transparent)",
              }}
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
          <div className="flex max-w-4xl flex-col justify-center w-full">
            {/* Phase 1: Clean editorial metadata line + segmented 2D / 3D switch */}
            <Reveal
              immediate
              delay={timing.heroBaseDelay}
              y={14}
              duration={timing.heroDuration * 0.85}
              className="flex flex-wrap items-center gap-x-5 gap-y-3 mb-6"
            >
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs sm:text-[13px] font-medium text-slate-200/90 tabular-nums">
                <span className="font-semibold text-white">
                  {activeScrims > 0
                    ? `${activeScrims} ${t("scrims_tonight", "Active Lobbies Today")}`
                    : t("scrims_tonight", "Competitive Free Fire Scrims")}
                </span>
                {showcase?.timeWindow && (
                  <>
                    <span className="text-accent/60" aria-hidden="true">·</span>
                    <span className="text-slate-200">{showcase.timeWindow}</span>
                  </>
                )}
                <span className="text-accent/60" aria-hidden="true">·</span>
                <span className="text-accent">Mobile-Only Fair Play</span>
              </div>

              {/* 2D / 3D Mode Selector Switch */}
              <div
                className="inline-flex items-center rounded-xl border border-[rgba(var(--rushx-soft-rgb),0.22)] bg-[#060c1e]/75 p-0.5 backdrop-blur-md shadow-lg"
                role="group"
                aria-label="View Mode Selector"
              >
                <button
                  type="button"
                  onClick={() => setMode("2d")}
                  className={`rushx-btn-splash inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1 text-xs font-semibold transition-all duration-200 active:scale-[0.97] cursor-pointer ${
                    mode === "2d"
                      ? "rushx-primary-btn text-white"
                      : "text-slate-300 hover:text-white"
                  }`}
                  title="Switch to 2D Ambient Mode (Color-Shifting Only)"
                >
                  <Layers className="size-3.5" />
                  2D Ambient
                </button>
                <button
                  type="button"
                  onClick={() => setMode("3d")}
                  className={`rushx-btn-splash inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1 text-xs font-semibold transition-all duration-200 active:scale-[0.97] cursor-pointer ${
                    mode === "3d"
                      ? "rushx-primary-btn text-white"
                      : "text-slate-300 hover:text-white"
                  }`}
                  title="Switch to 3D Cyber Mode"
                >
                  <Boxes className="size-3.5" />
                  3D Cyber
                </button>
              </div>
            </Reveal>

            {/* Phase 2: Primary H1 — Oversized RushX ORGANIZATION brand centerpiece with editorial scale settle */}
            <VisualReveal
              immediate
              delay={timing.visualDelay}
              duration={timing.visualDuration}
              y={22}
              initialScale={1.045}
            >
              <h1 className="font-display font-black leading-none tracking-tight">
                <span className="sr-only">{t("hero_title", BRAND.name)}</span>
                <span className="relative block w-full max-w-[440px] sm:max-w-[680px] md:max-w-[820px] lg:max-w-[880px] -ml-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={BRAND.assets.fullWordmark}
                    alt={BRAND.name}
                    className="block w-full h-auto max-h-[98px] sm:max-h-[144px] md:max-h-[172px] object-contain object-left drop-shadow-[0_10px_34px_rgba(var(--rushx-primary-rgb),0.36)] select-none transition-transform duration-500 ease-out hover:scale-[1.01]"
                  />
                </span>
              </h1>
            </VisualReveal>

            {/* Phase 3: Masked typography slide-up on Subheadline H2 */}
            <MaskedLineReveal
              immediate
              delay={timing.heroBaseDelay + timing.heroStagger * 2}
              duration={timing.heroDuration}
              className="mt-3"
            >
              <h2 className="font-display text-lg font-bold uppercase tracking-[0.06em] text-slate-100/95 sm:text-2xl md:text-[28px] lg:text-[32px]">
                {t("hero_h2", "DOMINATE THE LOBBY EVERY NIGHT")}
              </h2>
            </MaskedLineReveal>

            {/* Phase 4: Body copy */}
            <Reveal
              immediate
              delay={timing.heroBaseDelay + timing.heroStagger * 3}
              y={18}
              duration={timing.heroDuration * 0.92}
            >
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-slate-200/85 text-pretty md:text-lg">
                {t(
                  "hero_subtitle",
                  "Bangladesh's most competitive Free Fire scrims. Daily competitive lobbies, instant booking, automated gateway payments, and cash prize pools. Your squad vs the best."
                )}
              </p>
            </Reveal>

            {/* Phase 5: Action Buttons */}
            <Reveal
              immediate
              delay={timing.heroBaseDelay + timing.heroStagger * 4}
              y={18}
              duration={timing.heroDuration * 0.9}
              className="mt-8 flex flex-wrap items-center gap-4"
            >
              <Button
                asChild
                size="lg"
                className="group h-12 px-8 font-display text-sm font-bold tracking-wide transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
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
                  <ChevronRight className="size-4 ml-1 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>
              </Button>

              <Button
                asChild
                size="lg"
                variant="outline"
                className="glass h-12 px-8 font-semibold text-foreground transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
              >
                <Link href="/results">{t("view_results", "View Results")}</Link>
              </Button>

              <span className="text-xs text-slate-300/80 hidden sm:inline-flex items-center gap-1.5 pl-1">
                Mode:{" "}
                <strong className="font-semibold text-white">
                  {mode === "2d" ? "2D Ambient (Color-Shift)" : "3D Cyber Experience"}
                </strong>
              </span>
            </Reveal>

            {/* Phase 6: Staggered Live Admin-Synced Stats Strip */}
            <RevealStagger
              immediate
              delay={timing.heroBaseDelay + timing.heroStagger * 4.8}
              stagger={0.075}
              className="mt-10 max-w-xl"
            >
              <dl className="grid grid-cols-3 gap-3 sm:gap-4">
                <RevealItem y={16} className="dc-surface dc-card-hover rushx-box-splash rounded-xl p-3.5 sm:p-4">
                  <dt className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                    <Zap className="size-3.5 text-accent" aria-hidden />
                    {t("scrims_tonight", "Active Lobbies")}
                  </dt>
                  <dd className="mt-1 font-display text-xl sm:text-2xl font-bold text-white tabular-nums">
                    {activeScrims > 0 ? activeScrims : "Live"}
                  </dd>
                </RevealItem>

                <RevealItem y={16} className="dc-surface dc-card-hover rushx-box-splash rounded-xl p-3.5 sm:p-4">
                  <dt className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                    <Users className="size-3.5 text-accent" aria-hidden />
                    {t("team_slots", "Team Slots")}
                  </dt>
                  <dd className="mt-1 font-display text-xl sm:text-2xl font-bold text-white tabular-nums">
                    {totalSlots > 0 ? totalSlots : "Open"}
                  </dd>
                </RevealItem>

                <RevealItem y={16} className="dc-surface dc-card-hover rushx-box-splash rounded-xl p-3.5 sm:p-4">
                  <dt className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                    <Trophy className="size-3.5 text-accent" aria-hidden />
                    {showcase?.timeWindow ? "Schedule" : t("scrim_format", "Format")}
                  </dt>
                  <dd className="mt-1 font-display text-sm sm:text-base font-bold text-accent leading-tight">
                    {formatLine}
                  </dd>
                </RevealItem>
              </dl>
            </RevealStagger>
          </div>
        </div>
      </div>
    </section>
  )
}
