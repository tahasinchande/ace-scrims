"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { requestTeamImage } from "@/app/actions/image-requests"
import { trashImageRequests } from "@/app/actions/admin"
import { toast } from "sonner"
import {
  Camera,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Search,
  Sparkles,
  Users,
  Image as ImageIcon,
  Clock,
  Copy,
  ChevronRight,
  Trash2,
  CheckSquare,
  Square,
  Calendar,
  History,
  Trophy,
} from "lucide-react"
import type { Booking, Scrim, ImageRequest } from "@/lib/db/schema"
import { formatDateTime, timeAgo } from "@/lib/format"
import { cn } from "@/lib/utils"

type Props = {
  scrims: Scrim[]
  bookingsByScrim: Record<string, (Booking & { userEmail: string | null })[]>
  allRequests: ImageRequest[]
  dates?: string[]
  selectedDate?: string
  todayDate?: string
  initialSelectedScrimId?: string
}

export function AdminImageRequestsView({
  scrims,
  bookingsByScrim,
  allRequests,
  dates = [],
  selectedDate: initialSelectedDate,
  todayDate,
  initialSelectedScrimId,
}: Props) {
  const router = useRouter()
  const [selectedDate, setSelectedDate] = useState<string>(initialSelectedDate || todayDate || "")
  const [selectedScrimId, setSelectedScrimId] = useState<string>(
    initialSelectedScrimId || scrims[0]?.id || ""
  )
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState<"pending" | "submitted" | "all">("all")
  const [isPending, startTransition] = useTransition()
  const [localRequestedIds, setLocalRequestedIds] = useState<Record<string, boolean>>({})

  // Request Photo Dialog State
  const [requestModalTeam, setRequestModalTeam] = useState<any | null>(null)
  const [inputMvpName, setInputMvpName] = useState("")
  const [requestType, setRequestType] = useState("MVP Image")

  const isToday = !selectedDate || selectedDate === todayDate

  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate)
    router.push(`/admin/image-requests?date=${encodeURIComponent(newDate)}&scrim=${encodeURIComponent(selectedScrimId)}`)
  }

  const handleScrimSelect = (scrimId: string) => {
    setSelectedScrimId(scrimId)
    router.push(`/admin/image-requests?date=${encodeURIComponent(selectedDate)}&scrim=${encodeURIComponent(scrimId)}`)
  }

  const selectedScrim = scrims.find((s) => s.id === selectedScrimId || s.slug === selectedScrimId)
  const roster = selectedScrimId ? (bookingsByScrim[selectedScrimId] || []) : []

  const filteredScrims = scrims.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.startTime.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const submittedRequests = allRequests.filter((r) => r.status === "submitted")
  const pendingRequests = allRequests.filter((r) => r.status === "pending")
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([])

  const allSubmittedSelected = submittedRequests.length > 0 && selectedRequestIds.length === submittedRequests.length

  const toggleSelectAllSubmitted = () => {
    if (allSubmittedSelected) {
      setSelectedRequestIds([])
    } else {
      setSelectedRequestIds(submittedRequests.map((r) => r.id))
    }
  }

  const toggleSelectRequest = (id: string) => {
    setSelectedRequestIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
  }

  const handleDeleteRequestsToTrash = (ids: string[]) => {
    if (ids.length === 0) return
    if (!window.confirm(`Move ${ids.length} photo request(s) to Trash?`)) return
    startTransition(async () => {
      const res = await trashImageRequests(ids)
      if (res.ok) {
        toast.success(`Moved ${res.count} image request(s) to Trash`)
        setSelectedRequestIds((prev) => prev.filter((id) => !ids.includes(id)))
      } else {
        toast.error(res.error || "Failed to move requests to trash")
      }
    })
  }

  const openRequestModal = (team: any) => {
    setRequestModalTeam(team)
    setInputMvpName(team.captainName || "")
    setRequestType("MVP Image")
  }

  const submitModalRequest = () => {
    if (!requestModalTeam) return
    const team = requestModalTeam
    startTransition(async () => {
      try {
        const res = await requestTeamImage(team.id, {
          mvpPlayerName: inputMvpName.trim() || null,
          requestType,
          scrimDate: selectedDate || undefined,
        })
        if (res.ok) {
          setLocalRequestedIds((prev) => ({ ...prev, [team.id]: true }))
          toast.success(res.message || `${requestType} requested for "${team.teamName}"`)
          setRequestModalTeam(null)
        } else {
          toast.error(res.error || "Failed to request image")
        }
      } catch (err: any) {
        toast.error(err?.message || "Failed to request image")
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Top Toolbar: Date Selector & Seamless History Switcher */}
      <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-primary" />
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Match Date:</span>
          </div>

          <Select value={selectedDate} onValueChange={(val) => val && handleDateChange(val)}>
            <SelectTrigger className="w-[200px] h-9 text-xs font-semibold bg-background/80">
              <SelectValue placeholder="Select Match Date" />
            </SelectTrigger>
            <SelectContent>
              {todayDate && (
                <SelectItem value={todayDate} className="text-xs font-bold text-emerald-400">
                  Today ({todayDate}) · Live
                </SelectItem>
              )}
              {dates
                .filter((d) => d !== todayDate)
                .map((d) => (
                  <SelectItem key={d} value={d} className="text-xs">
                    {d} (Historical Archive)
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          <Badge
            variant="outline"
            className={cn(
              "text-xs font-mono",
              isToday
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                : "bg-primary/10 text-primary border-primary/30"
            )}
          >
            {isToday ? "Live Active Scrims" : `Archived Date: ${selectedDate}`}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="h-9 gap-1.5 text-xs font-semibold">
            <Link href={`/admin/history?date=${encodeURIComponent(selectedDate)}&scrim=${encodeURIComponent(selectedScrimId)}`}>
              <History className="size-3.5 text-primary" />
              Open in Match History Archive →
            </Link>
          </Button>
        </div>
      </div>

      {/* Top Banner Stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="glass rounded-xl p-4 border border-border/80">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase font-semibold">
              {isToday ? "Active Scrims" : "Archived Scrims"}
            </span>
            <Users className="size-4 text-primary" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold">{scrims.length}</p>
        </div>
        <div className="glass rounded-xl p-4 border border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-amber-300 uppercase font-semibold">Pending Submissions</span>
            <Clock className="size-4 text-amber-400" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-amber-400">{pendingRequests.length}</p>
        </div>
        <div className="glass rounded-xl p-4 border border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-emerald-300 uppercase font-semibold">Photos Received</span>
            <CheckCircle2 className="size-4 text-emerald-400" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-emerald-400">{submittedRequests.length}</p>
        </div>
      </div>

      {/* Submitted Photos Gallery Section */}
      {submittedRequests.length > 0 && (
        <section className="glass rounded-2xl border border-primary/30 p-5 md:p-6 flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/40 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              <h2 className="font-display text-lg font-bold uppercase tracking-wide">
                Recent Player Photo Submissions ({submittedRequests.length})
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {selectedRequestIds.length > 0 && (
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={isPending}
                  onClick={() => handleDeleteRequestsToTrash(selectedRequestIds)}
                  className="h-8 gap-1.5 text-xs"
                >
                  <Trash2 className="size-3.5" /> Move to Trash ({selectedRequestIds.length})
                </Button>
              )}
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40">
                Ready for Banner Design
              </Badge>
            </div>
          </div>

          <div className="flex items-center justify-between py-1">
            <button
              type="button"
              onClick={toggleSelectAllSubmitted}
              className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              {allSubmittedSelected ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4" />}
              <span>{selectedRequestIds.length > 0 ? `${selectedRequestIds.length} submission(s) selected` : "Select all submissions"}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {submittedRequests.map((req) => {
              const urls = (req.uploadedImageUrls as string[]) || []
              const isSelected = selectedRequestIds.includes(req.id)
              return (
                <div
                  key={req.id}
                  className={`rounded-xl border bg-background/60 p-4 flex flex-col gap-3 transition-all ${
                    isSelected ? "border-primary bg-primary/5 shadow-md" : "border-border/80"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={() => toggleSelectRequest(req.id)}
                        className="p-1 text-muted-foreground hover:text-foreground"
                      >
                        {isSelected ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4" />}
                      </button>
                      <span className="font-display font-bold text-foreground truncate">
                        {req.submittedTeamName || req.teamName}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="outline" className="text-[10px] font-mono">
                        UID: {req.submittedPlayerUid || req.captainUid}
                      </Badge>
                      <button
                        type="button"
                        onClick={() => handleDeleteRequestsToTrash([req.id])}
                        title="Move to Trash"
                        className="p-1 text-muted-foreground hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <p className="text-muted-foreground truncate">{req.scrimTitle}</p>
                    {req.scrimDate && (
                      <span className="text-[10px] text-muted-foreground font-mono">({req.scrimDate})</span>
                    )}
                  </div>

                  {(req.mvpPlayerName || req.submittedPlayerName) && (
                    <div className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 text-xs">
                      <Trophy className="size-3 text-emerald-400 shrink-0" />
                      <span className="text-emerald-300 font-semibold truncate">
                        MVP: {req.submittedPlayerName || req.mvpPlayerName}
                      </span>
                    </div>
                  )}

                  {/* Photo Previews */}
                  {urls.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2">
                      {urls.map((url, uIdx) => (
                        <div key={uIdx} className="group relative rounded-lg border border-border/60 bg-black/20 overflow-hidden">
                          <img
                            src={url}
                            alt={`Photo ${uIdx + 1}`}
                            className="w-full h-32 object-contain bg-black/40"
                          />
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute bottom-1 right-1 rounded bg-black/80 px-1.5 py-0.5 text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
                          >
                            <ExternalLink className="size-2.5" /> Full
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-xs text-muted-foreground">No photos attached</div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-border/40 text-[11px] text-muted-foreground">
                    <span>Submitted {req.submittedAt ? timeAgo(req.submittedAt) : "recently"}</span>
                    {urls[0] && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs gap-1"
                        onClick={() => {
                          navigator.clipboard.writeText(urls[0])
                          toast.success("Image URL copied to clipboard")
                        }}
                      >
                        <Copy className="size-3" /> Copy URL
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {/* Main Scrim & Team Selector for Requesting Images */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Scrim Selector */}
        <div className="lg:col-span-4 flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search scrims..."
              className="pl-9 text-xs"
            />
          </div>

          <div className="flex flex-col gap-2 max-h-[70vh] overflow-y-auto pr-1">
            {filteredScrims.map((scrim) => {
              const isSelected = scrim.id === selectedScrimId || scrim.slug === selectedScrimId
              const teams = bookingsByScrim[scrim.id] || []
              return (
                <button
                  key={scrim.id}
                  type="button"
                  onClick={() => handleScrimSelect(scrim.id)}
                  className={cn(
                    "flex flex-col gap-1.5 rounded-xl p-3.5 text-left border transition-all",
                    isSelected
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-border/60 bg-secondary/20 hover:border-border hover:bg-secondary/40"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display text-sm font-bold text-foreground truncate">
                      {scrim.title}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      {scrim.startTime}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{scrim.map}</span>
                    <span className="font-mono font-medium text-foreground">
                      {teams.length} registered
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Right Column: Registered Teams & Request Actions */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {selectedScrim ? (
            <div className="glass rounded-2xl border border-border/80 p-5 md:p-6 flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
                <div>
                  <h2 className="font-display text-xl font-bold uppercase tracking-wide">
                    {selectedScrim.title}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {selectedScrim.startTime} · {selectedScrim.map} · {roster.length} registered teams
                  </p>
                </div>
                <Badge className="bg-primary/20 text-primary border-primary/30">
                  Select a team below to request photo
                </Badge>
              </div>

              {roster.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No teams registered for this scrim yet.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {roster.map((team) => {
                    const isRequested = localRequestedIds[team.id] || team.imageRequested
                    return (
                      <div
                        key={team.id}
                        className={cn(
                          "rounded-xl border p-4 flex flex-col gap-3 transition-all",
                          isRequested
                            ? "border-emerald-500/30 bg-emerald-950/10"
                            : "border-border/70 bg-secondary/20 hover:border-primary/40"
                        )}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-display text-base font-bold text-foreground">
                              {team.teamName}
                            </span>
                            {team.slotNumber && <Badge variant="secondary">Slot {team.slotNumber}</Badge>}
                            <Badge variant={team.status === "confirmed" ? "default" : "secondary"}>
                              {team.status}
                            </Badge>
                          </div>
                          {isRequested && (
                            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-400">
                              <CheckCircle2 className="size-3.5" /> Request Sent
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2 text-muted-foreground">
                          <div>
                            <span className="text-foreground font-medium">Leader: </span>
                            {team.captainName} ({team.captainUid})
                          </div>
                          <div>
                            <span className="text-foreground font-medium">WhatsApp: </span>
                            {team.phone}
                          </div>
                          {team.paymentNumber && (
                            <div>
                              <span className="text-foreground font-medium">Payment No: </span>
                              <span className="font-mono text-primary font-semibold">{team.paymentNumber}</span>
                            </div>
                          )}
                          {team.teamMembersDriveLink && (
                            <div>
                              <a
                                href={team.teamMembersDriveLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-primary underline truncate hover:text-primary/80"
                              >
                                <ExternalLink className="size-3" /> Team Drive Folder
                              </a>
                            </div>
                          )}
                        </div>

                        {/* Team leader image preview if uploaded during booking */}
                        {team.teamLeaderImageUrl && (
                          <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/50 p-2">
                            <img
                              src={team.teamLeaderImageUrl}
                              alt={team.captainName}
                              className="size-10 rounded object-cover border border-border"
                            />
                            <div className="min-w-0 flex-1 text-xs">
                              <p className="font-semibold text-foreground">Uploaded at Registration</p>
                              <a
                                href={team.teamLeaderImageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary underline text-[11px]"
                              >
                                View full photo
                              </a>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-border/40">
                          <span className="text-[11px] text-muted-foreground">
                            UID: {team.captainUid}
                          </span>
                          <Button
                            size="sm"
                            disabled={isPending}
                            variant={isRequested ? "secondary" : "default"}
                            className={cn(
                              "gap-1.5 text-xs font-bold uppercase",
                              isRequested
                                ? "border border-emerald-500/40 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
                                : "glow-primary"
                            )}
                            onClick={() => openRequestModal(team)}
                          >
                            <Camera className="size-3.5" />
                            {isRequested ? "Request Again" : "Request MVP Photo"}
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="glass rounded-2xl p-12 text-center text-sm text-muted-foreground">
              Select a scrim on the left to view registered teams.
            </div>
          )}
        </div>
      </div>

      {/* Modal for Requesting MVP Photo with Explicit Player Name Input */}
      {requestModalTeam && (
        <Dialog open={!!requestModalTeam} onOpenChange={(open) => !open && setRequestModalTeam(null)}>
          <DialogContent className="max-w-md border-border/80 bg-zinc-950 p-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-display text-lg uppercase">
                <Camera className="size-5 text-primary" />
                Request Player Photo / Assets
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-4 text-xs">
              <div className="rounded-xl bg-secondary/50 p-3 border border-border/60 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground text-sm">{requestModalTeam.teamName}</span>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    UID: {requestModalTeam.captainUid}
                  </Badge>
                </div>
                <div className="text-muted-foreground">
                  Match: <strong className="text-foreground">{selectedScrim?.title}</strong> · {selectedDate}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mvp-name" className="text-xs font-semibold text-foreground">
                  MVP Player Name (Optional or Specific Player)
                </Label>
                <Input
                  id="mvp-name"
                  value={inputMvpName}
                  onChange={(e) => setInputMvpName(e.target.value)}
                  placeholder="e.g. Abrar / RAJ-77 (leave blank or specify MVP)"
                  className="h-9 text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  The captain will see this name and be asked to upload the player&apos;s waist-up photo.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="req-type" className="text-xs font-semibold text-foreground">
                  Request Asset Type
                </Label>
                <Select value={requestType} onValueChange={(val) => val && setRequestType(val)}>
                  <SelectTrigger id="req-type" className="h-9 text-xs bg-background/80">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MVP Image" className="text-xs">
                      MVP Image (Waist-up Player Cutout)
                    </SelectItem>
                    <SelectItem value="Winner Team Photo" className="text-xs">
                      Winner Team Photo (Podium Banner)
                    </SelectItem>
                    <SelectItem value="Top 3 Banner Photo" className="text-xs">
                      Top 3 Banner Photo
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/40">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setRequestModalTeam(null)}
                  disabled={isPending}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={submitModalRequest}
                  disabled={isPending}
                  className="gap-1.5 text-xs font-bold glow-primary"
                >
                  {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                  Send Photo Request
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
