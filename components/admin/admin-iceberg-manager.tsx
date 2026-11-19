"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  fluctuateIcebergAction,
  resetIcebergCycleAction,
  setScrimsShowAllFilledAction,
  updateScrimIcebergAction,
} from "@/app/actions/iceberg"
import {
  computeIcebergDisplayCount,
  getIcebergCycleProgress,
} from "@/lib/iceberg"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import {
  CheckCheck,
  CheckSquare,
  Flame,
  Info,
  Lock,
  Power,
  RefreshCw,
  Search,
  ShieldAlert,
  Shuffle,
  Snowflake,
  Sparkles,
  Square,
  Unlock,
  Users,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"

export type AdminIcebergScrim = {
  id: string
  slug: string
  title: string
  startTime: string
  scrimDate: string
  map: string
  category: string | null
  maxTeams: number
  confirmedTeams: number
  registrationOpen: boolean
  status: string
  hidden: boolean
  icebergEnabled: boolean
  icebergShowAllFilled: boolean
  icebergAmount: number
  icebergThreshold: number
  icebergStartRealCount: number
  isTodaySchedule: boolean
}

function broadcastSlotsRefresh() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("acescrims:slots-updated"))
  }
  if (typeof BroadcastChannel !== "undefined") {
    try {
      const ch = new BroadcastChannel("acescrims-slots")
      ch.postMessage({ type: "refresh", ts: Date.now() })
      ch.close()
    } catch {}
  }
}

export function AdminIcebergManager({
  scrims: initialScrims,
  isFriday,
  showRoom2,
}: {
  scrims: AdminIcebergScrim[]
  isFriday: boolean
  showRoom2: boolean
}) {
  const router = useRouter()
  const [scrims, setScrims] = useState<AdminIcebergScrim[]>(initialScrims)
  const [isPending, startTransition] = useTransition()

  // Multi-Scrim Selection & Filters
  const [selectAllScrims, setSelectAllScrims] = useState<boolean>(true)
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    initialScrims.filter((s) => s.isTodaySchedule).map((s) => s.id),
  )
  const [scheduleFilter, setScheduleFilter] = useState<"today" | "all">("today")
  const [searchQuery, setSearchQuery] = useState("")

  // Bulk Control Configuration
  const [bulkAmount, setBulkAmount] = useState<number>(7)
  const [bulkThreshold, setBulkThreshold] = useState<number>(3)
  const [fluctuateMin, setFluctuateMin] = useState<number>(5)
  const [fluctuateMax, setFluctuateMax] = useState<number>(9)

  // Per-row draft inputs
  const [rowDrafts, setRowDrafts] = useState<Record<string, { amount: number; threshold: number }>>(() => {
    const init: Record<string, { amount: number; threshold: number }> = {}
    for (const s of initialScrims) {
      init[s.id] = {
        amount: Number(s.icebergAmount ?? 7),
        threshold: Number(s.icebergThreshold ?? 3),
      }
    }
    return init
  })

  useEffect(() => {
    setScrims(initialScrims)
    setRowDrafts((prev) => {
      const next = { ...prev }
      for (const s of initialScrims) {
        next[s.id] = {
          amount: Number(s.icebergAmount ?? 7),
          threshold: Number(s.icebergThreshold ?? 3),
        }
      }
      return next
    })
  }, [initialScrims])

  const visibleScrims = useMemo(() => {
    return scrims.filter((s) => {
      if (scheduleFilter === "today" && !s.isTodaySchedule) return false
      const q = searchQuery.trim().toLowerCase()
      if (!q) return true
      return (
        s.title.toLowerCase().includes(q) ||
        s.startTime.toLowerCase().includes(q) ||
        s.map.toLowerCase().includes(q)
      )
    })
  }, [scrims, scheduleFilter, searchQuery])

  const visibleIdSet = useMemo(() => new Set(visibleScrims.map((s) => s.id)), [visibleScrims])

  const effectiveTargetIds = useMemo(() => {
    if (selectAllScrims) {
      return visibleScrims.map((s) => s.id)
    }
    return selectedIds.filter((id) => scrims.some((s) => s.id === id))
  }, [selectAllScrims, visibleScrims, selectedIds, scrims])

  const selectedVisibleCount = useMemo(() => {
    if (selectAllScrims) return visibleScrims.length
    return selectedIds.filter((id) => visibleIdSet.has(id)).length
  }, [selectAllScrims, visibleScrims.length, selectedIds, visibleIdSet])

  const summary = useMemo(() => {
    const todayScrims = scrims.filter((s) => s.isTodaySchedule)
    let activeIceberg = 0
    let showAllFilledCount = 0
    let safetyLocked = 0
    let totalReal = 0
    let totalDisplayed = 0

    for (const s of todayScrims) {
      const real = s.confirmedTeams || 0
      const max = s.maxTeams || 12
      totalReal += real
      if (real >= max) {
        safetyLocked++
      } else if (s.icebergShowAllFilled) {
        showAllFilledCount++
      } else if (s.icebergEnabled) {
        activeIceberg++
      }
      totalDisplayed += computeIcebergDisplayCount({
        realConfirmed: real,
        maxTeams: max,
        icebergEnabled: s.icebergEnabled,
        icebergShowAllFilled: s.icebergShowAllFilled,
        icebergAmount: s.icebergAmount,
        icebergThreshold: s.icebergThreshold,
        icebergStartRealCount: s.icebergStartRealCount,
      })
    }

    return {
      todayCount: todayScrims.length,
      activeIceberg,
      showAllFilledCount,
      safetyLocked,
      totalReal,
      totalDisplayed,
    }
  }, [scrims])

  function handleSelectAllToggle(checked: boolean) {
    setSelectAllScrims(checked)
    if (checked) {
      setSelectedIds(visibleScrims.map((s) => s.id))
    } else {
      setSelectedIds([])
    }
  }

  function handleSelectTodayOpenOnly() {
    const openIds = visibleScrims
      .filter((s) => s.confirmedTeams < s.maxTeams && s.registrationOpen && s.status !== "not_hosted" && s.status !== "completed")
      .map((s) => s.id)
    setSelectAllScrims(false)
    setSelectedIds(openIds)
  }

  function handleClearSelection() {
    setSelectAllScrims(false)
    setSelectedIds([])
  }

  function toggleRowSelection(id: string) {
    if (selectAllScrims) {
      // Switching from "Select All" to explicit multi-selection keeping every visible scrim except toggled row
      const next = visibleScrims.map((s) => s.id).filter((item) => item !== id)
      setSelectAllScrims(false)
      setSelectedIds(next)
      return
    }
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  function handleBulkApply(enabled: boolean) {
    if (effectiveTargetIds.length === 0) {
      toast.error("Select at least one scrim or enable Select All Scrims.")
      return
    }
    startTransition(async () => {
      const useSelectAllToday = selectAllScrims && scheduleFilter === "today" && !searchQuery.trim()
      const res = await updateScrimIcebergAction({
        scrimIds: effectiveTargetIds,
        selectAllActive: useSelectAllToday,
        enabled,
        icebergAmount: bulkAmount,
        icebergThreshold: bulkThreshold,
        resetBaseline: enabled,
      })
      if (!res.ok) {
        toast.error(res.error || "Failed to update Iceberg settings")
        return
      }
      setScrims((prev) =>
        prev.map((item) =>
          effectiveTargetIds.includes(item.id) && item.confirmedTeams < item.maxTeams
            ? {
                ...item,
                icebergEnabled: enabled,
                icebergAmount: bulkAmount,
                icebergThreshold: bulkThreshold,
                ...(enabled ? { icebergStartRealCount: item.confirmedTeams } : {}),
              }
            : item,
        ),
      )
      if (res.skippedFullTitles.length > 0) {
        toast.warning(
          `Updated ${res.updatedCount} scrim(s). Safety override kept ${res.skippedFullTitles.length} full lobby(s) OFF.`,
        )
      } else {
        toast.success(
          enabled
            ? `Iceberg enabled (${bulkAmount} base / reset every ${bulkThreshold}) on ${res.updatedCount} scrim(s).`
            : `Iceberg turned OFF for ${res.updatedCount} scrim(s).`,
        )
      }
      broadcastSlotsRefresh()
      router.refresh()
    })
  }

  function handleBulkShowAllFilled(showAllFilled: boolean) {
    if (effectiveTargetIds.length === 0) {
      toast.error("Select at least one scrim or enable Select All Scrims.")
      return
    }
    startTransition(async () => {
      const useSelectAllToday = selectAllScrims && scheduleFilter === "today" && !searchQuery.trim()
      const res = await setScrimsShowAllFilledAction({
        scrimIds: effectiveTargetIds,
        selectAllActive: useSelectAllToday,
        showAllFilled,
      })
      if (!res.ok) {
        toast.error(res.error || "Failed to update Show All Slots Filled")
        return
      }
      setScrims((prev) =>
        prev.map((item) =>
          effectiveTargetIds.includes(item.id) && item.confirmedTeams < item.maxTeams
            ? { ...item, icebergShowAllFilled: showAllFilled }
            : item,
        ),
      )
      if (res.skippedFullTitles.length > 0) {
        toast.warning(
          `Updated ${res.updatedCount} scrim(s). ${res.skippedFullTitles.length} already-full lobby(s) kept real count.`,
        )
      } else {
        toast.success(
          showAllFilled
            ? `Marked all slots filled (12/12) across ${res.updatedCount} selected scrim(s)!`
            : `Cleared "Show All Slots Filled" override on ${res.updatedCount} scrim(s).`,
        )
      }
      broadcastSlotsRefresh()
      router.refresh()
    })
  }

  function handleSingleRowShowAllFilled(scrim: AdminIcebergScrim, nextShowAllFilled: boolean) {
    if (nextShowAllFilled && scrim.confirmedTeams >= scrim.maxTeams) {
      toast.error(`${scrim.title} already has ${scrim.confirmedTeams}/${scrim.maxTeams} real teams.`)
      return
    }
    startTransition(async () => {
      const res = await setScrimsShowAllFilledAction({
        scrimIds: [scrim.id],
        showAllFilled: nextShowAllFilled,
      })
      if (!res.ok) {
        toast.error(res.error || "Failed to update Show All Slots Filled")
        return
      }
      setScrims((prev) =>
        prev.map((item) =>
          item.id === scrim.id ? { ...item, icebergShowAllFilled: nextShowAllFilled } : item,
        ),
      )
      toast.success(
        nextShowAllFilled
          ? `${scrim.title}: All slots marked filled (${scrim.maxTeams}/${scrim.maxTeams})`
          : `${scrim.title}: Show All Slots Filled turned OFF`,
      )
      broadcastSlotsRefresh()
      router.refresh()
    })
  }

  function handleFluctuateNow() {
    if (effectiveTargetIds.length === 0) {
      toast.error("Select at least one scrim or enable Select All Scrims.")
      return
    }
    startTransition(async () => {
      const useSelectAllToday = selectAllScrims && scheduleFilter === "today" && !searchQuery.trim()
      const res = await fluctuateIcebergAction({
        scrimIds: effectiveTargetIds,
        selectAllActive: useSelectAllToday,
        minAmount: fluctuateMin,
        maxAmount: fluctuateMax,
        icebergThreshold: bulkThreshold,
      })
      if (!res.ok) {
        toast.error(res.error || "Failed to fluctuate Iceberg numbers")
        return
      }
      if (res.skippedFullTitles.length > 0) {
        toast.warning(
          `Fluctuated ${res.updatedCount} scrim(s) (${fluctuateMin}–${fluctuateMax}). Skipped ${res.skippedFullTitles.length} full lobby(s).`,
        )
      } else {
        toast.success(
          `Fluctuated Iceberg counts (${fluctuateMin}–${fluctuateMax}) across ${res.updatedCount} scrim(s)!`,
        )
      }
      broadcastSlotsRefresh()
      router.refresh()
    })
  }

  function handleResetCycles() {
    if (effectiveTargetIds.length === 0) {
      toast.error("Select at least one scrim first.")
      return
    }
    startTransition(async () => {
      const useSelectAllToday = selectAllScrims && scheduleFilter === "today" && !searchQuery.trim()
      const res = await resetIcebergCycleAction({
        scrimIds: effectiveTargetIds,
        selectAllActive: useSelectAllToday,
      })
      if (!res.ok) {
        toast.error(res.error || "Failed to reset Iceberg cycles")
        return
      }
      toast.success(`Reset Iceberg cycle baseline for ${res.updatedCount} scrim(s).`)
      broadcastSlotsRefresh()
      router.refresh()
    })
  }

  function handleSingleRowSave(scrim: AdminIcebergScrim, nextEnabled: boolean) {
    const draft = rowDrafts[scrim.id] || {
      amount: scrim.icebergAmount,
      threshold: scrim.icebergThreshold,
    }

    if (nextEnabled && scrim.confirmedTeams >= scrim.maxTeams) {
      toast.error(`${scrim.title} already has ${scrim.confirmedTeams}/${scrim.maxTeams} real teams (Safety Override active).`)
      return
    }

    startTransition(async () => {
      const res = await updateScrimIcebergAction({
        scrimIds: [scrim.id],
        enabled: nextEnabled,
        icebergAmount: draft.amount,
        icebergThreshold: draft.threshold,
        resetBaseline: nextEnabled && !scrim.icebergEnabled,
      })
      if (!res.ok) {
        toast.error(res.error || "Failed to update scrim Iceberg")
        return
      }
      setScrims((prev) =>
        prev.map((item) =>
          item.id === scrim.id
            ? {
                ...item,
                icebergEnabled: nextEnabled,
                icebergAmount: draft.amount,
                icebergThreshold: draft.threshold,
              }
            : item,
        ),
      )
      toast.success(
        nextEnabled
          ? `${scrim.title}: Iceberg ON (Base ${draft.amount}, Reset every ${draft.threshold})`
          : `${scrim.title}: Iceberg settings saved (OFF)`,
      )
      broadcastSlotsRefresh()
      router.refresh()
    })
  }

  const safePreviewBase = Math.max(1, Math.min(11, Math.floor(bulkAmount || 7)))
  const safePreviewThreshold = Math.max(1, Math.min(12, Math.floor(bulkThreshold || 3)))
  const sampleSequence = Array.from({ length: safePreviewThreshold + 1 }, (_, i) => {
    const offset = i % safePreviewThreshold
    return `${i} real → ${Math.min(11, safePreviewBase + offset)}/12`
  }).join("  ·  ")

  const activeTargetCount = selectAllScrims ? visibleScrims.length : effectiveTargetIds.length

  return (
    <div className="flex flex-col gap-6">
      {/* KPI Overview */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="glass rounded-2xl border border-cyan-500/25 bg-cyan-500/5 p-4">
          <div className="flex items-center justify-between text-xs text-cyan-300 font-semibold">
            <span>Active Icebergs</span>
            <Snowflake className="size-4" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-foreground">
            {summary.activeIceberg} <span className="text-xs font-normal text-muted-foreground">/ {summary.todayCount}</span>
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {summary.showAllFilledCount > 0
              ? `${summary.showAllFilledCount} Marked Full (12/12)`
              : `${isFriday ? "Friday Schedule" : "Daily Schedule"} · Room 2 ${showRoom2 ? "On" : "Off"}`}
          </p>
        </div>

        <div className="glass rounded-2xl border border-border/60 p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
            <span>Real Confirmed Slots</span>
            <Users className="size-4 text-emerald-400" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-emerald-400">
            {summary.totalReal}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Actual booked squads today</p>
        </div>

        <div className="glass rounded-2xl border border-border/60 p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
            <span>Public Displayed Slots</span>
            <Flame className="size-4 text-primary" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-primary">
            {summary.totalDisplayed}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Shown across public cards</p>
        </div>

        <div className="glass rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4">
          <div className="flex items-center justify-between text-xs text-amber-300 font-semibold">
            <span>Safety Override (12/12)</span>
            <ShieldAlert className="size-4" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-amber-300">
            {summary.safetyLocked}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">Full lobbies auto-turned OFF</p>
        </div>
      </div>

      {/* Main Automation & Multi-Scrim Batch Control Card */}
      <section className="glass rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/20 via-card/70 to-card p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border/60 pb-4">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide text-cyan-300">
              <Snowflake className="size-5" />
              Iceberg Automation Controls
            </h2>
            <p className="mt-1 text-xs text-muted-foreground max-w-2xl">
              Select single or multiple scrims below, or use Select All to configure baseline slots, cyclic resets, or instant &quot;Show All Slots Filled&quot; marketing overrides in one click.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="border-cyan-500/40 bg-cyan-500/10 text-cyan-200 font-mono text-xs px-2.5 py-1"
            >
              {activeTargetCount} Scrim{activeTargetCount === 1 ? "" : "s"} Selected
            </Badge>
            <div className="flex items-center gap-2.5 rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-3.5 py-2">
              <Switch
                checked={selectAllScrims}
                onCheckedChange={(checked) => handleSelectAllToggle(Boolean(checked))}
                aria-label="Select All Scrims"
              />
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-200">
                Select All ({visibleScrims.length})
              </span>
            </div>
          </div>
        </div>

        {/* Multi-Scrim Selection Quick Chips + Parameters Grid */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Multi-Scrim Selection Scope
            </Label>
            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="sm"
                variant={selectAllScrims ? "default" : "outline"}
                onClick={() => handleSelectAllToggle(true)}
                className="h-8 gap-1.5 text-xs"
              >
                <CheckCheck className="size-3.5" />
                Select All ({visibleScrims.length})
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleSelectTodayOpenOnly}
                className="h-8 gap-1.5 text-xs"
              >
                <Sparkles className="size-3.5 text-cyan-400" />
                Select Open
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleClearSelection}
                className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <XCircle className="size-3.5" />
                Clear
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {selectAllScrims
                ? `Batch actions apply to all ${visibleScrims.length} visible scrim(s).`
                : selectedVisibleCount > 0
                ? `${selectedVisibleCount} scrim(s) checked below (${effectiveTargetIds.length} total selected).`
                : "Check individual scrim checkboxes below to select multiple lobbies."}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="iceberg-amount-input" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Iceberg Amount (Baseline Slots)
            </Label>
            <Input
              id="iceberg-amount-input"
              type="number"
              min={1}
              max={11}
              value={bulkAmount}
              onChange={(e) => setBulkAmount(Math.max(0, Math.min(11, Number(e.target.value) || 0)))}
              className="h-10 font-mono font-bold"
            />
            <div className="flex flex-wrap gap-1.5">
              {[5, 6, 7, 8, 9].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setBulkAmount(preset)}
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-[11px] font-mono font-semibold transition-colors",
                    bulkAmount === preset
                      ? "border-cyan-400 bg-cyan-500/20 text-cyan-200"
                      : "border-border/60 bg-secondary/50 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="iceberg-threshold-input" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Reset Threshold (Real Signups)
            </Label>
            <Input
              id="iceberg-threshold-input"
              type="number"
              min={1}
              max={12}
              value={bulkThreshold}
              onChange={(e) => setBulkThreshold(Math.max(1, Math.min(12, Number(e.target.value) || 1)))}
              className="h-10 font-mono font-bold"
            />
            <div className="flex flex-wrap gap-1.5">
              {[2, 3, 4, 5].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setBulkThreshold(preset)}
                  className={cn(
                    "rounded-md border px-2 py-0.5 text-[11px] font-mono font-semibold transition-colors",
                    bulkThreshold === preset
                      ? "border-cyan-400 bg-cyan-500/20 text-cyan-200"
                      : "border-border/60 bg-secondary/50 text-muted-foreground hover:text-foreground",
                  )}
                >
                  Every {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Fluctuate Range (1-Click Auto)
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <Input
                type="number"
                min={1}
                max={10}
                value={fluctuateMin}
                onChange={(e) => {
                  const val = Math.max(1, Math.min(10, Number(e.target.value) || 1))
                  setFluctuateMin(val)
                  if (val > fluctuateMax) setFluctuateMax(val)
                }}
                aria-label="Fluctuate minimum amount"
                className="h-10 font-mono"
              />
              <Input
                type="number"
                min={1}
                max={11}
                value={fluctuateMax}
                onChange={(e) => {
                  const val = Math.max(fluctuateMin, Math.min(11, Number(e.target.value) || fluctuateMin))
                  setFluctuateMax(val)
                }}
                aria-label="Fluctuate maximum amount"
                className="h-10 font-mono"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Randomizes varied baseline slots between {fluctuateMin} and {fluctuateMax}.
            </p>
          </div>
        </div>

        {/* Show All Slots Filled Batch Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/35 bg-rose-500/10 px-4 py-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-200">
              <Lock className="size-3.5 text-rose-400" />
              Show All Slots Filled (Marketing Attraction Mode)
            </div>
            <p className="text-[11px] text-rose-200/80">
              Instantly display selected scrims as 12/12 Full on public pages &amp; cards while preserving actual booking counts underneath.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              disabled={isPending || activeTargetCount === 0}
              onClick={() => handleBulkShowAllFilled(true)}
              className="gap-1.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold"
            >
              <Lock className="size-3.5" />
              Show All Slots Filled ({selectAllScrims ? "All" : activeTargetCount})
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isPending || activeTargetCount === 0}
              onClick={() => handleBulkShowAllFilled(false)}
              className="gap-1.5 border-rose-500/40 text-rose-200 hover:bg-rose-500/15"
            >
              <Unlock className="size-3.5" />
              Clear Filled Override
            </Button>
          </div>
        </div>

        {/* Live Logic Simulation Preview */}
        <div className="flex items-start gap-2.5 rounded-xl border border-border/60 bg-secondary/40 px-4 py-3 text-xs">
          <Info className="size-4 shrink-0 text-cyan-400 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-foreground">
              Live Cycle Simulation (Amount {safePreviewBase}, Reset Threshold {safePreviewThreshold}):
            </p>
            <p className="font-mono text-[11px] text-cyan-300">{sampleSequence}</p>
            <p className="text-[11px] text-muted-foreground">
              Safety Override: Reaching 12/12 real bookings automatically disables Iceberg &amp; marketing overrides for that scrim so lobbies close cleanly.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            disabled={isPending || activeTargetCount === 0}
            onClick={() => handleBulkApply(true)}
            className="gap-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold"
          >
            <Power className="size-4" />
            Apply &amp; Enable Iceberg ({selectAllScrims ? "All" : activeTargetCount})
          </Button>

          <Button
            type="button"
            disabled={isPending || activeTargetCount === 0}
            onClick={handleFluctuateNow}
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          >
            <Shuffle className="size-4" />
            1-Click Fluctuate Automation
          </Button>

          <Button
            type="button"
            variant="outline"
            disabled={isPending || activeTargetCount === 0}
            onClick={handleResetCycles}
            className="gap-2 border-border/70"
          >
            <RefreshCw className="size-4" />
            Reset Cycle Baseline
          </Button>

          <Button
            type="button"
            variant="destructive"
            disabled={isPending || activeTargetCount === 0}
            onClick={() => handleBulkApply(false)}
            className="gap-2 ml-auto"
          >
            <Power className="size-4" />
            Turn Off Selected
          </Button>
        </div>
      </section>

      {/* Scrim List & Per-Scrim Controls */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setScheduleFilter("today")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-bold transition-colors border",
                scheduleFilter === "today"
                  ? "border-primary/50 bg-primary/15 text-primary"
                  : "border-border/60 bg-secondary/50 text-muted-foreground hover:text-foreground",
              )}
            >
              Today&apos;s Active Scrims ({scrims.filter((s) => s.isTodaySchedule).length})
            </button>
            <button
              type="button"
              onClick={() => setScheduleFilter("all")}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-bold transition-colors border",
                scheduleFilter === "all"
                  ? "border-primary/50 bg-primary/15 text-primary"
                  : "border-border/60 bg-secondary/50 text-muted-foreground hover:text-foreground",
              )}
            >
              All Standard &amp; Custom Scrims ({scrims.length})
            </button>
          </div>

          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter scrims by title or time…"
              className="pl-9 h-9"
            />
          </div>
        </div>

        {visibleScrims.length === 0 ? (
          <div className="glass rounded-2xl p-10 text-center text-sm text-muted-foreground">
            No scrims match your current filter.
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {visibleScrims.map((s) => {
              const draft = rowDrafts[s.id] || {
                amount: s.icebergAmount,
                threshold: s.icebergThreshold,
              }
              const isSelected = selectAllScrims || selectedIds.includes(s.id)
              const progress = getIcebergCycleProgress({
                realConfirmed: s.confirmedTeams,
                maxTeams: s.maxTeams,
                icebergEnabled: s.icebergEnabled,
                icebergShowAllFilled: s.icebergShowAllFilled,
                icebergAmount: s.icebergAmount,
                icebergThreshold: s.icebergThreshold,
                icebergStartRealCount: s.icebergStartRealCount,
              })
              const isRealFull = s.confirmedTeams >= s.maxTeams
              const isShowAllFilledActive = Boolean(s.icebergShowAllFilled && !isRealFull)

              return (
                <div
                  key={s.id}
                  className={cn(
                    "glass flex flex-col gap-3 rounded-xl border p-4 transition-all xl:flex-row xl:items-center xl:justify-between",
                    isShowAllFilledActive
                      ? "border-rose-500/45 bg-rose-500/5"
                      : isSelected
                      ? "border-cyan-500/45 bg-cyan-500/5"
                      : "border-border/60",
                  )}
                >
                  {/* Left: Checkbox + Scrim Metadata */}
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => toggleRowSelection(s.id)}
                      className="mt-0.5 p-1 text-muted-foreground hover:text-foreground"
                      aria-label={`Select ${s.title}`}
                    >
                      {isSelected ? (
                        <CheckSquare className="size-4 text-cyan-400" />
                      ) : (
                        <Square className="size-4" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
                          {s.title}
                        </span>
                        <Badge variant="outline" className="font-mono text-[11px]">
                          {s.startTime}
                        </Badge>
                        {isRealFull ? (
                          <Badge
                            variant="outline"
                            className="border-amber-500/40 bg-amber-500/10 text-amber-300 text-[11px]"
                          >
                            Safety Override: Full (Auto-OFF)
                          </Badge>
                        ) : isShowAllFilledActive ? (
                          <Badge
                            variant="outline"
                            className="border-rose-500/45 bg-rose-500/15 text-rose-300 text-[11px]"
                          >
                            All Slots Filled ({s.maxTeams}/{s.maxTeams})
                          </Badge>
                        ) : s.icebergEnabled ? (
                          <Badge
                            variant="outline"
                            className="border-cyan-500/40 bg-cyan-500/15 text-cyan-300 text-[11px]"
                          >
                            Iceberg Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[11px] text-muted-foreground">
                            Off (Real Count)
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>
                          Real Confirmed:{" "}
                          <strong className="font-mono text-emerald-400">
                            {s.confirmedTeams}/{s.maxTeams}
                          </strong>
                        </span>
                        <span>·</span>
                        <span>
                          Public Display:{" "}
                          <strong className={cn("font-mono", isShowAllFilledActive ? "text-rose-300" : "text-primary")}>
                            {progress.displayedCount}/{s.maxTeams}
                          </strong>
                        </span>
                        {s.icebergEnabled && !isRealFull && !isShowAllFilledActive && (
                          <>
                            <span>·</span>
                            <span className="font-mono text-[11px] text-cyan-300">
                              Cycle: +{progress.cycleOffset}/{s.icebergThreshold} (resets to {s.icebergAmount} in{" "}
                              {progress.remainingUntilReset} real booking
                              {progress.remainingUntilReset === 1 ? "" : "s"})
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Inline Amount / Threshold / Save / All-Filled / Iceberg Toggle */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-muted-foreground">Base:</span>
                      <Input
                        type="number"
                        min={1}
                        max={Math.max(1, s.maxTeams - 1)}
                        value={draft.amount}
                        disabled={isPending || isRealFull}
                        onChange={(e) =>
                          setRowDrafts((prev) => ({
                            ...prev,
                            [s.id]: {
                              ...draft,
                              amount: Math.max(0, Math.min(s.maxTeams - 1, Number(e.target.value) || 0)),
                            },
                          }))
                        }
                        aria-label={`Base Iceberg amount for ${s.title}`}
                        className="h-8 w-16 font-mono text-xs text-center"
                      />
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-muted-foreground">Reset:</span>
                      <Input
                        type="number"
                        min={1}
                        max={s.maxTeams}
                        value={draft.threshold}
                        disabled={isPending || isRealFull}
                        onChange={(e) =>
                          setRowDrafts((prev) => ({
                            ...prev,
                            [s.id]: {
                              ...draft,
                              threshold: Math.max(1, Math.min(s.maxTeams, Number(e.target.value) || 1)),
                            },
                          }))
                        }
                        aria-label={`Reset threshold for ${s.title}`}
                        className="h-8 w-16 font-mono text-xs text-center"
                      />
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending || isRealFull}
                      onClick={() => handleSingleRowSave(s, s.icebergEnabled)}
                      className="h-8 text-xs"
                    >
                      Save
                    </Button>

                    <div
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-2.5 py-1",
                        isShowAllFilledActive
                          ? "border-rose-500/45 bg-rose-500/15"
                          : "border-border/60 bg-secondary/50",
                      )}
                      title="Display all slots filled (12/12) publicly for marketing"
                    >
                      <Switch
                        checked={isShowAllFilledActive}
                        disabled={isPending || isRealFull}
                        onCheckedChange={(checked) => handleSingleRowShowAllFilled(s, Boolean(checked))}
                        aria-label={`Show All Slots Filled for ${s.title}`}
                      />
                      <span
                        className={cn(
                          "text-[11px] font-semibold whitespace-nowrap",
                          isShowAllFilledActive ? "text-rose-200" : "text-muted-foreground",
                        )}
                      >
                        All Filled
                      </span>
                    </div>

                    <div
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-2.5 py-1",
                        s.icebergEnabled && !isRealFull
                          ? "border-cyan-500/40 bg-cyan-500/15"
                          : "border-border/60 bg-secondary/50",
                      )}
                    >
                      <Switch
                        checked={Boolean(s.icebergEnabled && !isRealFull)}
                        disabled={isPending || isRealFull}
                        onCheckedChange={(checked) => handleSingleRowSave(s, Boolean(checked))}
                        aria-label={`Toggle Iceberg for ${s.title}`}
                      />
                      <span
                        className={cn(
                          "text-xs font-semibold min-w-[24px]",
                          s.icebergEnabled && !isRealFull ? "text-cyan-300" : "text-muted-foreground",
                        )}
                      >
                        {s.icebergEnabled && !isRealFull ? "ON" : "OFF"}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
