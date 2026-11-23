"use client"

import { useEffect } from "react"

const SPLASH_SELECTOR =
  '.rushx-btn-splash, .rushx-box-splash, .rushx-live-support-btn, [data-slot="button"], [data-slot="card"], .dc-surface'

export function GlobalSplashTracker() {
  useEffect(() => {
    if (typeof window === "undefined") return
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduced) return

    let rafId = 0
    let pendingTarget: HTMLElement | null = null
    let pendingX = 0
    let pendingY = 0

    const flush = () => {
      rafId = 0
      if (!pendingTarget || !pendingTarget.isConnected) return
      const rect = pendingTarget.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) return
      const x = Math.max(0, Math.min(rect.width, pendingX - rect.left))
      const y = Math.max(0, Math.min(rect.height, pendingY - rect.top))
      pendingTarget.style.setProperty("--splash-x", `${x.toFixed(1)}px`)
      pendingTarget.style.setProperty("--splash-y", `${y.toFixed(1)}px`)
    }

    const onPointerMove = (e: PointerEvent) => {
      const target = e.target
      if (!(target instanceof Element)) return
      const el = target.closest(SPLASH_SELECTOR) as HTMLElement | null
      if (!el) return
      pendingTarget = el
      pendingX = e.clientX
      pendingY = e.clientY
      if (!rafId) {
        rafId = window.requestAnimationFrame(flush)
      }
    }

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target
      if (!(target instanceof Element)) return
      const el = target.closest(
        '.rushx-btn-splash, .rushx-live-support-btn, [data-slot="button"]'
      ) as HTMLElement | null
      if (!el) return
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && rect.height > 0) {
        el.style.setProperty("--splash-x", `${(e.clientX - rect.left).toFixed(1)}px`)
        el.style.setProperty("--splash-y", `${(e.clientY - rect.top).toFixed(1)}px`)
      }
      el.removeAttribute("data-splashing")
      void el.offsetWidth
      el.setAttribute("data-splashing", "true")
      window.setTimeout(() => {
        if (el.isConnected) {
          el.removeAttribute("data-splashing")
        }
      }, 540)
    }

    document.addEventListener("pointermove", onPointerMove, { passive: true })
    document.addEventListener("pointerdown", onPointerDown, { passive: true })

    return () => {
      if (rafId) window.cancelAnimationFrame(rafId)
      document.removeEventListener("pointermove", onPointerMove)
      document.removeEventListener("pointerdown", onPointerDown)
    }
  }, [])

  return null
}
