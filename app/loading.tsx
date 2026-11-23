import { RushXBrandLogo } from "@/components/site/brand-logo"

export default function Loading() {
  return (
    <div
      className="flex min-h-screen w-full flex-col items-center justify-center gap-6 px-4 text-center"
      role="status"
      aria-label="Loading RushX Organization"
    >
      <div className="relative flex flex-col items-center gap-4">
        <div
          className="pointer-events-none absolute -inset-10 rounded-full bg-violet-600/20 blur-3xl animate-pulse"
          aria-hidden
        />
        <RushXBrandLogo
          variant="wordmark"
          size="xl"
          className="relative z-10 animate-pulse"
        />
        <div className="relative z-10 h-1 w-40 overflow-hidden rounded-full bg-white/[0.08]">
          <div className="h-full w-1/2 rounded-full bg-gradient-to-r from-violet-400 via-orange-400 to-amber-300 animate-pulse" />
        </div>
        <p className="relative z-10 font-display text-xs font-semibold uppercase tracking-[0.26em] text-zinc-400">
          Loading RushX Lobby...
        </p>
      </div>
    </div>
  )
}
