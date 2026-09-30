"use client"

import { useState, useTransition, useRef } from "react"
import Image from "next/image"
import { publishResult, updateResult, markPrizeSent, deleteResult } from "@/app/actions/staff"
import { bulkDeleteResults } from "@/app/actions/admin"
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
import type { MatchResult, Booking } from "@/lib/db/schema"
import { formatTaka, formatDate } from "@/lib/format"
import { resolveImageUrl, resolveImageUrls } from "@/lib/image-url"
import { uploadMediaFile } from "@/lib/client-upload"
import {
  Loader2,
  Plus,
  Trophy,
  CheckCheck,
  Trash2,
  Edit2,
  Crown,
  Medal,
  Award,
  UploadCloud,
  X,
  Users,
  CheckSquare,
  Square,
} from "lucide-react"
import { toast } from "sonner"

type ResultRow = {
  result: MatchResult
  scrimTitle: string | null
  startTime: string | null
}

type ScrimOption = { id: string; title: string; startTime: string; prizePoolBdt?: number }
type RosterBooking = Booking & { userEmail: string | null }

const WINNER_TYPES = [
  { id: "Champion — 1st place", label: "Champion — 1st place", placement: 1, defaultPrizePct: 0.55 },
  { id: "Runner-up — 2nd place", label: "Runner-up — 2nd place", placement: 2, defaultPrizePct: 0.30 },
  { id: "Second Runner-up — 3rd place", label: "Second Runner-up — 3rd place", placement: 3, defaultPrizePct: 0.15 },
  { id: "MVP Face Banner", label: "MVP Face Banner", placement: 1, defaultPrizePct: 0 },
  { id: "Top 3 Face Banner", label: "Top 3 Face Banner", placement: 1, defaultPrizePct: 0 },
  { id: "Overall Standing Banner", label: "Overall Standing Banner", placement: 1, defaultPrizePct: 0 },
]

export function EditResultDialog({
  result,
  scrimTitle,
}: {
  result: MatchResult
  scrimTitle: string | null
}) {
  const [open, setOpen] = useState(false)
  const [winningTeam, setWinningTeam] = useState(result.winningTeam)
  const [mvpPlayerName, setMvpPlayerName] = useState(result.mvpPlayerName || "")
  const [mvpTeamName, setMvpTeamName] = useState(result.mvpTeamName || "")
  const [winnerType, setWinnerType] = useState(result.category || "Champion — 1st place")
  const [kills, setKills] = useState(String(result.kills))
  const [placement, setPlacement] = useState(String(result.placement))
  const [prizeBdt, setPrizeBdt] = useState(String(result.prizeBdt))
  const [prizeStatus, setPrizeStatus] = useState(result.prizeStatus)

  const rawInitial = (Array.isArray(result.imageUrls) && result.imageUrls.length > 0)
    ? (result.imageUrls as string[])
    : result.screenshotUrl ? [result.screenshotUrl] : []
  const [uploadedUrls, setUploadedUrls] = useState<string[]>(rawInitial)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    setUploadProgress(10)
    try {
      const urls: string[] = []
      const fileList = Array.from(files)
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i]
        if (file.size > 25 * 1024 * 1024) {
          toast.error(`"${file.name}" is over 25MB`)
          continue
        }
        const res = await uploadMediaFile(file, "results", (pct) => {
          const overall = Math.round(((i + pct / 100) / fileList.length) * 100)
          setUploadProgress(overall)
        })
        urls.push(res.url)
      }
      setUploadedUrls((prev) => [...prev, ...urls])
      setUploadProgress(100)
      toast.success(`${urls.length} image(s) uploaded successfully`)
    } catch (err) {
      toast.error("Upload error: " + (err instanceof Error ? err.message : "Failed to upload"))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (uploading) {
      toast.info("Please wait for images to finish uploading")
      return
    }

    if (!winningTeam.trim()) {
      toast.error("Winning team is required")
      return
    }

    const actionData = new FormData()
    actionData.append("id", result.id)
    actionData.append("winningTeam", winningTeam.trim())
    if (mvpPlayerName.trim()) actionData.append("mvpPlayerName", mvpPlayerName.trim())
    if (mvpTeamName.trim()) actionData.append("mvpTeamName", mvpTeamName.trim())
    actionData.append("kills", kills)
    actionData.append("placement", placement)
    actionData.append("prizeBdt", prizeBdt)
    actionData.append("category", winnerType)
    actionData.append("prizeStatus", prizeStatus)
    actionData.append("imageUrlsJson", JSON.stringify(uploadedUrls))

    startTransition(async () => {
      const res = await updateResult(null, actionData)
      if (res.ok) {
        toast.success("Match result updated successfully!")
        setOpen(false)
      } else {
        toast.error(res.error ?? "Failed to update result")
      }
    })
  }

  const busy = uploading || isPending

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline" className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10">
            <Edit2 className="size-3.5" />
            Edit Result
          </Button>
        }
      />
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display uppercase flex items-center gap-2">
            <Trophy className="size-5 text-amber-400" />
            Edit Match Result: {winningTeam}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left">
          <div className="rounded-xl bg-secondary/50 p-3 text-xs text-muted-foreground">
            Scrim: <span className="font-bold text-foreground">{scrimTitle || "Scrim Match"}</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`edit-team-${result.id}`}>Winning Team Name *</Label>
            <Input
              id={`edit-team-${result.id}`}
              value={winningTeam}
              onChange={(e) => setWinningTeam(e.target.value)}
              required
              className="h-10 text-sm font-semibold"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`edit-type-${result.id}`}>Winner Type / Category *</Label>
            <select
              id={`edit-type-${result.id}`}
              value={winnerType}
              onChange={(e) => setWinnerType(e.target.value)}
              className="h-10 rounded-xl border border-input bg-secondary px-3 text-sm font-semibold text-primary"
            >
              <optgroup label="Podium Winners">
                <option value="Champion — 1st place">🏆 Champion — 1st place</option>
                <option value="Runner-up — 2nd place">🥈 Runner-up — 2nd place</option>
                <option value="Second Runner-up — 3rd place">🥉 Second Runner-up — 3rd place</option>
              </optgroup>
              <optgroup label="Special Banners">
                <option value="MVP Face Banner">⭐ MVP Face Banner</option>
                <option value="Top 3 Face Banner">🖼️ Top 3 Face Banner</option>
                <option value="Overall Standing Banner">📊 Overall Standing Banner</option>
              </optgroup>
            </select>
          </div>

          {/* MVP Dedicated Fields */}
          {(winnerType === "MVP Face Banner" || mvpPlayerName || mvpTeamName) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl border border-amber-500/30 bg-amber-500/5">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`edit-mvp-player-${result.id}`} className="text-amber-400 font-semibold text-xs">
                  MVP Name
                </Label>
                <Input
                  id={`edit-mvp-player-${result.id}`}
                  value={mvpPlayerName}
                  onChange={(e) => setMvpPlayerName(e.target.value)}
                  placeholder="e.g. VIPER"
                  className="h-10 text-sm"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`edit-mvp-team-${result.id}`} className="text-amber-400 font-semibold text-xs">
                  Team Name
                </Label>
                <Input
                  id={`edit-mvp-team-${result.id}`}
                  value={mvpTeamName}
                  onChange={(e) => setMvpTeamName(e.target.value)}
                  placeholder="e.g. TEAM ACE"
                  className="h-10 text-sm"
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`edit-placement-${result.id}`}>Placement</Label>
              <Input
                id={`edit-placement-${result.id}`}
                type="number"
                min={1}
                max={12}
                required
                value={placement}
                onChange={(e) => setPlacement(e.target.value)}
                className="h-10 text-center font-bold"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`edit-kills-${result.id}`}>Kills</Label>
              <Input
                id={`edit-kills-${result.id}`}
                type="number"
                min={0}
                max={200}
                required
                value={kills}
                onChange={(e) => setKills(e.target.value)}
                className="h-10 text-center font-bold"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={`edit-prize-${result.id}`}>Prize (BDT)</Label>
              <Input
                id={`edit-prize-${result.id}`}
                type="number"
                min={0}
                required
                value={prizeBdt}
                onChange={(e) => setPrizeBdt(e.target.value)}
                className="h-10 text-center font-bold text-amber-400"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`edit-prizestatus-${result.id}`}>Prize Distribution Status</Label>
            <select
              id={`edit-prizestatus-${result.id}`}
              value={prizeStatus}
              onChange={(e) => setPrizeStatus(e.target.value as "pending" | "sent")}
              className="h-10 rounded-xl border border-input bg-secondary px-3 text-sm font-medium"
            >
              <option value="pending">Pending</option>
              <option value="sent">Sent / Distributed</option>
            </select>
          </div>

          {/* Screenshots / Banner Uploads */}
          <div className="flex flex-col gap-2 rounded-xl border border-border/80 p-3 bg-secondary/30">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Result Screenshots / Banners</Label>
              <span className="text-[11px] text-muted-foreground">{uploadedUrls.length} image(s)</span>
            </div>

            {uploadedUrls.length > 0 && (
              <div className="grid grid-cols-3 gap-2 my-1">
                {uploadedUrls.map((url, idx) => (
                  <div key={idx} className="relative rounded-lg overflow-hidden border border-border aspect-video bg-black/40">
                    <img src={resolveImageUrl(url)} alt={`Proof ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setUploadedUrls((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 size-5 rounded-full bg-black/80 text-white flex items-center justify-center hover:bg-destructive"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              className="hidden"
            />

            <Button
              type="button"
              variant="outline"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-dashed h-11 text-xs"
            >
              {uploading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin text-primary" />
                  <span>Uploading images... {uploadProgress}%</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <UploadCloud className="size-4 text-primary" />
                  <span>Add / Replace Result Images</span>
                </div>
              )}
            </Button>
          </div>

          <Button type="submit" disabled={busy} className="font-display font-bold uppercase py-6 glow-primary mt-1">
            {busy && <Loader2 className="size-4 animate-spin mr-2" />}
            Save Changes
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function PublishResultButton({
  scrims,
  bookingsByScrim = {},
  defaultScrimId,
}: {
  scrims: ScrimOption[]
  bookingsByScrim?: Record<string, RosterBooking[]>
  defaultScrimId?: string
}) {
  const [open, setOpen] = useState(false)
  const [selectedScrimId, setSelectedScrimId] = useState(defaultScrimId || scrims[0]?.id || "")
  const [winnerType, setWinnerType] = useState("Champion — 1st place")
  const [winningTeam, setWinningTeam] = useState("")
  const [mvpPlayerName, setMvpPlayerName] = useState("")
  const [mvpTeamName, setMvpTeamName] = useState("")
  const [kills, setKills] = useState("0")
  const [placement, setPlacement] = useState("1")
  const [prizeBdt, setPrizeBdt] = useState("330")

  // Client side image uploads
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedScrim = scrims.find((s) => s.id === selectedScrimId)
  const registeredTeams = selectedScrimId ? bookingsByScrim[selectedScrimId] || [] : []

  function handleWinnerTypeChange(typeId: string) {
    setWinnerType(typeId)
    const wt = WINNER_TYPES.find((w) => w.id === typeId)
    if (wt) {
      setPlacement(String(wt.placement))
      if (selectedScrim?.prizePoolBdt && wt.defaultPrizePct > 0) {
        const calculated = Math.round(selectedScrim.prizePoolBdt * wt.defaultPrizePct)
        setPrizeBdt(String(calculated))
      }
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploading(true)
    setUploadProgress(10)
    try {
      const urls: string[] = []
      const fileList = Array.from(files)
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i]
        if (file.size > 25 * 1024 * 1024) {
          toast.error(`"${file.name}" is over 25MB`)
          continue
        }
        const res = await uploadMediaFile(file, "results", (pct) => {
          const overall = Math.round(((i + pct / 100) / fileList.length) * 100)
          setUploadProgress(overall)
        })
        urls.push(res.url)
      }
      setUploadedUrls((prev) => [...prev, ...urls])
      setUploadProgress(100)
      toast.success(`${urls.length} image(s) uploaded successfully`)
    } catch (err) {
      toast.error("Upload error: " + (err instanceof Error ? err.message : "Failed to upload"))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (uploading) {
      toast.info("Please wait for images to finish uploading")
      return
    }

    if (!selectedScrimId) {
      toast.error("Please select a scrim")
      return
    }
    if (!winningTeam.trim()) {
      toast.error("Please select or enter the winning team")
      return
    }

    const actionData = new FormData()
    actionData.append("scrimId", selectedScrimId)
    actionData.append("winningTeam", winningTeam.trim())
    if (mvpPlayerName.trim()) actionData.append("mvpPlayerName", mvpPlayerName.trim())
    if (mvpTeamName.trim()) actionData.append("mvpTeamName", mvpTeamName.trim())
    actionData.append("kills", kills)
    actionData.append("placement", placement)
    actionData.append("prizeBdt", prizeBdt)
    actionData.append("category", winnerType)
    if (uploadedUrls.length > 0) {
      actionData.append("imageUrlsJson", JSON.stringify(uploadedUrls))
    }

    startTransition(async () => {
      const res = await publishResult(null, actionData)
      if (res.ok) {
        toast.success("Result published & participants notified!")
        setOpen(false)
        setWinningTeam("")
        setMvpPlayerName("")
        setMvpTeamName("")
        setUploadedUrls([])
      } else {
        toast.error(res.error ?? "Failed to publish result")
      }
    })
  }

  const busy = uploading || isPending

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="glow-primary font-display font-bold uppercase gap-2">
            <Plus className="size-4" />
            Publish Winner Result
          </Button>
        }
      />
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display uppercase flex items-center gap-2">
            <Trophy className="size-5 text-amber-400" />
            Select Scrim Winner & Publish Result
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left">
          {/* 1. Scrim Selection */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="result-scrim">Scrim *</Label>
            <select
              id="result-scrim"
              name="scrimId"
              required
              value={selectedScrimId}
              onChange={(e) => {
                setSelectedScrimId(e.target.value)
                setWinningTeam("")
              }}
              className="h-10 rounded-xl border border-input bg-secondary px-3 text-sm font-medium"
            >
              <option value="">Select a scrim…</option>
              {scrims.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} — {s.startTime} {s.prizePoolBdt ? `(Prize: ৳${s.prizePoolBdt})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Winner Type (Required in Prompt) */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="winnerType">Winner Type *</Label>
            <select
              id="winnerType"
              value={winnerType}
              onChange={(e) => handleWinnerTypeChange(e.target.value)}
              className="h-10 rounded-xl border border-input bg-secondary px-3 text-sm font-semibold text-primary"
            >
              <optgroup label="Podium Winners">
                <option value="Champion — 1st place">🏆 Champion — 1st place</option>
                <option value="Runner-up — 2nd place">🥈 Runner-up — 2nd place</option>
                <option value="Second Runner-up — 3rd place">🥉 Second Runner-up — 3rd place</option>
              </optgroup>
              <optgroup label="Special Banners">
                <option value="MVP Face Banner">⭐ MVP Face Banner</option>
                <option value="Top 3 Face Banner">🖼️ Top 3 Face Banner</option>
                <option value="Overall Standing Banner">📊 Overall Standing Banner</option>
              </optgroup>
            </select>
          </div>

          {/* MVP Details (Shown when MVP Face Banner is selected or user enters MVP) */}
          {(winnerType === "MVP Face Banner" || mvpPlayerName) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl border border-amber-500/40 bg-amber-500/10">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mvpPlayerName" className="text-amber-300 font-bold text-xs">
                  MVP Name *
                </Label>
                <Input
                  id="mvpPlayerName"
                  value={mvpPlayerName}
                  onChange={(e) => setMvpPlayerName(e.target.value)}
                  placeholder="e.g. VIPER"
                  required={winnerType === "MVP Face Banner"}
                  className="h-10 border-amber-500/50 bg-background/80"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mvpTeamName" className="text-amber-300 font-bold text-xs">
                  Team Name *
                </Label>
                <Input
                  id="mvpTeamName"
                  value={mvpTeamName}
                  onChange={(e) => {
                    setMvpTeamName(e.target.value)
                    if (!winningTeam) setWinningTeam(e.target.value)
                  }}
                  placeholder="e.g. TEAM ACE"
                  required={winnerType === "MVP Face Banner"}
                  className="h-10 border-amber-500/50 bg-background/80"
                />
              </div>
            </div>
          )}

          {/* 3. Winning Team Selection from registered team list */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="winningTeam">
              Winning Team (Pick from registered teams or enter name) *
            </Label>
            {registeredTeams.length > 0 ? (
              <div className="flex flex-col gap-2">
                <select
                  value={winningTeam}
                  onChange={(e) => setWinningTeam(e.target.value)}
                  className="h-10 rounded-xl border border-input bg-secondary px-3 text-sm font-medium"
                >
                  <option value="">-- Choose registered team ({registeredTeams.length} teams) --</option>
                  {registeredTeams.map((team) => (
                    <option key={team.id} value={team.teamName}>
                      {team.slotNumber ? `[Slot ${team.slotNumber}] ` : ""}{team.teamName} (Leader: {team.captainName})
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Or custom name:</span>
                  <Input
                    id="winningTeam"
                    value={winningTeam}
                    onChange={(e) => setWinningTeam(e.target.value)}
                    placeholder="Enter winning team name"
                    className="h-9 text-xs"
                    required
                  />
                </div>
              </div>
            ) : (
              <Input
                id="winningTeam"
                value={winningTeam}
                onChange={(e) => setWinningTeam(e.target.value)}
                placeholder="Winning team name"
                required
                className="h-10 text-sm"
              />
            )}
          </div>

          {/* 4. Match Statistics (Placement, Kills, Prize) */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="placement">Placement</Label>
              <Input
                id="placement"
                type="number"
                min={1}
                max={12}
                required
                value={placement}
                onChange={(e) => setPlacement(e.target.value)}
                className="h-10 text-center font-bold"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="kills">Total Kills</Label>
              <Input
                id="kills"
                type="number"
                min={0}
                max={200}
                required
                value={kills}
                onChange={(e) => setKills(e.target.value)}
                className="h-10 text-center font-bold"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="prizeBdt">Prize (BDT)</Label>
              <Input
                id="prizeBdt"
                type="number"
                min={0}
                required
                value={prizeBdt}
                onChange={(e) => setPrizeBdt(e.target.value)}
                className="h-10 text-center font-bold text-amber-400"
              />
            </div>
          </div>

          {/* 5. Screenshots / Banner Uploads */}
          <div className="flex flex-col gap-2 rounded-xl border border-border/80 p-3 bg-secondary/30">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">
                Result Screenshots / Face Banners (Multiple Images Allowed)
              </Label>
              <span className="text-[11px] text-muted-foreground">
                {uploadedUrls.length} attached
              </span>
            </div>

            {uploadedUrls.length > 0 && (
              <div className="grid grid-cols-3 gap-2 my-1">
                {uploadedUrls.map((url, idx) => (
                  <div key={idx} className="relative rounded-lg overflow-hidden border border-border aspect-video bg-black/40">
                    <img src={resolveImageUrl(url)} alt={`Proof ${idx + 1}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setUploadedUrls((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 size-5 rounded-full bg-black/80 text-white flex items-center justify-center hover:bg-destructive"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              className="hidden"
            />

            <Button
              type="button"
              variant="outline"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-dashed h-11 text-xs"
            >
              {uploading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin text-primary" />
                  <span>Uploading images... {uploadProgress}%</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <UploadCloud className="size-4 text-primary" />
                  <span>Add Result Screenshots / Face Banners (up to 25MB)</span>
                </div>
              )}
            </Button>
          </div>

          <Button type="submit" disabled={busy} className="font-display font-bold uppercase py-6 glow-primary mt-1">
            {busy && <Loader2 className="size-4 animate-spin mr-2" />}
            {uploading ? "Uploading Proof Media..." : "Publish Match Result"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function AdminResults({
  results,
  scrims,
  bookingsByScrim = {},
  isAdmin = true,
}: {
  results: ResultRow[]
  scrims: ScrimOption[]
  bookingsByScrim?: Record<string, RosterBooking[]>
  isAdmin?: boolean
}) {
  const [isPending, startTransition] = useTransition()
  const [selectedResultIds, setSelectedResultIds] = useState<string[]>([])

  const allSelected = results.length > 0 && selectedResultIds.length === results.length

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedResultIds([])
    } else {
      setSelectedResultIds(results.map((r) => r.result.id))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedResultIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
  }

  const handleDeleteToTrash = (ids: string[]) => {
    if (ids.length === 0) return
    if (!window.confirm(`Move ${ids.length} match result(s) to Trash?`)) return
    startTransition(async () => {
      const res = await bulkDeleteResults(ids)
      if (res.ok) {
        toast.success(`Moved ${res.count} result(s) to Trash`)
        setSelectedResultIds((prev) => prev.filter((id) => !ids.includes(id)))
      } else {
        toast.error(res.error || "Failed to move results to trash")
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PublishResultButton scrims={scrims} bookingsByScrim={bookingsByScrim} />

        {isAdmin && selectedResultIds.length > 0 && (
          <Button
            size="sm"
            variant="destructive"
            disabled={isPending}
            onClick={() => handleDeleteToTrash(selectedResultIds)}
            className="h-8 gap-1.5 text-xs"
          >
            <Trash2 className="size-3.5" /> Move Selected to Trash ({selectedResultIds.length})
          </Button>
        )}
      </div>

      {results.length > 0 && isAdmin && (
        <div className="glass flex items-center justify-between rounded-xl border border-border/60 p-3">
          <button
            type="button"
            onClick={toggleSelectAll}
            className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            {allSelected ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4" />}
            <span>{selectedResultIds.length > 0 ? `${selectedResultIds.length} result(s) selected` : "Select all results"}</span>
          </button>
        </div>
      )}

      {results.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center text-sm text-muted-foreground">
          No match results published yet.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {results.map(({ result, scrimTitle }) => {
            const isSelected = selectedResultIds.includes(result.id)
            const isChampion = result.category?.includes("Champion") || result.placement === 1
            const isRunnerUp = result.category?.includes("Runner-up") || result.placement === 2
            const isSecondRunnerUp = result.category?.includes("Second Runner-up") || result.placement === 3

            return (
              <li
                key={result.id}
                className={`glass flex flex-col gap-3 rounded-2xl p-4 border transition-all ${
                  isSelected ? "border-primary bg-primary/5 shadow-md" : "border-border/80"
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => toggleSelect(result.id)}
                      className="p-1 text-muted-foreground hover:text-foreground mr-1"
                    >
                      {isSelected ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4" />}
                    </button>
                  )}
                  {isChampion ? (
                    <Crown className="size-5 text-amber-400" />
                  ) : isRunnerUp ? (
                    <Medal className="size-5 text-slate-300" />
                  ) : isSecondRunnerUp ? (
                    <Medal className="size-5 text-amber-700" />
                  ) : (
                    <Trophy className="size-5 text-primary" />
                  )}

                  <h2 className="min-w-0 flex-1 truncate font-display text-lg font-bold">
                    {result.winningTeam}
                  </h2>

                  {result.category && (
                    <Badge variant="outline" className="border-primary/50 text-primary bg-primary/10 font-bold">
                      {result.category}
                    </Badge>
                  )}
                  {result.mvpPlayerName && (
                    <Badge variant="outline" className="border-amber-500/50 text-amber-400 bg-amber-500/10 font-bold">
                      MVP: {result.mvpPlayerName} {result.mvpTeamName ? `(${result.mvpTeamName})` : ""}
                    </Badge>
                  )}
                  <Badge variant={result.prizeStatus === "sent" ? "default" : "secondary"}>
                    {result.prizeStatus === "sent" ? "Prize sent" : "Prize pending"}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{scrimTitle ?? "Deleted scrim"}</span>
                  <span>{result.kills} kills</span>
                  <span className="font-bold text-primary">#{result.placement}</span>
                  <span className="font-bold text-amber-400">{formatTaka(result.prizeBdt)}</span>
                  <span>{formatDate(result.matchDate)}</span>
                </div>

                {(() => {
                  const rawImgs = (Array.isArray(result.imageUrls) && result.imageUrls.length > 0)
                    ? (result.imageUrls as string[])
                    : result.screenshotUrl ? [result.screenshotUrl] : []
                  const imgs = resolveImageUrls(rawImgs)

                  if (imgs.length === 0) return null

                  return (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {imgs.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                          <Image
                            src={url || "/placeholder.svg"}
                            alt={`Result screenshot ${i + 1} for ${result.winningTeam}`}
                            width={240}
                            height={135}
                            unoptimized
                            className="h-28 w-44 rounded-lg border border-border object-cover hover:opacity-90 transition-opacity"
                          />
                        </a>
                      ))}
                    </div>
                  )
                })()}

                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/40 pt-3">
                  {isAdmin && (
                    <EditResultDialog result={result} scrimTitle={scrimTitle} />
                  )}

                  {result.prizeStatus !== "sent" && isAdmin && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() =>
                        startTransition(async () => {
                          try {
                            await markPrizeSent(result.id)
                            toast.success("Marked prize as sent")
                          } catch {
                            toast.error("Failed to update prize status")
                          }
                        })
                      }
                    >
                      <CheckCheck className="size-3.5" />
                      Mark prize sent
                    </Button>
                  )}

                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={isPending}
                      onClick={() => handleDeleteToTrash([result.id])}
                    >
                      <Trash2 className="size-3.5" />
                      Move to Trash
                    </Button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
