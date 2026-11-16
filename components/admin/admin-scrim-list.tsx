"use client"

import { useActionState, useCallback, useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { publishRoom, unpublishRoom, type PublishRoomState } from "@/app/actions/staff"
import {
  deleteScrim,
  restoreScrim,
  permanentlyDeleteScrim,
  bulkDeleteScrims,
  toggleRegistration,
  toggleScrimStatus,
  toggleScrimHidden,
  setSetting,
  forceTurnOnAllScrimsAction,
  forceTurnOffAllScrimsAction,
  normalModeAllScrimsAction,
  removeTeamFromScrimAction,
} from "@/app/actions/admin"
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import type { Booking, Scrim } from "@/lib/db/schema"
import { formatTaka, timeAgo, formatDateTime, sortScrimsAscending } from "@/lib/format"
import { cn } from "@/lib/utils"
import { KeyRound, Loader2, Lock, Trash2, Users, Eye, EyeOff, AlertTriangle, Search, Trophy, Flame, Layers, RotateCcw, CalendarDays, CheckSquare, Square, Camera, CheckCircle2, ExternalLink, Image as ImageIcon, Power, PowerOff, UserX, Copy, Check } from "lucide-react"
import { toast } from "sonner"

type AdminScrim = Scrim & { confirmedTeams: number; pendingTeams: number; deletedAt?: Date | string | null }
type RosterBooking = Booking & { userEmail: string | null }

function toDateOrNow(val: Date | string | null | undefined): Date {
  if (val instanceof Date) return val
  if (typeof val === "string") {
    const parsed = new Date(val)
    if (!Number.isNaN(parsed.getTime())) return parsed
  }
  return new Date()
}

function toNullableDate(val: Date | string | null | undefined): Date | null {
  if (!val) return null
  if (val instanceof Date) return val
  const parsed = new Date(val)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function normalizeAdminScrim(raw: AdminScrim): AdminScrim {
  return {
    ...raw,
    createdAt: toDateOrNow(raw.createdAt as Date | string | undefined),
    updatedAt: toDateOrNow(raw.updatedAt as Date | string | undefined),
    deletedAt: toNullableDate(raw.deletedAt),
    confirmedTeams: Number(raw.confirmedTeams ?? 0),
    pendingTeams: Number(raw.pendingTeams ?? 0),
  }
}

function normalizeRosterBooking(raw: RosterBooking): RosterBooking {
  return {
    ...raw,
    createdAt: toDateOrNow(raw.createdAt as Date | string | undefined),
    updatedAt: toDateOrNow(raw.updatedAt as Date | string | undefined),
    deletedAt: toNullableDate(raw.deletedAt),
  }
}

function broadcastSlotsSync(scrimId?: string) {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent("acescrims:slots-updated", { detail: { scrimId } }))
  if (typeof BroadcastChannel !== "undefined") {
    try {
      const ch = new BroadcastChannel("acescrims-slots")
      ch.postMessage({ type: "slots-updated", scrimId, timestamp: Date.now() })
      ch.close()
    } catch {
      // ignore BroadcastChannel errors
    }
  }
}

function formatRegistrationDate(date: Date | string | null | undefined): string {
  if (!date) return "N/A"
  try {
    const formatted = formatDateTime(date)
    return formatted || "N/A"
  } catch {
    return "N/A"
  }
}

const initialState: PublishRoomState = {
  ok: false,
  error: null,
  emailsSent: 0,
  emailsFailed: 0,
  totalRecipients: 0,
  emailWarning: null,
}

function PublishRoomButton({ scrim, onUpdated }: { scrim: AdminScrim; onUpdated?: () => void }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(publishRoom, initialState)

  useEffect(() => {
    if (state.ok) {
      const total = state.totalRecipients ?? 0
      const sent = state.emailsSent ?? 0
      const failed = state.emailsFailed ?? 0
      if (state.emailWarning) {
        toast.warning(state.emailWarning)
      } else if (total === 0) {
        toast.success("Room details published in dashboard")
      } else if (failed > 0) {
        toast.warning(`Room published — emailed ${sent}/${total} confirmed teams (${failed} failed)`)
      } else {
        toast.success(`Room published & emailed to all ${sent} confirmed team(s)`)
      }
      setOpen(false)
      onUpdated?.()
      broadcastSlotsSync(scrim.id)
    } else if (state.error) {
      toast.error(state.error)
    }
  }, [state, scrim.id, onUpdated])

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
  onTeamRemoved,
}: {
  scrim: AdminScrim
  roster: RosterBooking[]
  confirmedCount?: number
  onTeamRemoved?: (scrimId: string, bookingId: string) => void
}) {
  const [teamList, setTeamList] = useState(roster)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [teamToRemove, setTeamToRemove] = useState<RosterBooking | null>(null)
  const router = useRouter()
  const [, startTransition] = useTransition()

  useEffect(() => {
    setTeamList(roster)
  }, [roster])

  const count = confirmedCount ?? teamList.length ?? scrim.confirmedTeams ?? 0

  function handlePromptRemoveTeam(b: RosterBooking) {
    setTeamToRemove(b)
  }

  async function handleConfirmRemoveTeam() {
    if (!teamToRemove) return
    const b = teamToRemove
    setRemovingId(b.id)
    try {
      const res = await removeTeamFromScrimAction(b.id, scrim.id)
      if (res.ok) {
        toast.success(`Team "${b.teamName}" removed! Slot #${b.slotNumber ?? ""} is now freed up.`)
        setTeamList((prev) => prev.filter((item) => item.id !== b.id))
        onTeamRemoved?.(scrim.id, b.id)
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("acescrims:slots-updated", { detail: { scrimId: scrim.id } }))
          if (typeof BroadcastChannel !== "undefined") {
            const ch = new BroadcastChannel("acescrims-slots")
            ch.postMessage({ type: "slots-updated", scrimId: scrim.id })
            ch.close()
          }
        }
        setTeamToRemove(null)
        startTransition(() => {
          router.refresh()
        })
      } else {
        toast.error(res.error || "Failed to remove team")
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove team")
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <>
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
        {teamList.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No teams registered yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {teamList.map((b) => (
              <li key={b.id} className="rounded-xl border border-border bg-secondary/30 p-4 flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-base font-bold">{b.teamName}</span>
                  {b.slotNumber != null && (
                    <Badge variant="secondary">Slot {b.slotNumber}</Badge>
                  )}
                  <Badge variant={statusBadgeVariant(b.status)} className="capitalize">
                    {b.status}
                  </Badge>

                  {/* Remove Team Action Button */}
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={removingId === b.id}
                    onClick={() => handlePromptRemoveTeam(b)}
                    className="h-7 px-2.5 text-xs font-semibold gap-1 bg-destructive/90 hover:bg-destructive text-destructive-foreground shadow-sm ml-1"
                    title={`Remove "${b.teamName}" from this scrim`}
                  >
                    {removingId === b.id ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <UserX className="size-3" />
                    )}
                    <span>{removingId === b.id ? "Removing..." : "Remove Team"}</span>
                  </Button>

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
                  <span>
                    <span className="text-muted-foreground">Payout Method: </span>
                    <Badge variant="outline" className="text-[10px] uppercase font-bold px-1.5 py-0 border-primary/40 text-primary bg-primary/10 mr-1.5">
                      {b.paymentMethod || "Digital Wallet"}
                    </Badge>
                    {b.paymentNumber && (
                      <span className="font-mono text-xs font-semibold text-primary">{b.paymentNumber}</span>
                    )}
                  </span>
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

    {/* Safeguard Prompt Confirmation Dialog */}
    {teamToRemove && (
      <Dialog open={true} onOpenChange={(open) => !open && setTeamToRemove(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive font-display uppercase text-base">
              <AlertTriangle className="size-5 shrink-0" />
              Remove Team from Scrim?
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-sm text-foreground">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Are you sure you want to remove this team? This action will immediately remove the team from this scrim lobby, cancel their slot, decrement the confirmed count, and free up the spot in real time.
            </p>

            <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Team Name:</span>
                <span className="font-bold text-foreground">{teamToRemove.teamName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Team Leader:</span>
                <span className="font-medium text-foreground">{teamToRemove.captainName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Captain UID:</span>
                <span className="font-mono text-foreground">{teamToRemove.captainUid}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Assigned Slot:</span>
                <span className="font-mono font-bold text-primary">Slot #{teamToRemove.slotNumber ?? "N/A"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Scrim Lobby:</span>
                <span className="font-medium text-foreground truncate max-w-[200px]">{scrim.title}</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              disabled={removingId === teamToRemove.id}
              onClick={() => setTeamToRemove(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={removingId === teamToRemove.id}
              onClick={handleConfirmRemoveTeam}
              className="gap-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90 font-semibold"
            >
              {removingId === teamToRemove.id ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Removing...
                </>
              ) : (
                <>
                  <UserX className="size-4" />
                  Yes, Remove Team
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )}
    </>
  )
}

function AdminControls({ scrim, onUpdated }: { scrim: AdminScrim; onUpdated?: () => void }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [confirmAction, setConfirmAction] = useState<"not_hosted" | "delete" | null>(null)

  function handleConfirmedAction() {
    const action = confirmAction
    setConfirmAction(null)
    if (action === "not_hosted") {
      startTransition(async () => {
        try {
          const { markScrimNotHosted } = await import("@/app/actions/not-hosted")
          const res = await markScrimNotHosted(scrim.id)
          if (res.ok) {
            toast.success(res.message || "Marked as Not Hosted")
            broadcastSlotsSync(scrim.id)
            onUpdated?.()
            router.refresh()
          } else toast.error(res.error || "Failed to mark as not hosted")
        } catch (err: any) {
          toast.error(err?.message || "Failed to mark as not hosted")
        }
      })
    } else if (action === "delete") {
      startTransition(async () => {
        try {
          const res = await deleteScrim(scrim.id)
          if (res?.ok) {
            toast.success("Scrim deleted successfully")
            broadcastSlotsSync(scrim.id)
            onUpdated?.()
            router.refresh()
          } else {
            toast.error(res?.error || "Failed to delete scrim")
          }
        } catch (e: any) {
          toast.error(e?.message || "Failed to delete scrim")
        }
      })
    }
  }

  return (
    <>
      <EditScrimButton scrim={scrim} />
      <select
        value={scrim.status}
        disabled={isPending}
        onChange={(e) => {
          const nextStatus = e.target.value as "upcoming" | "force_open" | "live" | "registration_closed" | "completed" | "not_hosted"
          if (nextStatus === "not_hosted") {
            setConfirmAction("not_hosted")
            return
          }

          startTransition(async () => {
            try {
              const res = await toggleScrimStatus(scrim.id, nextStatus)
              if (res?.ok) {
                toast.success(nextStatus === "force_open" ? "Registration FORCE TURNED ON (overriding match time)!" : `Scrim status set to ${nextStatus}`)
                broadcastSlotsSync(scrim.id)
                onUpdated?.()
                router.refresh()
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
        <option value="force_open">Force Turn On</option>
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
                broadcastSlotsSync(scrim.id)
                onUpdated?.()
                router.refresh()
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
        onClick={() => setConfirmAction("not_hosted")}
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
                broadcastSlotsSync(scrim.id)
                onUpdated?.()
                router.refresh()
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
        onClick={() => setConfirmAction("delete")}
      >
        <Trash2 className="size-3.5" />
      </Button>

      <ConfirmDialog
        open={confirmAction !== null}
        onOpenChange={(open) => !open && setConfirmAction(null)}
        title={confirmAction === "not_hosted" ? "Mark Scrim as Not Hosted?" : "Delete Scrim?"}
        description={
          confirmAction === "not_hosted"
            ? `Mark "${scrim.title}" as NOT HOSTED? Registered teams will be moved to the Not Hosted section for refund processing.`
            : `Move "${scrim.title}" to Trash?`
        }
        confirmLabel={confirmAction === "not_hosted" ? "Mark Not Hosted" : "Delete Scrim"}
        variant="destructive"
        loading={isPending}
        onConfirm={handleConfirmedAction}
      />
    </>
  )
}

function TrashControls({ scrim }: { scrim: AdminScrim }) {
  const [isPending, startTransition] = useTransition()
  const [confirmPurge, setConfirmPurge] = useState(false)

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
        onClick={() => setConfirmPurge(true)}
      >
        <Trash2 className="size-3.5" />
        Delete Permanently
      </Button>

      <ConfirmDialog
        open={confirmPurge}
        onOpenChange={setConfirmPurge}
        title="Permanently Delete Scrim?"
        description={`Permanently delete "${scrim.title}"? This cannot be recovered.`}
        confirmLabel="Delete Permanently"
        variant="destructive"
        loading={isPending}
        onConfirm={() => {
          setConfirmPurge(false)
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
      />
    </div>
  )
}

type ScrimTab = "all" | "daily" | "room1" | "room2" | "friday" | "champion" | "not_hosted" | "trash"
const VALID_TABS: ScrimTab[] = ["all", "daily", "room1", "room2", "friday", "champion", "not_hosted", "trash"]

export function AdminScrimList({
  scrims,
  isAdmin,
  bookingsByScrim = {},
  initialRoom2Enabled = false,
  initialTab,
}: {
  scrims: AdminScrim[]
  isAdmin: boolean
  bookingsByScrim?: Record<string, RosterBooking[]>
  initialRoom2Enabled?: boolean
  initialTab?: string
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const resolvedInitialTab: ScrimTab = VALID_TABS.includes(initialTab as ScrimTab) ? (initialTab as ScrimTab) : "all"
  const [activeTab, setActiveTab] = useState<ScrimTab>(resolvedInitialTab)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedScrimIds, setSelectedScrimIds] = useState<string[]>([])
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [room2Visible, setRoom2Visible] = useState(initialRoom2Enabled)
  const [isTogglingRoom2, setIsTogglingRoom2] = useState(false)
  const [isBulkForcing, setIsBulkForcing] = useState(false)
  const [liveScrims, setLiveScrims] = useState<AdminScrim[]>(scrims)
  const [liveBookingsByScrim, setLiveBookingsByScrim] = useState<Record<string, RosterBooking[]>>(bookingsByScrim)
  const [bulkConfirm, setBulkConfirm] = useState<"force_on" | "force_off" | "normal_mode" | "bulk_delete" | null>(null)
  const [copiedScrimId, setCopiedScrimId] = useState<string | null>(null)
  const isSyncingRef = useRef(false)

  async function handleCopyTeams(scrimId: string, roster: RosterBooking[]) {
    const activeTeams = [...roster].sort(
      (a, b) =>
        (a.slotNumber ?? 999) - (b.slotNumber ?? 999) ||
        toDateOrNow(a.createdAt).getTime() - toDateOrNow(b.createdAt).getTime()
    )

    if (activeTeams.length === 0) {
      toast.info("No registered teams in this scrim yet.")
      return
    }

    const formatted = activeTeams
      .map((b, idx) => `${idx + 1}. ${(b.teamName || "Unknown Team").trim()}`)
      .join("\n")

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(formatted)
      } else if (typeof document !== "undefined") {
        const ta = document.createElement("textarea")
        ta.value = formatted
        ta.style.position = "fixed"
        ta.style.opacity = "0"
        document.body.appendChild(ta)
        ta.focus()
        ta.select()
        document.execCommand("copy")
        document.body.removeChild(ta)
      }
      setCopiedScrimId(scrimId)
      toast.success(`Copied ${activeTeams.length} team name(s) to clipboard`)
      window.setTimeout(() => {
        setCopiedScrimId((prev) => (prev === scrimId ? null : prev))
      }, 2000)
    } catch {
      toast.error("Failed to copy teams to clipboard")
    }
  }

  useEffect(() => {
    if (initialTab && VALID_TABS.includes(initialTab as ScrimTab)) {
      setActiveTab(initialTab as ScrimTab)
    } else {
      setActiveTab("all")
    }
  }, [initialTab])

  useEffect(() => {
    setLiveScrims(scrims)
  }, [scrims])

  useEffect(() => {
    setLiveBookingsByScrim(bookingsByScrim)
  }, [bookingsByScrim])

  const syncAdminScrims = useCallback(async () => {
    if (isSyncingRef.current) return
    isSyncingRef.current = true
    try {
      const res = await fetch("/api/admin/scrims", { cache: "no-store" })
      if (!res.ok) return
      const data = await res.json()
      if (!data?.ok) return

      if (Array.isArray(data.scrims)) {
        setLiveScrims(data.scrims.map((s: AdminScrim) => normalizeAdminScrim(s)))
      }
      if (data.bookingsByScrim && typeof data.bookingsByScrim === "object") {
        const normalizedBookings: Record<string, RosterBooking[]> = {}
        for (const [k, list] of Object.entries(data.bookingsByScrim as Record<string, RosterBooking[]>)) {
          if (Array.isArray(list)) {
            normalizedBookings[k] = list.map((b) => normalizeRosterBooking(b))
          }
        }
        setLiveBookingsByScrim(normalizedBookings)
      }
      if (typeof data.room2Enabled === "boolean") {
        setRoom2Visible(data.room2Enabled)
      }
    } catch {
      // ignore transient network polling failures
    } finally {
      isSyncingRef.current = false
    }
  }, [])

  useEffect(() => {
    void syncAdminScrims()

    const handleSlotEvent = () => {
      void syncAdminScrims()
    }
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void syncAdminScrims()
      }
    }

    window.addEventListener("acescrims:slots-updated", handleSlotEvent)
    window.addEventListener("focus", handleSlotEvent)
    document.addEventListener("visibilitychange", handleVisibility)

    let bc: BroadcastChannel | null = null
    if (typeof BroadcastChannel !== "undefined") {
      try {
        bc = new BroadcastChannel("acescrims-slots")
        bc.onmessage = () => {
          void syncAdminScrims()
        }
      } catch {
        bc = null
      }
    }

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void syncAdminScrims()
      }
    }, 8000)

    return () => {
      window.removeEventListener("acescrims:slots-updated", handleSlotEvent)
      window.removeEventListener("focus", handleSlotEvent)
      document.removeEventListener("visibilitychange", handleVisibility)
      bc?.close()
      window.clearInterval(timer)
    }
  }, [syncAdminScrims])

  function handleTeamRemoved(scrimId: string, bookingId: string) {
    setLiveBookingsByScrim((prev) => {
      const next = { ...prev }
      for (const key of Object.keys(next)) {
        if (next[key]) {
          next[key] = next[key].filter((b) => b.id !== bookingId)
        }
      }
      return next
    })
    setLiveScrims((prev) =>
      prev.map((s) =>
        s.id === scrimId || s.slug === scrimId
          ? { ...s, confirmedTeams: Math.max(0, (s.confirmedTeams || 0) - 1) }
          : s
      )
    )
    void syncAdminScrims()
  }

  const isRoom2Scrim = (s: AdminScrim) =>
    s.id.includes("r2") || s.slug.includes("room-2") || s.title.toLowerCase().includes("room 2")

  const isRoom1Scrim = (s: AdminScrim) => {
    const isCR = s.title.toLowerCase().includes("champion rush") || s.slug.includes("champion-rush")
    const isFridayBlast = s.title.toLowerCase().includes("friday special") || s.slug.includes("friday-special")
    return !isRoom2Scrim(s) && !isCR && !isFridayBlast
  }

  const notHostedCount = liveScrims.filter((s) => s.status === "not_hosted").length
  const trashCount = liveScrims.filter((s) => s.status === "deleted" || s.deletedAt != null).length

  const filteredScrims = sortScrimsAscending(
    liveScrims.filter((scrim) => {
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
      const isR1 = isRoom1Scrim(scrim)

      if (activeTab === "daily" && !isDaily) return false
      if (activeTab === "room1" && !isR1) return false
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

  const activeScrimsCount = liveScrims.filter((s) => s.status !== "deleted" && s.deletedAt == null).length
  const dailyCount = liveScrims.filter((s) => s.status !== "deleted" && s.deletedAt == null && !s.title.toLowerCase().includes("champion rush") && !s.title.toLowerCase().includes("friday special") && !s.slug.includes("champion-rush") && !s.slug.includes("friday-special")).length
  const room1Count = liveScrims.filter((s) => s.status !== "deleted" && s.deletedAt == null && isRoom1Scrim(s)).length
  const room2Count = liveScrims.filter((s) => s.status !== "deleted" && s.deletedAt == null && isRoom2Scrim(s)).length
  const fridayCount = liveScrims.filter((s) => s.status !== "deleted" && s.deletedAt == null && (s.title.toLowerCase().includes("friday special") || s.slug.includes("friday-special"))).length
  const crCount = liveScrims.filter((s) => s.status !== "deleted" && s.deletedAt == null && (s.title.toLowerCase().includes("champion rush") || s.slug.includes("champion-rush"))).length

  async function executeBulkConfirm() {
    const mode = bulkConfirm
    setBulkConfirm(null)
    if (mode === "force_on") {
      setIsBulkForcing(true)
      try {
        const res = await forceTurnOnAllScrimsAction()
        if (res.ok) {
          toast.success("Success! Force turned ON registration for all scrim lobbies.")
          broadcastSlotsSync()
          void syncAdminScrims()
          router.refresh()
        } else {
          toast.error(res.error || "Failed to force turn on scrims")
        }
      } catch {
        toast.error("Failed to force turn on scrims")
      } finally {
        setIsBulkForcing(false)
      }
    } else if (mode === "force_off") {
      setIsBulkForcing(true)
      try {
        const res = await forceTurnOffAllScrimsAction()
        if (res.ok) {
          toast.success("Success! Force turned OFF registration for all scrim lobbies.")
          broadcastSlotsSync()
          void syncAdminScrims()
          router.refresh()
        } else {
          toast.error(res.error || "Failed to force turn off scrims")
        }
      } catch {
        toast.error("Failed to force turn off scrims")
      } finally {
        setIsBulkForcing(false)
      }
    } else if (mode === "normal_mode") {
      setIsBulkForcing(true)
      try {
        const res = await normalModeAllScrimsAction()
        if (res.ok) {
          toast.success("Success! Restored all scrim lobbies to Normal Mode (schedule-based).")
          broadcastSlotsSync()
          void syncAdminScrims()
          router.refresh()
        } else {
          toast.error(res.error || "Failed to switch scrims to Normal Mode")
        }
      } catch {
        toast.error("Failed to switch scrims to Normal Mode")
      } finally {
        setIsBulkForcing(false)
      }
    } else if (mode === "bulk_delete") {
      if (selectedScrimIds.length === 0) return
      setIsBulkDeleting(true)
      try {
        const res = await bulkDeleteScrims(selectedScrimIds)
        if (res.ok) {
          toast.success(`Moved ${res.count} scrim(s) to Trash`)
          setSelectedScrimIds([])
          broadcastSlotsSync()
          void syncAdminScrims()
        } else {
          toast.error(res.error || "Failed to bulk delete")
        }
      } catch {
        toast.error("Error deleting scrims")
      } finally {
        setIsBulkDeleting(false)
      }
    }
  }

  function handleForceTurnOnAll() {
    setBulkConfirm("force_on")
  }

  function handleForceTurnOffAll() {
    setBulkConfirm("force_off")
  }

  function handleNormalModeAll() {
    setBulkConfirm("normal_mode")
  }

  async function handleToggleRoom2() {
    setIsTogglingRoom2(true)
    const nextVal = !room2Visible
    try {
      const res = await setSetting("show_room2", nextVal ? "true" : "false")
      if (res.ok) {
        setRoom2Visible(nextVal)
        toast.success(nextVal ? "Room 2 Lobbies are now VISIBLE publicly" : "Room 2 Lobbies are now HIDDEN from public")
        broadcastSlotsSync()
        void syncAdminScrims()
      } else {
        toast.error(res.error || "Failed to update Room 2 visibility")
      }
    } catch {
      toast.error("Failed to update Room 2 visibility")
    } finally {
      setIsTogglingRoom2(false)
    }
  }

  function handleBulkDelete() {
    if (selectedScrimIds.length === 0) return
    setBulkConfirm("bulk_delete")
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
            onClick={() => setActiveTab("room1")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              activeTab === "room1" ? "bg-blue-600 text-white shadow" : "text-muted-foreground hover:text-blue-300"
            }`}
          >
            <KeyRound className="size-3.5" />
            Room 1 ({room1Count})
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
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={isBulkForcing}
                onClick={handleForceTurnOnAll}
                className="h-8 gap-1.5 text-xs font-bold border-emerald-500/50 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:text-emerald-100 transition-all shadow-sm"
                title="Force turn on all scrims and open registrations immediately"
              >
                {isBulkForcing ? <Loader2 className="size-3.5 animate-spin" /> : <Power className="size-3.5 text-emerald-400" />}
                <span>Force Turn On All Scrims</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                disabled={isBulkForcing}
                onClick={handleForceTurnOffAll}
                className="h-8 gap-1.5 text-xs font-bold border-rose-500/50 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 hover:text-rose-100 transition-all shadow-sm"
                title="Force turn off all scrims and close registrations immediately"
              >
                {isBulkForcing ? <Loader2 className="size-3.5 animate-spin" /> : <PowerOff className="size-3.5 text-rose-400" />}
                <span>Force Turn Off All Scrims</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                disabled={isBulkForcing}
                onClick={handleNormalModeAll}
                className="h-8 gap-1.5 text-xs font-bold border-sky-500/50 bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 hover:text-sky-100 transition-all shadow-sm"
                title="Restore all scrims to normal schedule-based mode"
              >
                {isBulkForcing ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5 text-sky-400" />}
                <span>Normal Mode</span>
              </Button>
            </>
          )}

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
              ...(liveBookingsByScrim[scrim.id] ?? []),
              ...(scrim.slug && scrim.slug !== scrim.id ? (liveBookingsByScrim[scrim.slug] ?? []) : []),
            ].filter((b, idx, arr) => arr.findIndex((x) => x.id === b.id) === idx)
            const hasLiveRoster =
              scrim.id in liveBookingsByScrim ||
              Boolean(scrim.slug && scrim.slug in liveBookingsByScrim)
            const dynamicConfirmedCount = hasLiveRoster ? roster.length : (scrim.confirmedTeams || 0)
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
                      scrim.status === "not_hosted" && "border-amber-500/50 bg-amber-500/10 text-amber-400 font-bold",
                      scrim.status === "force_open" && "border-emerald-500/50 bg-emerald-500/20 text-emerald-400 font-bold"
                    )}
                  >
                    {isDeleted ? "In Trash" : scrim.status === "not_hosted" ? "Not Hosted" : scrim.status === "force_open" ? "Force Open" : scrim.status}
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
                    onTeamRemoved={handleTeamRemoved}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void handleCopyTeams(scrim.id, roster)}
                    className={cn(
                      "gap-1.5",
                      copiedScrimId === scrim.id &&
                        "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                    )}
                    title="Copy numbered list of registered teams"
                  >
                    {copiedScrimId === scrim.id ? (
                      <Check className="size-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                    {copiedScrimId === scrim.id ? "Copied" : "Copy Teams"}
                  </Button>
                  {!isDeleted && (
                    <>
                      <PublishRoomButton scrim={scrim} onUpdated={syncAdminScrims} />
                      <PublishResultButton
                        scrims={liveScrims.map((s) => ({
                          id: s.id,
                          title: s.title,
                          startTime: s.startTime,
                          prizePoolBdt: s.prizePoolBdt,
                        }))}
                        bookingsByScrim={liveBookingsByScrim}
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
                              broadcastSlotsSync(scrim.id)
                              void syncAdminScrims()
                            })
                          }
                        >
                          Hide Room
                        </Button>
                      )}
                      {isAdmin && <AdminControls scrim={scrim} onUpdated={syncAdminScrims} />}
                    </>
                  )}
                  {isDeleted && isAdmin && <TrashControls scrim={scrim} />}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmDialog
        open={bulkConfirm !== null}
        onOpenChange={(open) => !open && setBulkConfirm(null)}
        title={
          bulkConfirm === "force_on"
            ? "Force Turn On All Scrims?"
            : bulkConfirm === "force_off"
            ? "Force Turn Off All Scrims?"
            : bulkConfirm === "normal_mode"
            ? "Restore Scrims to Normal Mode?"
            : "Move Selected Scrims to Trash?"
        }
        description={
          bulkConfirm === "force_on"
            ? "This will immediately enable registration and set status to 'Force Open' for ALL active scrim lobbies, overriding match start time closures."
            : bulkConfirm === "force_off"
            ? "This will immediately CLOSE registration and set status to 'Registration Closed' for ALL active scrim lobbies."
            : bulkConfirm === "normal_mode"
            ? "This will exit Force Turn On / Force Turn Off and restore all active scrim lobbies back to normal schedule-based open/closed timing."
            : `Move ${selectedScrimIds.length} selected scrim(s) to Trash?`
        }
        confirmLabel={
          bulkConfirm === "force_on"
            ? "Force Turn On All"
            : bulkConfirm === "force_off"
            ? "Force Turn Off All"
            : bulkConfirm === "normal_mode"
            ? "Switch to Normal Mode"
            : "Move to Trash"
        }
        variant={bulkConfirm === "force_on" || bulkConfirm === "normal_mode" ? "default" : "destructive"}
        loading={isBulkForcing || isBulkDeleting}
        onConfirm={executeBulkConfirm}
      />
    </div>
  )
}
