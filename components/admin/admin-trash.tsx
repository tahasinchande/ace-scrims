"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  RotateCcw,
  Trash2,
  AlertTriangle,
  Loader2,
  CheckSquare,
  Square,
  Clock,
  MapPin,
  Calendar,
  Swords,
  Trophy,
  ShieldCheck,
  Search,
} from "lucide-react"
import {
  restoreScrim,
  permanentlyDeleteScrim,
  bulkRestoreScrims,
  bulkPermanentlyDeleteScrims,
  restoreResult,
  permanentlyDeleteResult,
  bulkRestoreResults,
  bulkPermanentlyDeleteResults,
} from "@/app/actions/admin"
import { toast } from "sonner"
import type { Scrim } from "@/lib/db/schema"

export type TrashedResult = {
  id: string
  scrimId: string
  winningTeam: string
  placement: number
  kills: number
  prizeBdt: number
  prizeStatus: string
  category: string
  mvpPlayerName?: string | null
  mvpTeamName?: string | null
  screenshotUrl?: string | null
  imageUrls?: string[] | unknown
  deletedAt?: Date | string | null
  createdAt: Date | string
  scrimTitle?: string | null
  scrimTime?: string | null
  scrimMap?: string | null
}

export function AdminTrash({
  scrims,
  results = [],
}: {
  scrims: Scrim[]
  results?: TrashedResult[]
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"scrims" | "results">("scrims")
  const [searchQuery, setSearchQuery] = useState("")

  // Scrims selection
  const [selectedScrimIds, setSelectedScrimIds] = useState<string[]>([])
  // Results selection
  const [selectedResultIds, setSelectedResultIds] = useState<string[]>([])

  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Filtered lists
  const filteredScrims = scrims.filter(
    (s) =>
      !searchQuery ||
      s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.map.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredResults = results.filter(
    (r) =>
      !searchQuery ||
      r.winningTeam.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.scrimTitle && r.scrimTitle.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.mvpPlayerName && r.mvpPlayerName.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  // Scrim Select All
  const allScrimsSelected =
    filteredScrims.length > 0 && selectedScrimIds.length === filteredScrims.length

  function toggleSelectAllScrims() {
    if (allScrimsSelected) {
      setSelectedScrimIds([])
    } else {
      setSelectedScrimIds(filteredScrims.map((s) => s.id))
    }
  }

  function toggleSelectScrim(id: string) {
    setSelectedScrimIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  // Results Select All
  const allResultsSelected =
    filteredResults.length > 0 && selectedResultIds.length === filteredResults.length

  function toggleSelectAllResults() {
    if (allResultsSelected) {
      setSelectedResultIds([])
    } else {
      setSelectedResultIds(filteredResults.map((r) => r.id))
    }
  }

  function toggleSelectResult(id: string) {
    setSelectedResultIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  // --- SCRIM ACTIONS ---
  async function handleRestoreScrim(id: string, title: string) {
    setActionLoading(`restore-scrim-${id}`)
    try {
      const res = await restoreScrim(id)
      if (res.ok) {
        toast.success(`"${title}" restored to active scrims`)
        setSelectedScrimIds((prev) => prev.filter((item) => item !== id))
        router.refresh()
      } else {
        toast.error(res.error || "Failed to restore scrim")
      }
    } catch {
      toast.error("An error occurred while restoring scrim")
    } finally {
      setActionLoading(null)
    }
  }

  async function handlePermanentDeleteScrim(id: string, title: string) {
    if (!confirm(`Permanently delete "${title}"? This cannot be undone.`)) {
      return
    }
    setActionLoading(`delete-scrim-${id}`)
    try {
      const res = await permanentlyDeleteScrim(id)
      if (res.ok) {
        toast.success(`"${title}" permanently deleted`)
        setSelectedScrimIds((prev) => prev.filter((item) => item !== id))
        router.refresh()
      } else {
        toast.error(res.error || "Failed to permanently delete scrim")
      }
    } catch {
      toast.error("An error occurred while deleting scrim")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleBulkRestoreScrims() {
    if (selectedScrimIds.length === 0) return
    setActionLoading("bulk-restore-scrims")
    try {
      const res = await bulkRestoreScrims(selectedScrimIds)
      if (res.ok) {
        toast.success(`Restored ${res.count} scrim${res.count > 1 ? "s" : ""}`)
        setSelectedScrimIds([])
        router.refresh()
      } else {
        toast.error(res.error || "Bulk restore failed")
      }
    } catch {
      toast.error("Error performing bulk restore")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleBulkPermanentDeleteScrims() {
    if (selectedScrimIds.length === 0) return
    if (!confirm(`Permanently delete ${selectedScrimIds.length} scrim(s)? This CANNOT be undone.`)) {
      return
    }
    setActionLoading("bulk-delete-scrims")
    try {
      const res = await bulkPermanentlyDeleteScrims(selectedScrimIds)
      if (res.ok) {
        toast.success(`Permanently deleted ${res.count} scrim${res.count > 1 ? "s" : ""}`)
        setSelectedScrimIds([])
        router.refresh()
      } else {
        toast.error(res.error || "Bulk delete failed")
      }
    } catch {
      toast.error("Error performing bulk delete")
    } finally {
      setActionLoading(null)
    }
  }

  // --- RESULT ACTIONS ---
  async function handleRestoreResult(id: string, team: string) {
    setActionLoading(`restore-result-${id}`)
    try {
      const res = await restoreResult(id)
      if (res.ok) {
        toast.success(`Result for "${team}" restored to active results`)
        setSelectedResultIds((prev) => prev.filter((item) => item !== id))
        router.refresh()
      } else {
        toast.error(res.error || "Failed to restore result")
      }
    } catch {
      toast.error("An error occurred while restoring result")
    } finally {
      setActionLoading(null)
    }
  }

  async function handlePermanentDeleteResult(id: string, team: string) {
    if (!confirm(`Permanently delete result for "${team}"? This cannot be undone.`)) {
      return
    }
    setActionLoading(`delete-result-${id}`)
    try {
      const res = await permanentlyDeleteResult(id)
      if (res.ok) {
        toast.success(`Result for "${team}" permanently deleted`)
        setSelectedResultIds((prev) => prev.filter((item) => item !== id))
        router.refresh()
      } else {
        toast.error(res.error || "Failed to permanently delete result")
      }
    } catch {
      toast.error("An error occurred while deleting result")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleBulkRestoreResults() {
    if (selectedResultIds.length === 0) return
    setActionLoading("bulk-restore-results")
    try {
      const res = await bulkRestoreResults(selectedResultIds)
      if (res.ok) {
        toast.success(`Restored ${res.count} result${res.count > 1 ? "s" : ""}`)
        setSelectedResultIds([])
        router.refresh()
      } else {
        toast.error(res.error || "Bulk restore failed")
      }
    } catch {
      toast.error("Error performing bulk restore")
    } finally {
      setActionLoading(null)
    }
  }

  async function handleBulkPermanentDeleteResults() {
    if (selectedResultIds.length === 0) return
    if (!confirm(`Permanently delete ${selectedResultIds.length} result(s)? This CANNOT be undone.`)) {
      return
    }
    setActionLoading("bulk-delete-results")
    try {
      const res = await bulkPermanentlyDeleteResults(selectedResultIds)
      if (res.ok) {
        toast.success(`Permanently deleted ${res.count} result${res.count > 1 ? "s" : ""}`)
        setSelectedResultIds([])
        router.refresh()
      } else {
        toast.error(res.error || "Bulk delete failed")
      }
    } catch {
      toast.error("Error performing bulk delete")
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <Button
            variant={activeTab === "scrims" ? "default" : "ghost"}
            size="sm"
            onClick={() => {
              setActiveTab("scrims")
              setSearchQuery("")
            }}
            className="h-8 gap-2 rounded-lg text-xs font-bold uppercase tracking-wider"
          >
            <Swords className="size-3.5" />
            Scrims
            <span className="rounded-full bg-background/20 px-1.5 py-0.5 text-[10px]">
              {scrims.length}
            </span>
          </Button>

          <Button
            variant={activeTab === "results" ? "default" : "ghost"}
            size="sm"
            onClick={() => {
              setActiveTab("results")
              setSearchQuery("")
            }}
            className="h-8 gap-2 rounded-lg text-xs font-bold uppercase tracking-wider"
          >
            <Trophy className="size-3.5" />
            Match Results
            <span className="rounded-full bg-background/20 px-1.5 py-0.5 text-[10px]">
              {results.length}
            </span>
          </Button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder={activeTab === "scrims" ? "Filter trashed scrims..." : "Filter trashed results..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-border bg-secondary/30 pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      {/* ===================== TAB: SCRIMS ===================== */}
      {activeTab === "scrims" && (
        <div className="flex flex-col gap-4">
          {scrims.length === 0 ? (
            <div className="glass flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/80 p-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <Trash2 className="size-6 text-muted-foreground/60" />
              </div>
              <p className="font-display text-base font-bold uppercase tracking-wide">
                Trash is empty
              </p>
              <p className="text-xs text-muted-foreground">
                No soft-deleted scrims found. Scrims moved to trash will appear here for recovery.
              </p>
            </div>
          ) : (
            <>
              {/* Batch Action Toolbar */}
              <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={toggleSelectAllScrims}
                    className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {allScrimsSelected ? (
                      <CheckSquare className="size-4 text-primary" />
                    ) : (
                      <Square className="size-4" />
                    )}
                    <span>
                      {selectedScrimIds.length > 0
                        ? `${selectedScrimIds.length} scrim(s) selected`
                        : "Select all"}
                    </span>
                  </button>
                </div>

                {selectedScrimIds.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleBulkRestoreScrims}
                      disabled={actionLoading !== null}
                      className="h-7 gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/10"
                    >
                      {actionLoading === "bulk-restore-scrims" ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="size-3.5" />
                      )}
                      Restore ({selectedScrimIds.length})
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleBulkPermanentDeleteScrims}
                      disabled={actionLoading !== null}
                      className="h-7 gap-1.5 text-xs"
                    >
                      {actionLoading === "bulk-delete-scrims" ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                      Permanently Delete ({selectedScrimIds.length})
                    </Button>
                  </div>
                )}
              </div>

              {/* Scrims List */}
              <div className="flex flex-col gap-3">
                {filteredScrims.map((scrim) => {
                  const isSelected = selectedScrimIds.includes(scrim.id)
                  const isRestoring = actionLoading === `restore-scrim-${scrim.id}`
                  const isDeleting = actionLoading === `delete-scrim-${scrim.id}`

                  return (
                    <div
                      key={scrim.id}
                      className={`glass flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border p-4 transition-all ${
                        isSelected
                          ? "border-primary/50 bg-primary/[0.04]"
                          : "border-border/60 hover:border-border"
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => toggleSelectScrim(scrim.id)}
                          className="mt-1 text-muted-foreground hover:text-foreground shrink-0"
                        >
                          {isSelected ? (
                            <CheckSquare className="size-4 text-primary" />
                          ) : (
                            <Square className="size-4" />
                          )}
                        </button>

                        <div className="flex flex-col gap-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-display text-sm font-bold uppercase text-foreground truncate">
                              {scrim.title}
                            </h4>
                            <Badge
                              variant="secondary"
                              className="text-[10px] uppercase font-mono tracking-wider bg-rose-500/10 text-rose-400 border-rose-500/20"
                            >
                              Soft-Deleted
                            </Badge>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="size-3.5 text-primary/70" />
                              {scrim.startTime}
                            </span>
                            <span className="flex items-center gap-1">
                              <MapPin className="size-3.5 text-primary/70" />
                              {scrim.map}
                            </span>
                            {scrim.deletedAt && (
                              <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                                <Calendar className="size-3 text-zinc-500" />
                                Deleted: {new Date(scrim.deletedAt).toLocaleDateString()}{" "}
                                {new Date(scrim.deletedAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRestoreScrim(scrim.id, scrim.title)}
                          disabled={actionLoading !== null}
                          className="h-8 gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/10"
                        >
                          {isRestoring ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="size-3.5" />
                          )}
                          Restore
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handlePermanentDeleteScrim(scrim.id, scrim.title)}
                          disabled={actionLoading !== null}
                          className="h-8 gap-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                        >
                          {isDeleting ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                          Delete Permanently
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ===================== TAB: MATCH RESULTS ===================== */}
      {activeTab === "results" && (
        <div className="flex flex-col gap-4">
          {results.length === 0 ? (
            <div className="glass flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/80 p-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
                <Trash2 className="size-6 text-muted-foreground/60" />
              </div>
              <p className="font-display text-base font-bold uppercase tracking-wide">
                No Deleted Results
              </p>
              <p className="text-xs text-muted-foreground">
                No soft-deleted match results found. Deleted results appear here and can be restored at any time.
              </p>
            </div>
          ) : (
            <>
              {/* Batch Action Toolbar */}
              <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={toggleSelectAllResults}
                    className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {allResultsSelected ? (
                      <CheckSquare className="size-4 text-primary" />
                    ) : (
                      <Square className="size-4" />
                    )}
                    <span>
                      {selectedResultIds.length > 0
                        ? `${selectedResultIds.length} result(s) selected`
                        : "Select all"}
                    </span>
                  </button>
                </div>

                {selectedResultIds.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleBulkRestoreResults}
                      disabled={actionLoading !== null}
                      className="h-7 gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/10"
                    >
                      {actionLoading === "bulk-restore-results" ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="size-3.5" />
                      )}
                      Restore ({selectedResultIds.length})
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleBulkPermanentDeleteResults}
                      disabled={actionLoading !== null}
                      className="h-7 gap-1.5 text-xs"
                    >
                      {actionLoading === "bulk-delete-results" ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                      Permanently Delete ({selectedResultIds.length})
                    </Button>
                  </div>
                )}
              </div>

              {/* Results List */}
              <div className="flex flex-col gap-3">
                {filteredResults.map((result) => {
                  const isSelected = selectedResultIds.includes(result.id)
                  const isRestoring = actionLoading === `restore-result-${result.id}`
                  const isDeleting = actionLoading === `delete-result-${result.id}`

                  return (
                    <div
                      key={result.id}
                      className={`glass flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border p-4 transition-all ${
                        isSelected
                          ? "border-primary/50 bg-primary/[0.04]"
                          : "border-border/60 hover:border-border"
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() => toggleSelectResult(result.id)}
                          className="mt-1 text-muted-foreground hover:text-foreground shrink-0"
                        >
                          {isSelected ? (
                            <CheckSquare className="size-4 text-primary" />
                          ) : (
                            <Square className="size-4" />
                          )}
                        </button>

                        <div className="flex flex-col gap-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-display text-sm font-bold uppercase text-foreground truncate">
                              {result.winningTeam} (Rank #{result.placement})
                            </h4>
                            <Badge
                              variant="secondary"
                              className="text-[10px] uppercase font-mono tracking-wider bg-rose-500/10 text-rose-400 border-rose-500/20"
                            >
                              Soft-Deleted
                            </Badge>
                            <Badge variant="outline" className="text-[10px] text-muted-foreground">
                              {result.category}
                            </Badge>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            {result.scrimTitle && (
                              <span className="font-medium text-foreground">
                                {result.scrimTitle}
                              </span>
                            )}
                            <span>{result.kills} Kills</span>
                            <span>{result.prizeBdt} BDT Prize</span>
                            {result.mvpPlayerName && (
                              <span className="text-amber-400 font-semibold">
                                MVP: {result.mvpPlayerName}
                              </span>
                            )}
                            {result.deletedAt && (
                              <span className="flex items-center gap-1 text-[11px] text-zinc-500">
                                <Calendar className="size-3 text-zinc-500" />
                                Deleted: {new Date(result.deletedAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRestoreResult(result.id, result.winningTeam)}
                          disabled={actionLoading !== null}
                          className="h-8 gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/10"
                        >
                          {isRestoring ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="size-3.5" />
                          )}
                          Restore
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handlePermanentDeleteResult(result.id, result.winningTeam)}
                          disabled={actionLoading !== null}
                          className="h-8 gap-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                        >
                          {isDeleting ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                          Delete Permanently
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
