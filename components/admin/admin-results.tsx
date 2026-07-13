"use client"

import { useActionState, useEffect, useState, useTransition } from "react"
import Image from "next/image"
import { publishResult, markPrizeSent } from "@/app/actions/staff"
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
import type { MatchResult } from "@/lib/db/schema"
import { formatTaka, formatDate } from "@/lib/format"
import { Loader2, Plus, Trophy, CheckCheck } from "lucide-react"
import { toast } from "sonner"

type ResultRow = {
  result: MatchResult
  scrimTitle: string | null
  startTime: string | null
}

type ScrimOption = { id: string; title: string; startTime: string }

const initialState = { ok: false, error: null as string | null }

function PublishResultButton({ scrims }: { scrims: ScrimOption[] }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(publishResult, initialState)

  useEffect(() => {
    if (state.ok) {
      toast.success("Result published — participants notified")
      setOpen(false)
    } else if (state.error) {
      toast.error(state.error)
    }
  }, [state])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="glow-primary font-display font-bold uppercase">
            <Plus className="size-4" />
            Publish Result
          </Button>
        }
      />
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display uppercase">Publish Match Result</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="result-scrim">Scrim</Label>
            <select
              id="result-scrim"
              name="scrimId"
              required
              className="h-9 rounded-md border border-input bg-secondary px-3 text-sm"
            >
              <option value="">Select a scrim…</option>
              {scrims.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} — {s.startTime}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="winningTeam">Winning team</Label>
            <Input id="winningTeam" name="winningTeam" required maxLength={100} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="kills">Kills</Label>
              <Input id="kills" name="kills" type="number" min={0} max={200} required defaultValue={0} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="placement">Placement</Label>
              <Input id="placement" name="placement" type="number" min={1} max={12} required defaultValue={1} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prizeBdt">Prize (BDT)</Label>
              <Input id="prizeBdt" name="prizeBdt" type="number" min={0} required defaultValue={400} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="screenshot">Result screenshot (optional)</Label>
            <Input id="screenshot" name="screenshot" type="file" accept="image/*" />
          </div>

          <Button type="submit" disabled={pending} className="font-display font-bold uppercase">
            {pending && <Loader2 className="size-4 animate-spin" />}
            Publish Result
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function AdminResults({ results, scrims }: { results: ResultRow[]; scrims: ScrimOption[] }) {
  const [isPending, startTransition] = useTransition()

  return (
    <div className="flex flex-col gap-4">
      <div>
        <PublishResultButton scrims={scrims} />
      </div>

      {results.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center text-sm text-muted-foreground">
          No results published yet.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {results.map(({ result, scrimTitle }) => (
            <li key={result.id} className="glass flex flex-col gap-3 rounded-2xl p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Trophy className="size-4 text-primary" />
                <h2 className="min-w-0 flex-1 truncate font-display text-lg font-bold">
                  {result.winningTeam}
                </h2>
                <Badge variant={result.prizeStatus === "sent" ? "default" : "secondary"}>
                  {result.prizeStatus === "sent" ? "Prize sent" : "Prize pending"}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span>{scrimTitle ?? "Deleted scrim"}</span>
                <span>{result.kills} kills</span>
                <span>#{result.placement}</span>
                <span className="font-medium text-foreground">{formatTaka(result.prizeBdt)}</span>
                <span>{formatDate(result.matchDate)}</span>
              </div>

              {result.screenshotUrl && (
                <Image
                  src={result.screenshotUrl || "/placeholder.svg"}
                  alt={`Result screenshot for ${result.winningTeam}`}
                  width={480}
                  height={270}
                  className="max-w-sm rounded-lg border border-border object-cover"
                />
              )}

              {result.prizeStatus !== "sent" && (
                <div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() =>
                      startTransition(async () => {
                        await markPrizeSent(result.id)
                        toast.success("Prize marked as sent")
                      })
                    }
                  >
                    <CheckCheck className="size-3.5" />
                    Mark Prize Sent
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
