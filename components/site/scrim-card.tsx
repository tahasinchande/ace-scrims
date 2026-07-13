import Link from "next/link"
import Image from "next/image"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Countdown } from "@/components/site/countdown"
import { bdt, scrimStatus, scrimStartDate } from "@/lib/format"
import { Clock, Users, Trophy, MapPin } from "lucide-react"
import { cn } from "@/lib/utils"

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

export type ScrimCardData = {
  slug: string
  title: string
  startTime: string
  scrimDate: string
  priceBdt: number
  prizePoolBdt: number
  maxTeams: number
  confirmedTeams: number
  map: string
  mode: string
  registrationOpen: boolean
  status: string
  bannerUrl: string | null
}

export function ScrimCard({ scrim }: { scrim: ScrimCardData }) {
  const status = scrimStatus(scrim.confirmedTeams, scrim.maxTeams, scrim.registrationOpen, scrim.status)
  const remaining = Math.max(0, scrim.maxTeams - scrim.confirmedTeams)
  const start = scrimStartDate(scrim.scrimDate, scrim.startTime)
  const banner = scrim.bannerUrl || mapImages[scrim.map] || "/images/map-bermuda.png"
  const bookable = status.tone === "open" || status.tone === "filling"

  return (
    <article className="group glass relative overflow-hidden rounded-2xl transition-transform duration-300 hover:-translate-y-1">
      <Link href={`/scrims/${scrim.slug}`} className="absolute inset-0 z-10" aria-label={`View ${scrim.title}`} />

      <div className="relative h-36 overflow-hidden">
        <Image
          src={banner || "/placeholder.svg"}
          alt={`${scrim.map} map`}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, 33vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/40 to-transparent" />
        <div className="absolute left-4 top-4 flex gap-2">
          <Badge variant="outline" className={cn("border font-semibold", toneStyles[status.tone])}>
            {status.label}
          </Badge>
        </div>
        <div className="absolute right-4 top-4">
          <Badge variant="outline" className="glass border-border/60 font-mono text-xs">
            <Countdown targetIso={start.toISOString()} />
          </Badge>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-bold leading-tight text-balance">{scrim.title}</h3>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="size-3.5" aria-hidden />
              {scrim.startTime} · 1 hour
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-xl font-bold text-primary">{bdt(scrim.priceBdt)}</p>
            <p className="text-xs text-muted-foreground">per team</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-secondary/60 px-2 py-2">
            <Trophy className="mx-auto mb-1 size-4 text-primary" aria-hidden />
            <p className="text-xs font-semibold">{bdt(scrim.prizePoolBdt)}</p>
            <p className="text-[10px] text-muted-foreground">Prize Pool</p>
          </div>
          <div className="rounded-lg bg-secondary/60 px-2 py-2">
            <MapPin className="mx-auto mb-1 size-4 text-accent" aria-hidden />
            <p className="text-xs font-semibold">{scrim.map}</p>
            <p className="text-[10px] text-muted-foreground">{scrim.mode}</p>
          </div>
          <div className="rounded-lg bg-secondary/60 px-2 py-2">
            <Users className="mx-auto mb-1 size-4 text-info" aria-hidden />
            <p className="text-xs font-semibold">
              {scrim.confirmedTeams}/{scrim.maxTeams}
            </p>
            <p className="text-[10px] text-muted-foreground">Teams</p>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
            <span>{remaining} spots left</span>
            <span>{Math.round((scrim.confirmedTeams / scrim.maxTeams) * 100)}% filled</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={scrim.confirmedTeams} aria-valuemin={0} aria-valuemax={scrim.maxTeams} aria-label="Slots filled">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                status.tone === "full" ? "bg-destructive" : status.tone === "filling" ? "bg-warning" : "bg-primary",
              )}
              style={{ width: `${Math.min(100, (scrim.confirmedTeams / scrim.maxTeams) * 100)}%` }}
            />
          </div>
        </div>

        <Button
          asChild
          className={cn("relative z-20 h-10 w-full font-semibold", bookable && "glow-primary")}
          variant={bookable ? "default" : "secondary"}
        >
          <Link href={bookable ? `/book/${scrim.slug}` : `/scrims/${scrim.slug}`}>
            {bookable ? "Book Spot" : status.tone === "full" ? "Lobby Full" : "View Details"}
          </Link>
        </Button>
      </div>
    </article>
  )
}
