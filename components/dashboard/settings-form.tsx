"use client"

import { useState, useRef, useEffect, useTransition } from "react"
import { useRouter } from "next/navigation"
import { updateProfile, type ProfileState } from "@/app/actions/dashboard"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Loader2,
  BadgeCheck,
  MailWarning,
  Camera,
  UploadCloud,
  Trash2,
  User as UserIcon,
  AlertCircle,
  CheckCircle2,
} from "lucide-react"
import { resolveImageUrl } from "@/lib/image-url"
import { compressImage } from "@/lib/image-compress"
import { uploadMediaFile } from "@/lib/client-upload"
import { cn } from "@/lib/utils"

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"]

function getUserInitials(name: string): string {
  if (!name || !name.trim()) return "U"
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function SettingsForm({
  user,
}: {
  user: { name: string; email: string; emailVerified: boolean; image?: string | null }
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // ── Profile Picture State Management ────────────────────────────────────
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(user.image ? resolveImageUrl(user.image) : null)
  const [isRemoved, setIsRemoved] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<string | null>(null)
  const [profileResult, setProfileResult] = useState<ProfileState | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Clean up object URL when component unmounts or preview changes
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  // Sync with initial user image if prop updates
  useEffect(() => {
    if (!selectedFile && !isRemoved) {
      setPreviewUrl(user.image ? resolveImageUrl(user.image) : null)
    }
  }, [user.image, selectedFile, isRemoved])

  function handleFileValidation(file: File): boolean {
    setFileError(null)

    // 1. File Type Check
    if (!ALLOWED_IMAGE_TYPES.includes(file.type) && !/\.(jpg|jpeg|png|webp)$/i.test(file.name)) {
      setFileError("Please upload a valid image file (JPG, PNG, or WEBP).")
      return false
    }

    // 2. File Size Check (Max 10MB)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1)
      setFileError(`File size (${sizeMb}MB) exceeds the 10MB limit. Please select a smaller photo.`)
      return false
    }

    return true
  }

  function handleFileSelect(file: File) {
    if (!handleFileValidation(file)) return

    // Clean up previous blob URL if any
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl)
    }

    const objectUrl = URL.createObjectURL(file)
    setSelectedFile(file)
    setPreviewUrl(objectUrl)
    setIsRemoved(false)
    setFileError(null)
    setProfileResult(null)
  }

  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  function handleRemoveAvatar() {
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl)
    }
    setSelectedFile(null)
    setPreviewUrl(null)
    setIsRemoved(true)
    setFileError(null)
    setProfileResult(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  function triggerFileInput() {
    fileInputRef.current?.click()
  }

  // Drag & Drop handlers for avatar circle
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  // ── Profile Submit Handler ───────────────────────────────────────────────
  async function handleProfileSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setProfileResult(null)
    setFileError(null)

    const form = e.currentTarget
    const formData = new FormData(form)
    const displayName = String(formData.get("name") || "").trim()

    if (!displayName || displayName.length < 2) {
      setProfileResult({ ok: false, error: "Display name must be at least 2 characters." })
      return
    }

    startTransition(async () => {
      try {
        let uploadedAvatarUrl: string | undefined = undefined

        // If user picked a new file, compress on client and upload directly
        // to bypass Vercel's 4.5MB Serverless Function payload limit.
        if (selectedFile && !isRemoved) {
          setUploadStatus("Optimizing photo...")
          const compressed = await compressImage(selectedFile, {
            maxWidth: 512,
            maxHeight: 512,
            quality: 0.85,
            mimeType: "image/webp",
          })

          setUploadStatus("Uploading avatar...")
          const uploadRes = await uploadMediaFile(compressed, "avatars")
          if (!uploadRes || !uploadRes.url) {
            throw new Error("Failed to upload image. Please try again.")
          }
          uploadedAvatarUrl = uploadRes.url
        }

        setUploadStatus("Saving profile...")

        const submissionData = new FormData()
        submissionData.append("name", displayName)

        if (isRemoved) {
          submissionData.append("removeAvatar", "true")
        } else if (uploadedAvatarUrl) {
          submissionData.append("avatarUrl", uploadedAvatarUrl)
        }

        const res = await updateProfile({ ok: false }, submissionData)
        setProfileResult(res)

        if (res.ok) {
          setSelectedFile(null)
          router.refresh()
        }
      } catch (err: any) {
        console.error("[Profile Settings Error]", err)
        setProfileResult({
          ok: false,
          error: err?.message || "Failed to update profile settings. Please try again.",
        })
      } finally {
        setUploadStatus(null)
      }
    })
  }

  // ── Password Change State ───────────────────────────────────────────────
  const [pwState, setPwState] = useState<{ error?: string; message?: string; busy: boolean }>({ busy: false })

  async function handlePasswordChange(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const currentPassword = String(data.get("currentPassword") ?? "")
    const newPassword = String(data.get("newPassword") ?? "")
    if (newPassword.length < 8) {
      setPwState({ error: "New password must be at least 8 characters.", busy: false })
      return
    }
    setPwState({ busy: true })
    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    })
    if (error) {
      setPwState({ error: error.message ?? "Could not change password.", busy: false })
    } else {
      form.reset()
      setPwState({ message: "Password changed. Other sessions were signed out.", busy: false })
      router.refresh()
    }
  }

  const hasAvatar = Boolean(previewUrl && !isRemoved)

  return (
    <div className="flex flex-col gap-6">
      {/* Profile Section */}
      <section aria-labelledby="profile-heading" className="glass rounded-2xl p-6 border border-border/80 shadow-lg">
        <h2 id="profile-heading" className="font-display text-lg font-bold uppercase tracking-wide">
          Profile Settings
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Update your personal details and public avatar displayed across tournaments.
        </p>

        <form onSubmit={handleProfileSubmit} className="mt-6 flex flex-col gap-6">
          {/* Hidden inputs to pass state */}
          <input
            ref={fileInputRef}
            id="avatar-file-input"
            type="file"
            name="avatar"
            accept="image/png, image/jpeg, image/webp, image/jpg"
            onChange={onFileInputChange}
            className="hidden"
            aria-label="Upload profile picture"
          />

          {/* ── 1. Profile Picture Upload UI ────────────────────────────── */}
          <div className="flex flex-col gap-3">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Profile Picture
            </Label>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 p-4 rounded-xl border border-border/60 bg-secondary/30">
              {/* Circular Avatar Container with Hover Overlay & Drag-Drop */}
              <div
                onClick={triggerFileInput}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    triggerFileInput()
                  }
                }}
                className={cn(
                  "group relative size-24 sm:size-28 shrink-0 rounded-full overflow-hidden border-2 cursor-pointer transition-all duration-200 outline-none select-none",
                  "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  isDragging
                    ? "border-primary ring-4 ring-primary/30 scale-105"
                    : hasAvatar
                    ? "border-primary/40 hover:border-primary ring-2 ring-primary/10 shadow-md"
                    : "border-dashed border-border/80 hover:border-primary/60 bg-secondary/80"
                )}
                title="Click or drag an image here to change your profile picture"
                aria-label="Change profile picture"
              >
                {hasAvatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl!}
                    alt={`${user.name}'s profile avatar`}
                    className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="size-full flex flex-col items-center justify-center bg-gradient-to-br from-secondary via-background to-secondary/60 text-muted-foreground">
                    {user.name ? (
                      <span className="font-display text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                        {getUserInitials(user.name)}
                      </span>
                    ) : (
                      <UserIcon className="size-10 text-muted-foreground/60" />
                    )}
                  </div>
                )}

                {/* Interactive Click/Hover Overlay */}
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/65 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-white gap-1 px-2 text-center">
                  <Camera className="size-5 text-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">
                    {hasAvatar ? "Change" : "Upload"}
                  </span>
                </div>
              </div>

              {/* Action Buttons & Format Helper Details */}
              <div className="flex flex-col gap-2.5 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={triggerFileInput}
                    className="font-display text-xs font-bold uppercase tracking-wider border-border/80 hover:border-primary hover:text-primary gap-1.5 h-9 px-3.5"
                  >
                    <UploadCloud className="size-4 text-primary" />
                    {hasAvatar ? "Change Avatar" : "Upload Image"}
                  </Button>

                  {hasAvatar && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveAvatar}
                      className="text-xs font-semibold text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5 h-9 px-3"
                    >
                      <Trash2 className="size-3.5" />
                      Remove
                    </Button>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <p className="text-xs text-muted-foreground">
                    Accepted formats: <strong className="text-foreground font-medium">JPG, PNG, or WEBP</strong>. Max file size: <strong className="text-foreground font-medium">10MB</strong>.
                  </p>
                  <p className="text-[11px] text-muted-foreground/80">
                    Square 1:1 ratio is recommended for best match results.
                  </p>
                </div>

                {/* Inline Validation Error */}
                {fileError && (
                  <div role="alert" className="flex items-center gap-1.5 text-xs text-destructive mt-1 font-medium">
                    <AlertCircle className="size-3.5 shrink-0" />
                    <span>{fileError}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── 2. Display Name Field ─────────────────────────────────── */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Display Name
            </Label>
            <Input
              id="name"
              name="name"
              defaultValue={user.name}
              required
              minLength={2}
              maxLength={50}
              placeholder="e.g. ShadowHunter"
              className="bg-secondary/40 border-border/80 focus:border-primary"
            />
          </div>

          {/* ── 3. Email Field (Read Only) ────────────────────────────── */}
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</Label>
            <div className="flex items-center gap-2">
              <Input value={user.email} disabled aria-label="Email (read only)" className="bg-secondary/20 text-muted-foreground" />
              {user.emailVerified ? (
                <Badge variant="outline" className="shrink-0 border-success/30 text-success bg-success/5">
                  <BadgeCheck className="size-3.5 mr-1" aria-hidden />
                  Verified
                </Badge>
              ) : (
                <Badge variant="outline" className="shrink-0 border-warning/30 text-warning bg-warning/5">
                  <MailWarning className="size-3.5 mr-1" aria-hidden />
                  Unverified
                </Badge>
              )}
            </div>
          </div>

          {/* Feedback Messages */}
          {profileResult?.error && (
            <div role="alert" className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive font-medium">
              <AlertCircle className="size-4 shrink-0" />
              <span>{profileResult.error}</span>
            </div>
          )}
          {profileResult?.ok && profileResult?.message && (
            <div className="flex items-center gap-2 rounded-lg bg-success/10 border border-success/30 p-3 text-sm text-success font-medium">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>{profileResult.message}</span>
            </div>
          )}

          {/* Submit Button */}
          <div>
            <Button type="submit" disabled={isPending} className="font-display font-bold uppercase tracking-wider px-6">
              {isPending && <Loader2 className="size-4 animate-spin mr-2" aria-hidden />}
              {isPending ? (uploadStatus || "Saving...") : "Save Changes"}
            </Button>
          </div>
        </form>
      </section>

      {/* Password Change Section */}
      <section aria-labelledby="password-heading" className="glass rounded-2xl p-6 border border-border/80 shadow-lg">
        <h2 id="password-heading" className="font-display text-lg font-bold uppercase tracking-wide">
          Change Password
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Ensure your account stays secure by using a strong password.
        </p>

        <form onSubmit={handlePasswordChange} className="mt-6 flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="currentPassword" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Current Password
              </Label>
              <Input
                id="currentPassword"
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                required
                className="bg-secondary/40 border-border/80"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="newPassword" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                New Password
              </Label>
              <Input
                id="newPassword"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                className="bg-secondary/40 border-border/80"
              />
            </div>
          </div>
          {pwState.error && (
            <div role="alert" className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive font-medium">
              <AlertCircle className="size-4 shrink-0" />
              <span>{pwState.error}</span>
            </div>
          )}
          {pwState.message && (
            <div className="flex items-center gap-2 rounded-lg bg-success/10 border border-success/30 p-3 text-sm text-success font-medium">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>{pwState.message}</span>
            </div>
          )}
          <div>
            <Button type="submit" disabled={pwState.busy} variant="secondary" className="font-display font-bold uppercase tracking-wider">
              {pwState.busy && <Loader2 className="size-4 animate-spin mr-2" aria-hidden />}
              Update Password
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}

