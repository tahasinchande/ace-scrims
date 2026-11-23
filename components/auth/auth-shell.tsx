"use client"

import Link from "next/link"
import Image from "next/image"
import { motion, useReducedMotion } from "motion/react"
import { ArrowLeft, Check } from "lucide-react"
import { BRAND } from "@/lib/brand"

const DEEPCHARTS_EASE = [0.16, 1, 0.3, 1] as const

const SHOWCASE_POINTS = [
  "12 nightly Free Fire lobbies from 7 PM to 12 AM",
  "Instant automated slot booking & wallet payouts",
  "Verified Room IDs delivered directly to your dashboard",
]

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <main className="relative flex min-h-svh w-full items-center justify-center overflow-hidden px-4 py-8 sm:px-6 lg:py-12">
      {/* Subtle atmospheric ambient backdrop */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#060917]/55 via-[#050814]/70 to-[#040610]/88" />
      <div className="pointer-events-none absolute -top-28 left-1/2 -translate-x-1/2 h-80 w-[560px] rounded-full bg-violet-600/22 blur-[110px]" />
      <div className="pointer-events-none absolute -bottom-24 right-1/4 h-72 w-96 rounded-full bg-cyan-500/14 blur-[110px]" />

      {/* ──────────────────────────────────────────────────────────────────────
          MOBILE / COMPACT VIEWPORT (< lg) — Sleek vertical dark app layout
         ────────────────────────────────────────────────────────────────────── */}
      <motion.div
        initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
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
          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-300/90">
            {BRAND.shortName} Arena
          </span>
        </div>

        {/* Centered RushX emblem + wordmark header (mobile AI-app aesthetic) */}
        <div className="mb-6 flex flex-col items-center text-center">
          <Link
            href="/"
            className="group mb-4 flex flex-col items-center gap-2.5"
            aria-label="RushX Organization home"
          >
            <div className="relative flex size-16 items-center justify-center rounded-2xl bg-[radial-gradient(circle_at_30%_20%,rgba(139,92,246,0.34),rgba(13,18,38,0.92))] border border-violet-400/30 shadow-[0_14px_36px_-12px_rgba(124,58,237,0.7)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={BRAND.assets.symbol}
                alt={BRAND.shortName}
                className="size-10 object-contain drop-shadow-[0_4px_14px_rgba(167,139,250,0.45)]"
              />
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={BRAND.assets.wordmark}
              alt={BRAND.name}
              className="h-7 w-auto object-contain drop-shadow-[0_2px_12px_rgba(255,255,255,0.18)]"
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
        initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.6, ease: DEEPCHARTS_EASE }}
        className="relative z-10 hidden w-full max-w-5xl lg:grid lg:grid-cols-[1.06fr_1fr] overflow-hidden rounded-[28px] dc-surface shadow-[0_32px_90px_-24px_rgba(2,4,16,0.92)]"
      >
        {/* Left Visual Brand Showcase Panel */}
        <div className="relative flex flex-col justify-between overflow-hidden p-10 border-r border-violet-300/14">
          <Image
            src="/images/squad.jpg"
            alt="RushX Organization competitive arena"
            fill
            priority
            className="object-cover object-center opacity-45 scale-[1.02]"
            sizes="(min-width: 1024px) 520px, 100vw"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#0d1026]/92 via-[#090d20]/76 to-[#170e33]/88" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(85%_65%_at_18%_14%,rgba(124,58,237,0.34),transparent_62%),radial-gradient(75%_60%_at_85%_88%,rgba(56,189,248,0.18),transparent_60%)]" />

          {/* Top Logo */}
          <div className="relative z-10 flex items-center justify-between">
            <Link href="/" className="group inline-flex items-center" aria-label="RushX Organization home">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={BRAND.assets.fullWordmark}
                alt={BRAND.name}
                className="h-9 w-auto object-contain drop-shadow-[0_4px_18px_rgba(139,92,246,0.35)]"
              />
            </Link>
          </div>

          {/* Center Editorial Showcase Copy */}
          <div className="relative z-10 my-auto py-10">
            <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
              Bangladesh Free Fire Esports
            </p>
            <h2 className="mt-3 font-display text-4xl font-extrabold leading-[1.06] tracking-tight text-white text-balance">
              Compete nightly. Climb the standings. Get paid fast.
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-300/85">
              One account unlocks instant scrim slot bookings, live room credentials, wallet payouts, and official leaderboard standings.
            </p>

            <ul className="mt-7 space-y-3">
              {SHOWCASE_POINTS.map((point) => (
                <li key={point} className="flex items-start gap-2.5 text-sm text-slate-200/90">
                  <Check className="mt-0.5 size-4 shrink-0 text-cyan-300" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Bottom Subtle Brand Strip */}
          <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-5 text-xs text-slate-400">
            <span>{BRAND.name}</span>
            <span className="font-mono text-[11px] text-violet-300/90">{BRAND.domain}</span>
          </div>
        </div>

        {/* Right Clean Focused Form Panel */}
        <div className="relative flex flex-col justify-center bg-[#080c1c]/88 p-10 xl:p-12">
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
              alt={BRAND.shortName}
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
