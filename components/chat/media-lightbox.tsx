"use client"

import { useEffect, useState, useCallback } from "react"
import { createPortal } from "react-dom"
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  ZoomIn,
  ZoomOut,
  FileText,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"

export interface MediaLightboxItem {
  url: string
  type: "image" | "video" | "document"
  name?: string | null
  caption?: string | null
}

interface MediaLightboxProps {
  items: MediaLightboxItem[]
  initialIndex?: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MediaLightbox({
  items,
  initialIndex = 0,
  open,
  onOpenChange,
}: MediaLightboxProps) {
  const [mounted, setMounted] = useState(false)
  const [index, setIndex] = useState(initialIndex)
  const [zoomed, setZoomed] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (open) {
      const clamped = Math.max(0, Math.min(initialIndex, items.length - 1))
      setIndex(clamped)
      setZoomed(false)
    }
  }, [open, initialIndex, items.length])

  const handleClose = useCallback(() => {
    setZoomed(false)
    onOpenChange(false)
  }, [onOpenChange])

  const handlePrev = useCallback(() => {
    if (items.length <= 1) return
    setZoomed(false)
    setIndex((prev) => (prev - 1 + items.length) % items.length)
  }, [items.length])

  const handleNext = useCallback(() => {
    if (items.length <= 1) return
    setZoomed(false)
    setIndex((prev) => (prev + 1) % items.length)
  }, [items.length])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        handleClose()
      } else if (e.key === "ArrowLeft") {
        e.preventDefault()
        handlePrev()
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        handleNext()
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [open, handleClose, handlePrev, handleNext])

  if (!mounted || !open || items.length === 0) return null

  const active = items[index] ?? items[0]
  if (!active) return null

  const isVideo =
    active.type === "video" ||
    /\.(mp4|webm|mov|mkv|avi)(\?|$)/i.test(active.url) ||
    active.url.startsWith("data:video/")
  const isImage = !isVideo && active.type === "image"

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/95 backdrop-blur-md animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-label="Media preview"
      onClick={handleClose}
    >
      {/* Top Toolbar */}
      <div
        className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6 bg-gradient-to-b from-black/80 to-transparent shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-w-0 flex items-center gap-3">
          {items.length > 1 && (
            <span className="rounded-md bg-white/10 px-2.5 py-1 text-xs font-mono text-white/90">
              {index + 1} / {items.length}
            </span>
          )}
          {(active.name || active.caption) && (
            <p className="truncate text-sm font-medium text-white/90">
              {active.caption || active.name}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isImage && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setZoomed((z) => !z)}
              className="text-white/80 hover:text-white hover:bg-white/15 rounded-full"
              title={zoomed ? "Zoom out" : "Zoom in"}
              aria-label={zoomed ? "Zoom out" : "Zoom in"}
            >
              {zoomed ? <ZoomOut className="size-4" /> : <ZoomIn className="size-4" />}
            </Button>
          )}
          <a
            href={active.url}
            download={active.name || "rushx-media"}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex size-8 items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/15 transition-colors"
            title="Download"
            aria-label="Download media"
          >
            <Download className="size-4" />
          </a>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={handleClose}
            className="text-white/80 hover:text-white hover:bg-white/15 rounded-full"
            title="Close (Esc)"
            aria-label="Close media viewer"
          >
            <X className="size-5" />
          </Button>
        </div>
      </div>

      {/* Center Stage */}
      <div className="relative flex-1 flex items-center justify-center p-4 sm:p-8 overflow-hidden select-none">
        {items.length > 1 && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation()
              handlePrev()
            }}
            className="absolute left-3 sm:left-5 z-10 size-10 rounded-full bg-black/60 text-white hover:bg-black/85 border border-white/15"
            aria-label="Previous media"
          >
            <ChevronLeft className="size-6" />
          </Button>
        )}

        <div
          className="relative flex items-center justify-center max-h-full max-w-full"
          onClick={(e) => e.stopPropagation()}
        >
          {isVideo ? (
            <video
              key={active.url}
              src={active.url}
              controls
              autoPlay
              playsInline
              className="max-h-[82vh] max-w-[92vw] rounded-xl bg-black shadow-2xl outline-none"
            />
          ) : isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={active.url}
              src={active.url}
              alt={active.caption || active.name || "Shared media"}
              onClick={() => setZoomed((z) => !z)}
              className={`max-h-[84vh] max-w-[92vw] rounded-xl object-contain shadow-2xl transition-transform duration-200 ${
                zoomed ? "scale-150 cursor-zoom-out" : "scale-100 cursor-zoom-in"
              }`}
            />
          ) : (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/15 bg-zinc-900/90 p-8 text-center text-white max-w-md">
              <FileText className="size-12 text-primary" />
              <p className="text-sm font-semibold break-all">{active.name || "Attached Document"}</p>
              <a
                href={active.url}
                download={active.name || "document"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold uppercase text-primary-foreground hover:opacity-90"
              >
                <ExternalLink className="size-3.5" />
                Open / Download File
              </a>
            </div>
          )}
        </div>

        {items.length > 1 && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation()
              handleNext()
            }}
            className="absolute right-3 sm:right-5 z-10 size-10 rounded-full bg-black/60 text-white hover:bg-black/85 border border-white/15"
            aria-label="Next media"
          >
            <ChevronRight className="size-6" />
          </Button>
        )}
      </div>

      {/* Bottom Thumbnail Strip for multi-media threads */}
      {items.length > 1 && (
        <div
          className="flex items-center justify-center gap-2 px-4 py-3 overflow-x-auto bg-gradient-to-t from-black/80 to-transparent shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item, idx) => {
            const thumbIsVideo =
              item.type === "video" || /\.(mp4|webm|mov|mkv|avi)(\?|$)/i.test(item.url)
            const isCurrent = idx === index
            return (
              <button
                key={`${item.url}-${idx}`}
                type="button"
                onClick={() => {
                  setZoomed(false)
                  setIndex(idx)
                }}
                className={`relative size-12 shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                  isCurrent
                    ? "border-primary scale-105 opacity-100"
                    : "border-white/15 opacity-55 hover:opacity-90"
                }`}
                aria-label={`View item ${idx + 1}`}
              >
                {thumbIsVideo ? (
                  <video src={item.url} muted className="h-full w-full object-cover" />
                ) : item.type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-zinc-800">
                    <FileText className="size-4 text-white/80" />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>,
    document.body
  )
}
