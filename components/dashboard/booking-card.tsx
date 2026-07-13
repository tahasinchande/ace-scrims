"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { UserBooking } from "@/lib/queries/dashboard"
import { bdt, formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Clock, MapPin, KeyRound, Eye, EyeOff, Copy, Check, Trophy, Lock } from "lucide-react"

const statusStyles: Record<string, string> = {
  confirmed: "bg-success/15 text-success border-success/30",
  pending: "bg-warning/15 text-warning border-warning/30",
  cancelled: "bg-muted text-muted-foreground border-border",
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={`Copy ${label}`}
      onClick={async () => {
        await navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? <Check className="size-3.5 text-success" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
    </Button>
  )
}

export function BookingCard({ booking }: { booking: UserBooking }) {
  const [showPassword, setShowPassword] = useState(false)
  const scrim = booking.scrim
  const roomVisible = booking.status === "confirmed" && scrim?.roomPublished && scrim.roomId

  return (
    <article className="glass flex flex-col gap-4 rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold">{scrim?.title ?? "Scrim removed"}</h3>
          {scrim && (
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="size-3.5" aria-hidden />
                {scrim.startTime} · {formatDate(scrim.scrimDate)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-3.5" aria-hidden />
                {scrim.map} · {scrim.mode}
              </span>
            </p>
          )}
        </div>
        <Badge variant="outline" className={cn("border font-semibold capitalize", statusStyles[booking.status] ?? statusStyles.pending)}>
          {booking.status}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        <div className="rounded-lg bg-secondary/60 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Team</p>
          <p className="truncate font-semibold">{booking.teamName}</p>
        </div>
        <div className="rounded-lg bg-secondary/60 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Booked</p>
          <p className="font-semibold">{formatDate(booking.createdAt)}</p>
        </div>
        <div className="rounded-lg bg-secondary/60 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Entry</p>
          <p className="font-semibold">{scrim ? bdt(scrim.priceBdt) : "—"}</p>
        </div>
        <div className="rounded-lg bg-secondary/60 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Slot</p>
          <p className="font-semibold">{booking.slotNumber ? `#${booking.slotNumber}` : "TBA"}</p>
        </div>
      </div>

      {/* Room credentials */}
      {booking.status === "confirmed" && (
        <div className="rounded-xl border border-border/60 p-4">
          <p className="mb-3 flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide">
            <KeyRound className="size-4 text-primary" aria-hidden />
            Room Credentials
          </p>
          {roomVisible ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Room ID</p>
                  <p className="font-mono font-semibold">{scrim.roomId}</p>
                </div>
                <CopyButton value={scrim.roomId!} label="Room ID" />
              </div>
              <div className="flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Password</p>
                  <p className="font-mono font-semibold">
                    {showPassword ? scrim.roomPassword : "••••••••"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff className="size-3.5" aria-hidden /> : <Eye className="size-3.5" aria-hidden />}
                  </Button>
                  {scrim.roomPassword && <CopyButton value={scrim.roomPassword} label="password" />}
                </div>
              </div>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="size-4" aria-hidden />
              Room ID and password will appear here once published by a moderator — usually 10-15
              minutes before start.
            </p>
          )}
        </div>
      )}

      {/* Result */}
      {booking.result && (
        <div className="flex items-center justify-between rounded-xl border border-success/30 bg-success/10 px-4 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-success">
            <Trophy className="size-4" aria-hidden />
            Winner — {booking.result.kills} kills · {bdt(booking.result.prizeBdt)}
          </p>
          <Badge variant="outline" className="border-success/30 capitalize text-success">
            Prize {booking.result.prizeStatus}
          </Badge>
        </div>
      )}
    </article>
  )
}
