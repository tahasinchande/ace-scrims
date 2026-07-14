import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronRight, Trophy, Users, Zap } from "lucide-react"

export function Hero({ stats }: { stats: { scrimsTonight: number; totalTeams: number; totalPrize: number } }) {
  return (
    <section className="relative overflow-hidden">
      <Image
        src="/images/hero-bg.jpg"
        alt=""
        fill
        priority
        className="object-cover object-right"
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/30" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />

      <div className="relative mx-auto flex min-h-[85svh] max-w-6xl flex-col justify-center px-4 py-20 md:px-6">
        <div className="max-w-2xl">
          <Badge variant="outline" className="glass mb-6 gap-2 border-primary/40 px-3 py-1.5 text-primary">
            <span className="size-1.5 animate-pulse-glow rounded-full bg-primary" aria-hidden />
            {stats.scrimsTonight} scrims live tonight
          </Badge>

          <h1 className="font-display text-4xl font-black leading-[1.05] tracking-tight text-balance md:text-6xl lg:text-7xl">
            DOMINATE THE
            <span className="block text-primary text-glow">SCRIM LOBBY</span>
            EVERY NIGHT
          </h1>

          <p className="mt-6 max-w-lg text-base leading-relaxed text-muted-foreground text-pretty md:text-lg">
            Bangladesh&apos;s most competitive Free Fire scrims. Six nightly lobbies, instant booking, automatic
            payments, and real cash prizes. Your squad vs the best.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="h-12 px-8 font-display font-bold glow-primary">
              <Link href="/scrims">
                Book Tonight&apos;s Scrim
                <ChevronRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="glass h-12 border-border/60 px-8 font-semibold bg-transparent">
              <Link href="/results">View Results</Link>
            </Button>
          </div>

          <dl className="mt-12 grid max-w-md grid-cols-3 gap-4">
            <div className="glass rounded-xl p-4">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Zap className="size-3.5 text-primary" aria-hidden />
                Nightly Scrims
              </dt>
              <dd className="mt-1 font-display text-2xl font-bold">{stats.scrimsTonight}</dd>
            </div>
            <div className="glass rounded-xl p-4">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="size-3.5 text-accent" aria-hidden />
                Team Slots
              </dt>
              <dd className="mt-1 font-display text-2xl font-bold">{stats.totalTeams}</dd>
            </div>
            <div className="glass rounded-xl p-4">
              <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Trophy className="size-3.5 text-warning" aria-hidden />
                Nightly Prizes
              </dt>
              <dd className="mt-1 font-display text-2xl font-bold">{"৳"}{stats.totalPrize.toLocaleString()}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  )
}
