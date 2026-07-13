import type { Metadata } from "next"
import { Suspense } from "react"
import { SiteHeader } from "@/components/site/site-header"
import { SiteFooter } from "@/components/site/site-footer"
import { getScrimsWithCounts } from "@/lib/queries/scrims"
import { getSessionUser } from "@/lib/session"
import { ScrimsExplorer } from "@/components/scrims/scrims-explorer"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata: Metadata = {
  title: "Daily Scrims — Ace Scrims",
  description:
    "Browse today's Free Fire scrim lobbies. 6 daily slots from 7 PM to 12 AM, ৳50 entry, 12 teams max per lobby.",
}

function ScrimsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-72 rounded-2xl" />
      ))}
    </div>
  )
}

async function ScrimsContent() {
  const [scrims, user] = await Promise.all([getScrimsWithCounts(), getSessionUser()])
  return <ScrimsExplorer scrims={scrims} isAuthed={!!user} />
}

export default function ScrimsPage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen pt-28 pb-20">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="mb-10 flex flex-col gap-3">
            <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-primary">
              Daily Lobbies
            </p>
            <h1 className="font-display text-4xl font-bold uppercase tracking-tight text-foreground sm:text-5xl text-balance">
              Today&apos;s Scrims
            </h1>
            <p className="max-w-2xl leading-relaxed text-muted-foreground">
              Six competitive lobbies every day from 7:00 PM to 12:00 AM. Entry is ৳50 per squad, 12
              teams max. Book your slot before the lobby fills.
            </p>
          </div>
          <Suspense fallback={<ScrimsSkeleton />}>
            <ScrimsContent />
          </Suspense>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
