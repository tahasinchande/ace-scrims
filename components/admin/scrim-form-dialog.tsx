"use client"

import { useState, useTransition, useRef } from "react"
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
import { Loader2, Plus, Pencil, Image as ImageIcon, UploadCloud, X } from "lucide-react"
import { uploadMediaFile } from "@/lib/client-upload"
import { resolveImageUrl } from "@/lib/image-url"
import { toast } from "sonner"

const MAPS = ["Bermuda", "Purgatory", "Kalahari", "Alpine", "NeXTerra"]
const TIMES = ["7:00 PM", "8:00 PM", "9:00 PM", "10:00 PM", "11:00 PM", "12:00 AM"]

function ScrimFields({
  scrim,
  bannerUrl,
  setBannerUrl,
  uploadingBanner,
  setUploadingBanner,
  bannerProgress,
  setBannerProgress,
}: {
  scrim?: Scrim
  bannerUrl: string
  setBannerUrl: (url: string) => void
  uploadingBanner: boolean
  setUploadingBanner: (val: boolean) => void
  bannerProgress: number
  setBannerProgress: (val: number) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 25 * 1024 * 1024) {
      toast.error("Banner image must be under 25MB")
      return
    }

    setUploadingBanner(true)
    setBannerProgress(15)
    try {
      const res = await uploadMediaFile(file, "banners", (pct) => setBannerProgress(pct))
      setBannerUrl(res.url)
      setBannerProgress(100)
      toast.success("Banner uploaded successfully")
    } catch (err) {
      toast.error("Banner upload failed: " + (err instanceof Error ? err.message : "Upload error"))
    } finally {
      setUploadingBanner(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <input type="hidden" name="bannerUrl" value={bannerUrl} />

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
        <Input id="mode" name="mode" required defaultValue={scrim?.mode ?? "BATTLE ROYALE"} />
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

      {/* Robust Banner Upload Section */}
      <div className="flex flex-col gap-2 sm:col-span-2 border border-border/60 rounded-xl p-3.5 bg-secondary/20">
        <Label htmlFor="banner-file" className="flex items-center justify-between text-xs font-semibold">
          <span className="flex items-center gap-1.5">
            <ImageIcon className="size-4 text-primary" /> Scrim Banner Image
          </span>
          {bannerUrl && (
            <button
              type="button"
              onClick={() => setBannerUrl("")}
              className="text-[11px] text-destructive hover:underline flex items-center gap-1"
            >
              <X className="size-3" /> Remove Banner
            </button>
          )}
        </Label>

        {bannerUrl && (
          <div className="relative rounded-lg overflow-hidden border border-border/80 aspect-video max-h-40 bg-black/40">
            <img
              src={resolveImageUrl(bannerUrl)}
              alt="Banner Preview"
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <input
          ref={fileInputRef}
          id="banner-file"
          type="file"
          accept="image/*"
          onChange={handleBannerUpload}
          className="hidden"
        />

        <Button
          type="button"
          variant="outline"
          disabled={uploadingBanner}
          onClick={() => fileInputRef.current?.click()}
          className="w-full border-dashed h-11 text-xs"
        >
          {uploadingBanner ? (
            <div className="flex items-center gap-2">
              <Loader2 className="size-4 animate-spin text-primary" />
              <span>Uploading banner... {bannerProgress}%</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <UploadCloud className="size-4 text-primary" />
              <span>{bannerUrl ? "Change Banner Image (PNG, JPG, WebP)" : "Upload Banner Image"}</span>
            </div>
          )}
        </Button>
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="description">Description</Label>
        <Textarea id="description" name="description" rows={2} defaultValue={scrim?.description ?? ""} />
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="rules">Rules</Label>
        <Textarea id="rules" name="rules" rows={3} defaultValue={scrim?.rules ?? ""} />
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
  const [isPending, startTransition] = useTransition()
  const [bannerUrl, setBannerUrl] = useState("")
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [bannerProgress, setBannerProgress] = useState(0)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (uploadingBanner) {
      toast.info("Please wait for the banner upload to complete")
      return
    }

    const formData = new FormData(e.currentTarget)
    if (bannerUrl) formData.set("bannerUrl", bannerUrl)

    startTransition(async () => {
      const res = await createScrim(null, formData)
      if (res.ok) {
        toast.success("Scrim created successfully")
        setOpen(false)
        setBannerUrl("")
      } else {
        toast.error(res.error || "Failed to create scrim")
      }
    })
  }

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
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <ScrimFields
            bannerUrl={bannerUrl}
            setBannerUrl={setBannerUrl}
            uploadingBanner={uploadingBanner}
            setUploadingBanner={setUploadingBanner}
            bannerProgress={bannerProgress}
            setBannerProgress={setBannerProgress}
          />
          <Button type="submit" disabled={isPending || uploadingBanner} className="font-display font-bold uppercase">
            {isPending && <Loader2 className="size-4 animate-spin mr-2" />}
            Create Scrim
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function EditScrimButton({ scrim }: { scrim: Scrim }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [bannerUrl, setBannerUrl] = useState(scrim.bannerUrl || "")
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [bannerProgress, setBannerProgress] = useState(0)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (uploadingBanner) {
      toast.info("Please wait for the banner upload to complete")
      return
    }

    const formData = new FormData(e.currentTarget)
    formData.set("scrimId", scrim.id)
    if (bannerUrl) formData.set("bannerUrl", bannerUrl)

    startTransition(async () => {
      const res = await updateScrim(null, formData)
      if (res.ok) {
        toast.success("Scrim updated successfully")
        setOpen(false)
      } else {
        toast.error(res.error || "Failed to update scrim")
      }
    })
  }

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
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <ScrimFields
            scrim={scrim}
            bannerUrl={bannerUrl}
            setBannerUrl={setBannerUrl}
            uploadingBanner={uploadingBanner}
            setUploadingBanner={setUploadingBanner}
            bannerProgress={bannerProgress}
            setBannerProgress={setBannerProgress}
          />
          <Button type="submit" disabled={isPending || uploadingBanner} className="font-display font-bold uppercase">
            {isPending && <Loader2 className="size-4 animate-spin mr-2" />}
            Save Changes
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
