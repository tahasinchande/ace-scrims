"use client"

import { useEffect, useState } from "react"

function diffParts(target: number) {
  const now = Date.now()
  const d = Math.max(0, target - now)
  return {
    hours: Math.floor(d / 3_600_000),
    minutes: Math.floor((d % 3_600_000) / 60_000),
    seconds: Math.floor((d % 60_000) / 1000),
    done: d <= 0,
  }
}

export function Countdown({ targetIso, className }: { targetIso: string; className?: string }) {
  const target = new Date(targetIso).getTime()
  const [parts, setParts] = useState<ReturnType<typeof diffParts> | null>(null)

  useEffect(() => {
    setParts(diffParts(target))
    const id = setInterval(() => setParts(diffParts(target)), 1000)
    return () => clearInterval(id)
  }, [target])

  if (!parts) {
    return (
      <span className={className} aria-hidden>
        --:--:--
      </span>
    )
  }
  if (parts.done) {
    return <span className={className}>Live now</span>
  }

  const pad = (n: number) => String(n).padStart(2, "0")
  return (
    <span className={className} aria-label="Time until start">
      {pad(parts.hours)}:{pad(parts.minutes)}:{pad(parts.seconds)}
    </span>
  )
}
