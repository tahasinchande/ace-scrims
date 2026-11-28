"use client"

import { useState, useTransition, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Mail,
  Plus,
  Save,
  Trash2,
  Eye,
  Code2,
  Send,
  UploadCloud,
  Image as ImageIcon,
  Video,
  Link2,
  X,
  Loader2,
  Sparkles,
  Power,
  CheckCircle2,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { cn } from "@/lib/utils"
import { uploadMediaFile } from "@/lib/client-upload"
import { resolveImageUrl } from "@/lib/image-url"
import type { EmailTemplateMediaItem } from "@/lib/db/schema"
import type { NormalizedEmailTemplate } from "@/lib/queries/email-templates"
import {
  updateEmailTemplateAction,
  createCustomEmailTemplateAction,
  deleteEmailTemplateAction,
  sendTestEmailTemplateAction,
} from "@/app/actions/email-templates"

function escapePreviewHtml(input: string): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

type Props = {
  initialTemplates: NormalizedEmailTemplate[]
  adminEmail: string
}

export function AdminEmailManager({ initialTemplates, adminEmail }: Props) {
  const router = useRouter()
  const [templates, setTemplates] = useState<NormalizedEmailTemplate[]>(initialTemplates)
  const [selectedId, setSelectedId] = useState<string>(initialTemplates[0]?.id || "")
  const [activeTab, setActiveTab] = useState<"editor" | "preview">("editor")
  const [isPending, startTransition] = useTransition()
  const [togglingKey, setTogglingKey] = useState<string | null>(null)

  const initialTemplatesFingerprint = initialTemplates
    .map((t) => `${t.id}:${t.purposeKey}:${t.isEnabled ? 1 : 0}`)
    .join("|")

  useEffect(() => {
    setTemplates(initialTemplates)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTemplatesFingerprint])

  // Currently edited draft state
  const activeTemplate = templates.find((t) => t.id === selectedId) || templates[0] || null

  const [label, setLabel] = useState(activeTemplate?.label || "")
  const [description, setDescription] = useState(activeTemplate?.description || "")
  const [isEnabled, setIsEnabled] = useState(activeTemplate?.isEnabled ?? true)
  const [format, setFormat] = useState<"html" | "text">(
    activeTemplate?.format === "text" ? "text" : "html"
  )
  const [subject, setSubject] = useState(activeTemplate?.subject || "")
  const [preheader, setPreheader] = useState(activeTemplate?.preheader || "")
  const [bodyHtml, setBodyHtml] = useState(activeTemplate?.bodyHtml || "")
  const [bodyText, setBodyText] = useState(activeTemplate?.bodyText || "")
  const [ctaText, setCtaText] = useState(activeTemplate?.ctaText || "")
  const [ctaUrl, setCtaUrl] = useState(activeTemplate?.ctaUrl || "")
  const [mediaItems, setMediaItems] = useState<EmailTemplateMediaItem[]>(
    activeTemplate?.mediaItems || []
  )

  // Media upload / link addition
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [manualMediaUrl, setManualMediaUrl] = useState("")
  const [manualMediaType, setManualMediaType] = useState<"image" | "video" | "link">("image")
  const [manualMediaName, setManualMediaName] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Test email dispatch
  const [testEmailTo, setTestEmailTo] = useState(adminEmail)

  // Create custom purpose dialog/panel
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newLabel, setNewLabel] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [newSubject, setNewSubject] = useState("")
  const [newBodyHtml, setNewBodyHtml] = useState("")
  const [newFormat, setNewFormat] = useState<"html" | "text">("html")

  // Delete confirmation
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  function loadDraft(tpl: NormalizedEmailTemplate) {
    setSelectedId(tpl.id)
    setLabel(tpl.label)
    setDescription(tpl.description || "")
    setIsEnabled(tpl.isEnabled)
    setFormat(tpl.format === "text" ? "text" : "html")
    setSubject(tpl.subject)
    setPreheader(tpl.preheader || "")
    setBodyHtml(tpl.bodyHtml)
    setBodyText(tpl.bodyText)
    setCtaText(tpl.ctaText || "")
    setCtaUrl(tpl.ctaUrl || "")
    setMediaItems(tpl.mediaItems || [])
    setActiveTab("editor")
  }

  function handleSelectTemplate(tpl: NormalizedEmailTemplate) {
    loadDraft(tpl)
  }

  async function handleMasterToggle(tpl: NormalizedEmailTemplate, nextValue: boolean) {
    const lockKey = tpl.purposeKey || tpl.id
    if (togglingKey === lockKey) return

    const previousValue = tpl.isEnabled
    const isCurrentlySelected =
      activeTemplate?.id === tpl.id || activeTemplate?.purposeKey === tpl.purposeKey

    // Optimistic UI update
    setTogglingKey(lockKey)
    setTemplates((prev) =>
      prev.map((item) =>
        item.id === tpl.id || item.purposeKey === tpl.purposeKey
          ? { ...item, isEnabled: nextValue }
          : item
      )
    )
    if (isCurrentlySelected) {
      setIsEnabled(nextValue)
    }

    try {
      const response = await fetch("/api/admin/email-templates/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({
          id: tpl.id,
          purposeKey: tpl.purposeKey,
          isEnabled: nextValue,
        }),
      })

      const data = await response.json().catch(() => ({ ok: false, error: "Invalid server response" }))

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || `Failed to toggle template (${response.status})`)
      }

      const persistedEnabled =
        typeof data.isEnabled === "boolean" ? data.isEnabled : nextValue
      const persistedTpl: NormalizedEmailTemplate | null = data.template
        ? {
            ...data.template,
            createdAt: new Date(data.template.createdAt || Date.now()),
            updatedAt: new Date(data.template.updatedAt || Date.now()),
          }
        : null

      setTemplates((prev) =>
        prev.map((item) =>
          item.id === tpl.id || item.purposeKey === tpl.purposeKey
            ? persistedTpl ?? { ...item, isEnabled: persistedEnabled }
            : item
        )
      )

      if (isCurrentlySelected) {
        if (persistedTpl) setSelectedId(persistedTpl.id)
        setIsEnabled(persistedEnabled)
      }

      toast.success(`${tpl.label} email trigger ${persistedEnabled ? "enabled" : "disabled"}.`)
      router.refresh()
    } catch (err) {
      // Roll back optimistic state cleanly
      setTemplates((prev) =>
        prev.map((item) =>
          item.id === tpl.id || item.purposeKey === tpl.purposeKey
            ? { ...item, isEnabled: previousValue }
            : item
        )
      )
      if (isCurrentlySelected) {
        setIsEnabled(previousValue)
      }
      toast.error(err instanceof Error ? err.message : "Failed to toggle template status")
    } finally {
      setTogglingKey((current) => (current === lockKey ? null : current))
    }
  }

  function handleSaveTemplate(e: React.FormEvent) {
    e.preventDefault()
    if (!activeTemplate) return

    startTransition(async () => {
      try {
        const res = await updateEmailTemplateAction({
          id: activeTemplate.id,
          purposeKey: activeTemplate.purposeKey,
          label,
          description,
          isEnabled,
          format,
          subject,
          preheader,
          bodyHtml,
          bodyText,
          ctaText,
          ctaUrl,
          mediaItems,
          variablesHint: activeTemplate.variablesHint,
        })

        if (res.ok && res.template) {
          const saved = res.template
          setTemplates((prev) =>
            prev.map((item) =>
              item.id === activeTemplate.id || item.purposeKey === saved.purposeKey ? saved : item
            )
          )
          setSelectedId(saved.id)
          setIsEnabled(saved.isEnabled)
          toast.success(`"${label}" template saved successfully!`)
          router.refresh()
        } else {
          toast.error(res.error || "Failed to save email template")
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save email template")
      }
    })
  }

  async function handleMediaUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file || uploadingMedia) return

    const isVideo =
      file.type.startsWith("video/") || /\.(mp4|mov|webm|mkv|avi)$/i.test(file.name)
    const isImage =
      file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|avif)$/i.test(file.name)

    if (!isVideo && !isImage) {
      toast.error("Please select an image or video file.")
      return
    }

    setUploadingMedia(true)
    setUploadProgress(10)
    try {
      const uploaded = await uploadMediaFile(file, "email-media", (pct) => {
        setUploadProgress(pct)
      })
      const newItem: EmailTemplateMediaItem = {
        id: `media_${Date.now()}`,
        url: uploaded.url,
        type: isVideo ? "video" : "image",
        name: file.name,
      }
      setMediaItems((prev) => [...prev, newItem])
      toast.success(`${isVideo ? "Video" : "Image"} uploaded and attached to template draft.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Media upload failed")
    } finally {
      setUploadingMedia(false)
      setUploadProgress(0)
    }
  }

  function handleAddManualMedia() {
    const url = manualMediaUrl.trim()
    if (!url) {
      toast.error("Please enter a valid URL.")
      return
    }
    if (!url.startsWith("https://") && !url.startsWith("http://") && !url.startsWith("/")) {
      toast.error("URL must start with https://, http://, or /")
      return
    }
    const item: EmailTemplateMediaItem = {
      id: `media_${Date.now()}`,
      url,
      type: manualMediaType,
      name: manualMediaName.trim() || undefined,
    }
    setMediaItems((prev) => [...prev, item])
    setManualMediaUrl("")
    setManualMediaName("")
  }

  function handleInsertVariable(varName: string) {
    const token = `{{${varName}}}`
    if (format === "text") {
      setBodyText((prev) => `${prev}${prev.endsWith(" ") || prev === "" ? "" : " "}${token}`)
    } else {
      setBodyHtml((prev) => `${prev}${prev.endsWith(" ") || prev === "" ? "" : " "}${token}`)
    }
    toast.success(`Inserted ${token}`)
  }

  function handleCreateCustom(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      try {
        const res = await createCustomEmailTemplateAction({
          label: newLabel,
          description: newDescription,
          format: newFormat,
          subject: newSubject,
          bodyHtml: newBodyHtml,
          bodyText: newFormat === "text" ? newBodyHtml : "",
        })
        if (res.ok && res.template) {
          setTemplates((prev) => [...prev, res.template!])
          loadDraft(res.template)
          setShowCreateModal(false)
          setNewLabel("")
          setNewDescription("")
          setNewSubject("")
          setNewBodyHtml("")
          toast.success(`Custom email purpose "${res.template.label}" created!`)
        } else {
          toast.error(res.error || "Failed to create email purpose")
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to create email purpose")
      }
    })
  }

  function executeDeleteCustom() {
    if (!pendingDeleteId) return
    const targetId = pendingDeleteId
    const targetTpl = templates.find((t) => t.id === targetId)
    setPendingDeleteId(null)

    startTransition(async () => {
      try {
        const res = await deleteEmailTemplateAction(targetId, targetTpl?.purposeKey)
        if (res.ok) {
          const remaining = templates.filter((t) => t.id !== targetId)
          setTemplates(remaining)
          if (remaining[0]) {
            loadDraft(remaining[0])
          }
          toast.success("Custom email purpose deleted.")
        } else {
          toast.error(res.error || "Could not delete template")
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not delete template")
      }
    })
  }

  function handleSendTest() {
    if (!activeTemplate) return
    startTransition(async () => {
      try {
        const res = await sendTestEmailTemplateAction(
          activeTemplate.id,
          testEmailTo,
          activeTemplate.purposeKey
        )
        if (res.ok) {
          toast.success(`Test email sent to ${testEmailTo}${res.provider ? ` via ${res.provider}` : ""}!`)
        } else {
          toast.error(res.error || "Failed to send test email")
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to send test email")
      }
    })
  }

  // Construct sandboxed HTML preview document matching RushX Organization email shell
  const previewDoc = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:24px;background:#040814;color:#e2e8f0;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#090f22;border:1px solid #1a284d;border-radius:16px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,0.75);">
    <div style="height:4px;background:linear-gradient(90deg,#2563eb 0%,#0ea5e9 54%,#38bdf8 100%);"></div>
    <div style="padding:18px 26px 14px 26px;background:linear-gradient(180deg,#0e1938 0%,#090f22 100%);border-bottom:1px solid #182548;display:flex;align-items:center;justify-content:space-between;gap:12px;">
      <div style="display:flex;align-items:center;gap:11px;">
        <img src="/images/brand/rushx-email-pfp.png" alt="RushX Organization" style="width:40px;height:40px;border-radius:50%;border:2px solid #2563eb;background:#060c1f;object-fit:cover;display:block;flex-shrink:0;" />
        <div>
          <img src="/images/brand/rushx-full-white.png" alt="RushX Organization" style="height:22px;width:auto;object-fit:contain;display:block;" />
          <div style="font-size:10px;font-weight:600;color:#7dd3fc;margin-top:2px;">Official Sender · rushxorg.online</div>
        </div>
      </div>
      <span style="font-size:10px;font-weight:700;letter-spacing:1.3px;color:#38bdf8;text-transform:uppercase;">${escapePreviewHtml(label)}</span>
    </div>
    <div style="padding:28px;">
      <h2 style="margin:0 0 14px 0;color:#ffffff;font-size:19px;font-weight:800;letter-spacing:-0.3px;">${escapePreviewHtml(subject)}</h2>
      ${
        format === "text"
          ? `<pre style="white-space:pre-wrap;font-family:inherit;color:#cbd5e1;font-size:14px;line-height:1.65;">${escapePreviewHtml(bodyText)}</pre>`
          : `<div style="color:#cbd5e1;font-size:14px;line-height:1.7;">${bodyHtml}</div>`
      }
      ${mediaItems
        .map((m) =>
          m.type === "image"
            ? `<div style="margin-top:16px;"><img src="${escapePreviewHtml(resolveImageUrl(m.url))}" alt="" style="max-width:100%;border-radius:10px;border:1px solid #1a284d;" /></div>`
            : `<div style="margin-top:14px;padding:10px 14px;background:#0e1938;border:1px solid #1a284d;border-radius:10px;font-size:13px;color:#38bdf8;">[${escapePreviewHtml(m.type.toUpperCase())}] ${escapePreviewHtml(m.name || m.url)}</div>`
        )
        .join("")}
      ${
        ctaText && ctaUrl
          ? `<div style="margin-top:26px;text-align:center;"><span style="display:inline-block;background:linear-gradient(135deg,#2563eb 0%,#0ea5e9 100%);color:#fff;font-weight:700;font-size:13px;padding:12px 28px;border-radius:10px;letter-spacing:0.4px;">${escapePreviewHtml(ctaText)}</span></div>`
          : ""
      }
    </div>
    <div style="padding:14px 28px;border-top:1px solid #182548;text-align:center;font-size:11px;color:#64748b;">
      RushX Organization · Competitive Free Fire Esports Platform
    </div>
  </div>
</body>
</html>`

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Sidebar: Email Purpose List */}
        <div className="lg:col-span-4 flex flex-col gap-3">
          <div className="dc-surface rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">
                    Email Purposes ({templates.length})
                  </h2>
                </div>
                <p className="text-[11px] text-muted-foreground tabular-nums">
                  {templates.filter((t) => t.isEnabled).length} active ·{" "}
                  {templates.filter((t) => !t.isEnabled).length} paused
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => setShowCreateModal(true)}
                className="h-8 gap-1.5 text-xs whitespace-nowrap"
              >
                <Plus className="size-3.5" />
                Add Custom
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              {templates.map((tpl) => {
                const selected = activeTemplate?.id === tpl.id
                return (
                  <div
                    key={tpl.id}
                    className={cn(
                      "rushx-box-splash rounded-xl border p-3 transition-all flex items-center justify-between gap-3",
                      selected
                        ? "border-violet-400/50 bg-violet-500/14 shadow-[0_10px_28px_-14px_rgba(124,58,237,0.7)]"
                        : "dc-metric-cell hover:border-violet-400/30"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectTemplate(tpl)}
                      className="min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <Mail
                          className={cn(
                            "size-4 shrink-0",
                            selected ? "text-violet-300" : "text-slate-400"
                          )}
                        />
                        <span className="font-display text-sm font-bold uppercase tracking-wide truncate text-foreground">
                          {tpl.label}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-400 truncate">
                        {tpl.purposeKey} · {tpl.isCore ? "Core" : "Custom"} · {tpl.format.toUpperCase()}
                        {(tpl.purposeKey === "welcome" || tpl.purposeKey === "register") ? " · Default OFF" : ""}
                      </p>
                    </button>

                    <button
                      type="button"
                      disabled={togglingKey === (tpl.purposeKey || tpl.id)}
                      onClick={() => handleMasterToggle(tpl, !tpl.isEnabled)}
                      aria-label={`Toggle ${tpl.label} emails`}
                      aria-pressed={tpl.isEnabled}
                      className={cn(
                        "shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-all flex items-center gap-1 whitespace-nowrap cursor-pointer disabled:opacity-60",
                        tpl.isEnabled
                          ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                          : "border-white/10 bg-white/[0.04] text-slate-400 hover:text-white hover:border-white/20"
                      )}
                    >
                      {togglingKey === (tpl.purposeKey || tpl.id) ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Power className="size-3" />
                      )}
                      {tpl.isEnabled ? "ON" : "OFF"}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right Panel: Interactive Template Configuration Card */}
        <div className="lg:col-span-8">
          {activeTemplate ? (
            <form
              onSubmit={handleSaveTemplate}
              className="dc-surface rounded-2xl p-5 sm:p-6 flex flex-col gap-5"
            >
              {/* Header */}
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.08] pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
                      {activeTemplate.label} Template
                    </h2>
                    <span className="text-xs font-mono text-muted-foreground">
                      ({activeTemplate.purposeKey})
                    </span>
                    <span
                      className={cn(
                        "text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1",
                        isEnabled ? "text-emerald-400" : "text-amber-400"
                      )}
                    >
                      {isEnabled ? (
                        <>
                          <CheckCircle2 className="size-3.5" /> Active Trigger
                        </>
                      ) : (
                        <>
                          <AlertCircle className="size-3.5" /> Paused (OFF)
                        </>
                      )}
                    </span>
                  </div>
                  {activeTemplate.description && (
                    <p className="text-xs text-muted-foreground">{activeTemplate.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    type="button"
                    size="sm"
                    disabled={togglingKey === (activeTemplate.purposeKey || activeTemplate.id)}
                    variant={isEnabled ? "outline" : "default"}
                    onClick={() => handleMasterToggle(activeTemplate, !isEnabled)}
                    className={cn(
                      "gap-1.5 text-xs whitespace-nowrap",
                      isEnabled
                        ? "border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/12"
                        : ""
                    )}
                  >
                    {togglingKey === (activeTemplate.purposeKey || activeTemplate.id) ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Power className="size-3.5" />
                    )}
                    Master Toggle: {isEnabled ? "ON" : "OFF"}
                  </Button>

                  {!activeTemplate.isCore && (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={isPending}
                      onClick={() => setPendingDeleteId(activeTemplate.id)}
                      className="gap-1.5 text-xs whitespace-nowrap"
                    >
                      <Trash2 className="size-3.5" />
                      Delete
                    </Button>
                  )}

                  <Button
                    type="submit"
                    size="sm"
                    disabled={isPending || uploadingMedia}
                    className="gap-1.5 text-xs font-bold uppercase whitespace-nowrap glow-primary"
                  >
                    {isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Save className="size-3.5" />
                    )}
                    Save Template
                  </Button>
                </div>
              </div>

              {/* Metadata Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tpl-label" className="text-xs font-semibold">
                    Purpose Display Name *
                  </Label>
                  <Input
                    id="tpl-label"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    required
                    className="h-9 text-sm"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold">Email Delivery Format</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormat("html")}
                      className={cn(
                        "h-9 rounded-lg border text-xs font-bold uppercase transition-colors flex items-center justify-center gap-1.5 cursor-pointer",
                        format === "html"
                          ? "border-violet-400/50 bg-violet-500/16 text-violet-200"
                          : "dc-metric-cell text-slate-400 hover:text-white"
                      )}
                    >
                      <Code2 className="size-3.5" /> HTML + Text
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormat("text")}
                      className={cn(
                        "h-9 rounded-lg border text-xs font-bold uppercase transition-colors flex items-center justify-center gap-1.5 cursor-pointer",
                        format === "text"
                          ? "border-violet-400/50 bg-violet-500/16 text-violet-200"
                          : "dc-metric-cell text-slate-400 hover:text-white"
                      )}
                    >
                      Plain Text
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tpl-subject" className="text-xs font-semibold">
                    Subject Line *
                  </Label>
                  <Input
                    id="tpl-subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                    placeholder="Email subject line..."
                    className="h-9 text-sm"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tpl-preheader" className="text-xs font-semibold">
                    Preheader / Inbox Summary
                  </Label>
                  <Input
                    id="tpl-preheader"
                    value={preheader}
                    onChange={(e) => setPreheader(e.target.value)}
                    placeholder="Short preview text shown in inbox..."
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              {/* Variables Helper */}
              {activeTemplate.variablesHint.length > 0 && (
                <div className="dc-metric-cell rounded-xl p-3 flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <Sparkles className="size-3.5 text-violet-300" />
                    Available Dynamic Variables (Click to insert)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {activeTemplate.variablesHint.map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => handleInsertVariable(v)}
                        className="rounded-md border border-violet-400/30 bg-violet-500/12 px-2 py-1 text-[11px] font-mono text-violet-200 hover:bg-violet-500/22 transition-colors cursor-pointer"
                      >
                        {`{{${v}}}`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Editor / Live Preview Tabs */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs font-semibold">
                    {format === "html" ? "HTML Body Content" : "Plain Text Message"} &amp; Live Preview
                  </Label>
                  <div className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-[#0a0f22] p-1">
                    <button
                      type="button"
                      onClick={() => setActiveTab("editor")}
                      className={cn(
                        "rounded-md px-3 py-1 text-xs font-bold uppercase transition-colors flex items-center gap-1.5 cursor-pointer",
                        activeTab === "editor"
                          ? "bg-violet-600 text-white"
                          : "text-slate-400 hover:text-white"
                      )}
                    >
                      <Code2 className="size-3.5" /> Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("preview")}
                      className={cn(
                        "rounded-md px-3 py-1 text-xs font-bold uppercase transition-colors flex items-center gap-1.5 cursor-pointer",
                        activeTab === "preview"
                          ? "bg-violet-600 text-white"
                          : "text-slate-400 hover:text-white"
                      )}
                    >
                      <Eye className="size-3.5" /> Preview
                    </button>
                  </div>
                </div>

                {activeTab === "editor" ? (
                  <div className="flex flex-col gap-4">
                    {format === "html" && (
                      <div className="flex flex-col gap-1.5">
                        <Label htmlFor="tpl-body-html" className="text-[11px] text-muted-foreground">
                          HTML Template Body (rendered inside RushX Organization dark email shell)
                        </Label>
                        <Textarea
                          id="tpl-body-html"
                          value={bodyHtml}
                          onChange={(e) => setBodyHtml(e.target.value)}
                          rows={10}
                          className="font-mono text-xs leading-relaxed"
                          placeholder="<p>Hello {{recipientName}},</p>"
                        />
                      </div>
                    )}

                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="tpl-body-text" className="text-[11px] text-muted-foreground">
                        {format === "text"
                          ? "Plain Text Email Body *"
                          : "Plain Text Fallback (for text-only email clients)"}
                      </Label>
                      <Textarea
                        id="tpl-body-text"
                        value={bodyText}
                        onChange={(e) => setBodyText(e.target.value)}
                        rows={format === "text" ? 10 : 4}
                        className="font-mono text-xs leading-relaxed"
                        placeholder="Plain text version of this email..."
                      />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border overflow-hidden bg-black">
                    <iframe
                      title="Email Template Preview"
                      srcDoc={previewDoc}
                      sandbox=""
                      className="w-full h-[420px] border-0"
                    />
                  </div>
                )}
              </div>

              {/* CTA Button Configuration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tpl-cta-text" className="text-xs font-semibold">
                    Action Button Label (Optional)
                  </Label>
                  <Input
                    id="tpl-cta-text"
                    value={ctaText}
                    onChange={(e) => setCtaText(e.target.value)}
                    placeholder="e.g. Open Player Dashboard"
                    className="h-9 text-sm"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="tpl-cta-url" className="text-xs font-semibold">
                    Action Button URL (Supports {`{{variables}}`})
                  </Label>
                  <Input
                    id="tpl-cta-url"
                    value={ctaUrl}
                    onChange={(e) => setCtaUrl(e.target.value)}
                    placeholder="e.g. {{dashboardUrl}} or https://..."
                    className="h-9 text-sm font-mono"
                  />
                </div>
              </div>

              {/* Embedded Media & Video/Image Attachments */}
              <div className="rounded-xl border border-border/70 bg-secondary/20 p-4 flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-sm font-bold uppercase tracking-wider text-foreground">
                      Template Media &amp; Attachments ({mediaItems.length})
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Images render inline inside the email; videos &amp; links appear as styled media cards.
                    </p>
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleMediaUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={uploadingMedia}
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-1.5 text-xs whitespace-nowrap"
                  >
                    {uploadingMedia ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin text-primary" />
                        Uploading {uploadProgress}%
                      </>
                    ) : (
                      <>
                        <UploadCloud className="size-3.5 text-primary" />
                        Upload Image / Video
                      </>
                    )}
                  </Button>
                </div>

                {/* Manual URL Attachment */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <select
                    value={manualMediaType}
                    onChange={(e) =>
                      setManualMediaType(e.target.value as "image" | "video" | "link")
                    }
                    className="sm:col-span-2 h-9 rounded-lg border border-border bg-secondary px-2 text-xs text-foreground"
                  >
                    <option value="image">Image</option>
                    <option value="video">Video</option>
                    <option value="link">Link</option>
                  </select>
                  <Input
                    value={manualMediaName}
                    onChange={(e) => setManualMediaName(e.target.value)}
                    placeholder="Caption / Label (optional)"
                    className="sm:col-span-3 h-9 text-xs"
                  />
                  <Input
                    value={manualMediaUrl}
                    onChange={(e) => setManualMediaUrl(e.target.value)}
                    placeholder="https://... or /uploads/..."
                    className="sm:col-span-5 h-9 text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={handleAddManualMedia}
                    className="sm:col-span-2 h-9 text-xs whitespace-nowrap"
                  >
                    Add Media
                  </Button>
                </div>

                {mediaItems.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {mediaItems.map((item, idx) => (
                      <div
                        key={item.id || `${item.url}-${idx}`}
                        className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-black/30 p-2.5"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {item.type === "image" ? (
                            <img
                              src={resolveImageUrl(item.url)}
                              alt={item.name || "Media"}
                              className="size-11 rounded-lg object-cover border border-border/40 shrink-0"
                            />
                          ) : item.type === "video" ? (
                            <div className="size-11 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
                              <Video className="size-5" />
                            </div>
                          ) : (
                            <div className="size-11 rounded-lg bg-secondary text-foreground flex items-center justify-center shrink-0">
                              <Link2 className="size-5" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-semibold truncate text-foreground flex items-center gap-1">
                              {item.type === "image" && <ImageIcon className="size-3 text-primary" />}
                              {item.name || `${item.type.toUpperCase()} attachment`}
                            </p>
                            <p className="text-[11px] text-muted-foreground truncate font-mono">
                              {item.url}
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setMediaItems((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                          title="Remove media"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Test Dispatch Bar */}
              <div className="rounded-xl border border-border/70 bg-secondary/30 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Send Test Dispatch
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Save your edits first, then trigger a live test email with sample variables.
                  </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Input
                    type="email"
                    value={testEmailTo}
                    onChange={(e) => setTestEmailTo(e.target.value)}
                    placeholder="admin@rushxorg.online"
                    className="h-9 text-xs sm:w-56"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={handleSendTest}
                    className="h-9 gap-1.5 text-xs whitespace-nowrap"
                  >
                    <Send className="size-3.5 text-primary" />
                    Send Test
                  </Button>
                </div>
              </div>
            </form>
          ) : (
            <div className="glass rounded-2xl p-12 text-center text-sm text-muted-foreground">
              No email templates configured yet.
            </div>
          )}
        </div>
      </div>

      {/* Add Custom Purpose Modal */}
      {showCreateModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <form
            onSubmit={handleCreateCustom}
            onClick={(e) => e.stopPropagation()}
            className="glass-strong w-full max-w-lg rounded-2xl border border-border p-6 flex flex-col gap-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border/50 pb-3">
              <h3 className="font-display text-lg font-bold uppercase tracking-wide">
                Add Custom Email Purpose
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="custom-label" className="text-xs font-semibold">
                Purpose Title *
              </Label>
              <Input
                id="custom-label"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                required
                placeholder="e.g. Prize Payout Sent or Scrim Reminder"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="custom-desc" className="text-xs font-semibold">
                Description
              </Label>
              <Input
                id="custom-desc"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="When should this email be dispatched?"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="custom-format" className="text-xs font-semibold">
                  Format
                </Label>
                <select
                  id="custom-format"
                  value={newFormat}
                  onChange={(e) => setNewFormat(e.target.value as "html" | "text")}
                  className="h-9 rounded-lg border border-border bg-secondary px-3 text-xs text-foreground"
                >
                  <option value="html">HTML Rich</option>
                  <option value="text">Plain Text</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="custom-subject" className="text-xs font-semibold">
                  Subject Line *
                </Label>
                <Input
                  id="custom-subject"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  required
                  placeholder="Subject line..."
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="custom-body" className="text-xs font-semibold">
                Initial Message Content
              </Label>
              <Textarea
                id="custom-body"
                value={newBodyHtml}
                onChange={(e) => setNewBodyHtml(e.target.value)}
                rows={4}
                placeholder="Hello {{recipientName}}, ..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} className="gap-1.5">
                {isPending && <Loader2 className="size-3.5 animate-spin" />}
                Create Purpose
              </Button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => !open && setPendingDeleteId(null)}
        title="Delete Custom Email Purpose?"
        description="This permanently removes the custom email template configuration."
        confirmLabel="Delete"
        variant="destructive"
        loading={isPending}
        onConfirm={executeDeleteCustom}
      />
    </div>
  )
}
