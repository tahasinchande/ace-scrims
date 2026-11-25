"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { motion, useInView, useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"
import { DEEPCHARTS_EASE } from "@/lib/intro-motion"

export { DEEPCHARTS_EASE }

/**
 * Reliable first-time entrance visibility hook:
 * - Triggers as soon as ANY pixel enters the viewport (`amount: "some"`) so tall blocks never stall.
 * - Latches to `true` once triggered so unrelated parent re-renders never replay the entrance animation.
 * - Includes immediate viewport checks, passive scroll verification, and a hydration fail-safe
 *   so elements can NEVER remain stuck at `opacity: 0`.
 */
export function useReliableOnceReveal(
  ref: React.RefObject<HTMLDivElement | null>,
  reduced: boolean | null,
  immediate = false
) {
  const inView = useInView(ref, { once: true, amount: "some" })
  const [revealed, setRevealed] = useState(Boolean(reduced) || immediate)

  useEffect(() => {
    if (reduced || immediate || inView || revealed) {
      if (!revealed) setRevealed(true)
      return
    }

    const checkRect = () => {
      const el = ref.current
      if (!el || typeof window === "undefined") return
      const rect = el.getBoundingClientRect()
      if (rect.top < window.innerHeight * 1.14 && rect.bottom > -48) {
        setRevealed(true)
      }
    }

    checkRect()
    const raf = window.requestAnimationFrame(checkRect)
    window.addEventListener("scroll", checkRect, { passive: true })
    window.addEventListener("resize", checkRect, { passive: true })

    const fallbackTimer = window.setTimeout(() => {
      const el = ref.current
      if (!el || typeof window === "undefined") return
      const rect = el.getBoundingClientRect()
      if (rect.top <= window.innerHeight + 160) {
        setRevealed(true)
      }
    }, 850)

    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener("scroll", checkRect)
      window.removeEventListener("resize", checkRect)
      window.clearTimeout(fallbackTimer)
    }
  }, [inView, reduced, immediate, revealed, ref])

  return Boolean(reduced) || immediate || revealed
}

export function Reveal({
  children,
  className,
  delay = 0,
  y = 18,
  duration = 0.56,
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
  const prefersReducedMotion = useReducedMotion()
  const isVisible = useReliableOnceReveal(ref, prefersReducedMotion, immediate)

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y, scale: 0.988 }}
      animate={isVisible ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y, scale: 0.988 }}
      transition={{ duration, delay, ease: DEEPCHARTS_EASE }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/**
 * DeepCharts-inspired masked typography slide-up reveal.
 * Clips vertical overflow while sliding headlines cleanly into place without bounce.
 */
export function MaskedLineReveal({
  children,
  className,
  innerClassName,
  delay = 0,
  duration = 0.64,
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
  const prefersReducedMotion = useReducedMotion()
  const isVisible = useReliableOnceReveal(ref, prefersReducedMotion, immediate)

  if (prefersReducedMotion) {
    return <div className={cn(className, innerClassName)}>{children}</div>
  }

  return (
    <div ref={ref} className={cn("overflow-hidden", className)}>
      <motion.div
        initial={{ opacity: 0, y: "102%" }}
        animate={isVisible ? { opacity: 1, y: "0%" } : { opacity: 0, y: "102%" }}
        transition={{ duration, delay, ease: DEEPCHARTS_EASE }}
        className={innerClassName}
      >
        {children}
      </motion.div>
    </div>
  )
}

/**
 * Editorial visual/media reveal for hero centerpiece, showcase photography, and victory banners.
 * Uses subtle scale settling + vertical glide for a crisp, hardware-accelerated feel.
 */
export function VisualReveal({
  children,
  className,
  delay = 0,
  duration = 0.68,
  y = 16,
  initialScale = 1.038,
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
  const prefersReducedMotion = useReducedMotion()
  const isVisible = useReliableOnceReveal(ref, prefersReducedMotion, immediate)

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y, scale: initialScale }}
      animate={isVisible ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y, scale: initialScale }}
      transition={{ duration, delay, ease: DEEPCHARTS_EASE }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function RevealStagger({
  children,
  className,
  stagger = 0.06,
  delay = 0.02,
  immediate = false,
}: {
  children: ReactNode
  className?: string
  stagger?: number
  delay?: number
  immediate?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useReducedMotion()
  const isVisible = useReliableOnceReveal(ref, prefersReducedMotion, immediate)

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isVisible ? "show" : "hidden"}
      variants={{
        hidden: {},
        show: {
          transition: {
            staggerChildren: stagger,
            delayChildren: delay,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function RevealItem({
  children,
  className,
  y = 16,
  duration = 0.5,
}: {
  children: ReactNode
  className?: string
  y?: number
  duration?: number
}) {
  const prefersReducedMotion = useReducedMotion()

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y, scale: 0.986 },
        show: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: {
            duration,
            ease: DEEPCHARTS_EASE,
          },
        },
      }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  )
}

/**
 * Lightweight non-blocking route transition wrapper.
 */
export function PageTransition({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const pathname = usePathname()
  const prefersReducedMotion = useReducedMotion()

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0.92, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.34, ease: DEEPCHARTS_EASE }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
