"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { motion, useInView, useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"
import { DEEPCHARTS_EASE } from "@/lib/intro-motion"

export { DEEPCHARTS_EASE }

/**
 * Reliable latched DeepCharts-style reveal hook:
 * - For `immediate={true}` (hero / above-the-fold): starts unrevealed on mount and flips to `true`
 *   on the next animation frame (with a guaranteed 260ms fail-safe), ensuring `initial -> animate`
 *   genuinely plays on load instead of snapping statically during SSR hydration.
 * - For scroll-revealed elements: triggers as soon as ANY pixel enters the viewport (`amount: "some"`),
 *   backed by `getBoundingClientRect()` scroll/resize checks and a safety fail-safe so elements
 *   can NEVER stay stuck at `opacity: 0`.
 * - Latches permanently to `true` once triggered so toggling 2D/3D mode or language NEVER resets
 *   or replays already-revealed content.
 */
export function useReliableOnceReveal(
  ref: React.RefObject<HTMLDivElement | null>,
  reduced: boolean | null,
  immediate = false
) {
  const inView = useInView(ref, { once: true, margin: "-40px" })
  const [revealed, setRevealed] = useState(Boolean(reduced))

  useEffect(() => {
    if (reduced) {
      if (!revealed) setRevealed(true)
      return
    }

    if (revealed) return

    if (immediate) {
      let raf2 = 0
      const raf1 = window.requestAnimationFrame(() => {
        raf2 = window.requestAnimationFrame(() => {
          setRevealed(true)
        })
      })
      const safeTimer = window.setTimeout(() => {
        setRevealed(true)
      }, 260)
      return () => {
        window.cancelAnimationFrame(raf1)
        if (raf2) window.cancelAnimationFrame(raf2)
        window.clearTimeout(safeTimer)
      }
    }

    if (inView) {
      setRevealed(true)
      return
    }

    const checkRect = () => {
      const el = ref.current
      if (!el || typeof window === "undefined") return
      const rect = el.getBoundingClientRect()
      // Only trigger once element has genuinely entered the visible viewport (never off-screen below the fold)
      if (rect.top < window.innerHeight - 40 && rect.bottom > 20) {
        setRevealed(true)
      }
    }

    checkRect()
    const raf = window.requestAnimationFrame(checkRect)
    window.addEventListener("scroll", checkRect, { passive: true })
    window.addEventListener("resize", checkRect, { passive: true })

    return () => {
      window.cancelAnimationFrame(raf)
      window.removeEventListener("scroll", checkRect)
      window.removeEventListener("resize", checkRect)
    }
  }, [inView, reduced, immediate, revealed, ref])

  return Boolean(reduced) || revealed
}

/**
 * DeepCharts-style hardware-accelerated word-by-word heading reveal
 * (pure GPU transform + opacity, zero paint-blocking blur layers).
 */
export function BlurTextReveal({
  text,
  as = "h2",
  id,
  className,
  delay = 0,
  wordStagger = 0.045,
  duration = 0.66,
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
  const prefersReducedMotion = useReducedMotion()
  const isVisible = useReliableOnceReveal(ref, prefersReducedMotion, immediate)
  const Tag = as
  const words = text.trim().split(/\s+/).filter(Boolean)

  if (prefersReducedMotion || words.length === 0) {
    return (
      <div ref={ref}>
        <Tag id={id} className={className}>
          {text}
        </Tag>
      </div>
    )
  }

  return (
    <div ref={ref}>
      <Tag id={id} className={className}>
        {words.map((word, index) => (
          <span key={`${word}-${index}`} className="inline-block whitespace-pre">
            <motion.span
              className="inline-block will-change-[transform,opacity]"
              initial={{ opacity: 0, y: 14 }}
              animate={
                isVisible
                  ? { opacity: 1, y: 0 }
                  : { opacity: 0, y: 14 }
              }
              transition={{
                duration,
                delay: delay + Math.min(index, 12) * wordStagger,
                ease: DEEPCHARTS_EASE,
              }}
            >
              {word}
            </motion.span>
            {index < words.length - 1 ? " " : ""}
          </span>
        ))}
      </Tag>
    </div>
  )
}

export function Reveal({
  children,
  className,
  delay = 0,
  y = 18,
  duration = 0.64,
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
      initial={{ opacity: 0, y, scale: 0.985 }}
      animate={
        isVisible
          ? { opacity: 1, y: 0, scale: 1 }
          : { opacity: 0, y, scale: 0.985 }
      }
      transition={{ duration, delay, ease: DEEPCHARTS_EASE }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/**
 * DeepCharts-inspired masked typography slide-up reveal (GPU transform + opacity).
 */
export function MaskedLineReveal({
  children,
  className,
  innerClassName,
  delay = 0,
  duration = 0.68,
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
    <div ref={ref} className={cn("overflow-hidden py-0.5", className)}>
      <motion.div
        initial={{ opacity: 0, y: "104%" }}
        animate={
          isVisible
            ? { opacity: 1, y: "0%" }
            : { opacity: 0, y: "104%" }
        }
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
 * Pure hardware-accelerated depth-scale settling + vertical glide matching DeepCharts.
 */
export function VisualReveal({
  children,
  className,
  delay = 0,
  duration = 0.74,
  y = 20,
  initialScale = 0.968,
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
      animate={
        isVisible
          ? { opacity: 1, y: 0, scale: 1 }
          : { opacity: 0, y, scale: initialScale }
      }
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
  stagger = 0.085,
  delay = 0.04,
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
  y = 22,
  duration = 0.66,
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
        hidden: { opacity: 0, y, scale: 0.976 },
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
 * Lightweight non-blocking route transition wrapper (GPU transform + opacity only).
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
      initial={{ opacity: 0.9, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: DEEPCHARTS_EASE }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
