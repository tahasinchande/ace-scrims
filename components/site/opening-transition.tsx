"use client"

import { useEffect, useState, type ReactNode } from "react"
import { motion, AnimatePresence, useReducedMotion } from "motion/react"
import { DEEPCHARTS_EASE } from "@/lib/intro-motion"

/**
 * DeepCharts-inspired crisp, non-blocking opening transition.
 * - Never blocks pointer/keyboard interaction (`pointer-events-none`).
 * - Never hides SSR page content at `opacity: 0` (eliminates CLS and stuck-invisible risks).
 * - Renders a sleek luminous horizon sweep + subtle radial atmospheric settle on initial mount,
 *   then unmounts cleanly with a guaranteed safety timeout.
 */
export function OpeningTransition() {
  const prefersReducedMotion = useReducedMotion()
  const [active, setActive] = useState(true)

  useEffect(() => {
    if (prefersReducedMotion) {
      setActive(false)
      return
    }

    const doneTimer = window.setTimeout(() => {
      setActive(false)
    }, 880)

    return () => {
      window.clearTimeout(doneTimer)
    }
  }, [prefersReducedMotion])

  return (
    <AnimatePresence>
      {active && !prefersReducedMotion && (
        <motion.div
          key="rushx-opening-transition"
          aria-hidden="true"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.72, delay: 0.12, ease: DEEPCHARTS_EASE }}
          className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
        >
          {/* Top luminous horizon progress sweep */}
          <motion.div
            initial={{ scaleX: 0, opacity: 0.95 }}
            animate={{ scaleX: 1, opacity: 0 }}
            transition={{ duration: 0.78, ease: DEEPCHARTS_EASE }}
            style={{
              transformOrigin: "left center",
              background:
                "linear-gradient(90deg, rgba(var(--rushx-primary-rgb), 0.15) 0%, rgba(var(--rushx-accent-rgb), 0.95) 55%, rgba(var(--rushx-soft-rgb), 1) 100%)",
              boxShadow: "0 0 22px rgba(var(--rushx-accent-rgb), 0.75)",
            }}
            className="absolute top-0 left-0 right-0 h-[2px]"
          />

          {/* Subtle translucent atmospheric light veil that expands and dissolves smoothly */}
          <motion.div
            initial={{ opacity: 0.52, scale: 1.06 }}
            animate={{ opacity: 0, scale: 1 }}
            transition={{ duration: 0.74, ease: DEEPCHARTS_EASE }}
            style={{
              background:
                "radial-gradient(70% 56% at 50% 24%, rgba(var(--rushx-accent-rgb), 0.18) 0%, rgba(var(--rushx-primary-rgb), 0.12) 42%, rgba(2, 5, 16, 0.58) 100%)",
            }}
            className="absolute inset-0"
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/**
 * Depth-settle page shell inspired by DeepCharts' crisp entrance choreography.
 * Starts at `opacity: 0.96` (never `0`) so SSR HTML is immediately legible and
 * can never stall invisible while settling cleanly in scale and Y depth.
 */
export function OpeningStage({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const prefersReducedMotion = useReducedMotion()

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      initial={{ opacity: 0.88, y: 14, scale: 1.012 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.72, ease: DEEPCHARTS_EASE }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
