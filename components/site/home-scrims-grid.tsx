"use client"

import { useEffect, useState } from "react"
import { ScrimCard, type ScrimCardData } from "@/components/site/scrim-card"

export function HomeScrimsGrid({ initialScrims }: { initialScrims: ScrimCardData[] }) {
  const [scrims, setScrims] = useState<ScrimCardData[]>(initialScrims)

  useEffect(() => {
    setScrims(initialScrims)
  }, [initialScrims])

  useEffect(() => {
    let active = true

    async function refreshSlots() {
      try {
        const res = await fetch("/api/scrims/slots", { cache: "no-store" })
        if (!res.ok) return
        const data = await res.json()
        if (!active || !data?.ok || !Array.isArray(data.scrims)) return
        setScrims(data.scrims)
      } catch {
        // Silent retry on next interval
      }
    }

    const onVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        void refreshSlots()
      }
    }

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshSlots()
      }
    }, 8000)

    window.addEventListener("focus", onVisibilityOrFocus)
    document.addEventListener("visibilitychange", onVisibilityOrFocus)

    return () => {
      active = false
      clearInterval(interval)
      window.removeEventListener("focus", onVisibilityOrFocus)
      document.removeEventListener("visibilitychange", onVisibilityOrFocus)
    }
  }, [])

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {scrims.map((s) => (
        <ScrimCard key={s.slug} scrim={s} />
      ))}
    </div>
  )
}
