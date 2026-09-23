"use client"

import React, { createContext, useContext, useEffect, useState } from "react"

export type ViewMode = "2d" | "3d"

interface ViewModeContextType {
  mode: ViewMode
  setMode: (mode: ViewMode) => void
  toggleMode: () => void
  is3D: boolean
}

const ViewModeContext = createContext<ViewModeContextType>({
  mode: "2d",
  setMode: () => {},
  toggleMode: () => {},
  is3D: false,
})

const STORAGE_KEY = "ace_scrims_view_mode"

export function ViewModeProvider({ children }: { children: React.ReactNode }) {
  // Default to 2D static mode as requested
  const [mode, setModeState] = useState<ViewMode>("2d")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as ViewMode | null
      if (saved === "2d" || saved === "3d") {
        setModeState(saved)
      }
    } catch {
      // ignore storage access errors
    }
  }, [])

  const setMode = (newMode: ViewMode) => {
    setModeState(newMode)
    try {
      localStorage.setItem(STORAGE_KEY, newMode)
    } catch {
      // ignore
    }
  }

  const toggleMode = () => {
    const next = mode === "2d" ? "3d" : "2d"
    setMode(next)
  }

  return (
    <ViewModeContext.Provider
      value={{
        mode,
        setMode,
        toggleMode,
        is3D: mode === "3d",
      }}
    >
      {children}
    </ViewModeContext.Provider>
  )
}

export function useViewMode() {
  return useContext(ViewModeContext)
}
