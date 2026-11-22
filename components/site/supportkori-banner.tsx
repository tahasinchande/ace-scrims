"use client"

import { Coffee, Heart, Sparkles, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SupportKoriIcon } from "@/components/site/brand-icons"

export function SupportKoriBanner({ supportKoriUrl }: { supportKoriUrl?: string }) {
  const url = supportKoriUrl || "https://www.supportkori.com/ace_scrims"

  return (
    <section className="w-full py-8 px-4">
      <div className="dc-surface mx-auto max-w-5xl overflow-hidden rounded-3xl border-amber-500/25 p-6 sm:p-8 shadow-2xl relative group">
        {/* Subtle warm & indigo atmospheric glow */}
        <div className="absolute -right-20 -top-20 size-60 rounded-full bg-amber-500/12 blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 size-60 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center md:text-left">
            <div className="size-15 shrink-0 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner group-hover:scale-105 transition-transform">
              <SupportKoriIcon className="size-8 text-amber-400" />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5">
                <h3 className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
                  Support Ace Scrims on SupportKori
                </h3>
                <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
                  <Heart className="size-3 fill-amber-400 text-amber-400" /> Buy Us A Coffee
                </span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground max-w-xl leading-relaxed">
                Help us host bigger tournament prize pools, ultra-fast servers, and maintain 24/7 dedicated support for Bangladesh Free Fire community.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto justify-center">
            <Button
              render={
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
              nativeButton={false}
              className="h-11 rounded-xl bg-gradient-to-b from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-zinc-950 font-semibold px-6 shadow-lg shadow-amber-500/20 transition-all text-xs sm:text-sm gap-2"
            >
              <Coffee className="size-4" />
              <span>Donate on SupportKori</span>
              <ExternalLink className="size-3.5 opacity-80" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
