"use client"

import { motion, useReducedMotion } from "motion/react"
import { Coffee, ExternalLink } from "lucide-react"
import { SupportKoriIcon } from "@/components/site/brand-icons"

const DEEPCHARTS_EASE = [0.16, 1, 0.3, 1] as const

export function SupportKoriBanner({ supportKoriUrl }: { supportKoriUrl?: string }) {
  const url = supportKoriUrl || "https://www.supportkori.com/ace_scrims"
  const prefersReducedMotion = useReducedMotion()

  return (
    <section className="w-full py-8 px-4">
      <motion.div
        initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.52, ease: DEEPCHARTS_EASE }}
        className="dc-surface rushx-box-splash mx-auto max-w-5xl overflow-hidden rounded-3xl border-amber-400/25 p-6 sm:p-8 shadow-2xl relative group"
      >
        {/* Clean warm golden ambient accent — zero violet/indigo bleed */}
        <div className="absolute -right-20 -top-20 size-60 rounded-full bg-amber-400/12 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-4 text-center md:text-left">
            <SupportKoriIcon className="size-9 shrink-0 text-amber-400 transition-transform duration-200 group-hover:scale-105" />

            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5">
                <h3 className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
                  Support RushX Organization on SupportKori
                </h3>
                <span className="text-xs font-semibold uppercase tracking-wider text-amber-300/90">
                  · Buy Us A Coffee
                </span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-xl leading-relaxed">
                Help us host bigger tournament prize pools, ultra-fast servers, and maintain dedicated support for the Bangladesh Free Fire community.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto justify-center">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="rushx-btn-splash inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-yellow-200/70 bg-gradient-to-b from-yellow-300 via-amber-400 to-amber-500 px-6 text-xs sm:text-sm font-bold text-zinc-950 shadow-[0_10px_28px_-8px_rgba(245,158,11,0.55),inset_0_1px_0_rgba(255,255,255,0.65)] transition-all duration-200 hover:from-yellow-200 hover:via-yellow-300 hover:to-amber-400 hover:-translate-y-0.5 active:translate-y-0"
            >
              <Coffee className="size-4 shrink-0 text-zinc-950" />
              <span>Donate on SupportKori</span>
              <ExternalLink className="size-3.5 shrink-0 text-zinc-900/80" />
            </a>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
