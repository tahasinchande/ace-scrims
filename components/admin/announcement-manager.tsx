"use client"

import { useActionState, useEffect, useState, useTransition } from "react"
import { setSetting, broadcastNotification } from "@/app/actions/admin"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Megaphone, Radio } from "lucide-react"
import { toast } from "sonner"

const initialState = { ok: false, error: null as string | null }

export function AnnouncementManager({ currentBanner }: { currentBanner: string }) {
  const [banner, setBanner] = useState(currentBanner)
  const [isPending, startTransition] = useTransition()
  const [state, formAction, broadcastPending] = useActionState(broadcastNotification, initialState)

  useEffect(() => {
    if (state.ok) toast.success("Broadcast sent to all users")
    else if (state.error) toast.error(state.error)
  }, [state])

  function saveBanner() {
    startTransition(async () => {
      try {
        await setSetting("announcement", banner.trim())
        toast.success(banner.trim() ? "Banner updated" : "Banner cleared")
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to save")
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="glass flex flex-col gap-4 rounded-2xl p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide">
          <Megaphone className="size-4 text-primary" />
          Site Banner
        </h2>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="banner-text">Banner text (leave empty to hide)</Label>
          <Input
            id="banner-text"
            value={banner}
            onChange={(e) => setBanner(e.target.value)}
            maxLength={160}
            placeholder="e.g. Tonight's 9 PM scrim is on Purgatory — extra ৳100 prize!"
          />
        </div>
        <div>
          <Button onClick={saveBanner} disabled={isPending} className="font-display font-bold uppercase">
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Save Banner
          </Button>
        </div>
      </section>

      <section className="glass flex flex-col gap-4 rounded-2xl p-5">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold uppercase tracking-wide">
          <Radio className="size-4 text-chart-3" />
          Broadcast Notification
        </h2>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="broadcast-title">Title</Label>
            <Input id="broadcast-title" name="title" required minLength={3} maxLength={120} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="broadcast-body">Message (optional)</Label>
            <Textarea id="broadcast-body" name="body" rows={3} maxLength={500} />
          </div>
          <div>
            <Button
              type="submit"
              disabled={broadcastPending}
              className="font-display font-bold uppercase"
            >
              {broadcastPending && <Loader2 className="size-4 animate-spin" />}
              Send to All Users
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}
