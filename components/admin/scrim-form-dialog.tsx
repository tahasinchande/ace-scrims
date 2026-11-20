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
import {
  Loader2,
  Plus,
  Pencil,
  Image as ImageIcon,
  UploadCloud,
  X,
  MapPin,
  Sparkles,
  ArrowUp,
  ArrowDown,
} from "lucide-react"
import { uploadMediaFile } from "@/lib/client-upload"
import { resolveImageUrl } from "@/lib/image-url"
import {
  PRESET_MAPS,
  PRESET_START_TIMES,
  SCRIM_CATEGORY_OPTIONS,
  getScrimCategoryConfig,
  parseMapsList,
  formatMapsDisplay,
} from "@/lib/scrim-categories"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

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

  const initialCat = scrim?.category?.trim() || "Daily Scrims"
  const [category, setCategory] = useState<string>(initialCat)
  const [title, setTitle] = useState<string>(scrim?.title || "")
  const [startTime, setStartTime] = useState<string>(scrim?.startTime || "7:00 PM")
  const [mode, setMode] = useState<string>(scrim?.mode || "BATTLE ROYALE")
  const [maxTeams, setMaxTeams] = useState<string>(String(scrim?.maxTeams ?? 12))
  const [priceBdt, setPriceBdt] = useState<string>(String(scrim?.priceBdt ?? 35))
  const [prizePoolBdt, setPrizePoolBdt] = useState<string>(String(scrim?.prizePoolBdt ?? 330))
  const [selectedMaps, setSelectedMaps] = useState<string[]>(() =>
    scrim?.map ? parseMapsList(scrim.map) : ["Bermuda", "Purgatory", "Kalahari"]
  )
  const [customMapInput, setCustomMapInput] = useState<string>("")
  const [description, setDescription] = useState<string>(scrim?.description || "")
  const [rules, setRules] = useState<string>(scrim?.rules || "")
  const [notes, setNotes] = useState<string>(scrim?.notes || "")

  const mapsValue = formatMapsDisplay(selectedMaps)

  function togglePresetMap(mapName: string) {
    setSelectedMaps((prev) => {
      const exists = prev.some((m) => m.toLowerCase() === mapName.toLowerCase())
      if (exists) {
        if (prev.length <= 1) {
          toast.info("Keep at least one map selected.")
          return prev
        }
        return prev.filter((m) => m.toLowerCase() !== mapName.toLowerCase())
      }
      return [...prev, mapName]
    })
  }

  function addCustomMap() {
    const clean = customMapInput.trim()
    if (!clean) return
    if (selectedMaps.some((m) => m.toLowerCase() === clean.toLowerCase())) {
      toast.info(`"${clean}" is already in the map list.`)
      setCustomMapInput("")
      return
    }
    setSelectedMaps((prev) => [...prev, clean])
    setCustomMapInput("")
  }

  function removeMap(idx: number) {
    setSelectedMaps((prev) => {
      if (prev.length <= 1) {
        toast.info("At least one map is required.")
        return prev
      }
      return prev.filter((_, i) => i !== idx)
    })
  }

  function moveMap(idx: number, dir: -1 | 1) {
    setSelectedMaps((prev) => {
      const nextIdx = idx + dir
      if (nextIdx < 0 || nextIdx >= prev.length) return prev
      const copy = [...prev]
      const temp = copy[idx]
      copy[idx] = copy[nextIdx]
      copy[nextIdx] = temp
      return copy
    })
  }

  function applyCategoryDefaults(targetCategory: string, showToast = true) {
    const cfg = getScrimCategoryConfig(targetCategory)
    const nextMaps = [...cfg.defaultMaps]
    const mapsStr = formatMapsDisplay(nextMaps)
    const teamsNum = Math.max(2, Number(maxTeams) || 12)
    const effectiveTitle = title.trim() || `${startTime.trim() || "7:00 PM"} ${cfg.shortLabel}`

    setSelectedMaps(nextMaps)
    setPriceBdt(String(cfg.defaultPriceBdt))
    setPrizePoolBdt(String(cfg.defaultPrizePoolBdt))
    setDescription(cfg.defaultDescription(effectiveTitle, mapsStr))
    setRules(cfg.defaultRules(mapsStr, teamsNum))
    setNotes(cfg.defaultNotes(mapsStr))
    if (showToast) {
      toast.success(`Applied ${cfg.label} defaults (maps, entry fee, prize pool, rules & description).`)
    }
  }

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

  const parsedEntryFee = Number(priceBdt)

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <input type="hidden" name="bannerUrl" value={bannerUrl} />
      <input type="hidden" name="map" value={mapsValue} />

      {/* Category & Inherited Defaults */}
      <div className="flex flex-col gap-2 sm:col-span-2 rounded-xl border border-primary/25 bg-primary/5 p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="category" className="text-xs font-bold uppercase tracking-wider text-primary">
            Scrim Category
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => applyCategoryDefaults(category, true)}
            className="h-7 gap-1.5 text-[11px]"
          >
            <Sparkles className="size-3 text-primary" />
            Apply Category Defaults
          </Button>
        </div>
        <select
          id="category"
          name="category"
          value={category}
          onChange={(e) => {
            const nextCat = e.target.value
            setCategory(nextCat)
            if (!scrim && !description.trim() && !rules.trim()) {
              applyCategoryDefaults(nextCat, false)
            }
          }}
          className="h-9 rounded-md border border-input bg-secondary px-3 text-sm font-medium"
        >
          {SCRIM_CATEGORY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label} ({opt.scheduleGroup === "friday" ? "Friday Schedule" : "Daily Schedule"})
            </option>
          ))}
        </select>
        <p className="text-[11px] text-muted-foreground">
          Leaving description, rules, or notes blank automatically inherits the selected category&apos;s defaults.
        </p>
      </div>

      {/* Custom Title */}
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="title">Custom Scrim Title</Label>
        <Input
          id="title"
          name="title"
          required
          minLength={2}
          maxLength={120}
          placeholder="e.g. Midnight Giveaway Scrims or 8:30 PM Pro Lobby"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      {/* Custom Start Time + Quick Presets */}
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="startTime">Start Time (Custom or Preset)</Label>
        <Input
          id="startTime"
          name="startTime"
          required
          minLength={2}
          maxLength={40}
          placeholder="e.g. 7:30 PM, 9:15 PM, 12:00 AM"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
        />
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {PRESET_START_TIMES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setStartTime(t)}
              className={cn(
                "rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors",
                startTime.toLowerCase() === t.toLowerCase()
                  ? "border-primary bg-primary/20 text-primary"
                  : "border-border/60 bg-secondary/40 text-muted-foreground hover:text-foreground"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Dynamic Multi-Select + Custom Map Builder */}
      <div className="flex flex-col gap-2.5 sm:col-span-2 rounded-xl border border-border/70 bg-secondary/20 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
            <MapPin className="size-3.5 text-primary" />
            Maps ({selectedMaps.length} selected)
          </Label>
          <span className="text-[11px] text-muted-foreground">Pick multiple maps or add custom names</span>
        </div>

        {/* Preset Map Toggles */}
        <div className="flex flex-wrap gap-1.5">
          {PRESET_MAPS.map((m) => {
            const active = selectedMaps.some((x) => x.toLowerCase() === m.toLowerCase())
            return (
              <button
                key={m}
                type="button"
                onClick={() => togglePresetMap(m)}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors",
                  active
                    ? "border-primary bg-primary/20 text-primary"
                    : "border-border/60 bg-background/50 text-muted-foreground hover:text-foreground"
                )}
              >
                {active ? "✓ " : "+ "}
                {m}
              </button>
            )
          })}
        </div>

        {/* Custom Map Input */}
        <div className="flex gap-2">
          <Input
            type="text"
            value={customMapInput}
            onChange={(e) => setCustomMapInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                addCustomMap()
              }
            }}
            placeholder="Add custom map name (e.g. Bermuda 2.0, Custom Arena)..."
            className="h-8 text-xs"
          />
          <Button type="button" size="sm" variant="outline" onClick={addCustomMap} className="h-8 shrink-0">
            <Plus className="size-3.5 mr-1" />
            Add Map
          </Button>
        </div>

        {/* Ordered Map Match List */}
        {selectedMaps.length > 0 && (
          <div className="flex flex-col gap-1.5 pt-1">
            <span className="text-[11px] font-medium text-muted-foreground">Match Order:</span>
            <div className="flex flex-wrap gap-1.5">
              {selectedMaps.map((m, idx) => (
                <div
                  key={`${m}-${idx}`}
                  className="inline-flex items-center gap-1 rounded-md border border-primary/35 bg-primary/10 px-2 py-1 text-xs font-semibold text-foreground"
                >
                  <span className="font-mono text-[10px] text-primary">M{idx + 1}</span>
                  <span>{m}</span>
                  <button
                    type="button"
                    onClick={() => moveMap(idx, -1)}
                    disabled={idx === 0}
                    className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    title="Move earlier"
                  >
                    <ArrowUp className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveMap(idx, 1)}
                    disabled={idx === selectedMaps.length - 1}
                    className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
                    title="Move later"
                  >
                    <ArrowDown className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeMap(idx)}
                    className="p-0.5 text-muted-foreground hover:text-destructive"
                    title="Remove map"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="mode">Mode</Label>
        <Input
          id="mode"
          name="mode"
          required
          value={mode}
          onChange={(e) => setMode(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="maxTeams">Max teams</Label>
        <Input
          id="maxTeams"
          name="maxTeams"
          type="number"
          min={2}
          max={64}
          required
          value={maxTeams}
          onChange={(e) => setMaxTeams(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="priceBdt">Entry fee (BDT)</Label>
        <Input
          id="priceBdt"
          name="priceBdt"
          type="number"
          min={0}
          max={100000}
          required
          value={priceBdt}
          onChange={(e) => setPriceBdt(e.target.value)}
        />
        <p className="text-[11px] text-muted-foreground">
          {parsedEntryFee === 0
            ? "Free / Giveaway scrim (৳0) — squads confirm instantly without payment."
            : "Set any custom amount, including 0 for free/giveaway scrims."}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="prizePoolBdt">Prize pool (BDT)</Label>
        <Input
          id="prizePoolBdt"
          name="prizePoolBdt"
          type="number"
          min={0}
          max={10000000}
          required
          value={prizePoolBdt}
          onChange={(e) => setPrizePoolBdt(e.target.value)}
        />
        <p className="text-[11px] text-muted-foreground">
          Any custom prize pool (e.g. 0, 330, 500, 1000, 5000 BDT).
        </p>
      </div>

      {/* Banner Upload Section */}
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
        <Label htmlFor="description">Description (optional — inherits category default if blank)</Label>
        <Textarea
          id="description"
          name="description"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="rules">Rules (optional — inherits category default if blank)</Label>
        <Textarea
          id="rules"
          name="rules"
          rows={3}
          value={rules}
          onChange={(e) => setRules(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="notes">Notes (optional — inherits category default if blank)</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
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
      <DialogContent className="max-h-[88svh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display uppercase">Create Custom Scrim</DialogTitle>
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
      <DialogContent className="max-h-[88svh] overflow-y-auto sm:max-w-2xl">
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
