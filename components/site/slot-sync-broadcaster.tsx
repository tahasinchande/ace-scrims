"use client"

import { useEffect } from "react"

export function SlotSyncBroadcaster({
  active = true,
  scrimId,
}: {
  active?: boolean
  scrimId?: string
}) {
  useEffect(() => {
    if (!active || typeof window === "undefined") return
    window.dispatchEvent(new CustomEvent("acescrims:slots-updated", { detail: { scrimId } }))
    if (typeof BroadcastChannel !== "undefined") {
      const ch = new BroadcastChannel("acescrims-slots")
      ch.postMessage({ type: "slots-updated", scrimId })
      ch.close()
    }
  }, [active, scrimId])

  return null
}
