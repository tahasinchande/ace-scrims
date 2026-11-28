"use client"

import { useState, useTransition, useRef, useEffect, useMemo } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { publishResult, updateResult, markPrizeSent, markAllPrizesSent, deleteResult } from "@/app/actions/staff"
import { bulkDeleteResults, queryHistoricalScrimsAction } from "@/app/actions/admin"
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
import { formatTaka, formatDate, sortScrimsAscending } from "@/lib/format"
import { CascadingScrimSelector } from "@/components/site/cascading-scrim-selector"
import { resolveImageUrl, resolveImageUrls } from "@/lib/image-url"
import { uploadMediaFile } from "@/lib/client-upload"
import {
  Loader2,
  Plus,
  Trophy,
  Swords,
  Clock,
  Layers,
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
  Calendar,
} from "lucide-react"
import { toast } from "sonner"

type ResultRow = {
  result: MatchResult
  scrimTitle: string | null
  startTime: string | null
}

type LobbyGroupAdmin = {
  key: string
  scrimId: string | null
  scrimTitle: string
  startTime: string | null
  matchDate: string | null
  items: ResultRow[]
}

type ScrimOption = {
  id: string
  slug?: string | null
  title: string
  startTime: string
  category?: string | null
  prizePoolBdt?: number
}
type RosterBooking = Booking & { userEmail: string | null }

const WINNER_TYPES = [
  { id: "Champion — 1st place", label: "Champion — 1st place", placement: 1, defaultPrizePct: 0.375 },
  { id: "Runner-up — 2nd place", label: "Runner-up — 2nd place", placement: 2, defaultPrizePct: 0.2708 },
  { id: "Second Runner-up — 3rd place", label: "Second Runner-up — 3rd place", placement: 3, defaultPrizePct: 0.2083 },
  { id: "Third Runner-up — 4th place", label: "Third Runner-up — 4th place", placement: 4, defaultPrizePct: 0.1458 },
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
                <option value="Third Runner-up — 4th place">🎖️ Third Runner-up — 4th place</option>
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
  availableDates = [],
  initialDate,
}: {
  scrims: ScrimOption[]
  bookingsByScrim?: Record<string, RosterBooking[]>
  defaultScrimId?: string
  availableDates?: string[]
  initialDate?: string
}) {
  const sortedScrims = sortScrimsAscending(scrims)
  const todayStr = initialDate || new Date().toISOString().slice(0, 10)
  const [open, setOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState(todayStr)
  const [selectedScrimId, setSelectedScrimId] = useState(defaultScrimId || sortedScrims[0]?.id || "")
  const [winnerType, setWinnerType] = useState("Champion — 1st place")
  const [winningTeam, setWinningTeam] = useState("")
  const [mvpPlayerName, setMvpPlayerName] = useState("")
  const [mvpTeamName, setMvpTeamName] = useState("")
  const [kills, setKills] = useState("0")
  const [placement, setPlacement] = useState("1")
  const [prizeBdt, setPrizeBdt] = useState("330")

  // Historical data teams state
  const [historicalTeams, setHistoricalTeams] = useState<any[]>([])
  const [loadingTeams, setLoadingTeams] = useState(false)

  // Client side image uploads
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isPending, startTransition] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const selectedScrim = sortedScrims.find((s) => s.id === selectedScrimId)

  // Dynamically load teams strictly from Historical Data matching selectedDate and selectedScrimId
  useEffect(() => {
    if (!open || !selectedScrimId) {
      setHistoricalTeams([])
      return
    }
    let active = true
    setLoadingTeams(true)
    queryHistoricalScrimsAction(selectedDate, selectedScrimId)
      .then((res) => {
        if (!active) return
        if (res.ok && res.data?.roster) {
          // Strictly and exclusively populate teams registered for this selected date and scrim
          setHistoricalTeams(res.data.roster)
        } else {
          setHistoricalTeams([])
        }
      })
      .catch(() => {
        if (active) {
          setHistoricalTeams([])
        }
      })
      .finally(() => {
        if (active) setLoadingTeams(false)
      })

    return () => {
      active = false
    }
  }, [open, selectedDate, selectedScrimId])

  function handleWinnerTypeChange(typeId: string) {
    setWinnerType(typeId)
    const wt = WINNER_TYPES.find((w) => w.id === typeId)
    if (wt) {
      setPlacement(String(wt.placement))
      const pool = selectedScrim?.prizePoolBdt || 330
      if (wt.defaultPrizePct > 0) {
        if (pool === 480) {
          if (wt.placement === 1) setPrizeBdt("180")
          else if (wt.placement === 2) setPrizeBdt("130")
          else if (wt.placement === 3) setPrizeBdt("100")
          else if (wt.placement === 4) setPrizeBdt("70")
          else setPrizeBdt("0")
        } else if (pool === 330) {
          if (wt.placement === 1) setPrizeBdt("160")
          else if (wt.placement === 2) setPrizeBdt("100")
          else if (wt.placement === 3) setPrizeBdt("70")
          else setPrizeBdt("0")
        } else if (pool === 320) {
          if (wt.placement === 1) setPrizeBdt("140")
          else if (wt.placement === 2) setPrizeBdt("100")
          else if (wt.placement === 3) setPrizeBdt("80")
          else setPrizeBdt("0")
        } else if (pool === 850) {
          if (wt.placement === 1) setPrizeBdt("300")
          else if (wt.placement === 2) setPrizeBdt("190")
          else if (wt.placement === 3) setPrizeBdt("140")
          else if (wt.placement === 4) setPrizeBdt("120")
          else if (wt.placement === 5) setPrizeBdt("100")
          else setPrizeBdt("0")
        } else {
          setPrizeBdt(String(Math.round(pool * wt.defaultPrizePct)))
        }
      } else {
        setPrizeBdt("0")
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
    actionData.append("matchDate", selectedDate)
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
        if ("emailWarning" in res && res.emailWarning) {
          toast.warning(res.emailWarning)
        } else {
          toast.success("Result published & participants notified!")
        }
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
            Select Scrim Winner &amp; Publish Result
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left">
          {/* Match Date & Cascading Scrim Selection */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5 sm:max-w-[220px]">
              <Label htmlFor="result-date" className="flex items-center gap-1.5 font-bold text-xs uppercase text-primary">
                <Calendar className="size-3.5" />
                Match Date *
              </Label>
              <Input
                id="result-date"
                type="date"
                required
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value)
                  setWinningTeam("")
                }}
                className="h-10 rounded-xl border border-input bg-secondary px-3 text-sm font-medium"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="font-bold text-xs uppercase text-muted-foreground">
                Target Scrim (Schedule → Category → Ascending Room) *
              </Label>
              <CascadingScrimSelector
                idPrefix="publish-result-scrim"
                scrims={sortedScrims}
                value={selectedScrimId}
                formatRoomLabel={(s) =>
                  `${s.startTime} · ${s.title}${s.prizePoolBdt ? ` (Prize: ৳${s.prizePoolBdt})` : ""}`
                }
                onChange={(newId, target) => {
                  setSelectedScrimId(newId)
                  setWinningTeam("")
                  if (target?.prizePoolBdt) {
                    const wt = WINNER_TYPES.find((w) => w.id === winnerType)
                    if (wt && wt.defaultPrizePct > 0) {
                      if (target.prizePoolBdt === 480) {
                        if (wt.placement === 1) setPrizeBdt("180")
                        else if (wt.placement === 2) setPrizeBdt("130")
                        else if (wt.placement === 3) setPrizeBdt("100")
                        else if (wt.placement === 4) setPrizeBdt("70")
                        else setPrizeBdt("0")
                      } else if (target.prizePoolBdt === 330) {
                        if (wt.placement === 1) setPrizeBdt("160")
                        else if (wt.placement === 2) setPrizeBdt("100")
                        else if (wt.placement === 3) setPrizeBdt("70")
                        else setPrizeBdt("0")
                      } else if (target.prizePoolBdt === 850) {
                        if (wt.placement === 1) setPrizeBdt("300")
                        else if (wt.placement === 2) setPrizeBdt("190")
                        else if (wt.placement === 3) setPrizeBdt("140")
                        else if (wt.placement === 4) setPrizeBdt("120")
                        else if (wt.placement === 5) setPrizeBdt("100")
                        else setPrizeBdt("0")
                      }
                    }
                  }
                }}
              />

              {/* Selected Scrim Lobby Confirmation Card */}
              {selectedScrim && (
                <div className="mt-1 dc-metric-cell rounded-xl border-primary/30 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary block">TARGET SCRIM LOBBY</span>
                    <span className="font-bold text-foreground text-sm truncate block">{selectedScrim.title}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary font-bold text-[11px]">
                      Slot: {selectedScrim.startTime}
                    </Badge>
                    <Badge variant="secondary" className="font-mono text-[10px]">
                      ID: {selectedScrim.id.slice(0, 8)}…
                    </Badge>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 2. Winner Type */}
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
                <option value="Third Runner-up — 4th place">🎖️ Third Runner-up — 4th place</option>
              </optgroup>
              <optgroup label="Special Banners">
                <option value="MVP Face Banner">⭐ MVP Face Banner</option>
                <option value="Top 3 Face Banner">🖼️ Top 3 Face Banner</option>
                <option value="Overall Standing Banner">📊 Overall Standing Banner</option>
              </optgroup>
            </select>
          </div>

          {/* MVP Details */}
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

          {/* 3. Winning Team Selection dynamically populated from Historical Data */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="winningTeam" className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-bold">
                <Users className="size-3.5 text-primary" />
                Winning Team (from Historical Data for {selectedDate}) *
              </span>
              {loadingTeams ? (
                <span className="text-xs text-primary flex items-center gap-1 font-normal">
                  <Loader2 className="size-3 animate-spin" /> Querying historical teams...
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground font-normal">
                  {historicalTeams.length} registered team(s)
                </span>
              )}
            </Label>
            {historicalTeams.length > 0 ? (
              <div className="flex flex-col gap-2">
                <select
                  value={winningTeam}
                  onChange={(e) => {
                    const val = e.target.value
                    setWinningTeam(val)
                    if (val && (!mvpTeamName || mvpTeamName === winningTeam)) {
                      setMvpTeamName(val)
                    }
                  }}
                  className="h-10 rounded-xl border border-input bg-secondary px-3 text-sm font-medium"
                >
                  <option value="">-- Choose registered team ({historicalTeams.length} teams) --</option>
                  {historicalTeams.map((team: any) => (
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
              <div className="flex flex-col gap-1.5">
                <Input
                  id="winningTeam"
                  value={winningTeam}
                  onChange={(e) => setWinningTeam(e.target.value)}
                  placeholder="Enter winning team name"
                  required
                  className="h-10 text-sm"
                />
                <p className="text-[11px] text-muted-foreground">
                  No registered squads recorded in Historical Data for {selectedDate} in this scrim. You can enter the winning team manually.
                </p>
              </div>
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
  availableDates = [],
  initialDate,
  isAdmin = true,
}: {
  results: ResultRow[]
  scrims: ScrimOption[]
  bookingsByScrim?: Record<string, RosterBooking[]>
  availableDates?: string[]
  initialDate?: string
  isAdmin?: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedResultIds, setSelectedResultIds] = useState<string[]>([])
  const [lobbyFilter, setLobbyFilter] = useState<string>("all")
  const [trashConfirmIds, setTrashConfirmIds] = useState<string[] | null>(null)
  const [markAllConfirmOpen, setMarkAllConfirmOpen] = useState(false)

  // Group published results under distinct scrim lobby headers
  const lobbyGroups = useMemo<LobbyGroupAdmin[]>(() => {
    const map = new Map<string, {
      key: string
      scrimId: string | null
      scrimTitle: string
      startTime: string | null
      matchDate: string | null
      items: ResultRow[]
    }>()

    for (const item of results) {
      const key = `${item.result.scrimId || item.scrimTitle || "lobby"}_${item.result.matchDate || "active"}`
      if (!map.has(key)) {
        map.set(key, {
          key,
          scrimId: item.result.scrimId || null,
          scrimTitle: item.scrimTitle || "Daily Scrim Lobby",
          startTime: item.startTime || null,
          matchDate: item.result.matchDate || null,
          items: [],
        })
      }
      map.get(key)!.items.push(item)
    }

    return sortScrimsAscending(
      Array.from(map.values()).map((g) => ({
        ...g,
        title: g.scrimTitle,
        startTime: g.startTime || "",
        scrimDate: g.matchDate || "",
      })),
    ) as unknown as LobbyGroupAdmin[]
  }, [results])

  const filteredGroups = useMemo<LobbyGroupAdmin[]>(() => {
    if (lobbyFilter === "all") return lobbyGroups
    return lobbyGroups.filter((g: LobbyGroupAdmin) => g.key === lobbyFilter || g.scrimId === lobbyFilter)
  }, [lobbyGroups, lobbyFilter])

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

  const handleConfirmTrash = () => {
    if (!trashConfirmIds || trashConfirmIds.length === 0) return
    const ids = trashConfirmIds
    startTransition(async () => {
      const res = await bulkDeleteResults(ids)
      if (res.ok) {
        toast.success(`Moved ${res.count} result(s) to Trash`)
        setSelectedResultIds((prev) => prev.filter((id) => !ids.includes(id)))
        setTrashConfirmIds(null)
      } else {
        toast.error(res.error || "Failed to move results to trash")
      }
    })
  }

  const pendingResults = useMemo(
    () => results.filter((r) => r.result.prizeStatus !== "sent"),
    [results]
  )

  const handleConfirmMarkAllSent = () => {
    if (pendingResults.length === 0) {
      setMarkAllConfirmOpen(false)
      return
    }
    const pendingIds = pendingResults.map((r) => r.result.id)
    startTransition(async () => {
      const res = await markAllPrizesSent(pendingIds)
      if (res.ok) {
        toast.success(`Marked ${res.count} prize(s) as sent`)
        setMarkAllConfirmOpen(false)
        router.refresh()
      } else {
        toast.error(res.error || "Failed to mark all prizes as sent")
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <PublishResultButton
            scrims={scrims}
            bookingsByScrim={bookingsByScrim}
            availableDates={availableDates}
            initialDate={initialDate}
          />
          {isAdmin && (
            <Button
              size="sm"
              variant="outline"
              disabled={isPending || pendingResults.length === 0}
              onClick={() => setMarkAllConfirmOpen(true)}
              className="h-9 gap-1.5 text-xs font-bold uppercase tracking-wider border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50"
            >
              {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCheck className="size-3.5" />}
              Mark All Prize Sent ({pendingResults.length})
            </Button>
          )}
        </div>
        {isAdmin && selectedResultIds.length > 0 && (
          <Button
            size="sm"
            variant="destructive"
            disabled={isPending}
            onClick={() => setTrashConfirmIds(selectedResultIds)}
            className="h-8 gap-1.5 text-xs font-semibold"
          >
            <Trash2 className="size-3.5" /> Move Selected to Trash ({selectedResultIds.length})
          </Button>
        )}
      </div>

      {/* Cascading Scrim Lobby Filter */}
      {lobbyGroups.length > 1 && (
        <div className="dc-surface rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Layers className="size-3.5 text-primary" /> Filter by Scrim Lobby (Schedule → Category → Room)
            </span>
            {lobbyFilter !== "all" && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setLobbyFilter("all")}
                className="h-7 text-xs text-primary"
              >
                Show All Lobbies ({results.length})
              </Button>
            )}
          </div>
          <CascadingScrimSelector
            idPrefix="admin-results-filter"
            scrims={scrims}
            value={lobbyFilter}
            allowAll
            allLabel={`All Lobbies (${results.length} results)`}
            onChange={(nextVal) => setLobbyFilter(nextVal || "all")}
          />
        </div>
      )}

      {/* Multi-Select Bar */}
      {results.length > 0 && isAdmin && (
        <div className="dc-surface flex items-center justify-between rounded-xl p-3">
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

      {/* Results Grouped Under Distinct Scrim Lobby Sections */}
      {results.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center text-sm text-muted-foreground">
          No match results published yet. Use &quot;Publish Result&quot; above to post results for a scrim lobby.
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {filteredGroups.map((group: LobbyGroupAdmin) => (
            <div
              key={group.key}
              className="rounded-2xl border border-border/80 bg-secondary/15 overflow-hidden shadow-sm"
            >
              {/* Distinct Scrim Lobby Header */}
              <div className="border-b border-border/70 bg-secondary/40 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shrink-0">
                    <Swords className="size-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary block">
                      SCRIM LOBBY SECTION
                    </span>
                    <h2 className="font-display text-base sm:text-lg font-bold uppercase text-foreground">
                      {group.scrimTitle}
                    </h2>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {group.startTime && (
                    <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary font-bold text-xs py-1 gap-1">
                      <Clock className="size-3" />
                      {group.startTime}
                    </Badge>
                  )}
                  {group.matchDate && (
                    <Badge variant="outline" className="border-border bg-background text-muted-foreground text-xs py-1 gap-1">
                      <Calendar className="size-3" />
                      {formatDate(group.matchDate)}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-xs py-1">
                    {group.items.length} {group.items.length === 1 ? "Result" : "Results"}
                  </Badge>
                </div>
              </div>

              {/* Result Cards within this Lobby */}
              <ul className="p-4 sm:p-5 flex flex-col gap-3">
                {group.items.map(({ result, scrimTitle }: ResultRow) => {
                  const isSelected = selectedResultIds.includes(result.id)
                  const isChampion = result.category?.includes("Champion") || result.placement === 1
                  const isRunnerUp = result.category?.includes("Runner-up") || result.placement === 2
                  const isSecondRunnerUp = result.category?.includes("Second Runner-up") || result.placement === 3

                  const rawImgs = (Array.isArray(result.imageUrls) && result.imageUrls.length > 0)
                    ? (result.imageUrls as string[])
                    : result.screenshotUrl ? [result.screenshotUrl] : []
                  const imgs = resolveImageUrls(rawImgs)

                  return (
                    <li
                      key={result.id}
                      className={`glass flex flex-col gap-3 rounded-xl p-4 border transition-all ${
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
                        <h3 className="min-w-0 flex-1 truncate font-display text-base font-bold text-foreground">
                          {result.winningTeam}
                        </h3>
                        {result.category && (
                          <Badge variant="outline" className="border-primary/50 text-primary bg-primary/10 font-bold text-xs">
                            {result.category}
                          </Badge>
                        )}
                        {result.mvpPlayerName && (
                          <Badge variant="outline" className="border-amber-500/50 text-amber-400 bg-amber-500/10 font-bold text-xs">
                            MVP: {result.mvpPlayerName} {result.mvpTeamName ? `(${result.mvpTeamName})` : ""}
                          </Badge>
                        )}
                        <Badge variant={result.prizeStatus === "sent" ? "default" : "secondary"} className="text-xs">
                          {result.prizeStatus === "sent" ? "Prize sent" : "Prize pending"}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>Placement: <strong className="text-primary font-bold">#{result.placement}</strong></span>
                        <span>Kills: <strong>{result.kills}</strong></span>
                        <span className="font-bold text-amber-400">{formatTaka(result.prizeBdt)}</span>
                        {result.matchDate && <span>Date: {formatDate(result.matchDate)}</span>}
                      </div>

                      {imgs.length > 0 && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {imgs.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                              <Image
                                src={url || "/placeholder.svg"}
                                alt={`Result screenshot ${i + 1} for ${result.winningTeam}`}
                                width={240}
                                height={135}
                                unoptimized
                                className="h-24 w-36 rounded-lg border border-border object-cover hover:opacity-90 transition-opacity"
                              />
                            </a>
                          ))}
                        </div>
                      )}

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
                            className="gap-1.5 text-xs"
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
                            onClick={() => setTrashConfirmIds([result.id])}
                            className="gap-1.5 text-xs"
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
            </div>
          ))}
        </div>
      )}

      {/* In-App Confirmation Dialog for Moving Results to Trash (replaces window.confirm) */}
      <Dialog open={trashConfirmIds !== null} onOpenChange={(open) => !open && setTrashConfirmIds(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Trash2 className="size-5 text-destructive" />
              Move Result(s) to Trash?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to move {trashConfirmIds?.length} match result(s) to the Trash bin? They can be restored or permanently wiped from the Trash tab.
          </p>
          <div className="flex items-center justify-end gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={() => setTrashConfirmIds(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleConfirmTrash} disabled={isPending} className="gap-1.5">
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              Confirm Move to Trash
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* In-App Confirmation Dialog for Mark All Prize Sent */}
      <Dialog open={markAllConfirmOpen} onOpenChange={setMarkAllConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2 font-display uppercase">
              <CheckCheck className="size-5 text-emerald-400" />
              Mark All Prizes as Sent?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will mark <strong className="text-foreground">{pendingResults.length}</strong> pending result(s) as{" "}
            <strong className="text-emerald-400">Prize sent</strong> across the results table and player dashboards.
          </p>
          <div className="flex items-center justify-end gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={() => setMarkAllConfirmOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmMarkAllSent}
              disabled={isPending || pendingResults.length === 0}
              className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-500"
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" />}
              Confirm Mark All Sent
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
