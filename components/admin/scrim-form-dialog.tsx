"use client"

import { useActionState, useEffect, useState } from "react"
import { createScrim, updateScrim } from "@/app/actions/admin"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { Scrim } from "@/lib/db/schema"
import { Loader2, Plus, Pencil } from "lucide-react"
import { toast } from "sonner"

const MAPS = ["Bermuda", "Purgatory", "Kalahari", "Alpine", "NeXTerra"]
const TIMES = ["7:00 PM", "8:00 PM", "9:00 PM", "10:00 PM", "11:00 PM", "12:00 AM"]

const initialState = { ok: false, error: null as string | null }

function ScrimFields({ scrim }: { scrim?: Scrim }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required minLength={3} maxLength={80} defaultValue={scrim?.title} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="startTime">Start time</Label>
        <select
          id="startTime"
          name="startTime"
          required
          defaultValue={scrim?.startTime ?? "7:00 PM"}
          className="h-9 rounded-md border border-input bg-secondary px-3 text-sm"
        >
          {TIMES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="map">Map</Label>
        <select
          id="map"
          name="map"
          required
          defaultValue={scrim?.map ?? "Bermuda"}
          className="h-9 rounded-md border border-input bg-secondary px-3 text-sm"
        >
          {MAPS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mode">Mode</Label>
        <Input id="mode" name="mode" required defaultValue={scrim?.mode ?? "Squad (4v4)"} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="maxTeams">Max teams</Label>
        <Input
          id="maxTeams"
          name="maxTeams"
          type="number"
          min={2}
          max={48}
          required
          defaultValue={scrim?.maxTeams ?? 12}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="priceBdt">Entry fee (BDT)</Label>
        <Input
          id="priceBdt"
          name="priceBdt"
          type="number"
          min={0}
          required
          defaultValue={scrim?.priceBdt ?? 50}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="prizePoolBdt">Prize pool (BDT)</Label>
        <Input
          id="prizePoolBdt"
          name="prizePoolBdt"
          type="number"
          min={0}
          required
          defaultValue={scrim?.prizePoolBdt ?? 400}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="banner">Banner image (optional)</Label>
        <Input id="banner" name="banner" type="file" accept="image/*" />
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={2} defaultValue={scrim?.description ?? ""} />
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="rules">Rules</Label>
        <Textarea id="rules" name="rules" rows={4} defaultValue={scrim?.rules ?? ""} />
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={2} defaultValue={scrim?.notes ?? ""} />
      </div>
    </div>
  )
}

export function CreateScrimButton() {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(createScrim, initialState)

  useEffect(() => {
    if (state.ok) {
      toast.success("Scrim created")
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
            New Scrim
          </Button>
        }
      />
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display uppercase">Create Scrim</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-5">
          <ScrimFields />
          <Button type="submit" disabled={pending} className="font-display font-bold uppercase">
            {pending && <Loader2 className="size-4 animate-spin" />}
            Create Scrim
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function EditScrimButton({ scrim }: { scrim: Scrim }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(updateScrim, initialState)

  useEffect(() => {
    if (state.ok) {
      toast.success("Scrim updated")
      setOpen(false)
    } else if (state.error) {
      toast.error(state.error)
    }
  }, [state])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm">
            <Pencil className="size-3.5" />
            Edit
          </Button>
        }
      />
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display uppercase">Edit Scrim</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-5">
          <input type="hidden" name="scrimId" value={scrim.id} />
          <ScrimFields scrim={scrim} />
          <Button type="submit" disabled={pending} className="font-display font-bold uppercase">
            {pending && <Loader2 className="size-4 animate-spin" />}
            Save Changes
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
