"use client"

import { useState, useTransition, useRef } from "react"
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
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { uploadMediaFile } from "@/lib/client-upload"
import { resolveImageUrl } from "@/lib/image-url"

type ReportType =
  | "Hacker Report"
  | "Winner Payment Not Received"
  | "Payment Completed But Slot Not Booked"
  | "Other Report"

type ScrimItem = {
  id: string
  title: string
  startTime?: string
  map?: string
}

export function ReportFormView({ scrims = [] }: { scrims?: ScrimItem[] }) {
  const [selectedType, setSelectedType] = useState<ReportType>("Hacker Report")
  const [isPending, startTransition] = useTransition()
  const [isSuccess, setIsSuccess] = useState(false)

  // Scrim and Date selection states
  const [selectedScrimId, setSelectedScrimId] = useState("")
  const [customScrimName, setCustomScrimName] = useState("")
  const todayStr = new Date().toISOString().split("T")[0]
  const [incidentDate, setIncidentDate] = useState(todayStr)

  // Upload states for multiple large images
  const [uploadedImages, setUploadedImages] = useState<string[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [imageProgress, setImageProgress] = useState(0)
  const [videoLink, setVideoLink] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleMultipleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || files.length === 0) return

    setUploadingImage(true)
    setImageProgress(10)

    try {
      const newUrls: string[] = []
      const fileList = Array.from(files)
      const total = fileList.length

      for (let i = 0; i < total; i++) {
        const file = fileList[i]
        if (file.size > 50 * 1024 * 1024) {
          toast.error(`"${file.name}" is over 50MB and was skipped.`)
          continue
        }
        const result = await uploadMediaFile(file, "reports", (pct) => {
          const overall = Math.round(((i + pct / 100) / total) * 100)
          setImageProgress(overall)
        })
        newUrls.push(result.url)
      }

      setUploadedImages((prev) => [...prev, ...newUrls])
      setImageProgress(100)
      toast.success(`${newUrls.length} image(s) uploaded successfully!`)
    } catch (err) {
      toast.error("Image upload failed: " + (err instanceof Error ? err.message : "Network error"))
    } finally {
      setUploadingImage(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  function removeImage(index: number) {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (uploadingImage) {
      toast.info("Please wait for images to finish uploading")
      return
    }

    const form = e.currentTarget
    const formData = new FormData(form)

    formData.set("reportType", selectedType)
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

    if (uploadedImages.length > 0) {
      formData.set("imageUrls", JSON.stringify(uploadedImages))
      formData.set("proofUrlInput", uploadedImages[0])
    } else {
      formData.set("imageUrls", "")
      formData.set("proofUrlInput", "")
    }
    
    if (videoLink.trim()) {
      formData.set("videoLink", videoLink.trim())
    } else {
      formData.set("videoLink", "")
    }

    startTransition(async () => {
      try {
        const res = await submitReport(null, formData)
        if (res.ok) {
          setIsSuccess(true)
          toast.success("Report submitted successfully! Status set to In Review.")
        } else {
          console.error("[Report Submit Error]", res.error)
          toast.error(res.error || "Failed to submit report")
        }
      } catch (submitErr) {
        console.error("[Report Submit Exception]", submitErr)
        toast.error(
          submitErr instanceof Error
            ? `Submission error: ${submitErr.message}`
            : "Network error occurred while submitting report."
        )
      }
    })
  }

  const busy = uploadingImage || isPending

  return (
    <div className="w-full text-left flex flex-col gap-6">
      {/* Report Type Selector Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {(
          [
            { id: "Hacker Report", label: "Hacker Report", icon: ShieldAlert, desc: "Report hacking or cheating" },
            { id: "Winner Payment Not Received", label: "Winner Payment Not Received", icon: FileText, desc: "Unpaid tournament prize" },
            { id: "Payment Completed But Slot Not Booked", label: "Slot Not Booked", icon: AlertTriangle, desc: "TrxID paid but slot missing" },
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
          <h3 className="font-display text-xl font-bold uppercase">Report Submitted & In Review</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Your report is currently <span className="font-semibold text-primary">In Review</span> by our administrators.
            Once processed, the status will update to <span className="font-semibold text-emerald-400">Resolved</span>.
          </p>
          <Button
            onClick={() => {
              setIsSuccess(false)
              setUploadedImages([])
              setVideoLink("")
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
          {/* SCRIM & INCIDENT DATE SELECTION ROW */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-2xl border border-border/80 bg-secondary/20 p-4">
            {/* Scrim Selection */}
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

            {/* Date Selection (restricted till today) */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="incidentDate" className="flex items-center gap-1.5 text-xs font-semibold">
                <Calendar className="size-3.5 text-primary" />
                Match / Incident Date *
              </Label>
              <Input
                id="incidentDate"
                name="incidentDate"
                type="date"
                max={todayStr}
                value={incidentDate}
                onChange={(e) => setIncidentDate(e.target.value)}
                required
                className="h-10 rounded-xl border border-border bg-secondary/80 text-xs font-medium"
              />
              <span className="text-[10px] text-muted-foreground">Selectable till today ({todayStr})</span>
            </div>
          </div>

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

          {/* UNIFIED MEDIA PROOF SECTION: MULTIPLE LARGE IMAGES + DRIVE VIDEO LINK */}
          <div className="rounded-2xl border border-border/80 bg-secondary/20 p-4 flex flex-col gap-4">
            <h4 className="font-display text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <ImageIcon className="size-4 text-primary" />
              Evidence & Proof Attachments
            </h4>

            {/* 1. Multiple Large Image Uploads */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <ImageIcon className="size-3.5 text-primary" />
                  Upload Screenshot Proofs (Multiple Large Images Supported)
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

              {/* Image previews grid */}
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
                className="w-full border-dashed h-12 text-xs"
              >
                {uploadingImage ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin text-primary" />
                    <span>Uploading images... {imageProgress}%</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <UploadCloud className="size-4 text-primary" />
                    <span>Select & Attach Screenshots (PNG, JPG, WebP up to 50MB)</span>
                  </div>
                )}
              </Button>
            </div>

            {/* 2. Video Proof Drive Link */}
            <div className="flex flex-col gap-2 pt-2 border-t border-border/50">
              <Label htmlFor="videoLinkInput" className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Link2 className="size-3.5 text-primary" />
                Video Proof Link (Google Drive / MEGA / YouTube)
              </Label>

              <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-xs text-muted-foreground flex flex-col gap-1.5">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <HelpCircle className="size-3.5 text-primary" />
                  Video Upload Instructions:
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] text-foreground/80 pl-1">
                  <li>Upload your video proof to a cloud drive (Preferred: <strong>Google Drive</strong> and <strong>MEGA</strong>)</li>
                  <li>Make sure the link is <strong>Public (Accessible to everyone / Anyone with the link)</strong></li>
                  <li>Paste the public shareable link below</li>
                </ul>
              </div>

              <Input
                id="videoLinkInput"
                type="url"
                value={videoLink}
                onChange={(e) => setVideoLink(e.target.value)}
                placeholder="https://drive.google.com/file/d/... or https://mega.nz/..."
                className="h-10 text-xs"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={busy}
            className="font-display font-bold uppercase py-6 glow-primary mt-2"
          >
            {busy && <Loader2 className="size-4 animate-spin mr-2" />}
            {uploadingImage ? "Uploading Proof Media..." : "Submit Report For Review"}
          </Button>
        </form>
      )}
    </div>
  )
}
