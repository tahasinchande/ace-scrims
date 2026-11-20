"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Handshake,
  Plus,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  Upload,
  Loader2,
  Eye,
  EyeOff,
  ExternalLink,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PartnershipTicker } from "@/components/site/partnership-ticker"
import { uploadMediaFile } from "@/lib/client-upload"
import {
  createPartnershipItemAction,
  updatePartnershipItemAction,
  togglePartnershipItemAction,
  reorderPartnershipItemAction,
  deletePartnershipItemAction,
} from "@/app/actions/partnerships"
import type { PartnershipItem } from "@/lib/db/schema"

const EMPTY_FORM = {
  partnerName: "",
  headline: "",
  tagline: "",
  badgeText: "OFFICIAL PARTNER",
  logoUrl: "",
  linkUrl: "",
  isActive: true,
}

export function AdminPartnershipsManager({ initialItems }: { initialItems: PartnershipItem[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [uploading, setUploading] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const activePreviewItems = initialItems.filter((item) => item.isActive)

  function startEdit(item: PartnershipItem) {
    setEditingId(item.id)
    setForm({
      partnerName: item.partnerName,
      headline: item.headline,
      tagline: item.tagline ?? "",
      badgeText: item.badgeText ?? "",
      logoUrl: item.logoUrl ?? "",
      linkUrl: item.linkUrl ?? "",
      isActive: item.isActive,
    })
  }

  function resetForm() {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const res = await uploadMediaFile(file, "banners")
      setForm((prev) => ({ ...prev, logoUrl: res.url }))
      toast.success("Partner logo uploaded!")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload logo.")
    } finally {
      setUploading(false)
      e.target.value = ""
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = editingId
        ? await updatePartnershipItemAction(editingId, form)
        : await createPartnershipItemAction(form)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(editingId ? "Partnership updated!" : "Partnership added to ticker!")
      resetForm()
      router.refresh()
    })
  }

  function handleToggle(item: PartnershipItem) {
    startTransition(async () => {
      const res = await togglePartnershipItemAction(item.id, !item.isActive)
      if (!res.ok) {
        toast.error("Could not update status.")
        return
      }
      toast.success(item.isActive ? "Hidden from ticker" : "Visible on ticker")
      router.refresh()
    })
  }

  function handleReorder(id: string, direction: "up" | "down") {
    startTransition(async () => {
      const res = await reorderPartnershipItemAction(id, direction)
      if (!res.ok) {
        toast.error("Could not reorder item.")
        return
      }
      router.refresh()
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const res = await deletePartnershipItemAction(id)
      if (!res.ok) {
        toast.error("Could not delete item.")
        return
      }
      if (editingId === id) resetForm()
      toast.success("Partnership item deleted.")
      router.refresh()
    })
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">
          Partnerships &amp; Collaboration Ticker
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage sponsors, brand collaborations, and transparent partner logos displayed in the
          horizontal scrolling announcement bar across Ace Scrims.
        </p>
      </div>

      {/* Live Preview */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Live Public Ticker Preview</CardTitle>
          <CardDescription>
            {activePreviewItems.length > 0
              ? `Showing ${activePreviewItems.length} active item${activePreviewItems.length > 1 ? "s" : ""} (hover to pause scrolling).`
              : "No active partnership items yet. The public ticker stays hidden until you add an active item."}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-4">
          {activePreviewItems.length > 0 ? (
            <PartnershipTicker items={activePreviewItems} />
          ) : (
            <div className="mx-6 rounded-xl border border-dashed border-border/70 py-6 text-center text-xs text-muted-foreground">
              Add an active partnership below to preview the marquee bar.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Form */}
      <Card className="border-primary/25">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Handshake className="size-5 text-primary" />
                {editingId ? "Edit Partnership Item" : "Add Partnership / Sponsor Item"}
              </CardTitle>
              <CardDescription>
                Supports transparent PNG/WebP partner logos, badges, headlines, and click-through links.
              </CardDescription>
            </div>
            {editingId && (
              <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                <X className="mr-1 size-4" /> Cancel Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="partnerName">Partner / Brand Name *</Label>
                <Input
                  id="partnerName"
                  value={form.partnerName}
                  onChange={(e) => setForm((f) => ({ ...f, partnerName: e.target.value }))}
                  placeholder="e.g. Hydra Esports"
                  required
                  maxLength={80}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="badgeText">Badge Label (Optional)</Label>
                <Input
                  id="badgeText"
                  value={form.badgeText}
                  onChange={(e) => setForm((f) => ({ ...f, badgeText: e.target.value }))}
                  placeholder="OFFICIAL PARTNER / SPONSOR"
                  maxLength={32}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="linkUrl">Destination URL (Optional)</Label>
                <Input
                  id="linkUrl"
                  value={form.linkUrl}
                  onChange={(e) => setForm((f) => ({ ...f, linkUrl: e.target.value }))}
                  placeholder="https://... or /creators"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="headline">Announcement Headline *</Label>
                <Input
                  id="headline"
                  value={form.headline}
                  onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))}
                  placeholder="Official Energy Partner for Friday Special Blast"
                  required
                  maxLength={160}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tagline">Short Tagline / Offer (Optional)</Label>
                <Input
                  id="tagline"
                  value={form.tagline}
                  onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
                  placeholder="Use code ACE10"
                  maxLength={120}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_auto] items-end">
              <div className="space-y-2">
                <Label htmlFor="logoUrl">Transparent Partner Logo URL (PNG / WebP)</Label>
                <Input
                  id="logoUrl"
                  value={form.logoUrl}
                  onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
                  placeholder="https://... or upload transparent logo"
                />
              </div>
              <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-secondary/40 px-4 h-10 text-xs font-semibold hover:bg-secondary/70 transition">
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                <span>{uploading ? "Uploading..." : "Upload Logo"}</span>
                <input
                  type="file"
                  accept="image/png,image/webp,image/jpeg,image/svg+xml"
                  onChange={handleLogoUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            </div>

            {form.logoUrl && (
              <div className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/50 p-2.5 w-fit">
                <img
                  src={form.logoUrl}
                  alt="Logo preview"
                  className="h-7 w-auto max-w-[120px] object-contain"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setForm((f) => ({ ...f, logoUrl: "" }))}
                >
                  Remove
                </Button>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="size-4 accent-primary"
                />
                Show immediately in public scrolling ticker
              </label>
              <Button type="submit" disabled={pending || uploading} className="glow-primary font-semibold">
                {pending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : editingId ? (
                  <Pencil className="mr-2 size-4" />
                ) : (
                  <Plus className="mr-2 size-4" />
                )}
                {editingId ? "Update Partnership" : "Add Partnership"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Existing Items Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configured Partnerships ({initialItems.length})</CardTitle>
          <CardDescription>
            Reorder items with up/down arrows, toggle visibility, or edit details anytime.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {initialItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 py-10 text-center text-sm text-muted-foreground">
              No partnerships added yet.
            </div>
          ) : (
            initialItems.map((item, idx) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border/80 bg-secondary/15 p-3.5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {item.logoUrl ? (
                    <img
                      src={item.logoUrl}
                      alt={item.partnerName}
                      className="h-8 w-12 shrink-0 rounded bg-black/40 p-1 object-contain"
                    />
                  ) : (
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Handshake className="size-4" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-heading text-base font-bold">{item.partnerName}</span>
                      {item.badgeText && (
                        <Badge variant="outline" className="text-[10px]">
                          {item.badgeText}
                        </Badge>
                      )}
                      <Badge variant={item.isActive ? "default" : "secondary"}>
                        {item.isActive ? "Active" : "Hidden"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.headline}
                      {item.tagline ? ` — ${item.tagline}` : ""}
                    </p>
                    {item.linkUrl && (
                      <a
                        href={item.linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-0.5"
                      >
                        {item.linkUrl} <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    disabled={pending || idx === 0}
                    onClick={() => handleReorder(item.id, "up")}
                    aria-label="Move up"
                  >
                    <ArrowUp className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    disabled={pending || idx === initialItems.length - 1}
                    onClick={() => handleReorder(item.id, "down")}
                    aria-label="Move down"
                  >
                    <ArrowDown className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    disabled={pending}
                    onClick={() => handleToggle(item)}
                    aria-label={item.isActive ? "Hide item" : "Show item"}
                  >
                    {item.isActive ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    disabled={pending}
                    onClick={() => startEdit(item)}
                    aria-label="Edit item"
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="destructive"
                    disabled={pending}
                    onClick={() => handleDelete(item.id)}
                    aria-label="Delete item"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
