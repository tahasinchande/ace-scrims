"use client"

import { AlertTriangle } from "lucide-react"
import { RushXBrandLogo } from "@/components/site/brand-logo"

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-24 text-center">
      <RushXBrandLogo variant="wordmark" size="lg" />
      <div className="glass flex size-20 items-center justify-center rounded-2xl">
        <AlertTriangle className="size-10 text-destructive" aria-hidden="true" />
      </div>
      <p className="font-display text-7xl font-bold tracking-tight text-destructive sm:text-8xl">500</p>
      <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-foreground text-balance">
        Server got knocked
      </h1>
      <p className="max-w-md leading-relaxed text-muted-foreground text-pretty">
        Something went wrong on our side at RushX Organization. Try again &mdash; if the problem continues, reach us on Discord or WhatsApp.
      </p>
      {error.digest ? <p className="text-xs text-muted-foreground font-mono">Error ID: {error.digest}</p> : null}
      <button
        onClick={() => reset()}
        className="px-6 py-2.5 bg-primary text-primary-foreground hover:bg-primary/85 rounded-xl font-display font-bold uppercase tracking-wide transition-colors cursor-pointer"
      >
        Try Again
      </button>
    </main>
  )
}
