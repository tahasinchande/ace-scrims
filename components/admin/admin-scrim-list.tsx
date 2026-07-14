"use client"

import { useActionState, useEffect, useState, useTransition } from "react"
import { publishRoom, unpublishRoom } from "@/app/actions/staff"
import { deleteScrim, toggleRegistration } from "@/app/actions/admin"
import { EditScrimButton } from "@/components/admin/scrim-form-dialog"
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
import { formatTaka, timeAgo } from "@/lib/format"
import { KeyRound, Loader2, Lock, Trash2, Users } from "lucide-react"
import { toast } from "sonner"

type AdminScrim = Scrim & { confirmedTeams: number; pendingTeams: number }
type RosterBooking = Booking & { userEmail: string | null }

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

function ViewTeamsButton({
  scrim,
  roster,
}: {
  scrim: AdminScrim
  roster: RosterBooking[]
}) {
  const total = scrim.confirmedTeams + scrim.pendingTeams
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline">
            <Users className="size-3.5" />
            Teams ({total})
          </Button>
        }
      />
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display uppercase">
            Registered Teams — {scrim.title}
          </DialogTitle>
        </DialogHeader>
        {roster.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No teams registered yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {roster.map((b) => (
              <li key={b.id} className="rounded-xl border border-border bg-secondary/30 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display text-base font-bold">{b.teamName}</span>
                  {b.slotNumber != null && (
                    <Badge variant="secondary">Slot {b.slotNumber}</Badge>
                  )}
                  <Badge variant={statusBadgeVariant(b.status)} className="capitalize">
                    {b.status}
                  </Badge>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {timeAgo(b.createdAt)}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  <span>
                    <span className="text-muted-foreground">Captain: </span>
                    {b.captainName} ({b.captainUid})
                  </span>
                  <span>
                    <span className="text-muted-foreground">Player 2: </span>
                    {b.player2Name} ({b.player2Uid})
                  </span>
                  <span>
                    <span className="text-muted-foreground">Player 3: </span>
                    {b.player3Name} ({b.player3Uid})
                  </span>
                  <span>
                    <span className="text-muted-foreground">Player 4: </span>
                    {b.player4Name} ({b.player4Uid})
                  </span>
                  {b.player5Name && (
                    <span>
                      <span className="text-muted-foreground">Player 5: </span>
                      {b.player5Name} {b.player5Uid ? `(${b.player5Uid})` : ""}
                    </span>
                  )}
                  <span>
                    <span className="text-muted-foreground">Phone: </span>
                    {b.phone}
                  </span>
                  {b.discordTelegram && (
                    <span>
                      <span className="text-muted-foreground">Discord/Telegram: </span>
                      {b.discordTelegram}
                    </span>
                  )}
                  {b.userEmail && (
                    <span className="truncate">
                      <span className="text-muted-foreground">Account: </span>
                      {b.userEmail}
                    </span>
                  )}
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
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await toggleRegistration(scrim.id, !scrim.registrationOpen)
            toast.success(scrim.registrationOpen ? "Registration closed" : "Registration opened")
          })
        }
      >
        <Lock className="size-3.5" />
        {scrim.registrationOpen ? "Close Reg" : "Open Reg"}
      </Button>
      <Button
        size="sm"
        variant="destructive"
        disabled={isPending}
        onClick={() => {
          if (!window.confirm(`Delete "${scrim.title}"? This cannot be undone.`)) return
          startTransition(async () => {
            try {
              await deleteScrim(scrim.id)
              toast.success("Scrim deleted")
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Failed to delete")
            }
          })
        }}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </>
  )
}

export function AdminScrimList({
  scrims,
  isAdmin,
  bookingsByScrim = {},
}: {
  scrims: AdminScrim[]
  isAdmin: boolean
  bookingsByScrim?: Record<string, RosterBooking[]>
}) {
  const [, startTransition] = useTransition()

  if (scrims.length === 0) {
    return (
      <div className="glass rounded-2xl p-12 text-center text-sm text-muted-foreground">
        No scrims yet. Create your first scrim to get started.
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-3">
      {scrims.map((scrim) => (
        <li key={scrim.id} className="glass flex flex-col gap-3 rounded-2xl p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="min-w-0 flex-1 truncate font-display text-lg font-bold">
              {scrim.title}
            </h2>
            <Badge variant="secondary">{scrim.startTime}</Badge>
            <Badge variant="secondary">{scrim.map}</Badge>
            <Badge
              variant={scrim.status === "completed" ? "outline" : "default"}
              className="capitalize"
            >
              {scrim.status}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Users className="size-3.5" />
              {scrim.confirmedTeams}/{scrim.maxTeams} confirmed
              {scrim.pendingTeams > 0 && (
                <span className="text-chart-3">(+{scrim.pendingTeams} pending)</span>
              )}
            </span>
            <span>Entry {formatTaka(scrim.priceBdt)}</span>
            <span>Prize {formatTaka(scrim.prizePoolBdt)}</span>
            <span className={scrim.registrationOpen ? "text-chart-4" : "text-destructive"}>
              {scrim.registrationOpen ? "Registration open" : "Registration closed"}
            </span>
            {scrim.roomPublished && (
              <span className="text-primary">
                Room live: {scrim.roomId} / {scrim.roomPassword}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ViewTeamsButton scrim={scrim} roster={bookingsByScrim[scrim.id] ?? []} />
            <PublishRoomButton scrim={scrim} />
            {scrim.roomPublished && (
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
          </div>
        </li>
      ))}
    </ul>
  )
}
