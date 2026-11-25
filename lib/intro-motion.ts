"use client"

import { useEffect, useState } from "react"

export const DEEPCHARTS_EASE = [0.16, 1, 0.3, 1] as const
export const INTRO_STORAGE_KEY = "rushx_intro_seen_v1"

export type IntroTiming = {
  headerDelay: number
  heroBaseDelay: number
  heroStagger: number
  heroDuration: number
  visualDelay: number
  visualDuration: number
}

const FIRST_VISIT_TIMING: IntroTiming = {
  headerDelay: 0.04,
  heroBaseDelay: 0.08,
  heroStagger: 0.085,
  heroDuration: 0.68,
  visualDelay: 0.16,
  visualDuration: 0.78,
}

const RETURN_VISIT_TIMING: IntroTiming = {
  headerDelay: 0,
  heroBaseDelay: 0.01,
  heroStagger: 0.045,
  heroDuration: 0.36,
  visualDelay: 0.04,
  visualDuration: 0.42,
}

// Module-level latch prevents replaying the full cinematic intro across internal route switches.
let sessionIntroCompleted = false

/**
 * Hydration-safe hook distinguishing true first-time site entry from returning visits
 * and internal route switches. Never reads localStorage during SSR/initial render.
 */
export function useFirstVisitIntro(): {
  isFirstVisit: boolean
  introReady: boolean
  timing: IntroTiming
} {
  const [isFirstVisit, setIsFirstVisit] = useState(true)
  const [introReady, setIntroReady] = useState(false)

  useEffect(() => {
    let alreadySeen = sessionIntroCompleted
    if (!alreadySeen) {
      try {
        alreadySeen = window.localStorage.getItem(INTRO_STORAGE_KEY) === "1"
      } catch {
        alreadySeen = false
      }
    }

    if (alreadySeen) {
      sessionIntroCompleted = true
      setIsFirstVisit(false)
      setIntroReady(true)
      return
    }

    setIsFirstVisit(true)
    setIntroReady(true)

    const timer = window.setTimeout(() => {
      sessionIntroCompleted = true
      try {
        window.localStorage.setItem(INTRO_STORAGE_KEY, "1")
      } catch {
        // Ignore restricted storage contexts (private mode / sandboxed iframes).
      }
    }, 1400)

    return () => window.clearTimeout(timer)
  }, [])

  return {
    isFirstVisit,
    introReady,
    timing: isFirstVisit ? FIRST_VISIT_TIMING : RETURN_VISIT_TIMING,
  }
}
