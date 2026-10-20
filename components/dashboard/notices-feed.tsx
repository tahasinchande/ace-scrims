"use client"

import { useState, useMemo } from "react"
import type { Notice } from "@/lib/db/schema"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  Megaphone,
  Pin,
  Clock,
  Search,
  Sparkles,
  Play,
  Maximize2,
  Calendar,
  AlertCircle,
  FileText,
  Shield,
  Layers,
} from "lucide-react"

function getCategoryBadge(category: string) {
  switch (category.toLowerCase()) {
    case "urgent":
      return <Badge className="bg-destructive/20 text-destructive border-destructive/40 font-bold uppercase text-[10px]">Urgent</Badge>
    case "tournament":
      return <Badge className="bg-primary/20 text-primary border-primary/40 font-bold uppercase text-[10px]">Tournament</Badge>
    case "rules":
      return <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 font-bold uppercase text-[10px]">Rules</Badge>
    case "announcement":
      return <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold uppercase text-[10px]">Announcement</Badge>
    case "prize pool & payouts":
      return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-bold uppercase text-[10px]">Prize Pool</Badge>
    default:
      return <Badge variant="secondary" className="text-[10px] uppercase font-medium">{category}</Badge>
  }
}

function timeAgo(date: Date | string | null): string {
  if (!date) return ""
  const d = new Date(date)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function NoticesFeed({ initialNotices }: { initialNotices: Notice[] }) {
  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [activeMediaPreview, setActiveMediaPreview] = useState<{ url: string; type: string; title: string } | null>(null)

  const categories = useMemo(() => {
    const set = new Set<string>()
    initialNotices.forEach((n) => {
      if (n.category) set.add(n.category)
    })
    return ["all", ...Array.from(set)]
  }, [initialNotices])

  const filteredNotices = useMemo(() => {
    return initialNotices.filter((n) => {
      const matchCat = selectedCategory === "all" || n.category?.toLowerCase() === selectedCategory.toLowerCase()
      const q = search.toLowerCase().trim()
      const matchSearch =
        !q ||
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        (n.category && n.category.toLowerCase().includes(q))
      return matchCat && matchSearch
    })
  }, [initialNotices, selectedCategory, search])

  // Count pinned
  const pinnedCount = initialNotices.filter((n) => n.isPinned).length

  return (
    <div className="space-y-6">
      {/* ── Search & Filter Controls ── */}
      <div className="glass flex flex-col gap-4 rounded-2xl p-4 sm:p-5 border border-border/70 shadow-lg">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notices, rules, schedules, updates..."
              className="pl-9 bg-background/60"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0 self-end sm:self-center">
            <Layers className="size-3.5 text-primary" />
            <span>
              Showing {filteredNotices.length} of {initialNotices.length} notices
            </span>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-xl px-3 py-1.5 text-xs font-semibold capitalize transition-all shrink-0 ${
                selectedCategory === cat
                  ? "bg-primary text-primary-foreground shadow-xs shadow-primary/20"
                  : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {cat === "all" ? "All Notices" : cat}
            </button>
          ))}
        </div>
      </div>

      {/* ── Feed List ── */}
      {filteredNotices.length === 0 ? (
        <div className="glass flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 p-12 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-3">
            <FileText className="size-7" />
          </div>
          <h3 className="font-display text-lg font-bold text-foreground">No Notices Found</h3>
          <p className="max-w-md text-xs text-muted-foreground mt-1">
            {search || selectedCategory !== "all"
              ? "No notices match your current search or category filter. Try clearing filters."
              : "There are no official announcements published at the moment. Please check back later!"}
          </p>
          {(search || selectedCategory !== "all") && (
            <button
              type="button"
              onClick={() => {
                setSearch("")
                setSelectedCategory("all")
              }}
              className="mt-4 text-xs font-bold text-primary hover:underline"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5">
          {filteredNotices.map((notice) => {
            const hasMedia = Boolean(notice.mediaUrl && notice.mediaType !== "none")
            const isVideo = notice.mediaType === "video" || notice.mediaUrl?.match(/\.(mp4|webm|mov)$/i)

            return (
              <article
                key={notice.id}
                className={`glass flex flex-col rounded-2xl border transition-all overflow-hidden ${
                  notice.isPinned
                    ? "border-primary/60 bg-gradient-to-b from-primary/[0.06] to-transparent shadow-lg shadow-primary/5 ring-1 ring-primary/20"
                    : notice.priority === "urgent"
                    ? "border-destructive/50 bg-destructive/[0.02]"
                    : "border-border/80 hover:border-primary/30"
                }`}
              >
                {/* Header Banner for Pinned/Urgent */}
                {notice.isPinned && (
                  <div className="flex items-center gap-2 border-b border-primary/20 bg-primary/15 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-primary">
                    <Pin className="size-3.5 fill-primary text-primary" />
                    <span>Pinned Announcement</span>
                  </div>
                )}

                <div className="p-5 sm:p-6 space-y-4">
                  {/* Category, Priority, and Timestamp */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {getCategoryBadge(notice.category)}
                      {notice.priority === "urgent" && (
                        <Badge className="bg-destructive/20 text-destructive border-destructive/40 font-bold uppercase text-[10px] gap-1">
                          <AlertCircle className="size-3" /> Urgent Alert
                        </Badge>
                      )}
                      {notice.priority === "important" && (
                        <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold uppercase text-[10px] gap-1">
                          <Sparkles className="size-3" /> Important
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                      <Clock className="size-3 text-primary/70" />
                      <span>{timeAgo(notice.createdAt)}</span>
                      <span className="text-[10px] text-muted-foreground/60 hidden sm:inline">
                        ({new Date(notice.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })})
                      </span>
                    </div>
                  </div>

                  {/* Title */}
                  <h2 className="font-display text-lg sm:text-xl font-bold text-foreground leading-snug">
                    {notice.title}
                  </h2>

                  {/* Rich Text Description */}
                  <div className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line break-words">
                    {notice.content}
                  </div>

                  {/* Attached Media Display */}
                  {hasMedia && notice.mediaUrl && (
                    <div className="mt-4 overflow-hidden rounded-xl border border-border/80 bg-background/50">
                      {isVideo ? (
                        <div className="relative aspect-video w-full bg-black">
                          <video
                            src={notice.mediaUrl}
                            controls
                            className="size-full object-contain"
                            poster={undefined}
                          />
                        </div>
                      ) : (
                        <div
                          className="group relative cursor-pointer overflow-hidden max-h-[460px] flex items-center justify-center bg-secondary/20"
                          onClick={() =>
                            setActiveMediaPreview({
                              url: notice.mediaUrl!,
                              type: "image",
                              title: notice.title,
                            })
                          }
                        >
                          <img
                            src={notice.mediaUrl}
                            alt={notice.title}
                            className="max-h-[460px] w-auto max-w-full rounded-lg object-contain transition-transform duration-300 group-hover:scale-[1.01]"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                            <span className="flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-1 text-xs font-semibold text-foreground backdrop-blur-xs">
                              <Maximize2 className="size-3.5" /> Click to view full image
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Footer Author Bar */}
                  <div className="flex items-center justify-between border-t border-border/50 pt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5 font-medium text-foreground/80">
                      <Shield className="size-3.5 text-primary" />
                      {notice.authorName || "Ace Scrims Administration"}
                    </span>
                    <span className="text-[11px] text-muted-foreground/75 font-mono">
                      Official Broadcast
                    </span>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {/* ── Lightbox / Fullscreen Image Preview Dialog ── */}
      {activeMediaPreview && (
        <Dialog open={true} onOpenChange={(open) => !open && setActiveMediaPreview(null)}>
          <DialogContent className="max-w-4xl p-2 sm:p-4 bg-background/95 backdrop-blur-xl border-border">
            <DialogHeader className="px-2 pb-2">
              <DialogTitle className="font-display text-sm font-bold truncate">
                {activeMediaPreview.title}
              </DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center max-h-[80vh] overflow-hidden rounded-xl bg-black/50 p-1">
              <img
                src={activeMediaPreview.url}
                alt={activeMediaPreview.title}
                className="max-h-[75vh] w-auto max-w-full object-contain"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
