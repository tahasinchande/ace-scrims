"use client"

import { useState, useTransition } from "react"
import { updateReportStatus } from "@/app/actions/reports"
import { trashReports } from "@/app/actions/admin"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/format"
import { resolveImageUrl, extractImageUrls } from "@/lib/image-url"
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
  Hash,
  CreditCard,
  AlertCircle,
  CheckSquare,
  Square,
  RotateCcw,
  X,
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
  whatsapp?: string | null
  hackerUid?: string | null
  hackerName?: string | null
  uid?: string | null
  name?: string | null
  trxid?: string | null
  bookingDetails?: string | null
  additionalInfo?: string | null
  status: string
  createdAt: Date
}

export function AdminReports({ reports }: { reports: ReportItem[] }) {
  const [isPending, startTransition] = useTransition()
  const [filter, setFilter] = useState<"all" | "pending" | "reviewed" | "resolved">("all")
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  const filteredReports = reports.filter((r) => {
    if (filter === "all") return true
    return r.status === filter
  })

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
    if (!window.confirm(`Move ${ids.length} report(s) to Trash?`)) return
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
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
            Player Reports ({reports.length})
          </h1>
          <p className="text-sm text-muted-foreground">
            Review hacker reports, slot verification issues, payment claims, and video proofs.
          </p>
        </div>

        <div className="flex items-center gap-1.5 rounded-xl bg-secondary/50 p-1">
          {(["all", "pending", "reviewed", "resolved"] as const).map((tab) => (
            <Button
              key={tab}
              size="sm"
              variant={filter === tab ? "default" : "ghost"}
              onClick={() => setFilter(tab)}
              className="text-xs uppercase font-bold"
            >
              {tab} ({reports.filter((r) => tab === "all" || r.status === tab).length})
            </Button>
          ))}
        </div>
      </header>

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
              className="h-8 gap-1.5 text-xs"
            >
              <Trash2 className="size-3.5" /> Move Selected to Trash ({selectedIds.length})
            </Button>
          )}
        </div>
      )}

      {filteredReports.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center text-sm text-muted-foreground">
          No reports found for the selected filter.
        </div>
      ) : (
        <ul className="flex flex-col gap-5">
          {filteredReports.map((report) => {
            const isSelected = selectedIds.includes(report.id)
            const cleanWa = report.whatsapp?.replace(/[^0-9]/g, "")
            const imageProofs = extractImageUrls([report.imageUrl, report.proofUrl])
            const videoProof = report.videoUrl

            return (
              <li
                key={report.id}
                className={`glass flex flex-col gap-4 rounded-2xl p-5 border transition-all ${
                  isSelected ? "border-primary bg-primary/5" : "border-border/70"
                } shadow-md`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 pb-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => toggleSelect(report.id)}
                      className="p-1 text-muted-foreground hover:text-foreground"
                    >
                      {isSelected ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4" />}
                    </button>
                    <Badge variant="destructive" className="font-bold uppercase tracking-wider">
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-foreground font-medium">
                      <User className="size-4 text-primary" />
                      <span>Reporter: {report.userName || "Guest"} ({report.userPhone || report.userId})</span>
                    </div>

                    {report.whatsapp && (
                      <div className="flex items-center gap-2">
                        <MessageSquare className="size-4 text-emerald-400" />
                        <a
                          href={`https://wa.me/${cleanWa}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-400 hover:underline font-semibold text-xs"
                        >
                          WhatsApp: {report.whatsapp} (Click to Chat)
                        </a>
                      </div>
                    )}

                    {report.scrimTitle && (
                      <div className="flex items-center gap-2 text-muted-foreground text-xs">
                        <AlertCircle className="size-4 text-primary" />
                        <span>Related Scrim: <strong className="text-foreground">{report.scrimTitle}</strong></span>
                      </div>
                    )}

                    {/* Specific details based on report */}
                    {(report.hackerUid || report.hackerName) && (
                      <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-3 text-xs flex flex-col gap-1">
                        <span className="font-bold text-destructive flex items-center gap-1">
                          <AlertCircle className="size-3.5" /> Accused Hacker Info:
                        </span>
                        {report.hackerName && <div>Name: <strong>{report.hackerName}</strong></div>}
                        {report.hackerUid && <div>UID: <strong className="font-mono">{report.hackerUid}</strong></div>}
                      </div>
                    )}

                    {report.trxid && (
                      <div className="rounded-xl bg-primary/10 border border-primary/30 p-3 text-xs flex flex-col gap-1">
                        <span className="font-bold text-primary flex items-center gap-1">
                          <CreditCard className="size-3.5" /> Claimed Payment TrxID:
                        </span>
                        <div className="font-mono font-bold text-foreground">{report.trxid}</div>
                      </div>
                    )}

                    {report.bookingDetails && (
                      <div className="rounded-xl bg-secondary/50 p-2.5 text-xs text-muted-foreground">
                        <strong>Registration Info:</strong> {report.bookingDetails}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Report Statement & Info:
                    </div>
                    <div className="rounded-xl bg-secondary/60 p-3 text-sm leading-relaxed whitespace-pre-wrap flex-1 border border-border/50">
                      {report.description}
                      {report.additionalInfo && (
                        <div className="mt-2 pt-2 border-t border-border/40 text-xs text-muted-foreground">
                          <strong>Additional Info:</strong> {report.additionalInfo}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Proof Media Preview (Screenshots & Large Videos) */}
                {(imageProofs.length > 0 || videoProof) && (
                  <div className="flex flex-col gap-3 border-t border-border/40 pt-3">
                    {imageProofs.length > 0 && (
                      <div className="flex flex-col gap-2 rounded-xl bg-black/40 p-3 border border-border/60">
                        <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                          <span className="flex items-center gap-1.5 text-primary">
                            <ImageIcon className="size-4" /> Screenshot Proof ({imageProofs.length})
                          </span>
                          {imageProofs.length === 1 && (
                            <a
                              href={imageProofs[0]}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline flex items-center gap-1 text-[11px]"
                            >
                              <ExternalLink className="size-3" /> Full View
                            </a>
                          )}
                        </div>

                        <div className={cn(
                          "grid gap-2.5",
                          imageProofs.length === 1 ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3"
                        )}>
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
                                  // Fallback gracefully if image fails to load
                                  (e.target as HTMLImageElement).src = "/placeholder.svg"
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

                    {videoProof ? (
                      <div className="flex flex-col gap-2 rounded-xl bg-black/40 p-3 border border-border/60">
                        <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                          <span className="flex items-center gap-1.5 text-accent">
                            <Video className="size-4" /> Video Proof (Screen Recording)
                          </span>
                          <a
                            href={resolveImageUrl(videoProof)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent hover:underline flex items-center gap-1 text-[11px]"
                          >
                            <ExternalLink className="size-3" /> Open Video
                          </a>
                        </div>
                        <div className="relative rounded-lg overflow-hidden border border-border/40 aspect-video bg-black/90 flex items-center justify-center">
                          <video src={resolveImageUrl(videoProof)} controls preload="metadata" className="w-full h-full object-contain" />
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3 mt-1">
                  <div className="flex items-center gap-2">
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
                      className="gap-1.5 text-xs"
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
                          if (res.ok) toast.success("Marked as Solved (Resolved)")
                          else toast.error(res.error)
                        })
                      }
                      className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
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
                      className="gap-1.5 text-xs"
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
                    className="gap-1.5 text-xs"
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
    </div>
  )
}
