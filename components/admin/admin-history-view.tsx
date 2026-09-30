"use client"

import { useState, useTransition, useMemo } from "react"
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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
}

export function AdminHistoryView({
  dates = [],
  scrims = [],
  selectedDate,
  selectedScrimId = "all",
  bookings = [],
}: {
  dates: string[]
  scrims: ScrimOption[]
  selectedDate: string
  selectedScrimId?: string
  bookings: HistoricalBookingItem[]
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
          <div className="flex items-center gap-2 pt-2 sm:pt-0">
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
