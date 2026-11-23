"use client"

import { useState, useEffect, useTransition, useRef } from "react"
import { submitReport } from "@/app/actions/reports"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertTriangle,
  Loader2,
  ShieldAlert,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Link2,
  UploadCloud,
  X,
  Calendar,
  Layers,
  HelpCircle,
  Lightbulb,
  Video,
  Plus,
  Bug,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { uploadMediaFile, uploadVideoDirect } from "@/lib/client-upload"
import { resolveImageUrl } from "@/lib/image-url"
import { isSafeHttpOrRelativeUrl } from "@/lib/url-safety"

type ReportType =
  | "Hacker Report"
  | "Winner Payment Not Received"
  | "Payment Completed But Slot Not Booked"
  | "Feature Request"
  | "Bug Report"
  | "Other Report"

type ScrimItem = {
  id: string
  title: string
  startTime?: string
  map?: string
}

export function ReportFormView({
  scrims = [],
  showHeader = false,
}: {
  scrims?: ScrimItem[]
  showHeader?: boolean
}) {
  const [selectedType, setSelectedType] = useState<ReportType>("Hacker Report")
  const [isPending, startTransition] = useTransition()
  const [isSuccess, setIsSuccess] = useState(false)

  // Scrim and Date selection states (avoid SSR date hydration mismatch via useEffect)
  const [selectedScrimId, setSelectedScrimId] = useState("")
  const [customScrimName, setCustomScrimName] = useState("")
  const [todayStr, setTodayStr] = useState("")
  const [incidentDate, setIncidentDate] = useState("")

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0]
    setTodayStr(today)
    setIncidentDate((prev) => prev || today)
  }, [])

  // Upload states for multiple large images
  const [uploadedImages, setUploadedImages] = useState<string[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageProgress, setImageProgress] = useState(0)

  // Upload states for direct video attachments
  const [uploadedVideos, setUploadedVideos] = useState<string[]>([])
  const [uploadingVideo, setUploadingVideo] = useState(false)
  const [videoProgress, setVideoProgress] = useState(0)

  // External Links (Google Drive / MEGA / YouTube / Other)
  const [externalLinks, setExternalLinks] = useState<string[]>([])
  const [externalLinkInput, setExternalLinkInput] = useState("")

  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const processedFileSigs = useRef<Set<string>>(new Set())
  const isSubmittingRef = useRef<boolean>(false)

  async function handleMultipleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0 || uploadingImage) return

    const fileList = Array.from(files)
    if (e.target) e.target.value = ""

    setUploadingImage(true)
    setImageProgress(10)

    try {
      const newUrls: string[] = []
      const total = fileList.length

      for (let i = 0; i < total; i++) {
        const file = fileList[i]
        if (file.size > 50 * 1024 * 1024) {
          toast.error(`"${file.name}" is over 50MB and was skipped.`)
          continue
        }

        const sig = `${file.name}_${file.size}_${file.lastModified}`
        if (processedFileSigs.current.has(sig)) continue

        const result = await uploadMediaFile(file, "reports", (pct) => {
          const overall = Math.round(((i + pct / 100) / total) * 100)
          setImageProgress(overall)
        })

        if (result?.url) {
          processedFileSigs.current.add(sig)
          newUrls.push(result.url)
        }
      }

      if (newUrls.length > 0) {
        setUploadedImages((prev) => {
          const seen = new Set<string>()
          const combined: string[] = []
          for (const u of [...prev, ...newUrls]) {
            if (!u || typeof u !== "string") continue
            const trimmed = u.trim()
            if (!trimmed) continue
            const key = trimmed.toLowerCase().replace(/\/+$/, "")
            if (!seen.has(key)) {
              seen.add(key)
              combined.push(trimmed)
            }
          }
          return combined
        })
        toast.success(`${newUrls.length} screenshot(s) uploaded!`)
      }
      setImageProgress(100)
    } catch (err) {
      toast.error("Image upload failed: " + (err instanceof Error ? err.message : "Network error"))
    } finally {
      setUploadingImage(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function handleVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0 || uploadingVideo) return

    const fileList = Array.from(files)
    if (e.target) e.target.value = ""

    setUploadingVideo(true)
    setVideoProgress(5)

    try {
      const newVideoUrls: string[] = []
      const total = fileList.length

      for (let i = 0; i < total; i++) {
        const file = fileList[i]
        const sig = `vid_${file.name}_${file.size}_${file.lastModified}`
        if (processedFileSigs.current.has(sig)) continue

        const result = await uploadVideoDirect(file, "reports", (pct) => {
          const overall = Math.round(((i + pct / 100) / total) * 100)
          setVideoProgress(overall)
        })

        if (result?.url) {
          processedFileSigs.current.add(sig)
          newVideoUrls.push(result.url)
        }
      }

      if (newVideoUrls.length > 0) {
        setUploadedVideos((prev) => [...new Set([...prev, ...newVideoUrls])])
        toast.success(`${newVideoUrls.length} video file(s) attached!`)
      }
      setVideoProgress(100)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Video upload failed")
    } finally {
      setUploadingVideo(false)
      if (videoInputRef.current) videoInputRef.current.value = ""
    }
  }

  function handleAddExternalLink() {
    const candidate = externalLinkInput.trim()
    if (!candidate) return
    if (!isSafeHttpOrRelativeUrl(candidate) || (!candidate.startsWith("https://") && !candidate.startsWith("http://"))) {
      toast.error("Please enter a valid external URL starting with https:// or http://")
      return
    }
    setExternalLinks((prev) => (prev.includes(candidate) ? prev : [...prev, candidate]))
    setExternalLinkInput("")
  }

  function removeImage(index: number) {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index))
  }

  function removeVideo(index: number) {
    setUploadedVideos((prev) => prev.filter((_, i) => i !== index))
  }

  function removeExternalLink(index: number) {
    setExternalLinks((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (uploadingImage || uploadingVideo) {
      toast.info("Please wait for attached media to finish uploading")
      return
    }
    if (isSubmittingRef.current || isPending) {
      return
    }

    // Auto-include any pending URL typed into the external link field
    const finalExternalLinks = [...externalLinks]
    const pendingLink = externalLinkInput.trim()
    if (pendingLink) {
      if (!isSafeHttpOrRelativeUrl(pendingLink) || (!pendingLink.startsWith("https://") && !pendingLink.startsWith("http://"))) {
        toast.error("External link must start with https:// or http://")
        return
      }
      if (!finalExternalLinks.includes(pendingLink)) {
        finalExternalLinks.push(pendingLink)
      }
    }

    isSubmittingRef.current = true

    const form = e.currentTarget
    const formData = new FormData(form)

    formData.set("reportType", selectedType)

    if (selectedType === "Feature Request" || selectedType === "Bug Report") {
      formData.set("incidentDate", "")
      formData.set("scrimId", "")
      formData.set("customScrimName", "")
    } else {
      formData.set("incidentDate", incidentDate || todayStr)
      if (selectedScrimId === "custom") {
        formData.set("scrimId", "")
        formData.set("customScrimName", customScrimName.trim())
      } else if (selectedScrimId) {
        formData.set("scrimId", selectedScrimId)
        formData.set("customScrimName", "")
      } else {
        formData.set("scrimId", "")
        formData.set("customScrimName", "")
      }
    }

    const seen = new Set<string>()
    const uniqueImages: string[] = []
    for (const u of uploadedImages) {
      if (!u || typeof u !== "string") continue
      const cleaned = u.trim()
      if (!cleaned) continue
      const key = cleaned.toLowerCase().replace(/\/+$/, "")
      if (!seen.has(key)) {
        seen.add(key)
        uniqueImages.push(cleaned)
      }
    }

    if (uniqueImages.length > 0) {
      formData.set("imageUrls", JSON.stringify(uniqueImages))
      formData.delete("proofUrlInput")
    } else {
      formData.set("imageUrls", "")
      formData.delete("proofUrlInput")
    }

    formData.set("videoUrls", uploadedVideos.length > 0 ? JSON.stringify(uploadedVideos) : "")
    formData.set("externalLinks", finalExternalLinks.length > 0 ? JSON.stringify(finalExternalLinks) : "")
    formData.set("videoLink", finalExternalLinks[0] || "")

    formData.delete("proof")
    formData.delete("imageProof")
    formData.delete("file")

    startTransition(async () => {
      try {
        const res = await submitReport(null, formData)
        if (res.ok) {
          setIsSuccess(true)
          setUploadedImages([])
          setUploadedVideos([])
          setExternalLinks([])
          setExternalLinkInput("")
          processedFileSigs.current.clear()
          toast.success("Report submitted successfully! Status set to Pending Review.")
        } else {
          toast.error(res.error || "Failed to submit report")
        }
      } catch (submitErr) {
        toast.error(
          submitErr instanceof Error
            ? `Submission error: ${submitErr.message}`
            : "Network error occurred while submitting report."
        )
      } finally {
        isSubmittingRef.current = false
      }
    })
  }

  const busy = uploadingImage || uploadingVideo || isPending
  const showScrimAndDate = selectedType !== "Feature Request" && selectedType !== "Bug Report"

  return (
    <div className="w-full text-left flex flex-col gap-6">
      {showHeader && (
        <header className="border-b border-border/50 pb-4">
          <h1 className="font-display text-2xl sm:text-3xl font-bold uppercase tracking-wide text-foreground">
            Submit a Report or Feature Request
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Report hackers, prize/slot issues, technical bugs, or suggest new features directly to RushX Organization administrators.
          </p>
        </header>
      )}
      {/* Report Type Selector Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {(
          [
            { id: "Hacker Report", label: "Hacker Report", icon: ShieldAlert, desc: "Report hacking or cheating" },
            { id: "Winner Payment Not Received", label: "Winner Payment Not Received", icon: FileText, desc: "Unpaid tournament prize" },
            { id: "Payment Completed But Slot Not Booked", label: "Slot Not Booked", icon: AlertTriangle, desc: "TrxID paid but slot missing" },
            { id: "Feature Request", label: "Feature Request", icon: Lightbulb, desc: "Suggest platform improvements" },
            { id: "Bug Report", label: "Bug Report", icon: Bug, desc: "Report website or app bugs" },
            { id: "Other Report", label: "Other Report", icon: FileText, desc: "General issues & support" },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon
          const active = selectedType === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setSelectedType(tab.id as ReportType)
                setIsSuccess(false)
              }}
              className={cn(
                "flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all",
                active
                  ? "border-primary bg-primary/10 text-primary font-semibold shadow-sm"
                  : "border-border/60 bg-secondary/30 hover:bg-secondary/60 text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-display uppercase tracking-wide leading-tight">{tab.label}</p>
                <p className="text-xs text-muted-foreground truncate font-normal">{tab.desc}</p>
              </div>
            </button>
          )
        })}
      </div>

      {isSuccess ? (
        <div className="rounded-2xl border border-primary/40 bg-primary/10 p-6 text-center flex flex-col items-center gap-3">
          <CheckCircle2 className="size-10 text-primary" />
          <h3 className="font-display text-xl font-bold uppercase">
            {selectedType === "Feature Request"
              ? "Feature Request Submitted"
              : selectedType === "Bug Report"
                ? "Bug Report Submitted & Pending Review"
                : "Report Submitted & Pending Review"}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Your submission is currently <span className="font-semibold text-primary">Pending Review</span> by our administrators.
            You can track updates from your Reports dashboard.
          </p>
          <Button
            onClick={() => {
              setIsSuccess(false)
              setUploadedImages([])
              setUploadedVideos([])
              setExternalLinks([])
              setExternalLinkInput("")
              setCustomScrimName("")
            }}
            variant="outline"
            className="mt-2"
          >
            Submit Another Report
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* SCRIM & INCIDENT DATE SELECTION ROW (Not needed for Feature Requests) */}
          {showScrimAndDate && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl border border-border/80 bg-secondary/20 p-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="scrimSelect" className="flex items-center gap-1.5 text-xs font-semibold">
                  <Layers className="size-3.5 text-primary" />
                  Select Scrim / Tournament *
                </Label>
                <select
                  id="scrimSelect"
                  value={selectedScrimId}
                  onChange={(e) => setSelectedScrimId(e.target.value)}
                  className="h-10 rounded-xl border border-border bg-secondary/80 px-3 text-xs font-medium text-foreground"
                >
                  <option value="">-- Choose Any Scrim --</option>
                  {scrims.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} {s.startTime ? `(${s.startTime})` : ""} {s.map ? `[${s.map}]` : ""}
                    </option>
                  ))}
                  <option value="custom">Other / Custom Scrim Name...</option>
                </select>

                {selectedScrimId === "custom" && (
                  <Input
                    value={customScrimName}
                    onChange={(e) => setCustomScrimName(e.target.value)}
                    placeholder="Type custom scrim or tournament name"
                    required
                    className="h-9 text-xs mt-1"
                  />
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="incidentDate" className="flex items-center gap-1.5 text-xs font-semibold">
                  <Calendar className="size-3.5 text-primary" />
                  Match / Incident Date *
                </Label>
                <Input
                  id="incidentDate"
                  name="incidentDate"
                  type="date"
                  max={todayStr || undefined}
                  value={incidentDate}
                  onChange={(e) => setIncidentDate(e.target.value)}
                  required
                  className="h-10 rounded-xl border border-border bg-secondary/80 text-xs font-medium"
                />
                {todayStr && (
                  <span className="text-[10px] text-muted-foreground">Selectable till today ({todayStr})</span>
                )}
              </div>
            </div>
          )}

          {/* Hacker Report Fields */}
          {selectedType === "Hacker Report" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="hackerUid">Hacker Free Fire UID *</Label>
                  <Input id="hackerUid" name="hackerUid" required placeholder="e.g. 123456789" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="hackerName">Hacker In-Game Name *</Label>
                  <Input id="hackerName" name="hackerName" required placeholder="Exact in-game name" />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="whatsapp">Reporter WhatsApp Number *</Label>
                <Input id="whatsapp" name="whatsapp" required placeholder="017XXXXXXXX" />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="additionalInfo">Additional Information & Incident Description *</Label>
                <Textarea
                  id="additionalInfo"
                  name="additionalInfo"
                  required
                  rows={3}
                  placeholder="Describe the suspicious activity, timestamps, round/phase of match..."
                />
              </div>
            </>
          )}

          {/* Winner Payment Not Received Fields */}
          {selectedType === "Winner Payment Not Received" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="uid">Winner Free Fire UID *</Label>
                  <Input id="uid" name="uid" required placeholder="e.g. 123456789" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="name">Winner Name / Team Leader Name *</Label>
                  <Input id="name" name="name" required placeholder="Winner full name" />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="whatsapp">WhatsApp Number *</Label>
                <Input id="whatsapp" name="whatsapp" required placeholder="017XXXXXXXX" />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="additionalInfo">Additional Information</Label>
                <Textarea
                  id="additionalInfo"
                  name="additionalInfo"
                  rows={2}
                  placeholder="Specify the winning match time, position, expected prize amount..."
                />
              </div>
            </>
          )}

          {/* Payment Completed But Slot Not Booked Fields */}
          {selectedType === "Payment Completed But Slot Not Booked" && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="bookingDetails">Registration Details (Team Name, Leader Name, Tag) *</Label>
                <Input id="bookingDetails" name="bookingDetails" required placeholder="e.g. Team Vipers, Captain Abid, Tag #VP" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="whatsapp">WhatsApp Number *</Label>
                  <Input id="whatsapp" name="whatsapp" required placeholder="017XXXXXXXX" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="trxid">Payment TrxID *</Label>
                  <Input id="trxid" name="trxid" required placeholder="e.g. BL10293847" />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="additionalInfo">Additional Information</Label>
                <Textarea id="additionalInfo" name="additionalInfo" rows={2} placeholder="Any extra details about your payment..." />
              </div>
            </>
          )}

          {/* Feature Request Fields */}
          {selectedType === "Feature Request" && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="description">Expected Feature Description *</Label>
                <Textarea
                  id="description"
                  name="description"
                  required
                  rows={4}
                  placeholder="Describe the new feature, improvement, or workflow you would love to see on RushX Organization..."
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="whatsapp">Your WhatsApp Number *</Label>
                <Input id="whatsapp" name="whatsapp" required placeholder="017XXXXXXXX (for feature feedback & follow-up)" />
              </div>
            </>
          )}

          {/* Bug Report Fields */}
          {selectedType === "Bug Report" && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="description">Bug Description &amp; Reproduction Steps *</Label>
                <Textarea
                  id="description"
                  name="description"
                  required
                  rows={4}
                  placeholder="Describe the technical issue or bug, what page/action triggered it, and what you expected to happen..."
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="whatsapp">Reporter WhatsApp Number *</Label>
                <Input
                  id="whatsapp"
                  name="whatsapp"
                  required
                  placeholder="017XXXXXXXX (so our dev team can reach out for follow-up)"
                />
              </div>
            </>
          )}

          {/* Other Report Fields */}
          {selectedType === "Other Report" && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="description">Issue Description *</Label>
                <Textarea
                  id="description"
                  name="description"
                  required
                  rows={3}
                  placeholder="Describe your issue or question in detail..."
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="whatsapp">WhatsApp Number *</Label>
                <Input id="whatsapp" name="whatsapp" required placeholder="017XXXXXXXX" />
              </div>
            </>
          )}

          {/* UNIFIED MEDIA PROOF SECTION: IMAGES + DIRECT VIDEO UPLOAD + EXTERNAL LINKS */}
          <div className="rounded-2xl border border-border/80 bg-secondary/20 p-4 flex flex-col gap-4">
            <h4 className="font-display text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <ImageIcon className="size-4 text-primary" />
              {selectedType === "Feature Request"
                ? "Mockups, Videos & Reference Links (Optional)"
                : selectedType === "Bug Report"
                  ? "Bug Screenshots, Screen Recordings & Drive Links"
                  : "Evidence & Proof Attachments"}
            </h4>

            {/* 1. Multiple Screenshot Uploads */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <ImageIcon className="size-3.5 text-primary" />
                  Upload Screenshots / Images
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  {uploadedImages.length} image{uploadedImages.length === 1 ? "" : "s"} attached
                </span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleMultipleImageUpload}
                className="hidden"
              />

              {uploadedImages.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 my-1">
                  {uploadedImages.map((url, idx) => (
                    <div key={idx} className="group relative rounded-xl border border-border/60 overflow-hidden bg-black/40 aspect-video">
                      <img
                        src={resolveImageUrl(url)}
                        alt={`Proof ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute top-1 right-1 size-6 rounded-full bg-black/80 text-white flex items-center justify-center hover:bg-destructive transition-colors shadow-md"
                        title="Remove image"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                disabled={uploadingImage}
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-dashed h-11 text-xs"
              >
                {uploadingImage ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin text-primary" />
                    <span>Uploading images... {imageProgress}%</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <UploadCloud className="size-4 text-primary" />
                    <span>Attach Screenshots (PNG, JPG, WebP up to 50MB)</span>
                  </div>
                )}
              </Button>
            </div>

            {/* 2. Direct Video File Upload */}
            <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Video className="size-3.5 text-primary" />
                  Upload Video Clips Directly (Optional)
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  {uploadedVideos.length} video{uploadedVideos.length === 1 ? "" : "s"} attached
                </span>
              </div>

              <input
                ref={videoInputRef}
                type="file"
                multiple
                accept="video/mp4,video/webm,video/quicktime,video/*"
                onChange={handleVideoUpload}
                className="hidden"
              />

              {uploadedVideos.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 my-1">
                  {uploadedVideos.map((vUrl, idx) => (
                    <div key={idx} className="relative rounded-xl border border-border/60 overflow-hidden bg-black/60">
                      <video
                        src={resolveImageUrl(vUrl)}
                        controls
                        preload="metadata"
                        className="w-full max-h-40 object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => removeVideo(idx)}
                        className="absolute top-1.5 right-1.5 size-6 rounded-full bg-black/80 text-white flex items-center justify-center hover:bg-destructive transition-colors shadow-md"
                        title="Remove video"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                disabled={uploadingVideo}
                onClick={() => videoInputRef.current?.click()}
                className="w-full border-dashed h-11 text-xs"
              >
                {uploadingVideo ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin text-primary" />
                    <span>Uploading video... {videoProgress}%</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Video className="size-4 text-primary" />
                    <span>Upload Video Clip (MP4, WebM, MOV)</span>
                  </div>
                )}
              </Button>
            </div>

            {/* 3. External Links (Google Drive / MEGA / YouTube / Reference URLs) */}
            <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
              <Label htmlFor="externalLinkInput" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Link2 className="size-3.5 text-primary" />
                External Links (Google Drive / MEGA / YouTube / Reference Links)
              </Label>

              <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-xs text-muted-foreground flex flex-col gap-1">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <HelpCircle className="size-3.5 text-primary" />
                  Link Instructions:
                </p>
                <p className="text-[11px] text-foreground/80">
                  For large screen recordings or design docs, upload to Google Drive or MEGA with{" "}
                  <strong>Anyone with the link</strong> enabled and add one or more URLs below.
                </p>
              </div>

              <div className="flex gap-2">
                <Input
                  id="externalLinkInput"
                  type="url"
                  value={externalLinkInput}
                  onChange={(e) => setExternalLinkInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      handleAddExternalLink()
                    }
                  }}
                  placeholder="https://drive.google.com/file/d/... or https://mega.nz/..."
                  className="h-10 text-xs flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleAddExternalLink}
                  className="h-10 gap-1 text-xs whitespace-nowrap"
                >
                  <Plus className="size-3.5" />
                  Add Link
                </Button>
              </div>

              {externalLinks.length > 0 && (
                <ul className="flex flex-col gap-1.5 mt-1">
                  {externalLinks.map((lnk, idx) => (
                    <li
                      key={`${lnk}-${idx}`}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border/50 bg-black/30 px-3 py-1.5 text-xs"
                    >
                      <span className="truncate font-mono text-foreground">{lnk}</span>
                      <button
                        type="button"
                        onClick={() => removeExternalLink(idx)}
                        className="text-muted-foreground hover:text-destructive p-1"
                        title="Remove link"
                      >
                        <X className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <Button
            type="submit"
            disabled={busy}
            className="font-display font-bold uppercase py-6 glow-primary mt-2"
          >
            {busy && <Loader2 className="size-4 animate-spin mr-2" />}
            {uploadingImage || uploadingVideo
              ? "Uploading Proof Media..."
              : selectedType === "Feature Request"
                ? "Submit Feature Request"
                : selectedType === "Bug Report"
                  ? "Submit Bug Report"
                  : "Submit Report For Review"}
          </Button>
        </form>
      )}
    </div>
  )
}
