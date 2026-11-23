"use client"

import Link from "next/link"
import Image from "next/image"
import { motion, useReducedMotion } from "motion/react"
import { ArrowLeft, Check } from "lucide-react"
import { BRAND } from "@/lib/brand"

const DEEPCHARTS_EASE = [0.16, 1, 0.3, 1] as const

const DEFAULT_SHOWCASE_POINTS = [
  "Live Free Fire scrim lobbies managed daily by RushX admins",
  "Instant automated slot booking & verified wallet payouts",
  "Room IDs and passwords delivered directly to your dashboard",
]

export function AuthShell({
  title,
  subtitle,
  highlights,
  children,
}: {
  title: string
  subtitle: string
  highlights?: string[]
  children: React.ReactNode
}) {
  const prefersReducedMotion = useReducedMotion()
  const points = highlights && highlights.length > 0 ? highlights : DEFAULT_SHOWCASE_POINTS

  return (
    <main className="relative flex min-h-svh w-full items-center justify-center overflow-hidden px-4 py-8 sm:px-6 lg:py-12">
      {/* Subtle atmospheric ambient backdrop synchronized with dynamic Blue-primary phase */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#040814]/50 via-[#040814]/65 to-[#030610]/85" />
      <div
        className="pointer-events-none absolute -top-28 left-1/2 -translate-x-1/2 h-80 w-[560px] rounded-full blur-[110px]"
        style={{ background: "rgba(var(--rushx-primary-rgb), 0.22)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-24 right-1/4 h-72 w-96 rounded-full blur-[110px]"
        style={{ background: "rgba(var(--rushx-accent-rgb), 0.14)" }}
      />

      {/* ──────────────────────────────────────────────────────────────────────
          MOBILE / COMPACT VIEWPORT (< lg) — Clean dark app layout
         ────────────────────────────────────────────────────────────────────── */}
      <motion.div
        initial={prefersReducedMotion ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 20, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.55, ease: DEEPCHARTS_EASE }}
        className="relative z-10 w-full max-w-[430px] lg:hidden"
      >
        <div className="mb-5 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to home</span>
          </Link>
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
            {BRAND.name}
          </span>
        </div>

        {/* Centered transparent RushX Organization header */}
        <div className="mb-6 flex flex-col items-center text-center">
          <Link
            href="/"
            className="group mb-4 flex flex-col items-center gap-2.5"
            aria-label="RushX Organization home"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={BRAND.assets.symbol}
              alt={BRAND.name}
              className="size-12 object-contain drop-shadow-[0_6px_18px_rgba(var(--rushx-primary-rgb),0.45)] transition-transform duration-200 group-hover:scale-105"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={BRAND.assets.fullWordmark}
              alt={BRAND.name}
              className="h-8 w-auto object-contain drop-shadow-[0_2px_12px_rgba(255,255,255,0.18)]"
            />
          </Link>
          <h1 className="font-display text-2xl font-bold tracking-tight text-white text-balance">
            {title}
          </h1>
          <p className="mt-1.5 max-w-xs text-sm text-slate-300/80 text-pretty">
            {subtitle}
          </p>
        </div>

        {/* Elevated glass sheet */}
        <div className="dc-surface rounded-[26px] p-6 sm:p-7 shadow-2xl">
          {children}
        </div>
      </motion.div>

      {/* ──────────────────────────────────────────────────────────────────────
          DESKTOP / PC VIEWPORT (lg+) — Refined asymmetric 2-column split screen
         ────────────────────────────────────────────────────────────────────── */}
      <motion.div
        initial={prefersReducedMotion ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 22, scale: 0.988 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.6, ease: DEEPCHARTS_EASE }}
        className="relative z-10 hidden w-full max-w-5xl lg:grid lg:grid-cols-[1.06fr_1fr] overflow-hidden rounded-[28px] dc-surface shadow-[0_32px_90px_-24px_rgba(2,4,16,0.92)]"
      >
        {/* Left Visual Brand Showcase Panel */}
        <div className="relative flex flex-col justify-between overflow-hidden p-10 border-r border-white/[0.08]">
          <Image
            src="/images/squad.jpg"
            alt="RushX Organization competitive arena"
            fill
            priority
            className="object-cover object-center opacity-45 scale-[1.02]"
            sizes="(min-width: 1024px) 520px, 100vw"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#060d22]/92 via-[#070f26]/78 to-[#040919]/90" />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(85% 65% at 18% 14%, rgba(var(--rushx-primary-rgb), 0.34), transparent 62%), radial-gradient(75% 60% at 85% 88%, rgba(var(--rushx-accent-rgb), 0.18), transparent 60%)",
            }}
          />

          {/* Top Logo */}
          <div className="relative z-10 flex items-center justify-between">
            <Link href="/" className="group inline-flex items-center" aria-label="RushX Organization home">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={BRAND.assets.fullWordmark}
                alt={BRAND.name}
                className="h-9 w-auto object-contain drop-shadow-[0_4px_18px_rgba(var(--rushx-primary-rgb),0.4)]"
              />
            </Link>
          </div>

          {/* Center Editorial Showcase Copy (Live Admin-Synced Points) */}
          <div className="relative z-10 my-auto py-10">
            <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-accent">
              Bangladesh Free Fire Esports
            </p>
            <h2 className="mt-3 font-display text-4xl font-extrabold leading-[1.06] tracking-tight text-white text-balance">
              Compete nightly. Climb the standings. Get paid fast.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-300/85">
              One account unlocks instant scrim slot bookings, live room credentials, wallet payouts, and official leaderboard standings.
            </p>

            <ul className="mt-7 space-y-3">
              {points.map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-sm text-slate-200/90">
                  <Check className="mt-0.5 size-4 shrink-0 text-accent" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Bottom Subtle Brand Strip */}
          <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-5 text-xs text-slate-400">
            <span>{BRAND.name}</span>
            <span className="font-mono text-[11px] text-accent">{BRAND.domain}</span>
          </div>
        </div>

        {/* Right Clean Focused Form Panel */}
        <div className="relative flex flex-col justify-center bg-[#060b1a]/88 p-10 xl:p-12">
          <div className="mb-7 flex items-center justify-between">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to site</span>
            </Link>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={BRAND.assets.symbol}
              alt={BRAND.name}
              className="size-7 object-contain opacity-90"
            />
          </div>

          <div className="mb-7">
            <h1 className="font-display text-3xl font-bold tracking-tight text-white text-balance">
              {title}
            </h1>
            <p className="mt-1.5 text-sm text-slate-400 text-pretty">{subtitle}</p>
          </div>

          {children}
        </div>
      </motion.div>
    </main>
  )
}
