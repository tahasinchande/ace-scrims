"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { UserBooking } from "@/lib/queries/dashboard"
import { bdt, formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Clock, MapPin, KeyRound, Eye, EyeOff, Copy, Check, Trophy, Lock, MessageCircle } from "lucide-react"

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

export function BookingCard({
  booking,
  championRushWhatsappUrl = "https://whatsapp.com/channel/0029Vb7Bq9w42DcT1O2b0s3V",
}: {
  booking: UserBooking
  championRushWhatsappUrl?: string
}) {
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

      {/* Official Champion Rush WhatsApp Channel Link - strictly visible ONLY to users with a verified/successful registration for Friday 10 PM Champion Rush */}
      {(() => {
        const isFridayChampionRush = Boolean(
          scrim &&
          (
            scrim.title?.trim().toLowerCase() === "10 pm champion rush" ||
            scrim.title?.trim().toLowerCase() === "friday 10 pm champion rush" ||
            scrim.slug === "10-pm-champion-rush" ||
            scrim.id === "scrim-fri-10pm-cr" ||
            (
              scrim.title?.toLowerCase().includes("champion rush") &&
              (scrim.startTime?.includes("10:00") || scrim.startTime === "22:00") &&
              !scrim.title?.toLowerCase().includes("8:00") &&
              !scrim.startTime?.includes("8:00")
            )
          )
        )
        const isBookingSuccessful = booking.status === "confirmed" || (booking.status as string) === "successful"

        if (!isFridayChampionRush || !isBookingSuccessful) return null

        return (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4">
            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-1.5 font-display text-sm font-bold uppercase tracking-wider text-emerald-400">
                <MessageCircle className="size-4" />
                Official Champion Rush WhatsApp Channel
              </span>
              <p className="text-xs text-muted-foreground">
                Room credentials, live leaderboard, and match updates for all 8 matches are posted directly in this channel.
              </p>
            </div>
            <a
              href={championRushWhatsappUrl || "https://whatsapp.com/channel/0029Vb7Bq9w42DcT1O2b0s3V"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition-colors shadow-lg shrink-0"
            >
              <MessageCircle className="size-4" />
              Join WhatsApp Channel
            </a>
          </div>
        )
      })()}

      {/* Room credentials */}
      {booking.status === "confirmed" && (
        <div className="rounded-xl border border-border/60 p-4 flex flex-col gap-3">
          <p className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide">
            <KeyRound className="size-4 text-primary" aria-hidden />
            Room Credentials &amp; Joining Details
          </p>
          {roomVisible ? (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2 border border-border/40">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Room ID</p>
                    <p className="font-mono text-base font-bold text-primary">{scrim.roomId}</p>
                  </div>
                  <CopyButton value={scrim.roomId!} label="Room ID" />
                </div>
                <div className="flex items-center justify-between rounded-lg bg-secondary/60 px-3 py-2 border border-border/40">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Password</p>
                    <p className="font-mono text-base font-bold text-foreground">
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

              {/* Explicit Joining Instructions Box */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs leading-relaxed flex flex-col gap-1.5">
                <span className="font-bold text-primary uppercase text-[11px] tracking-wider">
                  Important Room Joining Instructions:
                </span>
                <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                  <li>
                    Sit strictly in your assigned <strong className="text-foreground">Slot #{booking.slotNumber}</strong> inside the Free Fire custom room.
                  </li>
                  <li>
                    Entering any other team&apos;s slot will cause room moderators to kick your players immediately.
                  </li>
                  <li>
                    Enter the room within <strong className="text-foreground">5 minutes</strong>. The match starts promptly 10 minutes after room creation.
                  </li>
                  <li>
                    Mobile devices only. Emulators and iPad aspect ratio modifiers are strictly prohibited.
                  </li>
                </ul>
              </div>
            </>
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
