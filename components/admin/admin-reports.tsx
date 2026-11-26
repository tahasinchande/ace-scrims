"use client"

import { useState, useTransition } from "react"
import { updateReportStatus } from "@/app/actions/reports"
import { trashReports } from "@/app/actions/admin"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { formatDate } from "@/lib/format"
import { resolveImageUrl, extractImageUrls } from "@/lib/image-url"
import { isSafeHttpOrRelativeUrl } from "@/lib/url-safety"
import { cn } from "@/lib/utils"
import {
  Trash2,
  ExternalLink,
  CheckCircle,
  Clock,
  Eye,
  Video,
  Image as ImageIcon,
  MessageSquare,
  User,
  CreditCard,
  AlertCircle,
  CheckSquare,
  Square,
  RotateCcw,
  X,
  Link2,
  Filter,
  Bug,
  Lightbulb,
} from "lucide-react"
import { toast } from "sonner"

type ReportItem = {
  id: string
  userId: string
  userName?: string | null
  userPhone?: string | null
  scrimId?: string | null
  scrimTitle?: string | null
  reportType: string
  description: string
  proofUrl: string | null
  imageUrl?: string | null
  videoUrl?: string | null
  videoUrls?: string[]
  externalLinks?: string[]
  whatsapp?: string | null
  hackerUid?: string | null
  hackerName?: string | null
  uid?: string | null
  name?: string | null
  trxid?: string | null
  bookingDetails?: string | null
  additionalInfo?: string | null
  status: string
  createdAt: Date | string
}

type ScrimFilterOption = {
  id: string
  title: string
  startTime?: string | null
}

const KNOWN_REPORT_PURPOSES = [
  "Hacker Report",
  "Winner Payment Not Received",
  "Payment Completed But Slot Not Booked",
  "Feature Request",
  "Bug Report",
  "Other Report",
]

function getIsoDateString(val: Date | string): string {
  try {
    const d = typeof val === "string" ? new Date(val) : val
    if (Number.isNaN(d.getTime())) return ""
    return d.toISOString().split("T")[0]
  } catch {
    return ""
  }
}

export function AdminReports({
  reports,
  scrims = [],
}: {
  reports: ReportItem[]
  scrims?: ScrimFilterOption[]
}) {
  const [isPending, startTransition] = useTransition()
  const [filter, setFilter] = useState<"all" | "pending" | "reviewed" | "resolved">("all")
  const [purposeFilter, setPurposeFilter] = useState<string>("all")
  const [dateFilter, setDateFilter] = useState<string>("")
  const [scrimFilter, setScrimFilter] = useState<string>("all")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null)

  const uniquePurposes = Array.from(
    new Set([
      ...KNOWN_REPORT_PURPOSES,
      ...reports.map((r) => r.reportType).filter((t): t is string => Boolean(t && t.trim())),
    ])
  )

  const filteredReports = reports.filter((r) => {
    if (filter !== "all" && r.status !== filter) return false
    if (purposeFilter !== "all" && r.reportType !== purposeFilter) return false
    if (scrimFilter === "__none__" && r.scrimId) return false
    if (scrimFilter !== "all" && scrimFilter !== "__none__" && r.scrimId !== scrimFilter) return false
    if (dateFilter) {
      const createdDay = getIsoDateString(r.createdAt)
      const incidentMatch = r.additionalInfo?.includes(dateFilter) ?? false
      if (createdDay !== dateFilter && !incidentMatch) return false
    }
    return true
  })

  const hasActiveFilters =
    filter !== "all" || purposeFilter !== "all" || dateFilter !== "" || scrimFilter !== "all"

  const clearAllFilters = () => {
    setFilter("all")
    setPurposeFilter("all")
    setDateFilter("")
    setScrimFilter("all")
  }

  const allSelected = filteredReports.length > 0 && selectedIds.length === filteredReports.length

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredReports.map((r) => r.id))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
  }

  const handleDeleteToTrash = (ids: string[]) => {
    if (ids.length === 0) return
    setPendingDeleteIds(ids)
  }

  const executeDeleteToTrash = () => {
    if (!pendingDeleteIds || pendingDeleteIds.length === 0) return
    const ids = pendingDeleteIds
    setPendingDeleteIds(null)
    startTransition(async () => {
      const res = await trashReports(ids)
      if (res.ok) {
        toast.success(`Moved ${res.count} report(s) to Trash`)
        setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)))
      } else {
        toast.error(res.error || "Failed to move reports to trash")
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold uppercase tracking-wide">
            Submissions ({filteredReports.length} of {reports.length})
          </h2>
          <p className="text-sm text-muted-foreground">
            Filter by status, report purpose, scrim lobby, or submission date.
          </p>
        </div>

        <div className="flex items-center gap-1.5 rounded-xl bg-secondary/50 p-1 flex-wrap">
          {(["all", "pending", "reviewed", "resolved"] as const).map((tab) => (
            <Button
              key={tab}
              size="sm"
              variant={filter === tab ? "default" : "ghost"}
              onClick={() => setFilter(tab)}
              className="text-xs uppercase font-bold whitespace-nowrap"
            >
              {tab} ({reports.filter((r) => tab === "all" || r.status === tab).length})
            </Button>
          ))}
        </div>
      </header>

      {/* Advanced Filters Toolbar: Purpose + Scrim + Date */}
      <div className="glass rounded-2xl border border-border/70 p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Filter className="size-3.5 text-primary" />
            Filter Reports
          </span>
          {hasActiveFilters && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={clearAllFilters}
              className="h-7 gap-1 text-xs text-primary hover:text-primary"
            >
              <RotateCcw className="size-3" />
              Clear Filters
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Purpose Dropdown Filter */}
          <div className="flex flex-col gap-1">
            <label htmlFor="report-purpose-filter" className="text-[11px] font-semibold text-muted-foreground">
              Report Purpose
            </label>
            <select
              id="report-purpose-filter"
              value={purposeFilter}
              onChange={(e) => setPurposeFilter(e.target.value)}
              className="h-9 rounded-xl border border-border bg-secondary/80 px-3 text-xs font-medium text-foreground"
            >
              <option value="all">All Purposes</option>
              {uniquePurposes.map((purpose) => (
                <option key={purpose} value={purpose}>
                  {purpose}
                </option>
              ))}
            </select>
          </div>

          {/* Scrim Selector Dropdown */}
          <div className="flex flex-col gap-1">
            <label htmlFor="report-scrim-filter" className="text-[11px] font-semibold text-muted-foreground">
              Scrim / Tournament
            </label>
            <select
              id="report-scrim-filter"
              value={scrimFilter}
              onChange={(e) => setScrimFilter(e.target.value)}
              className="h-9 rounded-xl border border-border bg-secondary/80 px-3 text-xs font-medium text-foreground"
            >
              <option value="all">All Scrims</option>
              <option value="__none__">General / No Scrim (Feature &amp; Bug Reports)</option>
              {scrims.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} {s.startTime ? `(${s.startTime})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Date Filter Selector */}
          <div className="flex flex-col gap-1">
            <label htmlFor="report-date-filter" className="text-[11px] font-semibold text-muted-foreground">
              Submission / Incident Date
            </label>
            <Input
              id="report-date-filter"
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="h-9 rounded-xl border border-border bg-secondary/80 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Batch Selection Toolbar */}
      {filteredReports.length > 0 && (
        <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 p-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              {allSelected ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4" />}
              <span>{selectedIds.length > 0 ? `${selectedIds.length} report(s) selected` : "Select all"}</span>
            </button>
          </div>

          {selectedIds.length > 0 && (
            <Button
              size="sm"
              variant="destructive"
              disabled={isPending}
              onClick={() => handleDeleteToTrash(selectedIds)}
              className="h-8 gap-1.5 text-xs whitespace-nowrap"
            >
              <Trash2 className="size-3.5" /> Move Selected to Trash ({selectedIds.length})
            </Button>
          )}
        </div>
      )}

      {filteredReports.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center text-sm text-muted-foreground">
          No reports found for the selected filters.
        </div>
      ) : (
        <ul className="flex flex-col gap-5">
          {filteredReports.map((report) => {
            const isSelected = selectedIds.includes(report.id)
            const cleanWa = report.whatsapp?.replace(/[^0-9]/g, "")
            const imageProofs = extractImageUrls(report.imageUrl || report.proofUrl).filter((u) =>
              isSafeHttpOrRelativeUrl(u, { allowImageDataUri: true })
            )
            const uploadedVideos = (Array.isArray(report.videoUrls) ? report.videoUrls : []).filter((u) =>
              isSafeHttpOrRelativeUrl(u)
            )
            const linkList = [
              ...(Array.isArray(report.externalLinks) ? report.externalLinks : []),
              ...(report.videoUrl &&
              !uploadedVideos.includes(report.videoUrl) &&
              !(report.externalLinks || []).includes(report.videoUrl)
                ? [report.videoUrl]
                : []),
            ].filter((u) => isSafeHttpOrRelativeUrl(u))

            const isFeatureRequest = report.reportType === "Feature Request"
            const isBugReport = report.reportType === "Bug Report"

            return (
              <li
                key={report.id}
                className={`glass flex flex-col gap-4 rounded-2xl p-5 border transition-all min-w-0 max-w-full overflow-hidden ${
                  isSelected ? "border-primary bg-primary/5" : "border-border/70"
                } shadow-md`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={() => toggleSelect(report.id)}
                      className="p-1 text-muted-foreground hover:text-foreground"
                    >
                      {isSelected ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4" />}
                    </button>
                    <Badge
                      variant={isFeatureRequest || isBugReport ? "default" : "destructive"}
                      className={cn(
                        "font-bold uppercase tracking-wider gap-1",
                        isFeatureRequest && "bg-primary/20 text-primary border border-primary/40",
                        isBugReport && "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      )}
                    >
                      {isFeatureRequest && <Lightbulb className="size-3" />}
                      {isBugReport && <Bug className="size-3" />}
                      {report.reportType}
                    </Badge>
                    <Badge
                      variant={
                        report.status === "resolved"
                          ? "default"
                          : report.status === "reviewed"
                            ? "secondary"
                            : "outline"
                      }
                      className={
                        report.status === "resolved"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : report.status === "reviewed"
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                            : "bg-blue-500/20 text-blue-300 border-blue-500/40"
                      }
                    >
                      {report.status.toUpperCase()}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">{formatDate(report.createdAt)}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm min-w-0 max-w-full w-full">
                  <div className="flex flex-col gap-2 min-w-0 max-w-full w-full overflow-hidden">
                    <div className="flex items-center gap-2 text-foreground font-medium">
                      <User className="size-4 text-primary shrink-0" />
                      <span className="truncate">
                        Reporter: {report.userName || "Guest"} ({report.userPhone || report.userId})
                      </span>
                    </div>

                    {report.whatsapp && (
                      <div className="flex items-center gap-2">
                        <MessageSquare className="size-4 text-emerald-400 shrink-0" />
                        <a
                          href={`https://wa.me/${cleanWa}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-400 hover:underline font-semibold text-xs truncate"
                        >
                          WhatsApp: {report.whatsapp} (Click to Chat)
                        </a>
                      </div>
                    )}

                    {report.scrimTitle && (
                      <div className="flex items-center gap-2 text-muted-foreground text-xs">
                        <AlertCircle className="size-4 text-primary shrink-0" />
                        <span className="truncate">
                          Related Scrim: <strong className="text-foreground">{report.scrimTitle}</strong>
                        </span>
                      </div>
                    )}

                    {(report.hackerUid || report.hackerName) && (
                      <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-3 text-xs flex flex-col gap-1 min-w-0 max-w-full">
                        <span className="font-bold text-destructive flex items-center gap-1">
                          <AlertCircle className="size-3.5" /> Accused Hacker Info:
                        </span>
                        {report.hackerName && (
                          <div className="break-words">Name: <strong>{report.hackerName}</strong></div>
                        )}
                        {report.hackerUid && (
                          <div className="break-words">UID: <strong className="font-mono">{report.hackerUid}</strong></div>
                        )}
                      </div>
                    )}

                    {report.trxid && (
                      <div className="rounded-xl bg-primary/10 border border-primary/30 p-3 text-xs flex flex-col gap-1 min-w-0 max-w-full">
                        <span className="font-bold text-primary flex items-center gap-1">
                          <CreditCard className="size-3.5" /> Claimed Payment TrxID:
                        </span>
                        <div className="font-mono font-bold text-foreground break-all">{report.trxid}</div>
                      </div>
                    )}

                    {report.bookingDetails && (
                      <div className="rounded-xl bg-secondary/50 p-2.5 text-xs text-muted-foreground break-words max-w-full min-w-0 w-full">
                        <strong className="text-foreground">Registration Info:</strong> {report.bookingDetails}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 min-w-0 max-w-full w-full overflow-hidden">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {isFeatureRequest
                        ? "Expected Feature Details:"
                        : isBugReport
                          ? "Bug Report Description:"
                          : "Report Statement & Info:"}
                    </div>
                    <div className="rounded-xl bg-secondary/60 p-3 text-sm leading-relaxed whitespace-pre-wrap flex-1 border border-border/50 break-words max-w-full min-w-0 w-full">
                      <div className="break-words">{report.description}</div>
                      {report.additionalInfo && (
                        <div className="mt-2 pt-2 border-t border-border/40 text-xs text-muted-foreground break-words">
                          <strong className="text-foreground">Additional Info:</strong> {report.additionalInfo}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Proof Media Preview (Screenshots, Uploaded Videos, & External Links) */}
                {(imageProofs.length > 0 || uploadedVideos.length > 0 || linkList.length > 0) && (
                  <div className="flex flex-col gap-3 border-t border-border/40 pt-3">
                    {imageProofs.length > 0 && (
                      <div className="flex flex-col gap-2 rounded-xl bg-black/40 p-3 border border-border/60">
                        <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                          <span className="flex items-center gap-1.5 text-primary">
                            <ImageIcon className="size-4" /> Screenshot Proof ({imageProofs.length})
                          </span>
                        </div>

                        <div
                          className={cn(
                            "grid gap-2.5",
                            imageProofs.length === 1 ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3"
                          )}
                        >
                          {imageProofs.map((imgSrc, imgIdx) => (
                            <div
                              key={imgIdx}
                              className="group relative rounded-lg overflow-hidden border border-border/40 max-h-52 bg-black/60 flex items-center justify-center cursor-pointer hover:border-primary/60 transition-colors"
                              onClick={() => setPreviewImage(imgSrc)}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={imgSrc}
                                alt={`Screenshot Proof ${imgIdx + 1}`}
                                className="max-h-52 w-full object-contain group-hover:scale-105 transition-transform duration-200"
                                onError={(e) => {
                                  ;(e.target as HTMLImageElement).src = "/placeholder.svg"
                                }}
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                                <span className="rounded-md bg-black/80 px-2 py-1 text-[10px] text-white flex items-center gap-1 font-semibold">
                                  <Eye className="size-3 text-primary" /> Zoom
                                </span>
                                <a
                                  href={imgSrc}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="rounded-md bg-black/80 px-2 py-1 text-[10px] text-white flex items-center gap-1 font-semibold hover:text-primary"
                                >
                                  <ExternalLink className="size-3" /> Tab
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {uploadedVideos.length > 0 && (
                      <div className="flex flex-col gap-2 rounded-xl bg-black/40 p-3 border border-border/60">
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-accent">
                          <Video className="size-4" /> Uploaded Video Proofs ({uploadedVideos.length})
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {uploadedVideos.map((vUrl, vIdx) => (
                            <div
                              key={`${vUrl}-${vIdx}`}
                              className="rounded-lg overflow-hidden border border-border/40 bg-black/90"
                            >
                              <video
                                src={resolveImageUrl(vUrl)}
                                controls
                                preload="metadata"
                                className="w-full max-h-56 object-contain"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {linkList.length > 0 && (
                      <div className="flex flex-col gap-2 rounded-xl bg-black/40 p-3 border border-border/60">
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-sky-400">
                          <Link2 className="size-4" /> External Video / Drive Links ({linkList.length})
                        </span>
                        <div className="flex flex-col gap-1.5">
                          {linkList.map((lnk, lIdx) => {
                            const safeLink = isSafeHttpOrRelativeUrl(lnk)
                            return safeLink ? (
                              <a
                                key={`${lnk}-${lIdx}`}
                                href={lnk}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-xs font-semibold text-sky-300 hover:bg-sky-500/20 transition-colors"
                              >
                                <span className="truncate pr-2 font-mono">{lnk}</span>
                                <ExternalLink className="size-3.5 shrink-0" />
                              </a>
                            ) : (
                              <span
                                key={`${lnk}-${lIdx}`}
                                className="flex items-center justify-between rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-mono text-rose-300"
                              >
                                <span className="truncate pr-2">Blocked unsafe link</span>
                              </span>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3 mt-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant={report.status === "reviewed" ? "default" : "outline"}
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          const res = await updateReportStatus(report.id, "reviewed")
                          if (res.ok) toast.success("Marked as in review / reviewed")
                          else toast.error(res.error)
                        })
                      }
                      className="gap-1.5 text-xs whitespace-nowrap"
                    >
                      <Eye className="size-3.5" />
                      In Review
                    </Button>
                    <Button
                      size="sm"
                      variant={report.status === "resolved" ? "default" : "outline"}
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          const res = await updateReportStatus(report.id, "resolved")
                          if (res.ok) toast.success("Marked as Resolved")
                          else toast.error(res.error)
                        })
                      }
                      className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white whitespace-nowrap"
                    >
                      <CheckCircle className="size-3.5" />
                      Mark Resolved
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          const res = await updateReportStatus(report.id, "pending")
                          if (res.ok) toast.success("Reset status to pending")
                          else toast.error(res.error)
                        })
                      }
                      className="gap-1.5 text-xs whitespace-nowrap"
                    >
                      <Clock className="size-3.5" />
                      Pending
                    </Button>
                  </div>

                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={isPending}
                    onClick={() => handleDeleteToTrash([report.id])}
                    className="gap-1.5 text-xs whitespace-nowrap"
                  >
                    <Trash2 className="size-3.5" />
                    Move to Trash
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* Lightbox Modal for High-Resolution Screenshot Zoom */}
      {previewImage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-[95vw] rounded-2xl bg-zinc-950 border border-zinc-800 p-2 shadow-2xl flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between pb-2 px-2 border-b border-zinc-800">
              <span className="text-xs font-semibold text-zinc-300">Screenshot Proof Inspection</span>
              <div className="flex items-center gap-2">
                <a
                  href={previewImage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-zinc-800 px-2.5 py-1 text-xs text-white hover:bg-zinc-700 flex items-center gap-1 font-semibold"
                >
                  <ExternalLink className="size-3" /> Open in New Tab
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewImage(null)}
                  className="rounded-lg bg-zinc-800 p-1 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
            <div className="overflow-auto max-h-[80vh] p-2 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewImage}
                alt="Enlarged Screenshot"
                className="max-h-[75vh] w-auto max-w-full object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={pendingDeleteIds !== null}
        onOpenChange={(open) => !open && setPendingDeleteIds(null)}
        title="Move Reports to Trash?"
        description={`Move ${pendingDeleteIds?.length ?? 0} report(s) to Trash?`}
        confirmLabel="Move to Trash"
        variant="destructive"
        loading={isPending}
        onConfirm={executeDeleteToTrash}
      />
    </div>
  )
}
