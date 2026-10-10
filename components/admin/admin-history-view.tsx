"use client"

import { useState, useTransition, useMemo, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import {
  Calendar as CalendarIcon,
  Search,
  Users,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  CreditCard,
  Clock,
  MapPin,
  Flame,
  FileSpreadsheet,
  Phone,
  Eye,
  Hash,
  Download,
  Trophy,
  Medal,
  Plus,
  Trash2,
  CheckCheck,
  Loader2,
  Crown,
  UploadCloud,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { formatTaka, formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { publishResult, markPrizeSent, deleteResult } from "@/app/actions/staff"
import { uploadMediaFile } from "@/lib/client-upload"
import type { MatchResult } from "@/lib/db/schema"

export type HistoricalBookingItem = {
  id: string
  userId: string
  scrimId: string
  scrimTitle: string
  scrimStartTime: string
  scrimMap: string
  status: string
  teamName: string
  captainName: string
  captainUid: string
  player2Name: string
  player2Uid: string
  player3Name: string
  player3Uid: string
  player4Name: string
  player4Uid: string
  player5Name?: string | null
  player5Uid?: string | null
  phone: string
  discordTelegram?: string | null
  slotNumber?: number | null
  scrimDate?: string | null
  transactionId?: string | null
  invoiceId?: string | null
  teamLeaderImageUrl?: string | null
  paymentNumber?: string | null
  teamMembersDriveLink?: string | null
  isArchived?: boolean
  createdAt: Date | string
  userEmail?: string | null
  userName?: string | null
}

export type ScrimOption = {
  id: string
  title: string
  startTime: string
  prizePoolBdt?: number
}

export type HistoricalResultItem = {
  result: MatchResult
  scrimTitle: string | null
  startTime: string | null
}

export function AdminHistoryView({
  dates = [],
  scrims = [],
  selectedDate,
  selectedScrimId = "all",
  bookings = [],
  results = [],
  isAdmin = false,
}: {
  dates: string[]
  scrims: ScrimOption[]
  selectedDate: string
  selectedScrimId?: string
  bookings: HistoricalBookingItem[]
  results?: HistoricalResultItem[]
  isAdmin?: boolean
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [dateInput, setDateInput] = useState(selectedDate)
  const [scrimFilter, setScrimFilter] = useState(selectedScrimId)
  const [searchQuery, setSearchQuery] = useState("")
  const [copiedRoster, setCopiedRoster] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  function applyFilters(newDate: string, newScrim: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (newDate) params.set("date", newDate)
    else params.delete("date")
    if (newScrim && newScrim !== "all") params.set("scrim", newScrim)
    else params.delete("scrim")

    startTransition(() => {
      router.push(`/admin/history?${params.toString()}`)
    })
  }

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (scrimFilter && scrimFilter !== "all") {
        if (b.scrimId !== scrimFilter && !b.scrimTitle?.toLowerCase().includes(scrimFilter.toLowerCase())) {
          return false
        }
      }
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase().trim()
      return (
        b.teamName?.toLowerCase().includes(q) ||
        b.captainName?.toLowerCase().includes(q) ||
        b.captainUid?.toLowerCase().includes(q) ||
        b.phone?.toLowerCase().includes(q) ||
        b.transactionId?.toLowerCase().includes(q) ||
        b.userEmail?.toLowerCase().includes(q) ||
        b.scrimTitle?.toLowerCase().includes(q)
      )
    })
  }, [bookings, scrimFilter, searchQuery])

  // Copy structured roster to clipboard
  function copyFullRoster() {
    if (filteredBookings.length === 0) {
      toast.error("No teams to copy")
      return
    }

    const lines: string[] = [
      `=== ACE SCRIMS ROSTER ARCHIVE (${selectedDate}) ===`,
      scrimFilter !== "all" ? `LOBBY: ${scrimFilter}` : "ALL LOBBIES",
      `TOTAL TEAMS: ${filteredBookings.length}`,
      "---------------------------------------------",
    ]

    filteredBookings.forEach((b, idx) => {
      const slot = b.slotNumber ? `Slot ${b.slotNumber}` : `#${idx + 1}`
      lines.push(`${slot}: ${b.teamName} [Tag: ${b.discordTelegram || "N/A"}]`)
      lines.push(`  Leader: ${b.captainName} | UID: ${b.captainUid}`)
      lines.push(`  Phone: ${b.phone}`)
      if (b.transactionId) lines.push(`  TrxID: ${b.transactionId}`)
      lines.push("")
    })

    navigator.clipboard.writeText(lines.join("\n"))
    setCopiedRoster(true)
    toast.success("Complete team roster copied to clipboard!")
    setTimeout(() => setCopiedRoster(false), 2500)
  }

  function copySingleUid(uid: string, id: string) {
    navigator.clipboard.writeText(uid)
    setCopiedId(id)
    toast.success(`UID ${uid} copied!`)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const confirmedCount = filteredBookings.filter((b) => b.status === "confirmed").length
  const totalRevenue = filteredBookings.filter((b) => b.status === "confirmed").length * 35

  return (
    <div className="flex flex-col gap-6">
      {/* Header controls: Date Picker, Scrim Selector, Copy Action */}
      <div className="glass rounded-2xl border border-border/80 p-5 flex flex-col gap-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Date Selector */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="history-date" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <CalendarIcon className="size-3.5 text-primary" />
                Select Match Date
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id="history-date"
                  type="date"
                  value={dateInput}
                  onChange={(e) => {
                    setDateInput(e.target.value)
                    applyFilters(e.target.value, scrimFilter)
                  }}
                  className="w-44 bg-background font-mono text-sm"
                />
                {dates.length > 0 && (
                  <Select
                    value={dateInput}
                    onValueChange={(val) => {
                      if (val) {
                        setDateInput(val)
                        applyFilters(val, scrimFilter)
                      }
                    }}
                  >
                    <SelectTrigger className="w-36 text-xs bg-background">
                      <SelectValue placeholder="Quick dates" />
                    </SelectTrigger>
                    <SelectContent>
                      {dates.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>

            {/* Scrim Selector */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="history-scrim" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Users className="size-3.5 text-primary" />
                Filter by Scrim Lobby
              </label>
              <Select
                value={scrimFilter}
                onValueChange={(val) => {
                  const safeVal = (val as string) || "all"
                  setScrimFilter(safeVal)
                  applyFilters(dateInput, safeVal)
                }}
              >
                <SelectTrigger id="history-scrim" className="w-56 bg-background text-sm">
                  <SelectValue placeholder="All Scrim Lobbies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Scrim Lobbies</SelectItem>
                  {scrims.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.title} ({s.startTime})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0">
            <PublishHistoryResultDialog
              selectedDate={dateInput}
              scrims={scrims}
              confirmedTeams={filteredBookings
                .filter((b) => b.status === "confirmed")
                .map((b) => ({ teamName: b.teamName, captainName: b.captainName, captainUid: b.captainUid }))}
              defaultScrimId={scrimFilter}
            />

            <Button
              variant="outline"
              size="sm"
              onClick={copyFullRoster}
              disabled={filteredBookings.length === 0}
              className="gap-2 border-primary/40 text-primary hover:bg-primary/10"
            >
              {copiedRoster ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
              {copiedRoster ? "Roster Copied!" : "Copy Team List"}
            </Button>
          </div>
        </div>

        {/* Search bar & Live Filter stats */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-border/50">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search team, captain, UID, phone..."
              className="pl-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-3 text-xs">
            <Badge variant="outline" className="border-border">
              Total Teams: <span className="ml-1 font-mono font-bold text-foreground">{filteredBookings.length}</span>
            </Badge>
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
              Confirmed: <span className="ml-1 font-mono font-bold">{confirmedCount}</span>
            </Badge>
            <Badge variant="outline" className="border-primary/30 text-primary bg-primary/10">
              Est. Entry: <span className="ml-1 font-mono font-bold">{formatTaka(totalRevenue)}</span>
            </Badge>
          </div>
        </div>
      </div>

      {/* Published Match Results for this Historical Date */}
      {results && results.length > 0 && (
        <div className="glass rounded-2xl border border-primary/30 p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="size-4 text-primary" />
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">
                Published Results for {selectedDate}
              </h3>
              <Badge variant="outline" className="border-primary/40 text-primary text-[10px]">
                {results.length} Recorded
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-1">
            {results.map((r) => {
              const res = r.result
              const isPaid = res.prizeStatus === "sent"

              return (
                <div key={res.id} className="rounded-xl border border-border/70 bg-card/60 p-3.5 flex flex-col justify-between gap-3 shadow-sm">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-primary truncate">
                        {r.scrimTitle || "Scrim Lobby"} ({r.startTime || "N/A"})
                      </span>
                      <Badge variant="outline" className={cn("text-[9px] uppercase font-bold", isPaid ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10" : "border-amber-500/40 text-amber-400 bg-amber-500/10")}>
                        {isPaid ? "Paid" : "Pending"}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1.5 mt-1">
                      <Crown className="size-4 text-amber-400 shrink-0" />
                      <h4 className="font-display font-bold text-sm text-foreground truncate">
                        {res.winningTeam}
                      </h4>
                      <span className="text-[11px] text-muted-foreground">
                        (#{res.placement})
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
                      <span>Prize: <strong className="text-foreground">{formatTaka(res.prizeBdt)}</strong></span>
                      <span>·</span>
                      <span>Kills: <strong className="text-foreground">{res.kills}</strong></span>
                      <span>·</span>
                      <span className="truncate">{res.category}</span>
                    </div>

                    {res.mvpPlayerName && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        MVP: <span className="text-foreground font-semibold">{res.mvpPlayerName}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-border/50">
                    {!isPaid && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          startTransition(async () => {
                            try {
                              await markPrizeSent(res.id)
                              toast.success("Prize marked as sent")
                              router.refresh()
                            } catch (err: any) {
                              toast.error(err?.message || "Failed to update prize status")
                            }
                          })
                        }}
                        disabled={isPending}
                        className="h-7 text-xs gap-1 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                      >
                        <CheckCheck className="size-3" />
                        Mark Paid
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        if (!confirm("Are you sure you want to move this result to trash?")) return
                        startTransition(async () => {
                          try {
                            await deleteResult(res.id)
                            toast.success("Result moved to trash")
                            router.refresh()
                          } catch (err: any) {
                            toast.error(err?.message || "Failed to delete result")
                          }
                        })
                      }}
                      disabled={isPending}
                      className="h-7 text-xs gap-1 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="size-3" />
                      Trash
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Bookings List Display */}
      {filteredBookings.length === 0 ? (
        <div className="glass rounded-2xl p-16 text-center flex flex-col items-center gap-3">
          <CalendarIcon className="size-10 text-muted-foreground/50" />
          <h3 className="font-display text-lg font-bold uppercase tracking-wide">No Historical Records Found</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            No team bookings were archived for date <span className="font-mono font-semibold text-foreground">{selectedDate}</span>. Select another date from the dropdown above to inspect previous lobbies.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredBookings.map((b, idx) => {
            const hasLeaderPhoto = Boolean(b.teamLeaderImageUrl && b.teamLeaderImageUrl.trim())
            const isConfirmed = b.status === "confirmed"

            return (
              <div
                key={b.id}
                className={cn(
                  "glass rounded-xl border p-4 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4",
                  isConfirmed ? "border-border/80 hover:border-primary/40" : "border-amber-500/30 bg-amber-500/5"
                )}
              >
                {/* Left: Slot & Team Overview */}
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="flex flex-col items-center justify-center size-12 shrink-0 rounded-xl bg-secondary/80 border border-border font-mono text-sm font-bold">
                    <span className="text-[10px] text-muted-foreground uppercase font-sans">SLOT</span>
                    <span className="text-primary font-display text-base">{b.slotNumber ?? idx + 1}</span>
                  </div>

                  {/* Leader thumbnail preview */}
                  {hasLeaderPhoto && (
                    <Dialog>
                      <DialogTrigger
                        className="relative size-12 shrink-0 rounded-lg overflow-hidden border border-border/80 group hover:opacity-90 cursor-pointer block"
                        title="View leader photo"
                      >
                        <Image
                          src={b.teamLeaderImageUrl!}
                          alt={`${b.teamName} Leader`}
                          fill
                          unoptimized
                          className="object-cover transition-transform group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Eye className="size-3.5 text-white" />
                        </div>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md p-4">
                        <DialogHeader>
                          <DialogTitle className="text-base font-bold flex items-center gap-2">
                            <span>{b.teamName} — Leader Photo</span>
                          </DialogTitle>
                        </DialogHeader>
                        <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-black/80 mt-2">
                          <Image
                            src={b.teamLeaderImageUrl!}
                            alt={b.teamName}
                            fill
                            unoptimized
                            className="object-contain"
                          />
                        </div>
                        <div className="flex justify-between items-center text-xs text-muted-foreground pt-2">
                          <span>Captain: {b.captainName}</span>
                          <span className="font-mono">UID: {b.captainUid}</span>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}

                  <div className="flex flex-col">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-display font-bold text-base text-foreground">
                        {b.teamName}
                      </h4>
                      {b.discordTelegram && (
                        <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0">
                          {b.discordTelegram}
                        </Badge>
                      )}
                      <Badge
                        variant={isConfirmed ? "default" : "outline"}
                        className={cn("text-[10px] uppercase font-semibold", isConfirmed ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-amber-400 border-amber-500/30")}
                      >
                        {b.status}
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                      <span className="text-primary font-medium">{b.scrimTitle}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {b.scrimStartTime}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="size-3" />
                        {b.scrimMap}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Middle: Player Details & UID */}
                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground border-t md:border-t-0 md:border-l border-border/60 pt-3 md:pt-0 md:pl-4">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground">Team Leader</span>
                    <span className="font-medium text-foreground">{b.captainName}</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <code className="font-mono text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        {b.captainUid}
                      </code>
                      <button
                        type="button"
                        onClick={() => copySingleUid(b.captainUid, b.id)}
                        className="text-muted-foreground hover:text-foreground p-0.5"
                        title="Copy UID"
                      >
                        {copiedId === b.id ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground">WhatsApp / Phone</span>
                    <a
                      href={`https://wa.me/${b.phone.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-foreground hover:text-primary flex items-center gap-1"
                    >
                      <Phone className="size-3 text-emerald-400" />
                      {b.phone}
                    </a>
                    {b.userEmail && (
                      <span className="text-[10px] text-muted-foreground truncate max-w-[140px]" title={b.userEmail}>
                        {b.userEmail}
                      </span>
                    )}
                  </div>

                  {/* Payment Details */}
                  {(b.transactionId || b.paymentNumber) && (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground">Payment Verification</span>
                      {b.transactionId && (
                        <span className="font-mono text-[11px] text-muted-foreground">
                          Trx: <span className="text-foreground">{b.transactionId}</span>
                        </span>
                      )}
                      {b.paymentNumber && (
                        <span className="font-mono text-[11px] text-muted-foreground">
                          Sender: <span className="text-foreground">{b.paymentNumber}</span>
                        </span>
                      )}
                    </div>
                  )}

                  {/* Google Drive Link if provided */}
                  {b.teamMembersDriveLink && (
                    <Button asChild variant="outline" size="sm" className="h-7 text-xs gap-1 border-border">
                      <a href={b.teamMembersDriveLink} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="size-3" />
                        Squad Photos
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const WINNER_TYPES = [
  { id: "Champion — 1st place", label: "Champion — 1st place", placement: 1, defaultPrizePct: 0.55 },
  { id: "Runner-up — 2nd place", label: "Runner-up — 2nd place", placement: 2, defaultPrizePct: 0.30 },
  { id: "Second Runner-up — 3rd place", label: "Second Runner-up — 3rd place", placement: 3, defaultPrizePct: 0.15 },
  { id: "MVP Face Banner", label: "MVP Face Banner", placement: 1, defaultPrizePct: 0 },
  { id: "Top 3 Face Banner", label: "Top 3 Face Banner", placement: 1, defaultPrizePct: 0 },
  { id: "Overall Standing Banner", label: "Overall Standing Banner", placement: 1, defaultPrizePct: 0 },
]

export function PublishHistoryResultDialog({
  selectedDate,
  scrims,
  confirmedTeams,
  defaultScrimId,
}: {
  selectedDate: string
  scrims: ScrimOption[]
  confirmedTeams: { teamName: string; captainName: string; captainUid?: string | null }[]
  defaultScrimId?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [selectedScrimId, setSelectedScrimId] = useState(
    defaultScrimId && defaultScrimId !== "all" ? defaultScrimId : scrims[0]?.id || ""
  )
  const [winnerType, setWinnerType] = useState("Champion — 1st place")
  const [winningTeam, setWinningTeam] = useState("")
  const [mvpPlayerName, setMvpPlayerName] = useState("")
  const [mvpTeamName, setMvpTeamName] = useState("")
  const [kills, setKills] = useState("0")
  const [placement, setPlacement] = useState("1")
  const [prizeBdt, setPrizeBdt] = useState("330")

  const [uploadedUrls, setUploadedUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedScrim = scrims.find((s) => s.id === selectedScrimId)

  function handleWinnerTypeChange(typeId: string) {
    setWinnerType(typeId)
    const wt = WINNER_TYPES.find((w) => w.id === typeId)
    if (wt) {
      setPlacement(String(wt.placement))
      if (selectedScrim?.prizePoolBdt && wt.defaultPrizePct > 0) {
        const calculated = Math.round(selectedScrim.prizePoolBdt * wt.defaultPrizePct)
        setPrizeBdt(String(calculated))
      }
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    setUploadProgress(10)
    try {
      const urls: string[] = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const res = await uploadMediaFile(
          file,
          "results",
          (p: number) => setUploadProgress(Math.round(((i + p / 100) / files.length) * 100))
        )
        urls.push(res.url)
      }
      setUploadedUrls((prev) => [...prev, ...urls])
      setUploadProgress(100)
      toast.success(`${urls.length} image(s) uploaded successfully`)
    } catch (err) {
      toast.error("Upload error: " + (err instanceof Error ? err.message : "Failed to upload"))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (uploading) {
      toast.info("Please wait for images to finish uploading")
      return
    }

    if (!selectedScrimId) {
      toast.error("Please select a scrim")
      return
    }
    if (!winningTeam.trim()) {
      toast.error("Please select or enter the winning team")
      return
    }

    const actionData = new FormData()
    actionData.append("scrimId", selectedScrimId)
    actionData.append("winningTeam", winningTeam.trim())
    if (mvpPlayerName.trim()) actionData.append("mvpPlayerName", mvpPlayerName.trim())
    if (mvpTeamName.trim()) actionData.append("mvpTeamName", mvpTeamName.trim())
    actionData.append("kills", kills)
    actionData.append("placement", placement)
    actionData.append("prizeBdt", prizeBdt)
    actionData.append("category", winnerType)
    actionData.append("matchDate", selectedDate)
    if (uploadedUrls.length > 0) {
      actionData.append("imageUrlsJson", JSON.stringify(uploadedUrls))
    }

    startTransition(async () => {
      const res = await publishResult(null, actionData)
      if (res.ok) {
        toast.success("Historical result published successfully!")
        setOpen(false)
        setWinningTeam("")
        setMvpPlayerName("")
        setMvpTeamName("")
        setUploadedUrls([])
        router.refresh()
      } else {
        toast.error(res.error ?? "Failed to publish result")
      }
    })
  }

  const busy = uploading || isPending

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" className="glow-primary font-display font-bold uppercase gap-2">
            <Plus className="size-4" />
            Publish Result for Date
          </Button>
        }
      />
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Trophy className="size-5 text-primary" />
            Publish Result ({selectedDate})
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Target Scrim */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Select Scrim Lobby</Label>
            <Select
              value={selectedScrimId}
              onValueChange={(val) => {
                if (!val) return
                setSelectedScrimId(val)
                const target = scrims.find((s) => s.id === val)
                if (target?.prizePoolBdt) {
                  const wt = WINNER_TYPES.find((w) => w.id === winnerType)
                  if (wt && wt.defaultPrizePct > 0) {
                    setPrizeBdt(String(Math.round(target.prizePoolBdt * wt.defaultPrizePct)))
                  }
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select scrim..." />
              </SelectTrigger>
              <SelectContent>
                {scrims.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title} ({s.startTime})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Winner Category */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Category / Placement Type</Label>
            <Select
              value={winnerType}
              onValueChange={(val) => {
                if (val) handleWinnerTypeChange(val)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WINNER_TYPES.map((wt) => (
                  <SelectItem key={wt.id} value={wt.id}>
                    {wt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Winning Team */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Winning Team Name</Label>
              {confirmedTeams.length > 0 && (
                <span className="text-[11px] text-muted-foreground">Quick pick from roster</span>
              )}
            </div>
            {confirmedTeams.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pb-1 max-h-24 overflow-y-auto">
                {confirmedTeams.map((t, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setWinningTeam(t.teamName)
                      if (!mvpTeamName) setMvpTeamName(t.teamName)
                      if (!mvpPlayerName && t.captainName) setMvpPlayerName(t.captainName)
                    }}
                    className={cn(
                      "px-2 py-0.5 rounded text-xs border transition-colors",
                      winningTeam === t.teamName
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary/40 hover:bg-secondary border-border text-foreground"
                    )}
                  >
                    {t.teamName}
                  </button>
                ))}
              </div>
            )}
            <Input
              value={winningTeam}
              onChange={(e) => setWinningTeam(e.target.value)}
              placeholder="e.g. VIP ESPORTS"
              required
            />
          </div>

          {/* Stats: Placement, Kills, Prize */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Placement (Rank)</Label>
              <Input
                type="number"
                min="1"
                max="12"
                value={placement}
                onChange={(e) => setPlacement(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Total Kills</Label>
              <Input
                type="number"
                min="0"
                max="200"
                value={kills}
                onChange={(e) => setKills(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Prize (BDT)</Label>
              <Input
                type="number"
                min="0"
                max="100000"
                value={prizeBdt}
                onChange={(e) => setPrizeBdt(e.target.value)}
                required
              />
            </div>
          </div>

          {/* MVP Player & Team */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">MVP Player (Optional)</Label>
              <Input
                value={mvpPlayerName}
                onChange={(e) => setMvpPlayerName(e.target.value)}
                placeholder="e.g. VIP・ALPHA"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">MVP Team (Optional)</Label>
              <Input
                value={mvpTeamName}
                onChange={(e) => setMvpTeamName(e.target.value)}
                placeholder="e.g. VIP ESPORTS"
              />
            </div>
          </div>

          {/* Screenshots Upload */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Match Screenshot(s) / Scoreboard</Label>
            <div className="flex items-center gap-2">
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                disabled={busy}
                onChange={handleImageUpload}
                className="text-xs file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
              />
            </div>
            {uploading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                <Loader2 className="size-3.5 animate-spin text-primary" />
                <span>Uploading screenshots ({uploadProgress}%)...</span>
              </div>
            )}
            {uploadedUrls.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {uploadedUrls.map((url, idx) => (
                  <div key={idx} className="relative group size-16 rounded border overflow-hidden bg-black/40">
                    <Image src={url} alt={`Screenshot ${idx + 1}`} fill className="object-cover" />
                    <button
                      type="button"
                      onClick={() => setUploadedUrls((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute top-0.5 right-0.5 bg-black/70 hover:bg-red-600 text-white rounded p-0.5 opacity-80 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy} className="glow-primary font-bold">
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-1.5" />
                  Publishing...
                </>
              ) : (
                <>
                  <CheckCheck className="size-4 mr-1.5" />
                  Publish Result
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
