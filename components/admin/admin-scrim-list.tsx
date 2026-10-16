"use client"

import { useActionState, useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { publishRoom, unpublishRoom } from "@/app/actions/staff"
import { deleteScrim, restoreScrim, permanentlyDeleteScrim, bulkDeleteScrims, toggleRegistration, toggleScrimStatus, toggleScrimHidden, setSetting } from "@/app/actions/admin"
import { EditScrimButton } from "@/components/admin/scrim-form-dialog"
import { PublishResultButton } from "@/components/admin/admin-results"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import type { Booking, Scrim } from "@/lib/db/schema"
import { formatTaka, timeAgo, formatDateTime, sortScrimsAscending } from "@/lib/format"
import { cn } from "@/lib/utils"
import { KeyRound, Loader2, Lock, Trash2, Users, Eye, EyeOff, AlertTriangle, Search, Trophy, Flame, Layers, RotateCcw, CalendarDays, CheckSquare, Square, Camera, CheckCircle2, ExternalLink, Image as ImageIcon } from "lucide-react"
import { toast } from "sonner"

type AdminScrim = Scrim & { confirmedTeams: number; pendingTeams: number; deletedAt?: Date | string | null }
type RosterBooking = Booking & { userEmail: string | null }

function formatRegistrationDate(date: Date | string | null | undefined): string {
  if (!date) return "N/A"
  try {
    const formatted = formatDateTime(date)
    return formatted || "N/A"
  } catch {
    return "N/A"
  }
}

const initialState = { ok: false, error: null as string | null }

function PublishRoomButton({ scrim }: { scrim: AdminScrim }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(publishRoom, initialState)

  useEffect(() => {
    if (state.ok) {
      toast.success("Room details published — participants notified")
      setOpen(false)
    } else if (state.error) {
      toast.error(state.error)
    }
  }, [state])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant={scrim.roomPublished ? "secondary" : "default"}>
            <KeyRound className="size-3.5" />
            {scrim.roomPublished ? "Update Room" : "Publish Room"}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display uppercase">
            Room — {scrim.title}
          </DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="scrimId" value={scrim.id} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`room-${scrim.id}`}>Room ID</Label>
            <Input
              id={`room-${scrim.id}`}
              name="roomId"
              required
              maxLength={50}
              defaultValue={scrim.roomId ?? ""}
              placeholder="e.g. 5523891"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`pass-${scrim.id}`}>Password</Label>
            <Input
              id={`pass-${scrim.id}`}
              name="roomPassword"
              required
              maxLength={50}
              defaultValue={scrim.roomPassword ?? ""}
              placeholder="e.g. ace123"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Publishing instantly reveals these to every confirmed team and sends them a
            notification.
          </p>
          <Button type="submit" disabled={pending} className="font-display font-bold uppercase">
            {pending && <Loader2 className="size-4 animate-spin" />}
            Publish to Teams
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function statusBadgeVariant(status: string) {
  if (status === "confirmed") return "default" as const
  if (status === "pending") return "secondary" as const
  return "outline" as const
}

function RequestImageButton({
  bookingId,
  teamName,
  alreadyRequested,
}: {
  bookingId: string
  teamName: string
  alreadyRequested?: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [requested, setRequested] = useState(alreadyRequested || false)

  return (
    <Button
      size="sm"
      variant={requested ? "secondary" : "outline"}
      disabled={isPending}
      className={cn(
        "gap-1.5 text-xs font-semibold uppercase tracking-wider",
        requested
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
          : "border-primary/50 text-primary hover:bg-primary/10"
      )}
      onClick={() => {
        startTransition(async () => {
          try {
            const { requestTeamImage } = await import("@/app/actions/image-requests")
            const res = await requestTeamImage(bookingId)
            if (res.ok) {
              setRequested(true)
              toast.success(res.message || `MVP Image requested for "${teamName}"`)
            } else {
              toast.error(res.error || "Failed to request image")
            }
          } catch (err: any) {
            toast.error(err?.message || "Failed to request image")
          }
        })
      }}
    >
      {isPending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : requested ? (
        <CheckCircle2 className="size-3.5 text-emerald-400" />
      ) : (
        <Camera className="size-3.5 text-primary" />
      )}
      {requested ? "Image Requested" : "Request MVP Image"}
    </Button>
  )
}

function ViewTeamsButton({
  scrim,
  roster,
  confirmedCount,
}: {
  scrim: AdminScrim
  roster: RosterBooking[]
  confirmedCount?: number
}) {
  const count = confirmedCount ?? roster.length ?? scrim.confirmedTeams ?? 0
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            <Users className="size-3.5" />
            Teams ({count}/{scrim.maxTeams})
          </Button>
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display uppercase">
            Registered Teams — {scrim.title} ({count}/{scrim.maxTeams})
          </DialogTitle>
        </DialogHeader>
        {roster.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No teams registered yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {roster.map((b) => (
              <li key={b.id} className="rounded-xl border border-border bg-secondary/30 p-4 flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-base font-bold">{b.teamName}</span>
                  {b.slotNumber != null && (
                    <Badge variant="secondary">Slot {b.slotNumber}</Badge>
                  )}
                  <Badge variant={statusBadgeVariant(b.status)} className="capitalize">
                    {b.status}
                  </Badge>
                  <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                    <CalendarDays className="size-3 text-primary/70" />
                    <span suppressHydrationWarning>{formatRegistrationDate(b.createdAt)}</span>
                    <span className="text-[10px] text-muted-foreground/75" suppressHydrationWarning>({timeAgo(b.createdAt)})</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  <span>
                    <span className="text-muted-foreground">Team Leader: </span>
                    {b.captainName}
                  </span>
                  <span>
                    <span className="text-muted-foreground">Team Tag: </span>
                    {b.captainUid}
                  </span>
                  <span>
                    <span className="text-muted-foreground">WhatsApp: </span>
                    {b.phone}
                  </span>
                  {b.paymentNumber && (
                    <span>
                      <span className="text-muted-foreground">Payment Number: </span>
                      <span className="font-mono text-xs font-semibold text-primary">{b.paymentNumber}</span>
                    </span>
                  )}
                  {b.userEmail && (
                    <span className="truncate">
                      <span className="text-muted-foreground">Account: </span>
                      {b.userEmail}
                    </span>
                  )}
                  {b.teamMembersDriveLink && (
                    <a
                      href={b.teamMembersDriveLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary underline truncate hover:text-primary/80"
                    >
                      <ExternalLink className="size-3" /> Team Drive Folder
                    </a>
                  )}
                </div>

                {/* Team Leader photo if uploaded */}
                {b.teamLeaderImageUrl && (
                  <div className="flex items-center gap-3 rounded-lg border border-border/80 bg-background/60 p-2.5">
                    <img
                      src={b.teamLeaderImageUrl}
                      alt={b.captainName}
                      className="size-12 rounded object-cover border border-border"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-foreground">Team Leader Photo Attached</p>
                      <a
                        href={b.teamLeaderImageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-primary underline truncate block"
                      >
                        View Full Image
                      </a>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-1 border-t border-border/40">
                  <span className="text-[11px] text-muted-foreground">
                    Player UID: {b.captainUid}
                  </span>
                  <RequestImageButton
                    bookingId={b.id}
                    teamName={b.teamName}
                    alreadyRequested={b.imageRequested}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}

function AdminControls({ scrim }: { scrim: AdminScrim }) {
  const [isPending, startTransition] = useTransition()

  return (
    <>
      <EditScrimButton scrim={scrim} />
      <select
        value={scrim.status}
        disabled={isPending}
        onChange={(e) => {
          const nextStatus = e.target.value as "upcoming" | "live" | "registration_closed" | "completed" | "not_hosted"
          if (nextStatus === "not_hosted") {
            if (!window.confirm(`Mark "${scrim.title}" as NOT HOSTED? Registered teams will be moved to the Not Hosted section for refund processing.`)) return
            startTransition(async () => {
              try {
                const { markScrimNotHosted } = await import("@/app/actions/not-hosted")
                const res = await markScrimNotHosted(scrim.id)
                if (res.ok) toast.success(res.message || "Marked as Not Hosted")
                else toast.error(res.error || "Failed to mark as not hosted")
              } catch (err: any) {
                toast.error(err?.message || "Failed to mark as not hosted")
              }
            })
            return
          }

          startTransition(async () => {
            try {
              const res = await toggleScrimStatus(scrim.id, nextStatus)
              if (res?.ok) {
                toast.success(`Scrim status set to ${nextStatus}`)
              } else {
                toast.error(res?.error || "Failed to update status")
              }
            } catch (err: any) {
              toast.error(err?.message || "Failed to update status")
            }
          })
        }}
        className="h-8 rounded-md border border-border bg-background px-2 text-xs font-semibold"
      >
        <option value="upcoming">Upcoming</option>
        <option value="live">Live</option>
        <option value="registration_closed">Closed</option>
        <option value="completed">Completed</option>
        <option value="not_hosted">Not Hosted</option>
      </select>
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            try {
              const res = await toggleRegistration(scrim.id, !scrim.registrationOpen)
              if (res?.ok) {
                toast.success(scrim.registrationOpen ? "Registration closed" : "Registration opened")
              } else {
                toast.error(res?.error || "Failed to toggle registration")
              }
            } catch (err: any) {
              toast.error(err?.message || "Failed to toggle registration")
            }
          })
        }
      >
        <Lock className="size-3.5" />
        {scrim.registrationOpen ? "Close Reg" : "Open Reg"}
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
        disabled={isPending}
        onClick={() => {
          if (!window.confirm(`Mark "${scrim.title}" as NOT HOSTED? Registered teams will be moved to Not Hosted section for refund processing.`)) return
          startTransition(async () => {
            try {
              const { markScrimNotHosted } = await import("@/app/actions/not-hosted")
              const res = await markScrimNotHosted(scrim.id)
              if (res.ok) toast.success(res.message || "Marked as Not Hosted")
              else toast.error(res.error || "Failed to mark as not hosted")
            } catch (err: any) {
              toast.error(err?.message || "Failed to mark as not hosted")
            }
          })
        }}
      >
        <AlertTriangle className="size-3.5" />
        Not Hosted
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            try {
              const nextHidden = !scrim.hidden
              const res = await toggleScrimHidden(scrim.id, nextHidden)
              if (res?.ok) {
                toast.success(nextHidden ? "Scrim hidden from public view" : "Scrim visible to public")
              } else {
                toast.error(res?.error || "Failed to update visibility")
              }
            } catch (err: any) {
              toast.error(err?.message || "Failed to update visibility")
            }
          })
        }
      >
        {scrim.hidden ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
        {scrim.hidden ? "Show" : "Hide"}
      </Button>
      <Button
        size="sm"
        variant="destructive"
        disabled={isPending}
        onClick={() => {
          if (!window.confirm(`Delete "${scrim.title}"? This cannot be undone.`)) return
          startTransition(async () => {
            try {
              const res = await deleteScrim(scrim.id)
              if (res?.ok) {
                toast.success("Scrim deleted successfully")
              } else {
                toast.error(res?.error || "Failed to delete scrim")
              }
            } catch (e: any) {
              toast.error(e?.message || "Failed to delete scrim")
            }
          })
        }}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </>
  )
}

function TrashControls({ scrim }: { scrim: AdminScrim }) {
  const [isPending, startTransition] = useTransition()
  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            try {
              const res = await restoreScrim(scrim.id)
              if (res?.ok) toast.success("Scrim restored from trash")
              else toast.error(res?.error || "Failed to restore scrim")
            } catch (err: any) {
              toast.error(err?.message || "Failed to restore scrim")
            }
          })
        }}
      >
        <RotateCcw className="size-3.5" />
        Restore
      </Button>
      <Button
        size="sm"
        variant="destructive"
        disabled={isPending}
        onClick={() => {
          if (!window.confirm(`Permanently delete "${scrim.title}"? This cannot be recovered.`)) return
          startTransition(async () => {
            try {
              const res = await permanentlyDeleteScrim(scrim.id)
              if (res?.ok) toast.success("Scrim permanently deleted")
              else toast.error(res?.error || "Failed to permanently delete scrim")
            } catch (err: any) {
              toast.error(err?.message || "Failed to permanently delete scrim")
            }
          })
        }}
      >
        <Trash2 className="size-3.5" />
        Delete Permanently
      </Button>
    </div>
  )
}

export function AdminScrimList({
  scrims,
  isAdmin,
  bookingsByScrim = {},
  initialRoom2Enabled = false,
}: {
  scrims: AdminScrim[]
  isAdmin: boolean
  bookingsByScrim?: Record<string, RosterBooking[]>
  initialRoom2Enabled?: boolean
}) {
  const [, startTransition] = useTransition()
  const [activeTab, setActiveTab] = useState<"all" | "daily" | "room2" | "friday" | "champion" | "not_hosted" | "trash">("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedScrimIds, setSelectedScrimIds] = useState<string[]>([])
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [room2Visible, setRoom2Visible] = useState(initialRoom2Enabled)
  const [isTogglingRoom2, setIsTogglingRoom2] = useState(false)

  const isRoom2Scrim = (s: AdminScrim) =>
    s.id.includes("r2") || s.slug.includes("room-2") || s.title.toLowerCase().includes("room 2")

  const notHostedCount = scrims.filter((s) => s.status === "not_hosted").length
  const trashCount = scrims.filter((s) => s.status === "deleted" || s.deletedAt != null).length

  const filteredScrims = sortScrimsAscending(
    scrims.filter((scrim) => {
      const isDeleted = scrim.status === "deleted" || scrim.deletedAt != null
      if (activeTab === "trash") {
        return isDeleted
      }
      if (isDeleted) return false

      if (activeTab === "not_hosted" && scrim.status !== "not_hosted") {
        return false
      }

      const isCR = scrim.title.toLowerCase().includes("champion rush") || scrim.slug.includes("champion-rush")
      const isFridayBlast = scrim.title.toLowerCase().includes("friday special") || scrim.slug.includes("friday-special")
      const isDaily = !isCR && !isFridayBlast
      const isR2 = isRoom2Scrim(scrim)

      if (activeTab === "daily" && !isDaily) return false
      if (activeTab === "room2" && !isR2) return false
      if (activeTab === "friday" && !isFridayBlast) return false
      if (activeTab === "champion" && !isCR) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const match =
          scrim.title.toLowerCase().includes(q) ||
          scrim.startTime.toLowerCase().includes(q) ||
          scrim.map.toLowerCase().includes(q) ||
          scrim.slug.toLowerCase().includes(q)
        if (!match) return false
      }

      return true
    })
  )

  const activeScrimsCount = scrims.filter((s) => s.status !== "deleted" && s.deletedAt == null).length
  const dailyCount = scrims.filter((s) => s.status !== "deleted" && s.deletedAt == null && !s.title.toLowerCase().includes("champion rush") && !s.title.toLowerCase().includes("friday special") && !s.slug.includes("champion-rush") && !s.slug.includes("friday-special")).length
  const room2Count = scrims.filter((s) => s.status !== "deleted" && s.deletedAt == null && isRoom2Scrim(s)).length
  const fridayCount = scrims.filter((s) => s.status !== "deleted" && s.deletedAt == null && (s.title.toLowerCase().includes("friday special") || s.slug.includes("friday-special"))).length
  const crCount = scrims.filter((s) => s.status !== "deleted" && s.deletedAt == null && (s.title.toLowerCase().includes("champion rush") || s.slug.includes("champion-rush"))).length

  async function handleToggleRoom2() {
    setIsTogglingRoom2(true)
    const nextVal = !room2Visible
    try {
      const res = await setSetting("show_room2", nextVal ? "true" : "false")
      if (res.ok) {
        setRoom2Visible(nextVal)
        toast.success(nextVal ? "Room 2 Lobbies are now VISIBLE publicly" : "Room 2 Lobbies are now HIDDEN from public")
      } else {
        toast.error(res.error || "Failed to update Room 2 visibility")
      }
    } catch {
      toast.error("Failed to update Room 2 visibility")
    } finally {
      setIsTogglingRoom2(false)
    }
  }

  async function handleBulkDelete() {
    if (selectedScrimIds.length === 0) return
    if (!window.confirm(`Move ${selectedScrimIds.length} scrim(s) to Trash?`)) return
    setIsBulkDeleting(true)
    try {
      const res = await bulkDeleteScrims(selectedScrimIds)
      if (res.ok) {
        toast.success(`Moved ${res.count} scrim(s) to Trash`)
        setSelectedScrimIds([])
      } else {
        toast.error(res.error || "Failed to bulk delete")
      }
    } catch {
      toast.error("Error deleting scrims")
    } finally {
      setIsBulkDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Category Tabs & Search Bar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border/80 bg-secondary/40 p-1">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              activeTab === "all" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Layers className="size-3.5" />
            Active Scrims ({activeScrimsCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("daily")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              activeTab === "daily" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Daily Scrims ({dailyCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("room2")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              activeTab === "room2" ? "bg-purple-600 text-white shadow" : "text-muted-foreground hover:text-purple-300"
            }`}
          >
            Room 2 ({room2Count})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("friday")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              activeTab === "friday" ? "bg-amber-500 text-black shadow" : "text-muted-foreground hover:text-amber-400"
            }`}
          >
            <Flame className="size-3.5" />
            Friday Special ({fridayCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("champion")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              activeTab === "champion" ? "bg-emerald-500 text-black shadow" : "text-muted-foreground hover:text-emerald-400"
            }`}
          >
            <Trophy className="size-3.5" />
            Champion Rush ({crCount})
          </button>
          {notHostedCount > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab("not_hosted")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                activeTab === "not_hosted" ? "bg-destructive text-destructive-foreground shadow" : "text-muted-foreground hover:text-destructive"
              }`}
            >
              <AlertTriangle className="size-3.5" />
              Not Hosted ({notHostedCount})
            </button>
          )}
          <Link
            href="/admin/trash"
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-muted-foreground hover:text-rose-400 transition-all"
          >
            <Trash2 className="size-3.5" />
            Trash {trashCount > 0 ? `(${trashCount})` : ""}
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              disabled={isTogglingRoom2}
              onClick={handleToggleRoom2}
              className={cn(
                "h-8 gap-1.5 text-xs font-semibold transition-all border",
                room2Visible
                  ? "border-purple-500/50 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20"
                  : "border-border/80 text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
              title="Toggle Room 2 lobbies public visibility ON or OFF"
            >
              {isTogglingRoom2 ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : room2Visible ? (
                <Eye className="size-3.5 text-purple-400" />
              ) : (
                <EyeOff className="size-3.5 text-muted-foreground" />
              )}
              <span>Room 2 Public: <strong className={room2Visible ? "text-purple-300 font-bold" : "text-muted-foreground font-bold"}>{room2Visible ? "ON" : "OFF"}</strong></span>
            </Button>
          )}

          {isAdmin && selectedScrimIds.length > 0 && (
            <Button
              size="sm"
              variant="destructive"
              disabled={isBulkDeleting}
              onClick={handleBulkDelete}
              className="h-8 gap-1 text-xs"
            >
              {isBulkDeleting ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
              Delete Selected ({selectedScrimIds.length})
            </Button>
          )}
          {notHostedCount > 0 && (
            <Link
              href="/admin/not-hosted"
              className="hidden lg:flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-400 hover:bg-amber-500/20 transition-all"
            >
              <AlertTriangle className="size-3.5" />
              Refund Panel ({notHostedCount})
            </Link>
          )}
          <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search scrims..."
              className="pl-9 text-xs"
            />
          </div>
        </div>
      </div>

      {filteredScrims.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center text-sm text-muted-foreground">
          No matching scrims found.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {filteredScrims.map((scrim) => {
            const isCR = scrim.title.toLowerCase().includes("champion rush") || scrim.slug.includes("champion-rush")
            const isFridayBlast = scrim.title.toLowerCase().includes("friday special") || scrim.slug.includes("friday-special")
            const isDeleted = scrim.status === "deleted" || scrim.deletedAt != null

            const roster = [
              ...(bookingsByScrim[scrim.id] ?? []),
              ...(scrim.slug && scrim.slug !== scrim.id ? (bookingsByScrim[scrim.slug] ?? []) : []),
            ].filter((b, idx, arr) => arr.findIndex((x) => x.id === b.id) === idx)
            const dynamicConfirmedCount = roster.length > 0 ? roster.length : (scrim.confirmedTeams || 0)
            const isSelected = selectedScrimIds.includes(scrim.id)

            return (
              <li
                key={scrim.id}
                className={`glass flex flex-col gap-3 rounded-2xl p-4 border transition-all ${
                  isSelected
                    ? "border-primary/60 bg-primary/[0.04]"
                    : isDeleted
                    ? "border-destructive/40 bg-destructive/5 opacity-85"
                    : isCR
                    ? "border-emerald-500/30 bg-emerald-950/10 hover:border-emerald-500/50"
                    : isFridayBlast
                    ? "border-amber-500/30 bg-amber-950/10 hover:border-amber-500/50"
                    : "border-border/60 hover:border-primary/30"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedScrimIds((prev) =>
                          prev.includes(scrim.id) ? prev.filter((x) => x !== scrim.id) : [...prev, scrim.id]
                        )
                      }
                      className="text-muted-foreground hover:text-foreground shrink-0"
                    >
                      {isSelected ? (
                        <CheckSquare className="size-4 text-primary" />
                      ) : (
                        <Square className="size-4" />
                      )}
                    </button>
                  )}
                  <h2 className="min-w-0 flex-1 truncate font-display text-lg font-bold flex items-center gap-2">
                    {scrim.title}
                    {isCR && (
                      <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px]">
                        Champion Rush (8 Max)
                      </Badge>
                    )}
                    {isFridayBlast && (
                      <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px]">
                        3 Matches Blast
                      </Badge>
                    )}
                    {isRoom2Scrim(scrim) && (
                      <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px]">
                        Room 2
                      </Badge>
                    )}
                    {!isRoom2Scrim(scrim) && !isCR && !isFridayBlast && (scrim.title.includes("ROOM 1") || scrim.slug.includes("room-1") || scrim.id.includes("r1")) && (
                      <Badge className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px]">
                        Room 1
                      </Badge>
                    )}
                  </h2>
                  <Badge variant="secondary">{scrim.startTime}</Badge>
                  <Badge variant="secondary">{scrim.map}</Badge>
                  <Badge
                    variant={scrim.status === "completed" ? "outline" : isDeleted ? "destructive" : scrim.status === "not_hosted" ? "outline" : "default"}
                    className={cn(
                      "capitalize",
                      scrim.status === "not_hosted" && "border-amber-500/50 bg-amber-500/10 text-amber-400 font-bold"
                    )}
                  >
                    {isDeleted ? "In Trash" : scrim.status === "not_hosted" ? "Not Hosted" : scrim.status}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5 font-medium text-foreground">
                    <Users className="size-3.5 text-primary" />
                    <span className="font-mono">{dynamicConfirmedCount} / {scrim.maxTeams}</span> slots filled
                    <span className="text-xs text-muted-foreground">
                      ({Math.max(0, scrim.maxTeams - dynamicConfirmedCount)} spots left)
                    </span>
                    {scrim.pendingTeams > 0 && (
                      <span className="text-chart-3 text-xs">(+{scrim.pendingTeams} pending)</span>
                    )}
                  </span>
                  <span>Entry {formatTaka(scrim.priceBdt)}</span>
                  <span>Prize {formatTaka(scrim.prizePoolBdt)}</span>
                  {!isDeleted && (
                    <span className={scrim.registrationOpen ? "text-chart-4" : "text-destructive"}>
                      {scrim.registrationOpen ? "Registration open" : "Registration closed"}
                    </span>
                  )}
                  {scrim.roomPublished && (
                    <span className="text-primary font-mono font-bold">
                      Room live: {scrim.roomId} / {scrim.roomPassword}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <ViewTeamsButton
                    scrim={scrim}
                    roster={roster}
                    confirmedCount={dynamicConfirmedCount}
                  />
                  {!isDeleted && (
                    <>
                      <PublishRoomButton scrim={scrim} />
                      <PublishResultButton
                        scrims={scrims.map((s) => ({
                          id: s.id,
                          title: s.title,
                          startTime: s.startTime,
                          prizePoolBdt: s.prizePoolBdt,
                        }))}
                        bookingsByScrim={bookingsByScrim}
                        defaultScrimId={scrim.id}
                      />
                      {scrim.roomPublished && isAdmin && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            startTransition(async () => {
                              await unpublishRoom(scrim.id)
                              toast.success("Room hidden")
                            })
                          }
                        >
                          Hide Room
                        </Button>
                      )}
                      {isAdmin && <AdminControls scrim={scrim} />}
                    </>
                  )}
                  {isDeleted && isAdmin && <TrashControls scrim={scrim} />}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
