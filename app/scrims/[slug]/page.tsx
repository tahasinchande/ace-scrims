import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { SiteHeader } from "@/components/site/site-header"
import { SiteFooter } from "@/components/site/site-footer"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Countdown } from "@/components/site/countdown"
import { getScrimBySlug } from "@/lib/queries/scrims"
import { bdt, scrimStatus, scrimStartDate, formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Clock, Users, Trophy, MapPin, Swords, CalendarDays, ScrollText, StickyNote } from "lucide-react"

const mapImages: Record<string, string> = {
  Bermuda: "/images/map-bermuda.png",
  Purgatory: "/images/map-purgatory.png",
  Kalahari: "/images/map-kalahari.png",
}

const toneStyles: Record<string, string> = {
  open: "bg-success/15 text-success border-success/30",
  filling: "bg-warning/15 text-warning border-warning/30",
  full: "bg-destructive/15 text-destructive border-destructive/30",
  closed: "bg-muted text-muted-foreground border-border",
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const scrim = await getScrimBySlug(slug)
  if (!scrim) return { title: "Scrim Not Found — Ace Scrims" }
  return {
    title: `${scrim.title} — Ace Scrims`,
    description: scrim.description ?? `Free Fire scrim at ${scrim.startTime}, ${bdt(scrim.priceBdt)} entry.`,
  }
}

export default async function ScrimDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const scrim = await getScrimBySlug(slug)
  if (!scrim) notFound()

  const status = scrimStatus(scrim.confirmedTeams, scrim.maxTeams, scrim.registrationOpen, scrim.status)
  const remaining = Math.max(0, scrim.maxTeams - scrim.confirmedTeams)
  const start = scrimStartDate(scrim.scrimDate, scrim.startTime)
  const banner = scrim.bannerUrl || mapImages[scrim.map] || "/images/map-bermuda.png"
  const bookable = status.tone === "open" || status.tone === "filling"

  const stats = [
    { icon: Clock, label: "Start Time", value: `${scrim.startTime} (1 hour)` },
    { icon: CalendarDays, label: "Date", value: formatDate(scrim.scrimDate) },
    { icon: MapPin, label: "Map", value: scrim.map },
    { icon: Swords, label: "Mode", value: scrim.mode },
    { icon: Trophy, label: "Prize Pool", value: bdt(scrim.prizePoolBdt) },
    { icon: Users, label: "Slots", value: `${scrim.confirmedTeams}/${scrim.maxTeams} teams` },
  ]

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen pb-20 pt-16">
        {/* Banner */}
        <div className="relative h-64 w-full overflow-hidden sm:h-80">
          <Image
            src={banner || "/placeholder.svg"}
            alt={`${scrim.map} map banner`}
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/20" />
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-6xl px-4 pb-6 sm:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn("border font-semibold", toneStyles[status.tone])}>
                {status.label}
              </Badge>
              <Badge variant="outline" className="glass border-border/60 font-mono text-xs">
                Starts in <Countdown targetIso={start.toISOString()} />
              </Badge>
            </div>
            <h1 className="mt-3 font-display text-3xl font-bold uppercase tracking-tight sm:text-5xl text-balance">
              {scrim.title}
            </h1>
          </div>
        </div>

        <div className="mx-auto mt-8 grid w-full max-w-6xl grid-cols-1 gap-8 px-4 sm:px-6 lg:grid-cols-3">
          {/* Main column */}
          <div className="flex flex-col gap-8 lg:col-span-2">
            {scrim.description && (
              <section aria-labelledby="about-heading">
                <h2 id="about-heading" className="font-display text-xl font-bold uppercase tracking-wide">
                  About this scrim
                </h2>
                <p className="mt-3 leading-relaxed text-muted-foreground">{scrim.description}</p>
              </section>
            )}

            <section aria-labelledby="details-heading">
              <h2 id="details-heading" className="sr-only">
                Scrim details
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {stats.map((s) => (
                  <div key={s.label} className="glass rounded-xl p-4">
                    <s.icon className="size-4 text-primary" aria-hidden />
                    <p className="mt-2 text-xs text-muted-foreground">{s.label}</p>
                    <p className="font-display text-sm font-bold">{s.value}</p>
                  </div>
                ))}
              </div>
            </section>

            {scrim.rules && (
              <section aria-labelledby="rules-heading" className="glass rounded-2xl p-6">
                <h2
                  id="rules-heading"
                  className="flex items-center gap-2 font-display text-xl font-bold uppercase tracking-wide"
                >
                  <ScrollText className="size-5 text-primary" aria-hidden />
                  Rules
                </h2>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {scrim.rules.split("\n").map((rule, i) => (
                    <li key={i} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
                      {rule.replace(/^\d+\.\s*/, "")}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {scrim.notes && (
              <section aria-labelledby="notes-heading" className="glass rounded-2xl p-6">
                <h2
                  id="notes-heading"
                  className="flex items-center gap-2 font-display text-xl font-bold uppercase tracking-wide"
                >
                  <StickyNote className="size-5 text-accent" aria-hidden />
                  Notes
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{scrim.notes}</p>
              </section>
            )}
          </div>

          {/* Booking sidebar */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="glass-strong rounded-2xl p-6">
              <div className="flex items-baseline justify-between">
                <p className="font-display text-3xl font-bold text-primary">{bdt(scrim.priceBdt)}</p>
                <p className="text-sm text-muted-foreground">per team</p>
              </div>

              <div className="mt-5">
                <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{remaining} spots left</span>
                  <span>
                    {scrim.confirmedTeams}/{scrim.maxTeams} booked
                  </span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-secondary"
                  role="progressbar"
                  aria-valuenow={scrim.confirmedTeams}
                  aria-valuemin={0}
                  aria-valuemax={scrim.maxTeams}
                  aria-label="Slots filled"
                >
                  <div
                    className={cn(
                      "h-full rounded-full",
                      status.tone === "full"
                        ? "bg-destructive"
                        : status.tone === "filling"
                          ? "bg-warning"
                          : "bg-primary",
                    )}
                    style={{ width: `${Math.min(100, (scrim.confirmedTeams / scrim.maxTeams) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3">
                {bookable ? (
                  <Button asChild size="lg" className="glow-primary h-12 w-full font-display text-base font-bold uppercase tracking-wide">
                    <Link href={`/book/${scrim.slug}`}>Book Your Spot</Link>
                  </Button>
                ) : (
                  <Button size="lg" variant="secondary" className="h-12 w-full font-display text-base font-bold uppercase tracking-wide" disabled>
                    {status.tone === "full" ? "Lobby Full" : "Registration Closed"}
                  </Button>
                )}
                <p className="text-center text-xs leading-relaxed text-muted-foreground">
                  Instant confirmation after payment via bKash, Nagad or Rocket. Room ID &amp; password
                  appear in your dashboard once published.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
