"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { formatDate } from "@/lib/format"
import { resolveImageUrl, extractImageUrls } from "@/lib/image-url"
import {
  ShieldAlert,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  RefreshCw,
  Search,
  ExternalLink,
  Video,
  Image as ImageIcon,
  MessageSquare,
  User,
  Hash,
  CreditCard,
  Phone,
  FileText,
  Calendar,
  Layers,
  ChevronRight,
  PlusCircle,
  X,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

export type UserReportItem = {
  id: string
  userId: string
  scrimId?: string | null
  scrimTitle?: string | null
  reportType: string
  description: string
  status: string
  proofUrl?: string | null
  imageUrl?: string | null
  imageUrls?: string[]
  videoUrl?: string | null
  whatsapp?: string | null
  hackerUid?: string | null
  hackerName?: string | null
  uid?: string | null
  name?: string | null
  trxid?: string | null
  bookingDetails?: string | null
  additionalInfo?: string | null
  createdAt: string
  updatedAt: string
}

interface UserReportsListProps {
  initialReports?: UserReportItem[]
}

/**
 * Returns badge styling and icon based on report status:
 * - Pending: Gray/Yellow/Amber
 * - Reviewed / In Progress: Blue/Sky
 * - Resolved: Green/Emerald
 * - Closed / Rejected: Red/Rose
 */
export function getStatusBadgeConfig(status: string) {
  const normalized = (status || "").toLowerCase().trim()
  switch (normalized) {
    case "resolved":
      return {
        label: "Resolved",
        badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
        dotClass: "bg-emerald-400",
        icon: CheckCircle2,
      }
    case "reviewed":
    case "in_progress":
    case "in progress":
      return {
        label: "In Progress",
        badgeClass: "bg-sky-500/15 text-sky-400 border-sky-500/30",
        dotClass: "bg-sky-400",
        icon: Eye,
      }
    case "rejected":
    case "closed":
      return {
        label: "Closed",
        badgeClass: "bg-rose-500/15 text-rose-400 border-rose-500/30",
        dotClass: "bg-rose-400",
        icon: XCircle,
      }
    case "pending":
    default:
      return {
        label: "Pending Review",
        badgeClass: "bg-amber-500/15 text-amber-400 border-amber-500/30",
        dotClass: "bg-amber-400",
        icon: Clock,
      }
  }
}

export function UserReportsList({ initialReports }: UserReportsListProps) {
  const [reports, setReports] = useState<UserReportItem[]>(initialReports || [])
  const [loading, setLoading] = useState<boolean>(!initialReports)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "in_progress" | "resolved" | "closed">("all")
  const [searchQuery, setSearchQuery] = useState<string>("")

  // Selected Report for detail modal
  const [selectedReport, setSelectedReport] = useState<UserReportItem | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  const fetchReports = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    setError(null)

    try {
      // Fetch from /api/user/reports with fallback to /api/reports
      let res = await fetch("/api/user/reports", { cache: "no-store" })
      if (!res.ok && res.status === 404) {
        res = await fetch("/api/reports", { cache: "no-store" })
      }

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || `Server responded with status ${res.status}`)
      }

      const data = await res.json()
      if (data.ok && Array.isArray(data.reports)) {
        setReports(data.reports)
      } else {
        throw new Error(data.error || "Failed to load reports")
      }
    } catch (err: any) {
      console.error("[UserReportsList] Fetch error:", err)
      setError(err?.message || "Could not retrieve your reports. Please try again.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (!initialReports) {
      fetchReports()
    }
  }, [initialReports, fetchReports])

  // Filtered reports
  const filteredReports = reports.filter((r) => {
    // Status filter
    const normStatus = (r.status || "").toLowerCase()
    if (statusFilter === "pending" && normStatus !== "pending") return false
    if (statusFilter === "in_progress" && normStatus !== "reviewed" && normStatus !== "in_progress") return false
    if (statusFilter === "resolved" && normStatus !== "resolved") return false
    if (statusFilter === "closed" && normStatus !== "rejected" && normStatus !== "closed") return false

    // Search query
    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim()
      const matchType = r.reportType.toLowerCase().includes(q)
      const matchScrim = (r.scrimTitle || "").toLowerCase().includes(q)
      const matchDesc = r.description.toLowerCase().includes(q)
      const matchTrx = (r.trxid || "").toLowerCase().includes(q)
      const matchHacker = (r.hackerUid || "").toLowerCase().includes(q) || (r.hackerName || "").toLowerCase().includes(q)
      const matchUid = (r.uid || "").toLowerCase().includes(q)
      return matchType || matchScrim || matchDesc || matchTrx || matchHacker || matchUid
    }

    return true
  })

  // Counts for tabs
  const pendingCount = reports.filter((r) => (r.status || "").toLowerCase() === "pending").length
  const inProgressCount = reports.filter((r) => {
    const s = (r.status || "").toLowerCase()
    return s === "reviewed" || s === "in_progress"
  }).length
  const resolvedCount = reports.filter((r) => (r.status || "").toLowerCase() === "resolved").length
  const closedCount = reports.filter((r) => {
    const s = (r.status || "").toLowerCase()
    return s === "rejected" || s === "closed"
  }).length

  return (
    <div className="flex flex-col gap-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold uppercase tracking-tight text-foreground flex items-center gap-2.5">
            <ShieldAlert className="size-7 text-primary" aria-hidden />
            My Reports
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track the status, admin updates, and details of all match and payment claims you&apos;ve submitted.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchReports(true)}
            disabled={loading || refreshing}
            className="border-border/60 hover:bg-secondary text-xs font-semibold gap-1.5 h-9"
          >
            <RefreshCw className={cn("size-3.5", refreshing && "animate-spin text-primary")} />
            <span>Refresh</span>
          </Button>

          <Button asChild size="sm" className="glow-primary font-display font-bold uppercase tracking-wider text-xs h-9 gap-1.5">
            <Link href="/report">
              <PlusCircle className="size-3.5" />
              Submit New Report
            </Link>
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none rounded-xl bg-secondary/40 p-1 border border-border/40">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap",
              statusFilter === "all"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            )}
          >
            All ({reports.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("pending")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5",
              statusFilter === "pending"
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            )}
          >
            <span className="size-1.5 rounded-full bg-amber-400" />
            Pending ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("in_progress")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5",
              statusFilter === "in_progress"
                ? "bg-sky-500/20 text-sky-400 border border-sky-500/40 shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            )}
          >
            <span className="size-1.5 rounded-full bg-sky-400" />
            In Progress ({inProgressCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("resolved")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5",
              statusFilter === "resolved"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            )}
          >
            <span className="size-1.5 rounded-full bg-emerald-400" />
            Resolved ({resolvedCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("closed")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5",
              statusFilter === "closed"
                ? "bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
            )}
          >
            <span className="size-1.5 rounded-full bg-rose-400" />
            Closed ({closedCount})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search reports or UID..."
            className="pl-9 bg-secondary/30 border-border/60 text-xs h-9"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Loading Skeleton State */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="glass rounded-2xl p-5 flex flex-col gap-4 border border-border/50 animate-pulse"
            >
              <div className="flex items-center justify-between">
                <div className="h-5 w-32 bg-secondary/80 rounded-md" />
                <div className="h-5 w-24 bg-secondary/80 rounded-full" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-full bg-secondary/60 rounded" />
                <div className="h-4 w-3/4 bg-secondary/60 rounded" />
              </div>
              <div className="pt-3 border-t border-border/40 flex items-center justify-between">
                <div className="h-3.5 w-28 bg-secondary/50 rounded" />
                <div className="h-8 w-24 bg-secondary/70 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="glass rounded-2xl p-8 border border-destructive/30 bg-destructive/5 text-center flex flex-col items-center gap-3">
          <AlertCircle className="size-10 text-destructive" />
          <h3 className="font-display text-lg font-bold text-foreground">Failed to load reports</h3>
          <p className="text-sm text-muted-foreground max-w-md">{error}</p>
          <Button
            onClick={() => fetchReports()}
            variant="outline"
            className="mt-2 border-border/60 hover:bg-secondary font-semibold text-xs"
          >
            Try Again
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && reports.length === 0 && (
        <div className="glass rounded-3xl p-12 text-center flex flex-col items-center gap-4 border border-border/60">
          <div className="size-16 rounded-2xl bg-secondary/60 flex items-center justify-center border border-border/50 text-muted-foreground">
            <ShieldAlert className="size-8 text-primary/70" />
          </div>
          <div className="space-y-1.5 max-w-md">
            <h3 className="font-display text-xl font-bold uppercase tracking-tight text-foreground">
              You haven&apos;t submitted any reports yet
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              If you encounter a hacker, payment mismatch, or room slot issue, you can report it directly to our moderation team.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button asChild className="glow-primary font-display font-bold uppercase tracking-wider text-xs">
              <Link href="/report">
                <PlusCircle className="size-4 mr-1.5" />
                Submit a Report
              </Link>
            </Button>
            <Button asChild variant="outline" className="border-border/60 text-xs font-semibold">
              <Link href="/scrims">Browse Scrims</Link>
            </Button>
          </div>
        </div>
      )}

      {/* No matching filter results */}
      {!loading && !error && reports.length > 0 && filteredReports.length === 0 && (
        <div className="glass rounded-2xl p-10 text-center flex flex-col items-center gap-2 border border-border/50">
          <Search className="size-7 text-muted-foreground/60" />
          <p className="font-display font-bold text-foreground">No reports matching your filter</p>
          <p className="text-xs text-muted-foreground">Try clearing your search query or selecting another status tab.</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter("all")
              setSearchQuery("")
            }}
            className="text-primary text-xs mt-2"
          >
            Clear Filters
          </Button>
        </div>
      )}

      {/* Reports Grid Cards */}
      {!loading && !error && filteredReports.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredReports.map((report) => {
            const badge = getStatusBadgeConfig(report.status)
            const BadgeIcon = badge.icon
            const hasMedia = Boolean(
              report.proofUrl ||
              report.videoUrl ||
              (report.imageUrls && report.imageUrls.length > 0)
            )

            return (
              <div
                key={report.id}
                className="glass rounded-2xl p-5 flex flex-col justify-between gap-4 border border-border/50 hover:border-primary/40 transition-all group"
              >
                {/* Header: Title & Status Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display font-bold text-base text-foreground group-hover:text-primary transition-colors">
                        {report.reportType}
                      </span>
                    </div>

                    {report.scrimTitle && (
                      <p className="text-xs text-primary/90 font-medium mt-0.5 flex items-center gap-1 truncate">
                        <Layers className="size-3 shrink-0" />
                        <span>{report.scrimTitle}</span>
                      </p>
                    )}
                  </div>

                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 border rounded-full flex items-center gap-1.5",
                      badge.badgeClass
                    )}
                  >
                    <BadgeIcon className="size-3" />
                    <span>{badge.label}</span>
                  </Badge>
                </div>

                {/* Body: Description Truncation & Key Identifiers */}
                <div className="space-y-2.5">
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed line-clamp-2">
                    {report.description || "No description provided."}
                  </p>

                  {/* Context chips */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    {report.hackerUid && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-0.5 font-mono text-destructive text-[11px] border border-destructive/20">
                        <User className="size-3" />
                        Hacker UID: {report.hackerUid}
                      </span>
                    )}
                    {report.trxid && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-secondary/80 px-2 py-0.5 font-mono text-foreground text-[11px] border border-border/40">
                        <CreditCard className="size-3 text-primary" />
                        Trx: {report.trxid}
                      </span>
                    )}
                    {report.uid && !report.hackerUid && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-secondary/80 px-2 py-0.5 font-mono text-muted-foreground text-[11px]">
                        UID: {report.uid}
                      </span>
                    )}
                    {hasMedia && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-secondary/80 px-2 py-0.5 text-xs text-muted-foreground">
                        {report.videoUrl ? <Video className="size-3 text-sky-400" /> : <ImageIcon className="size-3 text-primary" />}
                        {report.videoUrl ? "Video Link" : `${report.imageUrls?.length || 1} Proof Image(s)`}
                      </span>
                    )}
                  </div>
                </div>

                {/* Footer: Date & Details Button */}
                <div className="pt-3 border-t border-border/40 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="size-3.5" />
                    <span>{formatDate(report.createdAt)}</span>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedReport(report)}
                    className="h-8 px-2.5 text-xs font-semibold text-primary hover:text-primary hover:bg-primary/10 gap-1 rounded-lg"
                  >
                    <span>View Details</span>
                    <ChevronRight className="size-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Report Details Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in-0">
          <div
            className="glass-strong w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 sm:p-7 border border-border flex flex-col gap-5 shadow-2xl relative"
            role="dialog"
            aria-modal="true"
          >
            {/* Close Button */}
            <button
              onClick={() => setSelectedReport(null)}
              className="absolute right-5 top-5 p-1.5 rounded-full bg-secondary/80 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              aria-label="Close details modal"
            >
              <X className="size-4" />
            </button>

            {/* Modal Header */}
            <div className="pr-8 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-display text-xl font-bold uppercase text-foreground">
                  {selectedReport.reportType}
                </h3>
                {(() => {
                  const badge = getStatusBadgeConfig(selectedReport.status)
                  const BadgeIcon = badge.icon
                  return (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 border rounded-full flex items-center gap-1",
                        badge.badgeClass
                      )}
                    >
                      <BadgeIcon className="size-3" />
                      <span>{badge.label}</span>
                    </Badge>
                  )
                })()}
              </div>
              <p className="text-xs text-muted-foreground">
                Submitted on {formatDate(selectedReport.createdAt)}
                {selectedReport.scrimTitle && ` • Match: ${selectedReport.scrimTitle}`}
              </p>
            </div>

            <div className="border-t border-border/50 pt-4 space-y-4">
              {/* Description Section */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                  Report Description
                </label>
                <div className="rounded-xl bg-secondary/40 p-3.5 text-xs sm:text-sm leading-relaxed text-foreground border border-border/40 whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word] max-w-full">
                  {selectedReport.description}
                </div>
              </div>

              {/* Specific Field Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {selectedReport.hackerUid && (
                  <div className="rounded-xl bg-destructive/10 p-3 border border-destructive/20 space-y-0.5">
                    <span className="text-[11px] text-destructive/80 font-bold uppercase">Hacker UID</span>
                    <p className="font-mono text-sm font-bold text-destructive">{selectedReport.hackerUid}</p>
                    {selectedReport.hackerName && (
                      <p className="text-muted-foreground text-xs">Name: {selectedReport.hackerName}</p>
                    )}
                  </div>
                )}

                {selectedReport.trxid && (
                  <div className="rounded-xl bg-secondary/50 p-3 border border-border/40 space-y-0.5">
                    <span className="text-[11px] text-muted-foreground font-bold uppercase">Transaction ID</span>
                    <p className="font-mono text-sm font-bold text-foreground">{selectedReport.trxid}</p>
                  </div>
                )}

                {selectedReport.uid && (
                  <div className="rounded-xl bg-secondary/50 p-3 border border-border/40 space-y-0.5">
                    <span className="text-[11px] text-muted-foreground font-bold uppercase">Your Player UID</span>
                    <p className="font-mono text-sm font-bold text-foreground">{selectedReport.uid}</p>
                    {selectedReport.name && (
                      <p className="text-muted-foreground text-xs">In-Game Name: {selectedReport.name}</p>
                    )}
                  </div>
                )}

                {selectedReport.whatsapp && (
                  <div className="rounded-xl bg-secondary/50 p-3 border border-border/40 space-y-0.5">
                    <span className="text-[11px] text-muted-foreground font-bold uppercase">WhatsApp Contact</span>
                    <p className="font-mono text-sm font-bold text-foreground">{selectedReport.whatsapp}</p>
                  </div>
                )}

                {selectedReport.bookingDetails && (
                  <div className="rounded-xl bg-secondary/50 p-3 border border-border/40 space-y-0.5 sm:col-span-2">
                    <span className="text-[11px] text-muted-foreground font-bold uppercase">Booking Reference</span>
                    <p className="text-xs text-foreground break-words [overflow-wrap:anywhere]">{selectedReport.bookingDetails}</p>
                  </div>
                )}

                {selectedReport.additionalInfo && (
                  <div className="rounded-xl bg-secondary/50 p-3 border border-border/40 space-y-0.5 sm:col-span-2">
                    <span className="text-[11px] text-muted-foreground font-bold uppercase">Additional Details</span>
                    <p className="text-xs text-foreground whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-break:break-word] max-w-full">{selectedReport.additionalInfo}</p>
                  </div>
                )}
              </div>

              {/* Video Proof */}
              {selectedReport.videoUrl && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5 flex items-center gap-1.5">
                    <Video className="size-3.5 text-sky-400" />
                    Video Proof URL
                  </label>
                  <a
                    href={selectedReport.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:bg-sky-500/20 text-xs font-semibold transition-colors"
                  >
                    <span className="truncate pr-2">{selectedReport.videoUrl}</span>
                    <ExternalLink className="size-3.5 shrink-0" />
                  </a>
                </div>
              )}

              {/* Image Proof Gallery */}
              {((selectedReport.imageUrls && selectedReport.imageUrls.length > 0) || selectedReport.proofUrl) && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-1.5 flex items-center gap-1.5">
                    <ImageIcon className="size-3.5 text-primary" />
                    Attached Proof Screenshots
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {extractImageUrls(
                      selectedReport.imageUrls && selectedReport.imageUrls.length > 0
                        ? selectedReport.imageUrls
                        : selectedReport.proofUrl
                    ).map((resolved, idx) => {
                      return (
                        <div
                          key={idx}
                          onClick={() => setPreviewImage(resolved)}
                          className="relative aspect-video rounded-xl overflow-hidden bg-secondary border border-border/60 cursor-pointer group hover:border-primary transition-all"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={resolved}
                            alt={`Proof ${idx + 1}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Eye className="size-4 text-white" />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="border-t border-border/50 pt-4 flex items-center justify-end gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedReport(null)}
                className="border-border/60 text-xs font-semibold"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Full Image Preview Lightbox */}
      {previewImage && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in-0"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute -top-10 right-0 p-2 text-white/80 hover:text-white"
            >
              <X className="size-6" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewImage}
              alt="Proof Full Preview"
              className="max-h-[85vh] max-w-full rounded-xl object-contain border border-white/20 shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  )
}
