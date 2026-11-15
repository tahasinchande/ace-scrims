"use client"

import Link from "next/link"
import { AlertTriangle, RotateCcw, Shield } from "lucide-react"

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-4 py-16 text-center">
      <div className="glass flex size-16 items-center justify-center rounded-2xl border border-destructive/40 bg-destructive/10">
        <AlertTriangle className="size-8 text-destructive" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide text-foreground">
          Admin Panel Error
        </h1>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          An unexpected error occurred while loading this administration view. You can retry or return to the admin overview.
        </p>
        {error.digest && (
          <p className="font-mono text-xs text-muted-foreground/80">Reference ID: {error.digest}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 font-display text-sm font-bold uppercase text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Try Again
        </button>
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary/60 px-5 py-2.5 font-display text-sm font-bold uppercase text-foreground transition-colors hover:bg-secondary"
        >
          <Shield className="size-4" aria-hidden="true" />
          Admin Overview
        </Link>
      </div>
    </div>
  )
}
