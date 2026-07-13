import Link from "next/link"
import { Zap } from "lucide-react"
import { FacebookIcon, DiscordIcon } from "@/components/site/brand-icons"

export function SiteFooter() {
  return (
    <footer className="border-t border-border/50 bg-card/40">
      <div className="mx-auto max-w-6xl px-4 py-12 md:px-6">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="flex flex-col gap-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Zap className="size-4" />
              </span>
              <span className="font-display text-lg font-bold tracking-wide">
                ACE<span className="text-primary">SCRIMS</span>
              </span>
            </Link>
            <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
              Bangladesh&apos;s premium Free Fire scrim platform. Six competitive lobbies every night.
            </p>
            <div className="mt-2 flex gap-2">
              <a
                href="https://discord.gg/acescrims"
                target="_blank"
                rel="noopener noreferrer"
                className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                aria-label="Join our Discord"
              >
                <DiscordIcon className="size-4" />
              </a>
              <a
                href="https://facebook.com/acescrims"
                target="_blank"
                rel="noopener noreferrer"
                className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                aria-label="Follow us on Facebook"
              >
                <FacebookIcon className="size-4" />
              </a>
            </div>
          </div>

          <nav className="flex flex-col gap-2" aria-label="Platform">
            <h3 className="mb-1 font-display text-sm font-bold uppercase tracking-wider text-foreground">Platform</h3>
            <Link href="/scrims" className="text-sm text-muted-foreground hover:text-foreground">
              Tonight&apos;s Scrims
            </Link>
            <Link href="/results" className="text-sm text-muted-foreground hover:text-foreground">
              Results &amp; Leaderboard
            </Link>
            <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
              My Dashboard
            </Link>
          </nav>

          <nav className="flex flex-col gap-2" aria-label="Support">
            <h3 className="mb-1 font-display text-sm font-bold uppercase tracking-wider text-foreground">Support</h3>
            <Link href="/#faq" className="text-sm text-muted-foreground hover:text-foreground">
              FAQ
            </Link>
            <Link href="/#contact" className="text-sm text-muted-foreground hover:text-foreground">
              Contact Us
            </Link>
          </nav>

          <nav className="flex flex-col gap-2" aria-label="Legal">
            <h3 className="mb-1 font-display text-sm font-bold uppercase tracking-wider text-foreground">Legal</h3>
            <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground">
              Terms &amp; Conditions
            </Link>
            <Link href="/refund-policy" className="text-sm text-muted-foreground hover:text-foreground">
              Refund Policy
            </Link>
          </nav>
        </div>

        <div className="mt-10 border-t border-border/50 pt-6 text-center text-xs text-muted-foreground">
          {"© "}
          {new Date().getFullYear()}
          {" Ace Scrims. All rights reserved. Not affiliated with Garena."}
        </div>
      </div>
    </footer>
  )
}

