"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
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
  ScrollText,
  Camera,
  Users as UsersIcon,
  CreditCard,
  ExternalLink,
  User as UserIcon,
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
  restoreReport,
  bulkRestoreReports,
  permanentlyDeleteReport,
  bulkPermanentlyDeleteReports,
  restoreImageRequest,
  bulkRestoreImageRequests,
  permanentlyDeleteImageRequest,
  bulkPermanentlyDeleteImageRequests,
  restoreUser,
  bulkRestoreUsers,
  permanentlyDeleteUser,
  bulkPermanentlyDeleteUsers,
  restorePayment,
  bulkRestorePayments,
  permanentlyDeletePayment,
  bulkPermanentlyDeletePayments,
} from "@/app/actions/admin"
import { toast } from "sonner"
import type { Scrim, ImageRequest } from "@/lib/db/schema"
import { formatDate, formatDateTime, formatTaka, timeAgo } from "@/lib/format"
import { resolveImageUrl } from "@/lib/image-url"

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

export type TrashedReport = {
  report: {
    id: string
    userId: string
    reportType: string
    description: string
    proofUrl: string | null
    imageUrl?: string | null
    videoUrl?: string | null
    whatsapp?: string | null
    hackerUid?: string | null
    hackerName?: string | null
    uid?: string | null
    name?: string | null
    trxid?: string | null
    status: string
    deletedAt?: Date | string | null
    createdAt: Date | string
  }
  userName?: string | null
  userEmail?: string | null
}

export type TrashedUser = {
  id: string
  name: string
  email: string
  role: string
  image?: string | null
  deletedAt?: Date | string | null
  createdAt: Date | string
}

export type TrashedPayment = {
  payment: {
    id: string
    userId: string
    amountBdt: number
    method?: string | null
    transactionId?: string | null
    status: string
    deletedAt?: Date | string | null
    createdAt: Date | string
  }
  teamName?: string | null
  scrimTitle?: string | null
  userEmail?: string | null
}

export function AdminTrash({
  scrims = [],
  results = [],
  reports = [],
  imageRequests = [],
  users = [],
  payments = [],
}: {
  scrims?: Scrim[]
  results?: TrashedResult[]
  reports?: TrashedReport[]
  imageRequests?: ImageRequest[]
  users?: TrashedUser[]
  payments?: TrashedPayment[]
}) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<
    "scrims" | "results" | "reports" | "image-requests" | "users" | "payments"
  >("scrims")
  const [searchQuery, setSearchQuery] = useState("")

  // Selections
  const [selectedScrimIds, setSelectedScrimIds] = useState<string[]>([])
  const [selectedResultIds, setSelectedResultIds] = useState<string[]>([])
  const [selectedReportIds, setSelectedReportIds] = useState<string[]>([])
  const [selectedImageReqIds, setSelectedImageReqIds] = useState<string[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<string[]>([])

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

  const filteredReports = reports.filter(
    (r) =>
      !searchQuery ||
      r.report.reportType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.report.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.userName && r.userName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (r.userEmail && r.userEmail.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const filteredImageRequests = imageRequests.filter(
    (i) =>
      !searchQuery ||
      (i.teamName && i.teamName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (i.scrimTitle && i.scrimTitle.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (i.captainUid && i.captainUid.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const filteredUsers = users.filter(
    (u) =>
      !searchQuery ||
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredPayments = payments.filter(
    (p) =>
      !searchQuery ||
      (p.teamName && p.teamName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.userEmail && p.userEmail.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.payment.transactionId && p.payment.transactionId.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  // Scrim Select All
  const allScrimsSelected = filteredScrims.length > 0 && selectedScrimIds.length === filteredScrims.length
  function toggleSelectAllScrims() {
    setSelectedScrimIds(allScrimsSelected ? [] : filteredScrims.map((s) => s.id))
  }

  // Result Select All
  const allResultsSelected = filteredResults.length > 0 && selectedResultIds.length === filteredResults.length
  function toggleSelectAllResults() {
    setSelectedResultIds(allResultsSelected ? [] : filteredResults.map((r) => r.id))
  }

  // Reports Select All
  const allReportsSelected = filteredReports.length > 0 && selectedReportIds.length === filteredReports.length
  function toggleSelectAllReports() {
    setSelectedReportIds(allReportsSelected ? [] : filteredReports.map((r) => r.report.id))
  }

  // Image Requests Select All
  const allImgReqSelected = filteredImageRequests.length > 0 && selectedImageReqIds.length === filteredImageRequests.length
  function toggleSelectAllImageReqs() {
    setSelectedImageReqIds(allImgReqSelected ? [] : filteredImageRequests.map((i) => i.id))
  }

  // Users Select All
  const allUsersSelected = filteredUsers.length > 0 && selectedUserIds.length === filteredUsers.length
  function toggleSelectAllUsers() {
    setSelectedUserIds(allUsersSelected ? [] : filteredUsers.map((u) => u.id))
  }

  // Payments Select All
  const allPaymentsSelected = filteredPayments.length > 0 && selectedPaymentIds.length === filteredPayments.length
  function toggleSelectAllPayments() {
    setSelectedPaymentIds(allPaymentsSelected ? [] : filteredPayments.map((p) => p.payment.id))
  }

  // Generic Runner
  async function runAction(
    loadingKey: string,
    actionFn: () => Promise<{ ok: boolean; count?: number; error?: string | null }>,
    successMsg: string,
    onSuccess: () => void
  ) {
    setActionLoading(loadingKey)
    try {
      const res = await actionFn()
      if (res.ok) {
        toast.success(successMsg)
        onSuccess()
        router.refresh()
      } else {
        toast.error(res.error || "Action failed")
      }
    } catch (e: any) {
      toast.error(e?.message || "An unexpected error occurred")
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Category Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-secondary/40 p-1">
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
            Results
            <span className="rounded-full bg-background/20 px-1.5 py-0.5 text-[10px]">
              {results.length}
            </span>
          </Button>

          <Button
            variant={activeTab === "reports" ? "default" : "ghost"}
            size="sm"
            onClick={() => {
              setActiveTab("reports")
              setSearchQuery("")
            }}
            className="h-8 gap-2 rounded-lg text-xs font-bold uppercase tracking-wider"
          >
            <ScrollText className="size-3.5" />
            Reports
            <span className="rounded-full bg-background/20 px-1.5 py-0.5 text-[10px]">
              {reports.length}
            </span>
          </Button>

          <Button
            variant={activeTab === "image-requests" ? "default" : "ghost"}
            size="sm"
            onClick={() => {
              setActiveTab("image-requests")
              setSearchQuery("")
            }}
            className="h-8 gap-2 rounded-lg text-xs font-bold uppercase tracking-wider"
          >
            <Camera className="size-3.5" />
            Image Requests
            <span className="rounded-full bg-background/20 px-1.5 py-0.5 text-[10px]">
              {imageRequests.length}
            </span>
          </Button>

          <Button
            variant={activeTab === "users" ? "default" : "ghost"}
            size="sm"
            onClick={() => {
              setActiveTab("users")
              setSearchQuery("")
            }}
            className="h-8 gap-2 rounded-lg text-xs font-bold uppercase tracking-wider"
          >
            <UsersIcon className="size-3.5" />
            Users
            <span className="rounded-full bg-background/20 px-1.5 py-0.5 text-[10px]">
              {users.length}
            </span>
          </Button>

          <Button
            variant={activeTab === "payments" ? "default" : "ghost"}
            size="sm"
            onClick={() => {
              setActiveTab("payments")
              setSearchQuery("")
            }}
            className="h-8 gap-2 rounded-lg text-xs font-bold uppercase tracking-wider"
          >
            <CreditCard className="size-3.5" />
            Payments
            <span className="rounded-full bg-background/20 px-1.5 py-0.5 text-[10px]">
              {payments.length}
            </span>
          </Button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder={`Filter trashed ${activeTab}...`}
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
              <Trash2 className="size-8 text-muted-foreground/60" />
              <p className="font-display text-base font-bold uppercase tracking-wide">Trash is empty</p>
              <p className="text-xs text-muted-foreground">No soft-deleted scrims found.</p>
            </div>
          ) : (
            <>
              <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
                <button
                  type="button"
                  onClick={toggleSelectAllScrims}
                  className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  {allScrimsSelected ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4" />}
                  <span>{selectedScrimIds.length > 0 ? `${selectedScrimIds.length} scrim(s) selected` : "Select all"}</span>
                </button>

                {selectedScrimIds.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={Boolean(actionLoading)}
                      onClick={() =>
                        runAction("bulk-restore-scrims", () => bulkRestoreScrims(selectedScrimIds), "Restored selected scrims", () =>
                          setSelectedScrimIds([])
                        )
                      }
                      className="h-8 gap-1.5 text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                    >
                      <RotateCcw className="size-3.5" /> Restore Selected ({selectedScrimIds.length})
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={Boolean(actionLoading)}
                      onClick={() => {
                        if (!confirm(`Permanently delete ${selectedScrimIds.length} scrim(s)? This cannot be undone.`)) return
                        runAction(
                          "bulk-delete-scrims",
                          () => bulkPermanentlyDeleteScrims(selectedScrimIds),
                          "Permanently deleted selected scrims",
                          () => setSelectedScrimIds([])
                        )
                      }}
                      className="h-8 gap-1.5 text-xs"
                    >
                      <Trash2 className="size-3.5" /> Purge Selected
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredScrims.map((scrim) => {
                  const isSelected = selectedScrimIds.includes(scrim.id)
                  return (
                    <div
                      key={scrim.id}
                      className={`glass relative flex flex-col justify-between rounded-xl border p-4 transition-all ${
                        isSelected ? "border-primary bg-primary/5" : "border-border/60"
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedScrimIds((prev) =>
                                prev.includes(scrim.id) ? prev.filter((i) => i !== scrim.id) : [...prev, scrim.id]
                              )
                            }
                            className="p-1 text-muted-foreground hover:text-foreground"
                          >
                            {isSelected ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4" />}
                          </button>
                          <Badge variant="destructive" className="text-[10px]">Deleted</Badge>
                        </div>
                        <h3 className="font-display text-base font-bold uppercase">{scrim.title}</h3>
                        <p className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                          <Clock className="size-3" /> {scrim.startTime} · <MapPin className="size-3" /> {scrim.map}
                        </p>
                      </div>

                      <div className="flex items-center justify-end gap-2 border-t border-border/40 pt-3 mt-4">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={Boolean(actionLoading)}
                          onClick={() =>
                            runAction(`restore-${scrim.id}`, () => restoreScrim(scrim.id), `Restored "${scrim.title}"`, () =>
                              setSelectedScrimIds((prev) => prev.filter((i) => i !== scrim.id))
                            )
                          }
                          className="h-7 text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                        >
                          <RotateCcw className="size-3" /> Restore
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={Boolean(actionLoading)}
                          onClick={() => {
                            if (!confirm(`Permanently delete "${scrim.title}"?`)) return
                            runAction(
                              `purge-${scrim.id}`,
                              () => permanentlyDeleteScrim(scrim.id),
                              `Permanently deleted "${scrim.title}"`,
                              () => setSelectedScrimIds((prev) => prev.filter((i) => i !== scrim.id))
                            )
                          }}
                          className="h-7 text-xs"
                        >
                          <Trash2 className="size-3" /> Purge
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

      {/* ===================== TAB: RESULTS ===================== */}
      {activeTab === "results" && (
        <div className="flex flex-col gap-4">
          {results.length === 0 ? (
            <div className="glass flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/80 p-12 text-center">
              <Trophy className="size-8 text-muted-foreground/60" />
              <p className="font-display text-base font-bold uppercase tracking-wide">Trash is empty</p>
              <p className="text-xs text-muted-foreground">No soft-deleted match results found.</p>
            </div>
          ) : (
            <>
              <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
                <button
                  type="button"
                  onClick={toggleSelectAllResults}
                  className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  {allResultsSelected ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4" />}
                  <span>{selectedResultIds.length > 0 ? `${selectedResultIds.length} result(s) selected` : "Select all"}</span>
                </button>

                {selectedResultIds.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={Boolean(actionLoading)}
                      onClick={() =>
                        runAction("bulk-restore-results", () => bulkRestoreResults(selectedResultIds), "Restored selected results", () =>
                          setSelectedResultIds([])
                        )
                      }
                      className="h-8 gap-1.5 text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                    >
                      <RotateCcw className="size-3.5" /> Restore Selected ({selectedResultIds.length})
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={Boolean(actionLoading)}
                      onClick={() => {
                        if (!confirm(`Permanently delete ${selectedResultIds.length} results? This cannot be undone.`)) return
                        runAction(
                          "bulk-delete-results",
                          () => bulkPermanentlyDeleteResults(selectedResultIds),
                          "Permanently deleted selected results",
                          () => setSelectedResultIds([])
                        )
                      }}
                      className="h-8 gap-1.5 text-xs"
                    >
                      <Trash2 className="size-3.5" /> Purge Selected
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredResults.map((result) => {
                  const isSelected = selectedResultIds.includes(result.id)
                  return (
                    <div
                      key={result.id}
                      className={`glass relative flex flex-col justify-between rounded-xl border p-4 transition-all ${
                        isSelected ? "border-primary bg-primary/5" : "border-border/60"
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedResultIds((prev) =>
                                prev.includes(result.id) ? prev.filter((i) => i !== result.id) : [...prev, result.id]
                              )
                            }
                            className="p-1 text-muted-foreground hover:text-foreground"
                          >
                            {isSelected ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4" />}
                          </button>
                          <Badge variant="outline" className="text-[10px]">#{result.placement} · {result.kills} Kills</Badge>
                        </div>
                        <h3 className="font-display text-base font-bold text-foreground">{result.winningTeam}</h3>
                        <p className="text-xs text-muted-foreground mt-1">{result.scrimTitle || "Scrim Match"}</p>
                        <p className="text-xs text-amber-400 font-bold mt-1">{formatTaka(result.prizeBdt)}</p>
                      </div>

                      <div className="flex items-center justify-end gap-2 border-t border-border/40 pt-3 mt-4">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={Boolean(actionLoading)}
                          onClick={() =>
                            runAction(`restore-${result.id}`, () => restoreResult(result.id), `Restored result for "${result.winningTeam}"`, () =>
                              setSelectedResultIds((prev) => prev.filter((i) => i !== result.id))
                            )
                          }
                          className="h-7 text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                        >
                          <RotateCcw className="size-3" /> Restore
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={Boolean(actionLoading)}
                          onClick={() => {
                            if (!confirm(`Permanently delete result for "${result.winningTeam}"?`)) return
                            runAction(
                              `purge-${result.id}`,
                              () => permanentlyDeleteResult(result.id),
                              `Permanently deleted result`,
                              () => setSelectedResultIds((prev) => prev.filter((i) => i !== result.id))
                            )
                          }}
                          className="h-7 text-xs"
                        >
                          <Trash2 className="size-3" /> Purge
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

      {/* ===================== TAB: REPORTS ===================== */}
      {activeTab === "reports" && (
        <div className="flex flex-col gap-4">
          {reports.length === 0 ? (
            <div className="glass flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/80 p-12 text-center">
              <ScrollText className="size-8 text-muted-foreground/60" />
              <p className="font-display text-base font-bold uppercase tracking-wide">Trash is empty</p>
              <p className="text-xs text-muted-foreground">No soft-deleted player reports found.</p>
            </div>
          ) : (
            <>
              <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
                <button
                  type="button"
                  onClick={toggleSelectAllReports}
                  className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  {allReportsSelected ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4" />}
                  <span>{selectedReportIds.length > 0 ? `${selectedReportIds.length} report(s) selected` : "Select all"}</span>
                </button>

                {selectedReportIds.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={Boolean(actionLoading)}
                      onClick={() =>
                        runAction("bulk-restore-reports", () => bulkRestoreReports(selectedReportIds), "Restored selected reports", () =>
                          setSelectedReportIds([])
                        )
                      }
                      className="h-8 gap-1.5 text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                    >
                      <RotateCcw className="size-3.5" /> Restore Selected ({selectedReportIds.length})
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={Boolean(actionLoading)}
                      onClick={() => {
                        if (!confirm(`Permanently delete ${selectedReportIds.length} reports? This cannot be undone.`)) return
                        runAction(
                          "bulk-delete-reports",
                          () => bulkPermanentlyDeleteReports(selectedReportIds),
                          "Permanently deleted selected reports",
                          () => setSelectedReportIds([])
                        )
                      }}
                      className="h-8 gap-1.5 text-xs"
                    >
                      <Trash2 className="size-3.5" /> Purge Selected
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-3">
                {filteredReports.map(({ report, userName, userEmail }) => {
                  const isSelected = selectedReportIds.includes(report.id)
                  return (
                    <div
                      key={report.id}
                      className={`glass flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border p-4 transition-all ${
                        isSelected ? "border-primary bg-primary/5" : "border-border/60"
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedReportIds((prev) =>
                              prev.includes(report.id) ? prev.filter((i) => i !== report.id) : [...prev, report.id]
                            )
                          }
                          className="mt-0.5 p-0.5 text-muted-foreground hover:text-foreground"
                        >
                          {isSelected ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4" />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="capitalize text-xs font-semibold">
                              {report.reportType}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              By {userName || userEmail || "User"} · {timeAgo(report.createdAt)}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-foreground line-clamp-2">{report.description}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={Boolean(actionLoading)}
                          onClick={() =>
                            runAction(`restore-${report.id}`, () => restoreReport(report.id), "Report restored to active reports", () =>
                              setSelectedReportIds((prev) => prev.filter((i) => i !== report.id))
                            )
                          }
                          className="h-7 text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                        >
                          <RotateCcw className="size-3" /> Restore
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={Boolean(actionLoading)}
                          onClick={() => {
                            if (!confirm("Permanently delete this report?")) return
                            runAction(
                              `purge-${report.id}`,
                              () => permanentlyDeleteReport(report.id),
                              "Report permanently deleted",
                              () => setSelectedReportIds((prev) => prev.filter((i) => i !== report.id))
                            )
                          }}
                          className="h-7 text-xs"
                        >
                          <Trash2 className="size-3" /> Purge
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

      {/* ===================== TAB: IMAGE REQUESTS ===================== */}
      {activeTab === "image-requests" && (
        <div className="flex flex-col gap-4">
          {imageRequests.length === 0 ? (
            <div className="glass flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/80 p-12 text-center">
              <Camera className="size-8 text-muted-foreground/60" />
              <p className="font-display text-base font-bold uppercase tracking-wide">Trash is empty</p>
              <p className="text-xs text-muted-foreground">No soft-deleted image requests found.</p>
            </div>
          ) : (
            <>
              <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
                <button
                  type="button"
                  onClick={toggleSelectAllImageReqs}
                  className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  {allImgReqSelected ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4" />}
                  <span>{selectedImageReqIds.length > 0 ? `${selectedImageReqIds.length} request(s) selected` : "Select all"}</span>
                </button>

                {selectedImageReqIds.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={Boolean(actionLoading)}
                      onClick={() =>
                        runAction("bulk-restore-img", () => bulkRestoreImageRequests(selectedImageReqIds), "Restored selected image requests", () =>
                          setSelectedImageReqIds([])
                        )
                      }
                      className="h-8 gap-1.5 text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                    >
                      <RotateCcw className="size-3.5" /> Restore Selected ({selectedImageReqIds.length})
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={Boolean(actionLoading)}
                      onClick={() => {
                        if (!confirm(`Permanently delete ${selectedImageReqIds.length} requests? This cannot be undone.`)) return
                        runAction(
                          "bulk-delete-img",
                          () => bulkPermanentlyDeleteImageRequests(selectedImageReqIds),
                          "Permanently deleted selected requests",
                          () => setSelectedImageReqIds([])
                        )
                      }}
                      className="h-8 gap-1.5 text-xs"
                    >
                      <Trash2 className="size-3.5" /> Purge Selected
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredImageRequests.map((req) => {
                  const isSelected = selectedImageReqIds.includes(req.id)
                  const urls = (req.uploadedImageUrls as string[]) || []
                  return (
                    <div
                      key={req.id}
                      className={`glass relative flex flex-col justify-between rounded-xl border p-4 transition-all ${
                        isSelected ? "border-primary bg-primary/5" : "border-border/60"
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedImageReqIds((prev) =>
                                prev.includes(req.id) ? prev.filter((i) => i !== req.id) : [...prev, req.id]
                              )
                            }
                            className="p-1 text-muted-foreground hover:text-foreground"
                          >
                            {isSelected ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4" />}
                          </button>
                          <Badge variant="outline" className="capitalize text-[10px]">{req.status}</Badge>
                        </div>
                        <h3 className="font-display text-base font-bold text-foreground truncate">{req.submittedTeamName || req.teamName}</h3>
                        <p className="text-xs text-muted-foreground mt-1 truncate">{req.scrimTitle}</p>
                        {urls.length > 0 && (
                          <div className="flex gap-2 mt-2">
                            {urls.slice(0, 2).map((u, i) => (
                              <img key={i} src={u} alt="Photo" className="h-16 w-16 object-cover rounded-lg border border-border" />
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-end gap-2 border-t border-border/40 pt-3 mt-4">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={Boolean(actionLoading)}
                          onClick={() =>
                            runAction(`restore-${req.id}`, () => restoreImageRequest(req.id), "Image request restored", () =>
                              setSelectedImageReqIds((prev) => prev.filter((i) => i !== req.id))
                            )
                          }
                          className="h-7 text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                        >
                          <RotateCcw className="size-3" /> Restore
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={Boolean(actionLoading)}
                          onClick={() => {
                            if (!confirm("Permanently delete this photo request?")) return
                            runAction(
                              `purge-${req.id}`,
                              () => permanentlyDeleteImageRequest(req.id),
                              "Image request permanently deleted",
                              () => setSelectedImageReqIds((prev) => prev.filter((i) => i !== req.id))
                            )
                          }}
                          className="h-7 text-xs"
                        >
                          <Trash2 className="size-3" /> Purge
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

      {/* ===================== TAB: USERS ===================== */}
      {activeTab === "users" && (
        <div className="flex flex-col gap-4">
          {users.length === 0 ? (
            <div className="glass flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/80 p-12 text-center">
              <UsersIcon className="size-8 text-muted-foreground/60" />
              <p className="font-display text-base font-bold uppercase tracking-wide">Trash is empty</p>
              <p className="text-xs text-muted-foreground">No soft-deleted users found.</p>
            </div>
          ) : (
            <>
              <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
                <button
                  type="button"
                  onClick={toggleSelectAllUsers}
                  className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  {allUsersSelected ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4" />}
                  <span>{selectedUserIds.length > 0 ? `${selectedUserIds.length} user(s) selected` : "Select all"}</span>
                </button>

                {selectedUserIds.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={Boolean(actionLoading)}
                      onClick={() =>
                        runAction("bulk-restore-users", () => bulkRestoreUsers(selectedUserIds), "Restored selected user accounts", () =>
                          setSelectedUserIds([])
                        )
                      }
                      className="h-8 gap-1.5 text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                    >
                      <RotateCcw className="size-3.5" /> Restore Selected ({selectedUserIds.length})
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={Boolean(actionLoading)}
                      onClick={() => {
                        if (!confirm(`Permanently delete ${selectedUserIds.length} users? This cannot be undone.`)) return
                        runAction(
                          "bulk-delete-users",
                          () => bulkPermanentlyDeleteUsers(selectedUserIds),
                          "Permanently deleted selected user accounts",
                          () => setSelectedUserIds([])
                        )
                      }}
                      className="h-8 gap-1.5 text-xs"
                    >
                      <Trash2 className="size-3.5" /> Purge Selected
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                {filteredUsers.map((user) => {
                  const isSelected = selectedUserIds.includes(user.id)
                  return (
                    <div
                      key={user.id}
                      className={`glass flex flex-wrap items-center justify-between gap-3 rounded-xl p-4 border transition-all ${
                        isSelected ? "border-primary bg-primary/5" : "border-border/60"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedUserIds((prev) =>
                              prev.includes(user.id) ? prev.filter((i) => i !== user.id) : [...prev, user.id]
                            )
                          }
                          className="p-1 text-muted-foreground hover:text-foreground"
                        >
                          {isSelected ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4" />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm truncate">{user.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email} · Role: {user.role}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={Boolean(actionLoading)}
                          onClick={() =>
                            runAction(`restore-${user.id}`, () => restoreUser(user.id), `Restored user ${user.name}`, () =>
                              setSelectedUserIds((prev) => prev.filter((i) => i !== user.id))
                            )
                          }
                          className="h-7 text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                        >
                          <RotateCcw className="size-3" /> Restore
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={Boolean(actionLoading)}
                          onClick={() => {
                            if (!confirm(`Permanently delete account "${user.name}"?`)) return
                            runAction(
                              `purge-${user.id}`,
                              () => permanentlyDeleteUser(user.id),
                              `Permanently deleted user account`,
                              () => setSelectedUserIds((prev) => prev.filter((i) => i !== user.id))
                            )
                          }}
                          className="h-7 text-xs"
                        >
                          <Trash2 className="size-3" /> Purge
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

      {/* ===================== TAB: PAYMENTS ===================== */}
      {activeTab === "payments" && (
        <div className="flex flex-col gap-4">
          {payments.length === 0 ? (
            <div className="glass flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/80 p-12 text-center">
              <CreditCard className="size-8 text-muted-foreground/60" />
              <p className="font-display text-base font-bold uppercase tracking-wide">Trash is empty</p>
              <p className="text-xs text-muted-foreground">No soft-deleted payment records found.</p>
            </div>
          ) : (
            <>
              <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
                <button
                  type="button"
                  onClick={toggleSelectAllPayments}
                  className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  {allPaymentsSelected ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4" />}
                  <span>{selectedPaymentIds.length > 0 ? `${selectedPaymentIds.length} payment(s) selected` : "Select all"}</span>
                </button>

                {selectedPaymentIds.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={Boolean(actionLoading)}
                      onClick={() =>
                        runAction("bulk-restore-pay", () => bulkRestorePayments(selectedPaymentIds), "Restored selected payments", () =>
                          setSelectedPaymentIds([])
                        )
                      }
                      className="h-8 gap-1.5 text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                    >
                      <RotateCcw className="size-3.5" /> Restore Selected ({selectedPaymentIds.length})
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={Boolean(actionLoading)}
                      onClick={() => {
                        if (!confirm(`Permanently delete ${selectedPaymentIds.length} payments? This cannot be undone.`)) return
                        runAction(
                          "bulk-delete-pay",
                          () => bulkPermanentlyDeletePayments(selectedPaymentIds),
                          "Permanently deleted selected payments",
                          () => setSelectedPaymentIds([])
                        )
                      }}
                      className="h-8 gap-1.5 text-xs"
                    >
                      <Trash2 className="size-3.5" /> Purge Selected
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                {filteredPayments.map(({ payment, teamName, scrimTitle, userEmail }) => {
                  const isSelected = selectedPaymentIds.includes(payment.id)
                  return (
                    <div
                      key={payment.id}
                      className={`glass flex flex-wrap items-center justify-between gap-3 rounded-xl p-4 border transition-all ${
                        isSelected ? "border-primary bg-primary/5" : "border-border/60"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedPaymentIds((prev) =>
                              prev.includes(payment.id) ? prev.filter((i) => i !== payment.id) : [...prev, payment.id]
                            )
                          }
                          className="p-1 text-muted-foreground hover:text-foreground"
                        >
                          {isSelected ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4" />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm truncate">
                            {teamName ?? "—"} <span className="text-muted-foreground">· {scrimTitle ?? "Scrim"}</span>
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {userEmail} · TRX: {payment.transactionId ?? "—"} · Method: {payment.method ?? "Online Gateway"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-display font-bold text-foreground">{formatTaka(payment.amountBdt)}</span>
                        <Badge variant="outline" className="capitalize text-xs">{payment.status}</Badge>

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={Boolean(actionLoading)}
                            onClick={() =>
                              runAction(`restore-${payment.id}`, () => restorePayment(payment.id), "Payment restored", () =>
                                setSelectedPaymentIds((prev) => prev.filter((i) => i !== payment.id))
                              )
                            }
                            className="h-7 text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                          >
                            <RotateCcw className="size-3" /> Restore
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={Boolean(actionLoading)}
                            onClick={() => {
                              if (!confirm("Permanently delete this payment record?")) return
                              runAction(
                                `purge-${payment.id}`,
                                () => permanentlyDeletePayment(payment.id),
                                "Payment permanently deleted",
                                () => setSelectedPaymentIds((prev) => prev.filter((i) => i !== payment.id))
                              )
                            }}
                            className="h-7 text-xs"
                          >
                            <Trash2 className="size-3" /> Purge
                          </Button>
                        </div>
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
