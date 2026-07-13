import Link from "next/link"
import { Button } from "@/components/ui/button"
import { SiteHeader } from "@/components/site/site-header"
import { SiteFooter } from "@/components/site/site-footer"
import { Skull } from "lucide-react"

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-32 text-center">
        <div className="glass flex size-20 items-center justify-center rounded-2xl">
          <Skull className="size-10 text-primary" aria-hidden="true" />
        </div>
        <p className="font-display text-7xl font-bold tracking-tight text-primary sm:text-8xl">404</p>
        <h1 className="font-display text-2xl font-semibold uppercase tracking-wide text-foreground text-balance">
          You landed outside the zone
        </h1>
        <p className="max-w-md leading-relaxed text-muted-foreground text-pretty">
          The page you&apos;re looking for was eliminated or never dropped in. Head back to the lobby and re-queue.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg" className="glow-primary font-display font-bold uppercase">
            <Link href="/">Back to Lobby</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="font-display font-bold uppercase bg-transparent">
            <Link href="/scrims">Browse Scrims</Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
