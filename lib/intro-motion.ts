"use client"

import { useEffect, useState } from "react"

export const DEEPCHARTS_EASE = [0.16, 1, 0.3, 1] as const

export type IntroTiming = {
  headerDelay: number
  heroBaseDelay: number
  heroStagger: number
  heroDuration: number
  visualDelay: number
  visualDuration: number
}

// Fresh page-load choreography inspired by DeepCharts: crisp, smooth, unmistakable entrance
const FRESH_LOAD_TIMING: IntroTiming = {
  headerDelay: 0.03,
  heroBaseDelay: 0.06,
  heroStagger: 0.09,
  heroDuration: 0.72,
  visualDelay: 0.14,
  visualDuration: 0.84,
}

// Slightly snappier timing when navigating back to Home via client-side routing within the same tab session
const ROUTE_RETURN_TIMING: IntroTiming = {
  headerDelay: 0,
  heroBaseDelay: 0.04,
  heroStagger: 0.065,
  heroDuration: 0.56,
  visualDelay: 0.08,
  visualDuration: 0.64,
}

// Session-only module latch (never persisted to localStorage, so reloads always play crisp entrance choreography)
let sessionIntroCompleted = false

/**
 * Hydration-safe hook providing DeepCharts-style choreography timing.
 * - Fresh page loads always receive the full crisp entrance sequence.
 * - In-app client-side route transitions stay smooth and snappy.
 * - Does not reset or re-trigger animations on 2D/3D mode or language toggles.
 */
export function useFirstVisitIntro(): {
  isFirstVisit: boolean
  introReady: boolean
  timing: IntroTiming
} {
  const [isFirstVisit] = useState(() => !sessionIntroCompleted)
  const [introReady, setIntroReady] = useState(false)

  useEffect(() => {
    setIntroReady(true)

    if (sessionIntroCompleted) {
      return
    }

    const timer = window.setTimeout(() => {
      sessionIntroCompleted = true
    }, 1200)

    return () => window.clearTimeout(timer)
  }, [])

  return {
    isFirstVisit,
    introReady,
    timing: isFirstVisit ? FRESH_LOAD_TIMING : ROUTE_RETURN_TIMING,
  }
}
