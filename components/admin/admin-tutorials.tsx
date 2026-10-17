"use client"

import { useState, useTransition } from "react"
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
} from "@/components/ui/dialog"
import { formatDate } from "@/lib/format"
import { Loader2, Plus, Trash2, Edit3, Video, Play, UploadCloud, Link as LinkIcon, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { uploadVideoToCloudinaryDirect } from "@/lib/client-upload"

type TutorialItem = {
  id: string
  title: string
  description: string | null
  videoUrl: string
  createdAt: Date
}

function AddTutorialButton() {
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)

    const title = (formData.get("title") as string)?.trim()
    const description = (formData.get("description") as string)?.trim() || ""
    const file = formData.get("videoFile") as File | null
    let finalVideoUrl = (formData.get("urlInput") as string)?.trim() || ""

    if (!title || title.length < 3) {
      toast.error("Please enter a valid title (at least 3 characters)")
      return
    }

    // Direct Client-Side Video Upload to Cloudinary (Bypasses Vercel 4.5MB Serverless Payload Limit)
    if (file && file.size > 0) {
      if (file.size > 500 * 1024 * 1024) {
        toast.error("Video file must be under 500MB")
        return
      }

      setUploading(true)
      setUploadProgress(5)

      try {
        const res = await uploadVideoToCloudinaryDirect(file, "tutorials", (pct) => {
          setUploadProgress(pct)
        })
        finalVideoUrl = res.url
        setUploadProgress(100)
      } catch (err: any) {
        console.error("[Direct Video Upload Error]", err)
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
        } else {
          toast.error(res.error ?? "Failed to save tutorial")
        }
      } catch (submitErr) {
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
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
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
            <Input id="urlInput" name="urlInput" placeholder="https://www.youtube.com/watch?v=... or direct MP4 link" />
          </div>

          <div className="relative flex items-center py-1">
            <div className="grow border-t border-border" />
            <span className="shrink mx-3 text-xs font-semibold uppercase text-muted-foreground">OR DIRECT UPLOAD</span>
            <div className="grow border-t border-border" />
          </div>

          <div className="flex flex-col gap-1.5 rounded-xl border border-border/70 bg-secondary/30 p-3.5">
            <Label htmlFor="videoFile" className="font-semibold text-xs flex items-center gap-1.5 text-foreground">
              <UploadCloud className="size-4 text-primary" />
              Direct Video Upload (Uploads directly to Cloudinary up to 500MB)
            </Label>
            <Input id="videoFile" name="videoFile" type="file" accept="video/*" className="bg-background cursor-pointer" />
            <p className="text-[11px] text-muted-foreground mt-1">
              Bypasses Vercel 4.5MB payload limit by streaming directly from your browser to Cloudinary.
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
                Please wait while your video is uploaded directly to Cloudinary...
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

  async function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)

    const title = (formData.get("title") as string)?.trim()
    const description = (formData.get("description") as string)?.trim() || ""
    const file = formData.get("videoFile") as File | null
    let finalVideoUrl = (formData.get("urlInput") as string)?.trim() || tutorial.videoUrl

    if (!title || title.length < 3) {
      toast.error("Please enter a valid title")
      return
    }

    if (file && file.size > 0) {
      if (file.size > 500 * 1024 * 1024) {
        toast.error("Video file must be under 500MB")
        return
      }

      setUploading(true)
      setUploadProgress(5)

      try {
        const res = await uploadVideoToCloudinaryDirect(file, "tutorials", (pct) => {
          setUploadProgress(pct)
        })
        finalVideoUrl = res.url
        setUploadProgress(100)
      } catch (err: any) {
        console.error("[Direct Video Upload Error]", err)
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
      } catch (submitErr) {
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
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
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
            <Input id={`edit-url-${tutorial.id}`} name="urlInput" defaultValue={tutorial.videoUrl} />
          </div>

          <div className="relative flex items-center py-1">
            <div className="grow border-t border-border" />
            <span className="shrink mx-3 text-xs font-semibold uppercase text-muted-foreground">OR REPLACE WITH FILE</span>
            <div className="grow border-t border-border" />
          </div>

          <div className="flex flex-col gap-1.5 rounded-xl border border-border/70 bg-secondary/30 p-3.5">
            <Label htmlFor={`edit-file-${tutorial.id}`} className="font-semibold text-xs flex items-center gap-1.5 text-foreground">
              <UploadCloud className="size-4 text-primary" />
              Upload Replacement Video (Direct Cloudinary Stream)
            </Label>
            <Input id={`edit-file-${tutorial.id}`} name="videoFile" type="file" accept="video/*" className="bg-background cursor-pointer" />
            <p className="text-[11px] text-muted-foreground mt-1">
              Replaces existing video URL with new direct Cloudinary upload (up to 500MB).
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

export function AdminTutorials({ tutorials }: { tutorials: TutorialItem[] }) {
  const [isPending, startTransition] = useTransition()

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
        <div className="glass rounded-2xl p-12 text-center text-sm text-muted-foreground">
          No tutorial videos uploaded yet. Click &quot;Add New Tutorial Video&quot; above to create one.
        </div>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2">
          {tutorials.map((tut) => (
            <li key={tut.id} className="glass flex flex-col justify-between gap-4 rounded-2xl p-5 border border-border/70 shadow-md">
              <div className="flex flex-col gap-2">
                <h3 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
                  <Play className="size-4 text-primary shrink-0" />
                  {tut.title}
                </h3>
                {tut.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{tut.description}</p>
                )}
                <span className="text-xs text-muted-foreground">{formatDate(tut.createdAt)}</span>
              </div>

              <div className="overflow-hidden rounded-xl bg-black/80 border border-border/80 aspect-video relative">
                {tut.videoUrl.includes("youtube.com") || tut.videoUrl.includes("youtu.be") ? (
                  <iframe
                    src={tut.videoUrl.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")}
                    title={tut.title}
                    className="w-full h-full"
                    allowFullScreen
                  />
                ) : (
                  <video src={tut.videoUrl} controls preload="metadata" className="w-full h-full object-contain" />
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/40">
                <EditTutorialDialog tutorial={tut} />
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={isPending}
                  onClick={() => {
                    if (!window.confirm("Are you sure you want to permanently delete this tutorial?")) return
                    startTransition(async () => {
                      const res = await deleteTutorial(tut.id)
                      if (res.ok) toast.success("Tutorial deleted successfully")
                      else toast.error(res.error)
                    })
                  }}
                  className="gap-1 text-xs"
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
