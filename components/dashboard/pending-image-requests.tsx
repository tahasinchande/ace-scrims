"use client"

import { useState } from "react"
import Link from "next/link"
import { submitPendingImageRequest } from "@/app/actions/image-requests"
import { uploadMediaFile } from "@/lib/client-upload"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { ImagePlus, Upload, Loader2, CheckCircle2, Trash2, Camera, Sparkles, AlertCircle } from "lucide-react"
import type { ImageRequest } from "@/lib/db/schema"
import { cn } from "@/lib/utils"

export function PendingImageRequestsSection({ requests }: { requests: ImageRequest[] }) {
  if (!requests || requests.length === 0) {
    return null
  }

  return (
    <section id="image-requests" aria-labelledby="image-requests-heading" className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary/20 text-primary">
            <Camera className="size-4" />
          </div>
          <h2 id="image-requests-heading" className="font-display text-xl font-bold uppercase tracking-wide">
            Pending MVP Image Requests
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-primary/20 text-primary border-primary/30">
            {requests.length} Action Needed
          </Badge>
          <Button asChild variant="ghost" size="sm" className="h-7 text-xs font-semibold">
            <Link href="/dashboard/image-requests">View Dedicated Tab →</Link>
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {requests.map((request) => (
          <ImageRequestCard key={request.id} request={request} />
        ))}
      </div>
    </section>
  )
}

export function ImageRequestCard({ request }: { request: ImageRequest }) {
  const [teamName, setTeamName] = useState(request.teamName || "")
  const [playerUid, setPlayerUid] = useState(request.captainUid || "")
  const [playerName, setPlayerName] = useState(request.mvpPlayerName || request.captainName || "")
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(request.status === "submitted")

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setIsUploading(true)
    const newUrls: string[] = []

    try {
      for (const file of files) {
        // Upload with no file size limit restriction
        const res = await uploadMediaFile(file, "avatars")
        if (res?.url) {
          newUrls.push(res.url)
        }
      }
      setUploadedUrls((prev) => [...prev, ...newUrls])
      toast.success(`${newUrls.length} image${newUrls.length > 1 ? "s" : ""} uploaded successfully`)
    } catch (err: any) {
      console.error("Multi-image upload failure:", err)
      toast.error(err?.message || "Failed to upload image(s). Please try again.")
    } finally {
      setIsUploading(false)
      // reset file input
      e.target.value = ""
    }
  }

  function handleRemoveUrl(indexToRemove: number) {
    setUploadedUrls((prev) => prev.filter((_, idx) => idx !== indexToRemove))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!teamName.trim()) {
      toast.error("Please enter your Team Name.")
      return
    }
    if (!playerName.trim()) {
      toast.error("Please enter the MVP / Player Name.")
      return
    }
    if (!playerUid.trim()) {
      toast.error("Please enter the Player UID.")
      return
    }
    if (uploadedUrls.length === 0) {
      toast.error("Please upload at least one waist-up photo.")
      return
    }

    setIsSubmitting(true)
    try {
      const res = await submitPendingImageRequest({
        requestId: request.id,
        teamName: teamName.trim(),
        playerUid: playerUid.trim(),
        playerName: playerName.trim(),
        imageUrls: uploadedUrls,
      })

      if (res.ok) {
        toast.success(res.message || "Images submitted successfully!")
        setIsSubmitted(true)
      } else {
        toast.error(res.error || "Failed to submit image request.")
      }
    } catch (err: any) {
      toast.error(err?.message || "An unexpected error occurred.")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSubmitted) {
    return (
      <div className="glass flex flex-col items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-950/10 p-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
          <CheckCircle2 className="size-6" />
        </div>
        <p className="font-display text-lg font-bold text-emerald-400 uppercase">
          Photos Submitted for {teamName} {playerName ? `(${playerName})` : ""}
        </p>
        <p className="max-w-md text-xs text-muted-foreground">
          Thank you! Our design team is currently processing your photo for the official RushX Organization Face Banners showcase.
        </p>
      </div>
    )
  }

  return (
    <div className="glass flex flex-col gap-5 rounded-2xl border border-primary/30 bg-secondary/20 p-5 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div>
          <span className="text-xs font-semibold text-primary uppercase tracking-wider">
            Official Production Request
          </span>
          <h3 className="font-display text-lg font-bold text-foreground">
            {request.scrimTitle || "Match Scrim"} — {request.teamName}
          </h3>
        </div>
        <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-300">
          MVP Banner Showcase
        </Badge>
      </div>

      {/* Upload Rules Displayed Exactly As Requested */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs leading-relaxed text-amber-200">
        <div className="flex items-center gap-2 font-bold text-amber-300 mb-2">
          <Sparkles className="size-4" />
          <span>Upload Rules / নির্দেশনা:</span>
        </div>
        <p className="font-semibold">
          (1) You must submit a waist-up photo. / কোমর পর্যন্ত ছবি দিতে হবে।
        </p>
        <p className="mt-1">
          (2) It would be better if your uploaded image has its background removed. / আপলোড করা ছবির ব্যাকগ্রাউন্ড রিমুভ করা থাকলে ভালো হয়।
        </p>
      </div>

      {/* Upload Form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {request.mvpPlayerName && (
          <div className="flex items-center gap-2 rounded-xl bg-primary/10 border border-primary/30 p-2.5 text-xs text-primary font-medium">
            <Sparkles className="size-4 shrink-0" />
            <span>Management explicitly nominated MVP Player: <strong>{request.mvpPlayerName}</strong>. Please confirm or edit the player name below.</span>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`team-name-${request.id}`} className="text-xs font-semibold text-muted-foreground">
              Team Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id={`team-name-${request.id}`}
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="e.g. Team Inferno"
              required
              maxLength={50}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`player-name-${request.id}`} className="text-xs font-semibold text-muted-foreground">
              MVP / Player Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id={`player-name-${request.id}`}
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="e.g. Abrar / RAJ-77"
              required
              maxLength={50}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`player-uid-${request.id}`} className="text-xs font-semibold text-muted-foreground">
              Player Free Fire UID <span className="text-destructive">*</span>
            </Label>
            <Input
              id={`player-uid-${request.id}`}
              value={playerUid}
              onChange={(e) => setPlayerUid(e.target.value)}
              placeholder="e.g. 192837465"
              required
              maxLength={40}
            />
          </div>
        </div>

        {/* Multi-Image Upload Field with Strictly No File Size Limit */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-muted-foreground">
              Player Photo(s) (Supports multiple uploads, no size limit) <span className="text-destructive">*</span>
            </Label>
            {uploadedUrls.length > 0 && (
              <span className="text-xs font-bold text-emerald-400">
                {uploadedUrls.length} file{uploadedUrls.length > 1 ? "s" : ""} selected
              </span>
            )}
          </div>

          {/* Drag & Drop or Click Area */}
          <label
            htmlFor={`file-upload-${request.id}`}
            className={cn(
              "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/80 bg-background/40 p-6 text-center transition-all cursor-pointer hover:border-primary/60 hover:bg-primary/[0.02]",
              isUploading && "pointer-events-none opacity-60"
            )}
          >
            <input
              id={`file-upload-${request.id}`}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFilesSelected}
              disabled={isUploading}
              className="sr-only"
            />
            {isUploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="size-6 animate-spin text-primary" />
                <span className="text-xs font-medium text-foreground">Uploading images in original quality...</span>
              </div>
            ) : (
              <>
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Upload className="size-5" />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-foreground">
                    Click to select multiple photos or drag & drop
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Strictly no file size limit · PNG, JPG, WEBP accepted
                  </span>
                </div>
              </>
            )}
          </label>

          {/* Uploaded Previews Gallery */}
          {uploadedUrls.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-2">
              {uploadedUrls.map((url, idx) => (
                <div key={idx} className="group relative overflow-hidden rounded-xl border border-border bg-background p-1">
                  <img
                    src={url}
                    alt={`Upload ${idx + 1}`}
                    className="aspect-square w-full rounded-lg object-contain bg-secondary/30"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveUrl(idx)}
                    className="absolute right-2 top-2 rounded-full bg-destructive/90 p-1 text-white opacity-0 shadow-md transition-opacity group-hover:opacity-100"
                    title="Remove image"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="submit"
            disabled={isSubmitting || isUploading || uploadedUrls.length === 0}
            className="glow-primary font-display font-bold uppercase"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Submitting...
              </>
            ) : (
              <>
                <ImagePlus className="size-4" /> Submit Photos for Banner
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
