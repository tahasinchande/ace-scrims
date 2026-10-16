"use client"

import { useState, useTransition, useEffect } from "react"
import { queryHistoricalScrimsAction, bulkDeleteBookings } from "@/app/actions/admin"
import type { HistoricalScrimMeta, HistoricalRosterBooking } from "@/lib/queries/admin"
import { PublishResultButton } from "@/components/admin/admin-results"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { formatTaka, formatDateTime, sortScrimsAscending } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  Calendar as CalendarIcon,
  Search,
  Users,
  Trophy,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  Trash2,
  CheckSquare,
  Square,
  Loader2,
  Clock,
  Layers,
  Phone,
  CreditCard,
  Image as ImageIcon,
  Flame,
} from "lucide-react"
import { toast } from "sonner"

export function HistoricalScrimView({
  initialDate,
  availableDates = [],
  isAdmin = true,
}: {
  initialDate: string
  availableDates?: string[]
  isAdmin?: boolean
}) {
  const [selectedDate, setSelectedDate] = useState(initialDate)
  const [selectedScrimId, setSelectedScrimId] = useState<string>("")
  const [scrims, setScrims] = useState<HistoricalScrimMeta[]>([])
  const [selectedScrim, setSelectedScrim] = useState<HistoricalScrimMeta | null>(null)
  const [roster, setRoster] = useState<HistoricalRosterBooking[]>([])
  const [result, setResult] = useState<any>(null)
  const [isPending, startTransition] = useTransition()
  const [selectedBookingIds, setSelectedBookingIds] = useState<string[]>([])
  const [isBulkDeleting, startBulkDelete] = useTransition()

  // Load data when date or scrimId changes
  function fetchData(date: string, scrimId?: string) {
    startTransition(async () => {
      const res = await queryHistoricalScrimsAction(date, scrimId)
      if (res.ok && res.data) {
        const sorted = sortScrimsAscending(res.data.scrims)
        setScrims(sorted)
        setSelectedScrim(res.data.selectedScrim)
        if (res.data.selectedScrim) {
          setSelectedScrimId(res.data.selectedScrim.id)
        }
        setRoster(res.data.roster)
        setResult(res.data.result)
        setSelectedBookingIds([])
      } else {
        toast.error(res.error || "Failed to load historical match data")
      }
    })
  }

  useEffect(() => {
    fetchData(selectedDate)
  }, [selectedDate])

  const handleSelectScrim = (scrimId: string) => {
    setSelectedScrimId(scrimId)
    fetchData(selectedDate, scrimId)
  }

  // Quick preset dates
  const handleQuickDate = (daysAgo: number) => {
    const d = new Date()
    d.setDate(d.getDate() - daysAgo)
    const dateStr = d.toISOString().slice(0, 10)
    setSelectedDate(dateStr)
  }

  // Copy formatted roster for WhatsApp / Discord announcements
  const handleCopyRoster = () => {
    if (!selectedScrim || roster.length === 0) {
      toast.error("No registered teams in this historical scrim to copy.")
      return
    }

    const lines: string[] = [
      `🏆 ACE SCRIMS — ${selectedScrim.title.toUpperCase()}`,
      `📅 Match Date: ${selectedDate} | ⏰ Time: ${selectedScrim.startTime} | 🗺️ Map: ${selectedScrim.map}`,
      `💰 Entry: ${formatTaka(selectedScrim.priceBdt)} | Prize: ${formatTaka(selectedScrim.prizePoolBdt)}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📋 CONFIRMED TEAM ROSTER (${roster.length}/${selectedScrim.maxTeams}):`,
    ]

    roster.forEach((team, index) => {
      const slot = team.slotNumber ?? index + 1
      const tag = team.discordTelegram ? ` [${team.discordTelegram}]` : ""
      lines.push(`Slot ${slot}: ${team.teamName}${tag} (Leader: ${team.captainName} | UID: ${team.captainUid})`)
    })

    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    lines.push(`Official Ace Scrims • www.acescrims.online`)

    navigator.clipboard.writeText(lines.join("\n"))
    toast.success("Team roster copied to clipboard!")
  }

  // Bulk Delete Selected Bookings
  const handleBulkDeleteBookings = () => {
    if (selectedBookingIds.length === 0) return
    if (!confirm(`Are you sure you want to delete ${selectedBookingIds.length} booking(s)? They will be moved to the Trash.`)) return

    startBulkDelete(async () => {
      const res = await bulkDeleteBookings(selectedBookingIds)
      if (res.ok) {
        toast.success(`Deleted ${res.count} team booking(s)`)
        setSelectedBookingIds([])
        fetchData(selectedDate, selectedScrimId)
      } else {
        toast.error(res.error || "Failed to delete selected bookings")
      }
    })
  }

  const allSelected = roster.length > 0 && selectedBookingIds.length === roster.length

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedBookingIds([])
    } else {
      setSelectedBookingIds(roster.map((b) => b.id))
    }
  }

  const toggleSelectOne = (id: string) => {
    setSelectedBookingIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Date Query Control Bar */}
      <div className="rounded-2xl border border-border/80 bg-card/60 p-4 sm:p-5 backdrop-blur-xl flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <CalendarIcon className="size-4" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold uppercase tracking-wider text-foreground">
                Historical Scrim Archive
              </h2>
              <p className="text-xs text-muted-foreground">
                Query past days' confirmed team lists, payment proofs, and calculate match results.
              </p>
            </div>
          </div>

          {/* Date Picker Input */}
          <div className="flex items-center gap-2">
            <Label htmlFor="historical-date-input" className="sr-only">Query Date</Label>
            <Input
              id="historical-date-input"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-44 font-mono text-sm bg-background border-border"
            />
            {isPending && <Loader2 className="size-4 animate-spin text-primary" />}
          </div>
        </div>

        {/* Quick Date Presets */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/40 text-xs">
          <span className="text-muted-foreground font-medium mr-1">Quick Select:</span>
          <Button
            type="button"
            size="sm"
            variant={selectedDate === new Date().toISOString().slice(0, 10) ? "default" : "outline"}
            className="h-7 text-xs px-2.5 rounded-lg"
            onClick={() => handleQuickDate(0)}
          >
            Today
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs px-2.5 rounded-lg"
            onClick={() => handleQuickDate(1)}
          >
            Yesterday
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs px-2.5 rounded-lg"
            onClick={() => handleQuickDate(2)}
          >
            2 Days Ago
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs px-2.5 rounded-lg"
            onClick={() => handleQuickDate(7)}
          >
            1 Week Ago
          </Button>
        </div>
      </div>

      {/* Scrim Selector Grid for chosen date */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Matches for {selectedDate} ({scrims.length} scheduled lobbies)
          </h3>
          <span className="text-xs text-muted-foreground">
            Click any scrim to view its historical roster
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {scrims.map((scrim) => {
            const isSelected = selectedScrim?.id === scrim.id || selectedScrim?.slug === scrim.id
            return (
              <button
                key={scrim.id}
                type="button"
                onClick={() => handleSelectScrim(scrim.id)}
                className={cn(
                  "flex flex-col gap-1.5 rounded-xl border p-3 text-left transition-all cursor-pointer relative",
                  isSelected
                    ? "border-primary bg-primary/10 shadow-md ring-1 ring-primary/40"
                    : "border-border/60 bg-card/40 hover:border-primary/40 hover:bg-card/70"
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-mono text-xs font-bold text-foreground">
                    {scrim.startTime}
                  </span>
                  {scrim.hasResult ? (
                    <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-400 text-[10px] px-1 py-0">
                      Result
                    </Badge>
                  ) : scrim.confirmedCount > 0 ? (
                    <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-[10px] px-1 py-0">
                      {scrim.confirmedCount} Booked
                    </Badge>
                  ) : null}
                </div>
                <p className="truncate text-xs font-semibold text-foreground/90">
                  {scrim.title}
                </p>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{scrim.map}</span>
                  <span className={scrim.confirmedCount > 0 ? "font-bold text-primary" : ""}>
                    {scrim.confirmedCount}/{scrim.maxTeams}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected Historical Scrim Details & Roster */}
      {selectedScrim ? (
        <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-lg">
          {/* Header & Meta Banner */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono">
                  {selectedScrim.startTime}
                </Badge>
                <Badge variant="outline">{selectedScrim.map}</Badge>
                <Badge variant="outline">{selectedScrim.category}</Badge>
                {result ? (
                  <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <CheckCircle2 className="size-3 mr-1" /> Result Published
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-amber-400 bg-amber-500/10 border border-amber-500/30">
                    <AlertCircle className="size-3 mr-1" /> Pending Result Calculation
                  </Badge>
                )}
              </div>
              <h2 className="font-display text-xl font-bold uppercase tracking-wide text-foreground">
                {selectedScrim.title} — {selectedDate}
              </h2>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Entry: {formatTaka(selectedScrim.priceBdt)}</span>
                <span>Prize Pool: {formatTaka(selectedScrim.prizePoolBdt)}</span>
                <span className="font-medium text-foreground">
                  Revenue Collected: {formatTaka(roster.length * selectedScrim.priceBdt)} ({roster.length} teams)
                </span>
              </div>
            </div>

            {/* Actions: Copy Roster & Publish Result */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyRoster}
                className="gap-1.5 text-xs font-semibold"
                disabled={roster.length === 0}
              >
                <Copy className="size-3.5" /> Copy Team Roster
              </Button>

              <PublishResultButton
                scrims={[{
                  id: selectedScrim.id,
                  title: selectedScrim.title,
                  startTime: selectedScrim.startTime,
                  prizePoolBdt: selectedScrim.prizePoolBdt,
                }]}
                bookingsByScrim={{
                  [selectedScrim.id]: roster,
                  ...(selectedScrim.slug ? { [selectedScrim.slug]: roster } : {}),
                }}
                defaultScrimId={selectedScrim.id}
              />
            </div>
          </div>

          {/* If Result is Already Published, Display Result Highlights */}
          {result && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/15 p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400">
                  <Trophy className="size-4" /> Published Match Result
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  Recorded on {selectedDate}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
                <div className="rounded-lg bg-background/60 p-2.5 border border-border">
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Champion</span>
                  <span className="font-bold text-foreground text-sm truncate block">{result.winningTeam}</span>
                </div>
                {result.mvpPlayerName && (
                  <div className="rounded-lg bg-background/60 p-2.5 border border-border">
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">MVP Fragger</span>
                    <span className="font-bold text-primary text-sm truncate block">{result.mvpPlayerName}</span>
                  </div>
                )}
                <div className="rounded-lg bg-background/60 p-2.5 border border-border">
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Prize Awarded</span>
                  <span className="font-bold text-emerald-400 text-sm block">{formatTaka(result.prizeBdt)}</span>
                </div>
                <div className="rounded-lg bg-background/60 p-2.5 border border-border">
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Category</span>
                  <span className="font-semibold text-foreground text-sm truncate block">{result.category}</span>
                </div>
              </div>
            </div>
          )}

          {/* Roster Controls: Bulk selection */}
          <div className="flex items-center justify-between gap-2 pt-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleSelectAll}
                disabled={roster.length === 0}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
              >
                {allSelected ? (
                  <CheckSquare className="size-4 text-primary" />
                ) : (
                  <Square className="size-4" />
                )}
                <span>Select All ({roster.length})</span>
              </button>

              {selectedBookingIds.length > 0 && (
                <span className="text-xs text-primary font-medium">
                  {selectedBookingIds.length} selected
                </span>
              )}
            </div>

            {isAdmin && selectedBookingIds.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={handleBulkDeleteBookings}
                disabled={isBulkDeleting}
                className="gap-1.5 text-xs h-8"
              >
                {isBulkDeleting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
                Delete Selected ({selectedBookingIds.length})
              </Button>
            )}
          </div>

          {/* Roster List Table */}
          {roster.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center flex flex-col items-center justify-center gap-2">
              <Users className="size-8 text-muted-foreground/40" />
              <p className="text-sm font-semibold text-muted-foreground">
                No confirmed teams found for this scrim on {selectedDate}.
              </p>
              <p className="text-xs text-muted-foreground/75">
                Teams registered on this day are preserved here after daily reset.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {roster.map((team, index) => {
                const isSelected = selectedBookingIds.includes(team.id)
                return (
                  <div
                    key={team.id}
                    className={cn(
                      "rounded-xl border p-4 transition-all flex flex-col gap-3",
                      isSelected
                        ? "border-primary/60 bg-primary/[0.04]"
                        : "border-border/70 bg-card/60 hover:border-border"
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => toggleSelectOne(team.id)}
                          className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="size-4 text-primary" />
                          ) : (
                            <Square className="size-4" />
                          )}
                        </button>
                      )}

                      <Badge variant="secondary" className="font-mono font-bold text-xs">
                        Slot {team.slotNumber ?? index + 1}
                      </Badge>

                      <span className="font-display font-bold text-base text-foreground">
                        {team.teamName}
                      </span>

                      {team.discordTelegram && (
                        <Badge variant="outline" className="text-xs font-mono">
                          Tag: {team.discordTelegram}
                        </Badge>
                      )}

                      <Badge
                        variant={team.status === "confirmed" ? "default" : "secondary"}
                        className="capitalize text-xs ml-auto"
                      >
                        {team.status}
                      </Badge>
                    </div>

                    {/* Team Details Grid */}
                    <div className="grid grid-cols-1 gap-x-6 gap-y-2 text-xs sm:grid-cols-2 md:grid-cols-3 text-muted-foreground pt-1 border-t border-border/40">
                      <div>
                        <span className="text-foreground/70 font-semibold block">Captain</span>
                        <span className="text-foreground">{team.captainName}</span>
                        <span className="block font-mono text-[11px] text-muted-foreground">
                          UID: {team.captainUid}
                        </span>
                      </div>

                      <div>
                        <span className="text-foreground/70 font-semibold block">Contact Phone</span>
                        <a
                          href={`tel:${team.phone}`}
                          className="text-foreground hover:text-primary transition-colors flex items-center gap-1"
                        >
                          <Phone className="size-3" /> {team.phone}
                        </a>
                        {team.paymentNumber && (
                          <span className="block font-mono text-[11px] text-muted-foreground">
                            Sender: {team.paymentNumber}
                          </span>
                        )}
                      </div>

                      <div>
                        <span className="text-foreground/70 font-semibold block">Payment Info</span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge variant="outline" className="text-[10px] font-mono font-bold uppercase px-1.5 py-0 border-primary/40 text-primary bg-primary/10">
                            {team.paymentMethod || "bKash"}
                          </Badge>
                          <span className="font-mono text-foreground text-xs">
                            {team.transactionId ? `Trx: ${team.transactionId}` : team.invoiceId ? `Inv: ${team.invoiceId}` : "Online Payment"}
                          </span>
                        </div>
                        {team.paymentNumber && (
                          <span className="block font-mono text-[11px] text-muted-foreground mt-0.5">
                            Account: {team.paymentNumber}
                          </span>
                        )}
                        <span className="block text-[10px] text-muted-foreground">
                          Registered: {formatDateTime(team.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Team photo or screenshot if present */}
                    {team.teamLeaderImageUrl && (
                      <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-background/50 p-2 text-xs">
                        <img
                          src={team.teamLeaderImageUrl}
                          alt={`${team.captainName} proof`}
                          className="size-10 rounded object-cover border border-border"
                        />
                        <div className="min-w-0 flex-1">
                          <span className="font-semibold text-foreground block">Proof / Leader Photo</span>
                          <a
                            href={team.teamLeaderImageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-primary hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="size-3" /> View full photo
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
