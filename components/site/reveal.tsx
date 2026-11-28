"use client"

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { DEEPCHARTS_EASE } from "@/lib/intro-motion"
import { cn } from "@/lib/utils"

export { DEEPCHARTS_EASE }

/**
 * Progressive, SSR-safe Fade-In reveal hook:
 * - SSR & first paint are ALWAYS visible (opacity: 1) — elements can NEVER stay blank/hidden.
 * - On client mount:
 *   • Elements strictly BELOW the initial fold are primed with `data-reveal="hidden"` and
 *     smoothly transition to `data-reveal="visible"` once as the user scrolls down.
 *   • Elements ALREADY inside or above the viewport stay visible immediately (or run a
 *     pure CSS fade-in keyframe if `immediate` is set) and are NEVER hidden.
 * - Uses IntersectionObserver (threshold: 0, generous bottom rootMargin) + capturing document
 *   scroll listener (works inside iframes and nested scrollers) + layout-settle checks.
 * - Runs once per mount with zero React state flips and zero Motion variant lockups.
 */
function useProgressiveReveal(
  ref: React.RefObject<HTMLDivElement | null>,
  options: { immediate?: boolean } = {}
) {
  const { immediate = false } = options
  const latchedRef = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof window === "undefined") return

    const prefersReduced =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches

    if (prefersReduced || latchedRef.current) {
      latchedRef.current = true
      el.dataset.reveal = "visible"
      return
    }

    const revealNow = () => {
      if (latchedRef.current) return
      latchedRef.current = true
      el.dataset.reveal = "visible"
    }

    const vh = window.innerHeight || document.documentElement.clientHeight || 800
    const initialRect = el.getBoundingClientRect()

    // Already in or above the viewport, unmeasured, or immediate above-the-fold: NEVER hide with opacity: 0
    if (
      immediate ||
      vh < 200 ||
      initialRect.height === 0 ||
      initialRect.top < vh * 0.96 ||
      initialRect.bottom <= 0
    ) {
      latchedRef.current = true
      el.dataset.reveal = "visible"
      return
    }

    // Strictly below the fold: prime hidden state & observe smoothly
    el.dataset.reveal = "hidden"

    const checkRect = () => {
      if (latchedRef.current) return
      const rect = el.getBoundingClientRect()
      const currentVh = window.innerHeight || document.documentElement.clientHeight || 800
      if (rect.top <= currentVh + 80 || rect.bottom <= 0) {
        revealNow()
        cleanup()
      }
    }

    let io: IntersectionObserver | null = null
    const cleanup = () => {
      io?.disconnect()
      io = null
      document.removeEventListener("scroll", checkRect, true)
      window.removeEventListener("scroll", checkRect)
      window.removeEventListener("resize", checkRect)
    }

    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (
              entry.isIntersecting ||
              entry.boundingClientRect.top <= (window.innerHeight || 800) + 80
            ) {
              revealNow()
              cleanup()
              break
            }
          }
        },
        {
          threshold: 0,
          rootMargin: "0px 0px 80px 0px",
        }
      )
      io.observe(el)
    } else {
      revealNow()
      return
    }

    document.addEventListener("scroll", checkRect, { passive: true, capture: true })
    window.addEventListener("scroll", checkRect, { passive: true })
    window.addEventListener("resize", checkRect, { passive: true })

    // Catch anchor jumps (#schedule, #contact) or late layout shifts
    const settle1 = window.setTimeout(checkRect, 180)
    const settle2 = window.setTimeout(checkRect, 600)

    return () => {
      window.clearTimeout(settle1)
      window.clearTimeout(settle2)
      cleanup()
    }
  }, [immediate, ref])
}

/**
 * Legacy export kept for compatibility with any callers.
 */
export function useReliableOnceReveal(
  ref: React.RefObject<HTMLDivElement | null>,
  _reduced: boolean | null,
  immediate = false
) {
  useProgressiveReveal(ref, { immediate })
  return true
}

function buildRevealStyle(y: number, duration: number, delay: number, scale = 0.99): CSSProperties {
  return {
    ["--reveal-y" as string]: `${y}px`,
    ["--reveal-dur" as string]: `${Math.round(duration * 1000)}ms`,
    ["--reveal-delay" as string]: `${Math.round(delay * 1000)}ms`,
    ["--reveal-scale" as string]: String(scale),
  }
}

/**
 * Heading reveal (SSR-safe, smooth GPU fade-in on initial load or scroll).
 */
export function BlurTextReveal({
  text,
  as = "h2",
  id,
  className,
  delay = 0,
  duration = 0.6,
  immediate = false,
}: {
  text: string
  as?: "h1" | "h2" | "h3" | "p" | "span"
  id?: string
  className?: string
  delay?: number
  wordStagger?: number
  duration?: number
  immediate?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  useProgressiveReveal(ref, { immediate })
  const Tag = as

  return (
    <div
      ref={ref}
      className={immediate ? "rushx-hero-fade" : undefined}
      style={
        immediate
          ? { animationDelay: `${Math.round(delay * 1000)}ms` }
          : buildRevealStyle(16, duration, delay, 0.995)
      }
    >
      <Tag id={id} className={className}>
        {text}
      </Tag>
    </div>
  )
}

export function Reveal({
  children,
  className,
  delay = 0,
  y = 18,
  duration = 0.58,
  immediate = false,
}: {
  children: ReactNode
  className?: string
  delay?: number
  y?: number
  duration?: number
  immediate?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  useProgressiveReveal(ref, { immediate })

  return (
    <div
      ref={ref}
      style={
        immediate
          ? { animationDelay: `${Math.round(delay * 1000)}ms` }
          : buildRevealStyle(y, duration, delay, 0.99)
      }
      className={cn(immediate && "rushx-hero-fade", className)}
    >
      {children}
    </div>
  )
}

/**
 * Masked typography slide-up reveal (SSR-safe, guaranteed visible).
 */
export function MaskedLineReveal({
  children,
  className,
  innerClassName,
  delay = 0,
  duration = 0.6,
  immediate = false,
}: {
  children: ReactNode
  className?: string
  innerClassName?: string
  delay?: number
  duration?: number
  immediate?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  useProgressiveReveal(ref, { immediate })

  return (
    <div
      ref={ref}
      style={
        immediate
          ? { animationDelay: `${Math.round(delay * 1000)}ms` }
          : buildRevealStyle(18, duration, delay, 1)
      }
      className={cn("py-0.5", immediate && "rushx-hero-fade", className)}
    >
      <div className={innerClassName}>{children}</div>
    </div>
  )
}

/**
 * Editorial visual/media reveal for showcase photography and victory banners.
 */
export function VisualReveal({
  children,
  className,
  delay = 0,
  duration = 0.64,
  y = 20,
  initialScale = 0.985,
  immediate = false,
}: {
  children: ReactNode
  className?: string
  delay?: number
  duration?: number
  y?: number
  initialScale?: number
  immediate?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  useProgressiveReveal(ref, { immediate })

  return (
    <div
      ref={ref}
      style={
        immediate
          ? { animationDelay: `${Math.round(delay * 1000)}ms` }
          : buildRevealStyle(y, duration, delay, initialScale)
      }
      className={cn(immediate && "rushx-hero-fade", className)}
    >
      {children}
    </div>
  )
}

export function RevealStagger({
  children,
  className,
  delay = 0,
  immediate = false,
}: {
  children: ReactNode
  className?: string
  stagger?: number
  delay?: number
  immediate?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  useProgressiveReveal(ref, { immediate })

  return (
    <div
      ref={ref}
      style={
        immediate
          ? { animationDelay: `${Math.round(delay * 1000)}ms` }
          : buildRevealStyle(16, 0.56, delay, 0.995)
      }
      className={cn(immediate && "rushx-hero-fade", className)}
    >
      {children}
    </div>
  )
}

export function RevealItem({
  children,
  className,
}: {
  children: ReactNode
  className?: string
  y?: number
  duration?: number
}) {
  return <div className={cn(className)}>{children}</div>
}

/**
 * Lightweight non-blocking route transition wrapper (SSR-safe, always visible).
 */
export function PageTransition({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const pathname = usePathname()

  return (
    <div key={pathname} className={cn("rushx-page-fade", className)}>
      {children}
    </div>
  )
}
