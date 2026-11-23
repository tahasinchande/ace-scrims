"use client"

import { useState, useTransition, useRef } from "react"
import { useRouter } from "next/navigation"
import type { Notice } from "@/lib/db/schema"
import {
  createNoticeAction,
  updateNoticeAction,
  deleteNoticeAction,
  togglePinNoticeAction,
} from "@/app/actions/notices"
import { uploadMediaFile } from "@/lib/client-upload"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import {
  Megaphone,
  Pin,
  Trash2,
  Edit3,
  Upload,
  Loader2,
  Video,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ExternalLink,
  PlusCircle,
  FileText,
  X,
  Mail,
} from "lucide-react"

const CATEGORIES = [
  "General",
  "Announcement",
  "Tournament",
  "Rules",
  "Urgent",
  "Maintenance",
  "Prize Pool & Payouts",
]

function getPriorityBadge(priority: string) {
  switch (priority) {
    case "urgent":
      return <Badge className="bg-destructive/20 text-destructive border-destructive/30 font-bold uppercase text-[10px]">Urgent</Badge>
    case "important":
      return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 font-bold uppercase text-[10px]">Important</Badge>
    default:
      return <Badge variant="secondary" className="text-[10px] font-medium uppercase">Normal</Badge>
  }
}

export function AdminNoticesManager({ initialNotices }: { initialNotices: Notice[] }) {
  const [noticesList, setNoticesList] = useState<Notice[]>(initialNotices)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  // Form State
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [category, setCategory] = useState("General")
  const [priority, setPriority] = useState<"normal" | "important" | "urgent">("normal")
  const [isPinned, setIsPinned] = useState(false)
  const [sendEmailBroadcast, setSendEmailBroadcast] = useState(true)
  const [mediaUrl, setMediaUrl] = useState("")
  const [mediaType, setMediaType] = useState<"none" | "image" | "video">("none")

  // Upload State
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Edit Modal State
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editContent, setEditContent] = useState("")
  const [editCategory, setEditCategory] = useState("General")
  const [editPriority, setEditPriority] = useState<"normal" | "important" | "urgent">("normal")
  const [editIsPinned, setEditIsPinned] = useState(false)
  const [editMediaUrl, setEditMediaUrl] = useState("")
  const [editMediaType, setEditMediaType] = useState<"none" | "image" | "video">("none")
  const [isEditUploading, setIsEditUploading] = useState(false)
  const [editUploadProgress, setEditUploadProgress] = useState(0)

  // Delete Safeguard Prompt State
  const [noticeToDelete, setNoticeToDelete] = useState<Notice | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  // Handle Media File Selection
  async function handleFileUpload(file: File, isEdit = false) {
    if (!file) return

    const isVideo = file.type.startsWith("video/") || /\.(mp4|mov|webm|mkv)$/i.test(file.name)
    const detectedType: "image" | "video" = isVideo ? "video" : "image"

    if (isEdit) {
      setIsEditUploading(true)
      setEditUploadProgress(10)
    } else {
      setIsUploading(true)
      setUploadProgress(10)
    }

    try {
      const res = await uploadMediaFile(file, "uploads", (pct) => {
        if (isEdit) setEditUploadProgress(pct)
        else setUploadProgress(pct)
      })

      if (isEdit) {
        setEditMediaUrl(res.url)
        setEditMediaType(detectedType)
        setEditUploadProgress(100)
      } else {
        setMediaUrl(res.url)
        setMediaType(detectedType)
        setUploadProgress(100)
      }

      toast.success(isVideo ? "Video uploaded successfully" : "Image uploaded successfully")
    } catch (err: any) {
      toast.error(err?.message || "File upload failed. Please try again.")
    } finally {
      if (isEdit) {
        setIsEditUploading(false)
      } else {
        setIsUploading(false)
        if (fileInputRef.current) fileInputRef.current.value = ""
      }
    }
  }

  // Handle Create Notice
  async function handlePublishNotice(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !content.trim()) {
      toast.error("Please fill in both the title and description.")
      return
    }

    const formData = new FormData()
    formData.append("title", title.trim())
    formData.append("content", content.trim())
    formData.append("category", category)
    formData.append("priority", priority)
    formData.append("isPinned", isPinned ? "true" : "false")
    formData.append("sendEmailBroadcast", sendEmailBroadcast ? "true" : "false")
    formData.append("mediaUrl", mediaUrl.trim())
    formData.append("mediaType", mediaType)

    startTransition(async () => {
      const res = await createNoticeAction(null, formData)
      if (res.ok) {
        if (sendEmailBroadcast && (res.totalRecipients ?? 0) > 0) {
          if ((res.emailsFailed ?? 0) > 0) {
            toast.warning(
              `Notice published! Emailed ${res.emailsSent ?? 0}/${res.totalRecipients} players (${res.emailsFailed} failed).`
            )
          } else {
            toast.success(res.message || `Notice published & emailed to ${res.emailsSent ?? 0} player(s)!`)
          }
        } else {
          toast.success(res.message || "Notice published successfully!")
        }
        // Reset form
        setTitle("")
        setContent("")
        setCategory("General")
        setPriority("normal")
        setIsPinned(false)
        setMediaUrl("")
        setMediaType("none")
        router.refresh()
      } else {
        toast.error(res.error || "Failed to publish notice.")
      }
    })
  }

  // Open Edit Modal
  function handleOpenEdit(notice: Notice) {
    setEditingNotice(notice)
    setEditTitle(notice.title)
    setEditContent(notice.content)
    setEditCategory(notice.category || "General")
    setEditPriority((notice.priority as any) || "normal")
    setEditIsPinned(notice.isPinned)
    setEditMediaUrl(notice.mediaUrl || "")
    setEditMediaType((notice.mediaType as any) || "none")
  }

  // Handle Save Edit
  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingNotice) return

    const formData = new FormData()
    formData.append("title", editTitle.trim())
    formData.append("content", editContent.trim())
    formData.append("category", editCategory)
    formData.append("priority", editPriority)
    formData.append("isPinned", editIsPinned ? "true" : "false")
    formData.append("mediaUrl", editMediaUrl.trim())
    formData.append("mediaType", editMediaType)

    startTransition(async () => {
      const res = await updateNoticeAction(editingNotice.id, formData)
      if (res.ok) {
        toast.success("Notice updated successfully!")
        setNoticesList((prev) =>
          prev.map((item) =>
            item.id === editingNotice.id
              ? {
                  ...item,
                  title: editTitle.trim(),
                  content: editContent.trim(),
                  category: editCategory,
                  priority: editPriority,
                  isPinned: editIsPinned,
                  mediaUrl: editMediaUrl.trim() || null,
                  mediaType: editMediaType,
                  updatedAt: new Date(),
                }
              : item
          )
        )
        setEditingNotice(null)
        router.refresh()
      } else {
        toast.error(res.error || "Failed to update notice.")
      }
    })
  }

  // Handle Toggle Pin
  async function handleTogglePin(notice: Notice) {
    const nextPinState = !notice.isPinned
    setNoticesList((prev) =>
      prev.map((item) => (item.id === notice.id ? { ...item, isPinned: nextPinState } : item))
    )
    const res = await togglePinNoticeAction(notice.id, notice.isPinned)
    if (res.ok) {
      toast.success(res.message || "Pinned status updated")
      router.refresh()
    } else {
      toast.error(res.error || "Failed to update pinned state")
      // Revert on error
      setNoticesList((prev) =>
        prev.map((item) => (item.id === notice.id ? { ...item, isPinned: notice.isPinned } : item))
      )
    }
  }

  // Handle Delete Confirmation
  async function handleConfirmDelete() {
    if (!noticeToDelete) return
    setIsDeleting(true)
    try {
      const res = await deleteNoticeAction(noticeToDelete.id)
      if (res.ok) {
        toast.success("Notice deleted successfully")
        setNoticesList((prev) => prev.filter((item) => item.id !== noticeToDelete.id))
        setNoticeToDelete(null)
        router.refresh()
      } else {
        toast.error(res.error || "Failed to delete notice")
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete notice")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* ── Publish Notice Form ── */}
      <div className="glass rounded-2xl border border-border/80 bg-secondary/20 p-5 md:p-6 shadow-xl">
        <div className="flex items-center gap-3 border-b border-border/60 pb-4 mb-5">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <PlusCircle className="size-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold uppercase tracking-wide text-foreground">
              Publish New Notice
            </h2>
            <p className="text-xs text-muted-foreground">
              Create an announcement or bulletin with optional image/video attachments for user dashboards.
            </p>
          </div>
        </div>

        <form onSubmit={handlePublishNotice} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="notice-title" className="text-xs font-semibold">
                Notice Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="notice-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Schedule Update: 9:00 PM Champions Scrim Postponed"
                required
                maxLength={120}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notice-category" className="text-xs font-semibold">
                Category
              </Label>
              <select
                id="notice-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notice-priority" className="text-xs font-semibold">
                Priority Level
              </Label>
              <select
                id="notice-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="normal">Normal</option>
                <option value="important">Important (Highlighted)</option>
                <option value="urgent">Urgent (Red Alert)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notice-content" className="text-xs font-semibold">
              Notice Description / Content <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="notice-content"
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write the detailed announcement, lobby instructions, rule modifications, or prize payout updates here..."
              required
              maxLength={5000}
            />
          </div>

          {/* Media Attachment Section */}
          <div className="rounded-xl border border-border/80 bg-background/40 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <ImageIcon className="size-3.5 text-primary" />
                Optional Media Attachment (Image or Video)
              </Label>
              {mediaUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setMediaUrl("")
                    setMediaType("none")
                  }}
                  className="text-xs text-destructive hover:underline flex items-center gap-1"
                >
                  <X className="size-3" /> Remove Attachment
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* File Upload Option */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">Upload file:</span>
                <label className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs font-medium cursor-pointer hover:border-primary/60 hover:bg-primary/[0.03] transition-colors">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) handleFileUpload(f, false)
                    }}
                    disabled={isUploading}
                    className="sr-only"
                  />
                  {isUploading ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin text-primary" />
                      <span>Uploading ({uploadProgress}%)...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="size-3.5 text-primary" />
                      <span>Choose Image or Video File</span>
                    </>
                  )}
                </label>
              </div>

              {/* External Media URL Option */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-muted-foreground">Or enter media URL:</span>
                <div className="flex gap-2">
                  <Input
                    value={mediaUrl}
                    onChange={(e) => {
                      const val = e.target.value
                      setMediaUrl(val)
                      if (val) {
                        if (val.match(/\.(mp4|webm|mov|mkv)$/i) || val.includes("youtube") || val.includes("youtu.be")) {
                          setMediaType("video")
                        } else {
                          setMediaType("image")
                        }
                      } else {
                        setMediaType("none")
                      }
                    }}
                    placeholder="https://... image or video URL"
                    className="h-8 text-xs"
                  />
                  <select
                    value={mediaType}
                    onChange={(e) => setMediaType(e.target.value as any)}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="none">None</option>
                    <option value="image">Image</option>
                    <option value="video">Video</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Media Preview */}
            {mediaUrl && (
              <div className="mt-2 rounded-lg border border-border bg-secondary/30 p-2">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase mb-1.5 block">
                  Media Attachment Preview
                </span>
                {mediaType === "video" ? (
                  <video
                    src={mediaUrl}
                    controls
                    className="max-h-48 w-full rounded-md bg-black object-contain"
                  />
                ) : (
                  <img
                    src={mediaUrl}
                    alt="Notice attachment preview"
                    className="max-h-48 rounded-md object-contain mx-auto"
                  />
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="size-4 rounded border-border text-primary focus:ring-primary"
                />
                <Pin className="size-3.5 text-primary" />
                <span>Pin this notice to the top of the feed</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={sendEmailBroadcast}
                  onChange={(e) => setSendEmailBroadcast(e.target.checked)}
                  className="size-4 rounded border-border text-primary focus:ring-primary"
                />
                <Mail className="size-3.5 text-primary" />
                <span>Send email alert to verified players</span>
              </label>
            </div>

            <Button
              type="submit"
              disabled={isPending || isUploading}
              className="glow-primary font-display font-bold uppercase"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-1.5" />
                  Publishing...
                </>
              ) : (
                <>
                  <Megaphone className="size-4 mr-1.5" />
                  Publish Notice
                </>
              )}
            </Button>
          </div>
        </form>
      </div>

      {/* ── Manage Existing Notices ── */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-bold uppercase tracking-wide text-foreground">
              Published Notices ({noticesList.length})
            </h2>
          </div>
        </div>

        {noticesList.length === 0 ? (
          <div className="glass flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 p-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground mb-3">
              <FileText className="size-6" />
            </div>
            <p className="font-display text-base font-bold text-foreground">No Notices Published Yet</p>
            <p className="max-w-sm text-xs text-muted-foreground mt-1">
              Use the form above to publish official tournament bulletins, schedules, and important rules for your players.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {noticesList.map((notice) => (
              <div
                key={notice.id}
                className={`glass flex flex-col md:flex-row gap-4 rounded-2xl p-4 md:p-5 border transition-all ${
                  notice.isPinned
                    ? "border-primary/50 bg-primary/[0.03] shadow-md shadow-primary/5"
                    : "border-border/60 hover:border-border"
                }`}
              >
                {/* Notice Content Left Column */}
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {notice.isPinned && (
                      <Badge className="bg-primary/20 text-primary border-primary/40 font-bold uppercase text-[10px] gap-1">
                        <Pin className="size-2.5" /> Pinned Notice
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-[10px] font-bold uppercase border-border/80">
                      {notice.category}
                    </Badge>
                    {getPriorityBadge(notice.priority)}
                    <span className="text-xs text-muted-foreground font-mono flex items-center gap-1 ml-auto md:ml-0">
                      <Clock className="size-3" />
                      {new Date(notice.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>

                  <h3 className="font-display text-base md:text-lg font-bold text-foreground">
                    {notice.title}
                  </h3>

                  <p className="text-xs md:text-sm text-muted-foreground leading-relaxed whitespace-pre-line line-clamp-3">
                    {notice.content}
                  </p>

                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>Published by: {notice.authorName || "RushX Organization Admin"}</span>
                  </div>
                </div>

                {/* Notice Media Thumbnail & Actions Right Column */}
                <div className="flex flex-row md:flex-col items-end justify-between md:justify-center gap-3 md:w-48 shrink-0 border-t md:border-t-0 md:border-l border-border/60 pt-3 md:pt-0 md:pl-4">
                  {notice.mediaUrl && (
                    <div className="relative size-16 md:size-20 overflow-hidden rounded-xl border border-border/80 bg-background/50 self-start md:self-center">
                      {notice.mediaType === "video" ? (
                        <div className="flex size-full items-center justify-center bg-black/60 text-white">
                          <Video className="size-6 text-primary" />
                        </div>
                      ) : (
                        <img
                          src={notice.mediaUrl}
                          alt={notice.title}
                          className="size-full object-cover"
                        />
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 ml-auto">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleTogglePin(notice)}
                      className={`h-8 px-2 text-xs ${notice.isPinned ? "text-primary" : "text-muted-foreground"}`}
                      title={notice.isPinned ? "Unpin notice" : "Pin notice to top"}
                    >
                      <Pin className="size-3.5" />
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenEdit(notice)}
                      className="h-8 px-2.5 text-xs font-semibold gap-1"
                      title="Edit Notice"
                    >
                      <Edit3 className="size-3.5" />
                      <span className="hidden sm:inline">Edit</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => setNoticeToDelete(notice)}
                      className="h-8 px-2.5 text-xs font-semibold gap-1 bg-destructive/90 hover:bg-destructive text-destructive-foreground shadow-xs"
                      title="Delete Notice"
                    >
                      <Trash2 className="size-3.5" />
                      <span className="hidden sm:inline">Delete</span>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Edit Notice Modal ── */}
      {editingNotice && (
        <Dialog open={true} onOpenChange={(open) => !open && setEditingNotice(null)}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle className="font-display uppercase text-lg">
                Edit Notice
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSaveEdit} className="space-y-4 pt-2">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold">Title</Label>
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                  maxLength={120}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold">Category</Label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold">Priority</Label>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value as any)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    <option value="normal">Normal</option>
                    <option value="important">Important</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold">Content</Label>
                <Textarea
                  rows={4}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  required
                  maxLength={5000}
                />
              </div>

              {/* Edit Media Attachment */}
              <div className="rounded-xl border border-border p-3 space-y-2 bg-secondary/10">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Media Attachment</Label>
                  {editMediaUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditMediaUrl("")
                        setEditMediaType("none")
                      }}
                      className="text-xs text-destructive hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="flex gap-2">
                  <Input
                    value={editMediaUrl}
                    onChange={(e) => {
                      setEditMediaUrl(e.target.value)
                      if (!e.target.value) setEditMediaType("none")
                    }}
                    placeholder="Media URL or upload below"
                    className="h-8 text-xs"
                  />
                  <select
                    value={editMediaType}
                    onChange={(e) => setEditMediaType(e.target.value as any)}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                  >
                    <option value="none">None</option>
                    <option value="image">Image</option>
                    <option value="video">Video</option>
                  </select>
                </div>

                <label className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs font-medium cursor-pointer hover:bg-secondary/40">
                  <input
                    type="file"
                    accept="image/*,video/*"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) handleFileUpload(f, true)
                    }}
                    disabled={isEditUploading}
                    className="sr-only"
                  />
                  {isEditUploading ? (
                    <>
                      <Loader2 className="size-3 animate-spin text-primary" />
                      <span>Uploading ({editUploadProgress}%)...</span>
                    </>
                  ) : (
                    <>
                      <Upload className="size-3 text-primary" />
                      <span>Upload New File Attachment</span>
                    </>
                  )}
                </label>

                {editMediaUrl && (
                  <div className="mt-2 rounded-md border border-border overflow-hidden bg-background p-1">
                    {editMediaType === "video" ? (
                      <video src={editMediaUrl} controls className="max-h-36 w-full object-contain" />
                    ) : (
                      <img src={editMediaUrl} alt="Preview" className="max-h-36 object-contain mx-auto" />
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={editIsPinned}
                    onChange={(e) => setEditIsPinned(e.target.checked)}
                    className="size-4 rounded border-border text-primary"
                  />
                  <span>Pin to top</span>
                </label>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setEditingNotice(null)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isPending || isEditUploading} className="glow-primary">
                    {isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Safeguard Delete Prompt Modal ── */}
      {noticeToDelete && (
        <Dialog open={true} onOpenChange={(open) => !open && setNoticeToDelete(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive font-display uppercase">
                <AlertTriangle className="size-5" />
                Delete Notice?
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-2 text-sm text-foreground">
              <p>
                Are you sure you want to permanently delete this notice? It will immediately be removed from the user notice feed.
              </p>
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs space-y-1">
                <p className="font-bold text-foreground">Notice Title:</p>
                <p className="text-muted-foreground">{noticeToDelete.title}</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                disabled={isDeleting}
                onClick={() => setNoticeToDelete(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="size-4" />
                    Yes, Delete Notice
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
