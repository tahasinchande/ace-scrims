"use client"

import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-32 text-center">
      <div className="glass flex size-20 items-center justify-center rounded-2xl">
        <AlertTriangle className="size-10 text-destructive" aria-hidden="true" />
      </div>
      <p className="font-display text-7xl font-bold tracking-tight text-destructive sm:text-8xl">500</p>
      <h1 className="font-display text-2xl font-semibold uppercase tracking-wide text-foreground text-balance">
        Server got knocked
      </h1>
      <p className="max-w-md leading-relaxed text-muted-foreground text-pretty">
        Something went wrong on our side. Try again &mdash; if the problem continues, reach us on Discord.
      </p>
      {error.digest ? <p className="text-xs text-muted-foreground">Error ID: {error.digest}</p> : null}
      <Button onClick={reset} size="lg" className="glow-primary font-display font-bold uppercase">
        Try Again
      </Button>
    </main>
  )
}
