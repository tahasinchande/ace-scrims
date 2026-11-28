"use client"

import { useState, useTransition, useMemo } from "react"
import { addTutorial, updateTutorial, deleteTutorial } from "@/app/actions/tutorials"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { formatDate } from "@/lib/format"
import {
  Loader2,
  Plus,
  Trash2,
  Edit3,
  Video,
  Play,
  UploadCloud,
  Link as LinkIcon,
  CheckCircle2,
  Info,
    HardDrive,
  FileVideo,
} from "lucide-react"
import { toast } from "sonner"
import { uploadVideoDirect } from "@/lib/client-upload"
import { parseVideoEmbed } from "@/lib/video-parser"

type TutorialItem = {
  id: string
  title: string
  description: string | null
  videoUrl: string
  createdAt: Date
}

const MAX_VIDEO_SIZE = 10 * 1024 * 1024 * 1024 // 10GB chunked/multipart upload support

function VideoEmbedPreview({ url }: { url: string }) {
  const parsed = useMemo(() => parseVideoEmbed(url), [url])

  if (!url.trim()) return null

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-center gap-2 text-xs font-semibold">
        {parsed.type === "youtube" ? (
          <span className="flex items-center gap-1.5 text-red-500 font-bold">
            <Video className="size-4" /> YouTube Embed Detected
          </span>
        ) : parsed.type === "drive" ? (
          <span className="flex items-center gap-1.5 text-blue-400 font-bold">
            <HardDrive className="size-4" /> Google Drive Stream Embed Detected
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-primary font-bold">
            <FileVideo className="size-4" /> Direct Video Stream
          </span>
        )}
      </div>

      {parsed.warning && (
        <p className="text-[11px] text-amber-400 flex items-start gap-1.5 leading-relaxed font-medium">
          <Info className="size-3.5 text-amber-400 shrink-0 mt-0.5" />
          <span>{parsed.warning}</span>
        </p>
      )}

      {parsed.instructions && (
        <p className="text-[11px] text-muted-foreground flex items-start gap-1.5 leading-relaxed">
          <Info className="size-3.5 text-primary shrink-0 mt-0.5" />
          <span>{parsed.instructions}</span>
        </p>
      )}

      <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border/80 bg-black">
        {parsed.isEmbeddableIframe ? (
          <iframe
            src={parsed.embedUrl}
            title="Video Preview"
            loading="lazy"
            className="absolute inset-0 h-full w-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
            allowFullScreen
          />
        ) : (
          <video
            src={parsed.embedUrl}
            controls
            playsInline
            preload="metadata"
            className="absolute inset-0 h-full w-full object-contain bg-black"
          />
        )}
      </div>
    </div>
  )
}

function AddTutorialButton() {
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isPending, startTransition] = useTransition()
  const [urlInput, setUrlInput] = useState("")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)

    const title = (formData.get("title") as string)?.trim()
    const description = (formData.get("description") as string)?.trim() || ""
    const file = formData.get("videoFile") as File | null
    let finalVideoUrl = urlInput.trim()

    if (!title || title.length < 3) {
      toast.error("Please enter a valid title (at least 3 characters)")
      return
    }

    // Chunked Direct Client Video Upload (supports 5GB–10GB files, bypasses server payload limits)
    if (file && file.size > 0) {
      if (file.size > MAX_VIDEO_SIZE) {
        toast.error("Video file exceeds the 10GB maximum upload limit")
        return
      }

      setUploading(true)
      setUploadProgress(2)

      try {
        const res = await uploadVideoDirect(file, "tutorials", (pct) => {
          setUploadProgress(pct)
        })
        finalVideoUrl = res.url
        setUploadProgress(100)
      } catch (err: any) {
        toast.error(err instanceof Error ? err.message : "Video upload failed.")
        return
      } finally {
        setUploading(false)
      }
    }

    if (!finalVideoUrl) {
      toast.error("Please provide a video link or select a video file to upload")
      return
    }

    // Submit only plain string metadata to Server Action (0 byte file overhead)
    const actionData = new FormData()
    actionData.append("title", title)
    actionData.append("description", description)
    actionData.append("videoUrl", finalVideoUrl)

    startTransition(async () => {
      try {
        const res = await addTutorial(null, actionData)
        if (res.ok) {
          toast.success("Tutorial video published successfully!")
          setOpen(false)
          setUrlInput("")
        } else {
          toast.error(res.error ?? "Failed to save tutorial")
        }
      } catch {
        toast.error("An error occurred while saving the tutorial")
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
            Add New Tutorial Video
          </Button>
        }
      />
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display uppercase flex items-center gap-2 text-foreground">
            <Video className="size-5 text-primary" />
            Add Tutorial Video
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Tutorial Title / শিরোনাম *</Label>
            <Input id="title" name="title" required placeholder="e.g. How to book slots via automated gateway" />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea id="description" name="description" rows={3} placeholder="Brief step-by-step instructions for players..." />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="urlInput" className="flex items-center gap-1.5">
              <LinkIcon className="size-3.5 text-muted-foreground" />
              External Video Link (YouTube / Google Drive / MP4 URL)
            </Label>
            <Input
              id="urlInput"
              name="urlInput"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="e.g. https://www.youtube.com/watch?v=... or https://drive.google.com/file/d/.../view"
            />
            <p className="text-[11px] text-muted-foreground">
              YouTube links (watch, youtu.be, shorts) and Google Drive links are automatically converted to clean embeds.
            </p>
          </div>

          {urlInput && <VideoEmbedPreview url={urlInput} />}

          <div className="relative flex items-center py-1">
            <div className="grow border-t border-border" />
            <span className="shrink mx-3 text-xs font-semibold uppercase text-muted-foreground">OR DIRECT CHUNKED UPLOAD (5GB–10GB)</span>
            <div className="grow border-t border-border" />
          </div>

          <div className="flex flex-col gap-1.5 rounded-xl border border-border/70 bg-secondary/30 p-3.5">
            <Label htmlFor="videoFile" className="font-semibold text-xs flex items-center gap-1.5 text-foreground">
              <UploadCloud className="size-4 text-primary" />
              Direct Video Upload (Supports Large Files 5GB+)
            </Label>
            <Input id="videoFile" name="videoFile" type="file" accept="video/*" className="bg-background cursor-pointer" />
            <p className="text-[11px] text-muted-foreground mt-1">
              Uses resilient 20MB chunked direct streaming from your browser (supports up to 10GB with automatic retry).
            </p>
          </div>

          {uploading && (
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-3.5 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-2 text-primary">
                  <UploadCloud className="size-4 animate-bounce text-primary" /> 
                  Direct Cloud Streaming...
                </span>
                <span className="font-mono">{uploadProgress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div 
                  className="h-full bg-primary transition-all duration-300 rounded-full" 
                  style={{ width: `${uploadProgress}%` }} 
                />
              </div>
              <p className="text-[11px] text-muted-foreground text-center">
                Please wait while your video file is uploaded...
              </p>
            </div>
          )}

          <Button type="submit" disabled={busy} className="font-display font-bold uppercase mt-2 w-full">
            {busy && <Loader2 className="size-4 animate-spin mr-2" />}
            {uploading ? `Uploading Video (${uploadProgress}%)...` : "Save & Publish Tutorial"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditTutorialDialog({ tutorial }: { tutorial: TutorialItem }) {
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isPending, startTransition] = useTransition()
  const [urlInput, setUrlInput] = useState(tutorial.videoUrl)

  async function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)

    const title = (formData.get("title") as string)?.trim()
    const description = (formData.get("description") as string)?.trim() || ""
    const file = formData.get("videoFile") as File | null
    let finalVideoUrl = urlInput.trim() || tutorial.videoUrl

    if (!title || title.length < 3) {
      toast.error("Please enter a valid title")
      return
    }

    if (file && file.size > 0) {
      if (file.size > MAX_VIDEO_SIZE) {
        toast.error("Video file exceeds the 10GB maximum upload limit")
        return
      }

      setUploading(true)
      setUploadProgress(2)

      try {
        const res = await uploadVideoDirect(file, "tutorials", (pct) => {
          setUploadProgress(pct)
        })
        finalVideoUrl = res.url
        setUploadProgress(100)
      } catch (err: any) {
        toast.error(err instanceof Error ? err.message : "Video upload failed.")
        return
      } finally {
        setUploading(false)
      }
    }

    if (!finalVideoUrl) {
      toast.error("A valid video URL is required")
      return
    }

    const actionData = new FormData()
    actionData.append("title", title)
    actionData.append("description", description)
    actionData.append("videoUrl", finalVideoUrl)

    startTransition(async () => {
      try {
        const res = await updateTutorial(tutorial.id, actionData)
        if (res.ok) {
          toast.success("Tutorial updated successfully!")
          setOpen(false)
        } else {
          toast.error(res.error ?? "Failed to update tutorial")
        }
      } catch {
        toast.error("An error occurred while updating the tutorial")
      }
    })
  }

  const busy = uploading || isPending

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline" className="gap-1.5 text-xs font-semibold">
            <Edit3 className="size-3.5" />
            Edit / Change
          </Button>
        }
      />
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display uppercase flex items-center gap-2">
            <Edit3 className="size-5 text-primary" />
            Edit Tutorial Video
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleEditSubmit} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`edit-title-${tutorial.id}`}>Tutorial Title / শিরোনাম *</Label>
            <Input id={`edit-title-${tutorial.id}`} name="title" defaultValue={tutorial.title} required />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`edit-desc-${tutorial.id}`}>Description (Optional)</Label>
            <Textarea
              id={`edit-desc-${tutorial.id}`}
              name="description"
              rows={3}
              defaultValue={tutorial.description || ""}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`edit-url-${tutorial.id}`} className="flex items-center gap-1.5">
              <LinkIcon className="size-3.5 text-muted-foreground" />
              Video Link (YouTube / Drive / MP4 URL)
            </Label>
            <Input
              id={`edit-url-${tutorial.id}`}
              name="urlInput"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
            />
          </div>

          {urlInput && <VideoEmbedPreview url={urlInput} />}

          <div className="relative flex items-center py-1">
            <div className="grow border-t border-border" />
            <span className="shrink mx-3 text-xs font-semibold uppercase text-muted-foreground">OR REPLACE WITH FILE (5GB–10GB)</span>
            <div className="grow border-t border-border" />
          </div>

          <div className="flex flex-col gap-1.5 rounded-xl border border-border/70 bg-secondary/30 p-3.5">
            <Label htmlFor={`edit-file-${tutorial.id}`} className="font-semibold text-xs flex items-center gap-1.5 text-foreground">
              <UploadCloud className="size-4 text-primary" />
              Upload Replacement Video (Chunked Direct Stream 5GB+)
            </Label>
            <Input id={`edit-file-${tutorial.id}`} name="videoFile" type="file" accept="video/*" className="bg-background cursor-pointer" />
            <p className="text-[11px] text-muted-foreground mt-1">
              Replaces existing video URL with new chunked direct upload (supports up to 10GB).
            </p>
          </div>

          {uploading && (
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-3.5 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-2 text-primary">
                  <UploadCloud className="size-4 animate-bounce text-primary" /> 
                  Streaming Replacement Video...
                </span>
                <span className="font-mono">{uploadProgress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div 
                  className="h-full bg-primary transition-all duration-300 rounded-full" 
                  style={{ width: `${uploadProgress}%` }} 
                />
              </div>
            </div>
          )}

          <Button type="submit" disabled={busy} className="font-display font-bold uppercase mt-2 w-full">
            {busy && <Loader2 className="size-4 animate-spin mr-2" />}
            {uploading ? `Uploading Video (${uploadProgress}%)...` : "Save Changes"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteTutorialButton({ tutorialId }: { tutorialId: string }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleConfirmDelete() {
    startTransition(async () => {
      const res = await deleteTutorial(tutorialId)
      if (res.ok) {
        toast.success("Tutorial deleted successfully")
        setOpen(false)
      } else {
        toast.error(res.error || "Failed to delete tutorial")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="destructive" className="gap-1 text-xs">
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">Delete Tutorial Video?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Are you sure you want to permanently delete this tutorial? This action cannot be undone.
        </p>
        <DialogFooter className="gap-2 sm:gap-0 mt-3">
          <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" onClick={handleConfirmDelete} disabled={isPending}>
            {isPending && <Loader2 className="size-3.5 animate-spin mr-1.5" />}
            Confirm Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AdminTutorials({ tutorials }: { tutorials: TutorialItem[] }) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
            Video Tutorials ({tutorials.length})
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage, edit, change, and delete instructional video tutorials on the public /tutorial page.
          </p>
        </div>
        <AddTutorialButton />
      </header>

      {tutorials.length === 0 ? (
        <div className="dc-surface rushx-box-splash rounded-2xl p-12 text-center text-sm text-muted-foreground">
          No tutorial videos uploaded yet. Click &quot;Add New Tutorial Video&quot; above to create one.
        </div>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2">
          {tutorials.map((tut) => {
            const parsed = parseVideoEmbed(tut.videoUrl)

            return (
              <li key={tut.id} className="dc-surface rushx-box-splash flex flex-col justify-between gap-4 rounded-2xl p-5 shadow-md">
                <div className="flex flex-col gap-2">
                  <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
                    <Play className="size-4 text-primary shrink-0" />
                    {tut.title}
                  </h3>
                  {tut.description && (
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{tut.description}</p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatDate(tut.createdAt)}</span>
                    <span>·</span>
                    <span className="capitalize">{parsed.type}</span>
                  </div>
                </div>

                <div className="relative w-full aspect-video overflow-hidden rounded-xl bg-black border border-border/80">
                  {parsed.isEmbeddableIframe ? (
                    <iframe
                      src={parsed.embedUrl}
                      title={tut.title}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                      allowFullScreen
                    />
                  ) : (
                    <video
                      src={parsed.embedUrl}
                      controls
                      playsInline
                      preload="metadata"
                      className="absolute inset-0 h-full w-full object-contain bg-black"
                    />
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/40">
                  <EditTutorialDialog tutorial={tut} />
                  <DeleteTutorialButton tutorialId={tut.id} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
