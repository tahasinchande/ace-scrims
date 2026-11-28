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
  mode: "3d",
  setMode: () => {},
  toggleMode: () => {},
  is3D: true,
})

const STORAGE_KEY = "rushx_view_mode"

export function ViewModeProvider({ children }: { children: React.ReactNode }) {
  // Default to dynamic 3D Cyber experience on initial entry; respects saved user toggle
  const [mode, setModeState] = useState<ViewMode>("3d")

  useEffect(() => {
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
