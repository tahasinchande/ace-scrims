"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { motion, useInView, useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"

const DEEPCHARTS_EASE = [0.16, 1, 0.3, 1] as const

/**
 * Reliable first-time entrance visibility hook:
 * - Triggers as soon as ANY pixel enters the viewport (`amount: "some"`) so tall blocks never stall.
 * - Latches to `true` once triggered so unrelated parent re-renders never replay the entrance animation.
 * - Includes an immediate viewport check + hydration fail-safe so elements can NEVER remain stuck at opacity: 0.
 */
function useReliableOnceReveal(ref: React.RefObject<HTMLDivElement | null>, reduced: boolean | null) {
  const inView = useInView(ref, { once: true, amount: "some" })
  const [revealed, setRevealed] = useState(Boolean(reduced))

  useEffect(() => {
    if (reduced || inView) {
      setRevealed(true)
      return
    }

    const checkRect = () => {
      const el = ref.current
      if (!el || typeof window === "undefined") return
      const rect = el.getBoundingClientRect()
      if (rect.top < window.innerHeight * 1.12 && rect.bottom > -40) {
        setRevealed(true)
      }
    }

    checkRect()
    const raf = window.requestAnimationFrame(checkRect)
    const fallbackTimer = window.setTimeout(() => {
      const el = ref.current
      if (!el || typeof window === "undefined") return
      const rect = el.getBoundingClientRect()
      // If user already scrolled past or element sits inside/above the current fold, guarantee visibility
      if (rect.top <= window.innerHeight + 120) {
        setRevealed(true)
      }
    }, 900)

    return () => {
      window.cancelAnimationFrame(raf)
      window.clearTimeout(fallbackTimer)
    }
  }, [inView, reduced, ref])

  return Boolean(reduced) || revealed
}

export function Reveal({
  children,
  className,
  delay = 0,
  y = 16,
  duration = 0.54,
}: {
  children: ReactNode
  className?: string
  delay?: number
  y?: number
  duration?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useReducedMotion()
  const isVisible = useReliableOnceReveal(ref, prefersReducedMotion)

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

export function RevealStagger({
  children,
  className,
  stagger = 0.06,
  delay = 0.02,
}: {
  children: ReactNode
  className?: string
  stagger?: number
  delay?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useReducedMotion()
  const isVisible = useReliableOnceReveal(ref, prefersReducedMotion)

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
  y = 14,
}: {
  children: ReactNode
  className?: string
  y?: number
}) {
  const prefersReducedMotion = useReducedMotion()

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y, scale: 0.988 },
        show: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: {
            duration: 0.48,
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
