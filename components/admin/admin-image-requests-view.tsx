"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
} from "lucide-react"
import type { Booking, Scrim, ImageRequest } from "@/lib/db/schema"
import { formatDateTime, timeAgo } from "@/lib/format"
import { cn } from "@/lib/utils"

type Props = {
  scrims: Scrim[]
  bookingsByScrim: Record<string, (Booking & { userEmail: string | null })[]>
  allRequests: ImageRequest[]
}

export function AdminImageRequestsView({ scrims, bookingsByScrim, allRequests }: Props) {
  const [selectedScrimId, setSelectedScrimId] = useState<string>(scrims[0]?.id || "")
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState<"pending" | "submitted" | "all">("all")
  const [isPending, startTransition] = useTransition()
  const [localRequestedIds, setLocalRequestedIds] = useState<Record<string, boolean>>({})

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

  const handleRequestClick = (bookingId: string, teamName: string) => {
    startTransition(async () => {
      try {
        const res = await requestTeamImage(bookingId)
        if (res.ok) {
          setLocalRequestedIds((prev) => ({ ...prev, [bookingId]: true }))
          toast.success(res.message || `MVP Image requested for "${teamName}"`)
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
      {/* Top Banner Stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="glass rounded-xl p-4 border border-border/80">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground uppercase font-semibold">Active Scrims</span>
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

                  <p className="text-xs text-muted-foreground truncate">{req.scrimTitle}</p>

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
                  onClick={() => setSelectedScrimId(scrim.id)}
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
                            onClick={() => handleRequestClick(team.id, team.teamName)}
                          >
                            {isPending ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Camera className="size-3.5" />
                            )}
                            {isRequested ? "Request Again" : "Request MVP Image"}
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
    </div>
  )
}
