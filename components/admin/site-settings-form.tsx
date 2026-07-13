"use client"

import { useState, useTransition } from "react"
import { setSetting } from "@/app/actions/admin"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

export function SiteSettingsForm({
  discordUrl,
  facebookUrl,
  supportPhone,
}: {
  discordUrl: string
  facebookUrl: string
  supportPhone: string
}) {
  const [discord, setDiscord] = useState(discordUrl)
  const [facebook, setFacebook] = useState(facebookUrl)
  const [phone, setPhone] = useState(supportPhone)
  const [isPending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      try {
        await Promise.all([
          setSetting("discord_url", discord.trim()),
          setSetting("facebook_url", facebook.trim()),
          setSetting("support_phone", phone.trim()),
        ])
        toast.success("Settings saved")
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to save settings")
      }
    })
  }

  return (
    <div className="glass flex max-w-xl flex-col gap-4 rounded-2xl p-5">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="discord-url">Discord invite URL</Label>
        <Input
          id="discord-url"
          type="url"
          value={discord}
          onChange={(e) => setDiscord(e.target.value)}
          placeholder="https://discord.gg/…"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="facebook-url">Facebook page URL</Label>
        <Input
          id="facebook-url"
          type="url"
          value={facebook}
          onChange={(e) => setFacebook(e.target.value)}
          placeholder="https://facebook.com/…"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="support-phone">Support phone / WhatsApp</Label>
        <Input
          id="support-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+880…"
        />
      </div>
      <div>
        <Button onClick={save} disabled={isPending} className="font-display font-bold uppercase">
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Save Settings
        </Button>
      </div>
    </div>
  )
}
