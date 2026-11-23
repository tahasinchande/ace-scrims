"use client"

import { useRef, useState } from "react"
import { Reply, SmilePlus, X } from "lucide-react"
import {
  CHAT_REACTION_EMOJIS,
  getReplySnippet,
  type ChatReactionEmoji,
  type ChatReactionsMap,
  type ChatReplyPreview,
} from "@/lib/chat-types"
import { cn } from "@/lib/utils"

const SWIPE_MAX_PX = 58
const SWIPE_TRIGGER_PX = 40

export function SwipeableReplyRow({
  messageId,
  alignRight,
  highlighted,
  onTriggerReply,
  children,
}: {
  messageId: string
  alignRight: boolean
  highlighted?: boolean
  onTriggerReply: () => void
  children: React.ReactNode
}) {
  const [offsetX, setOffsetX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startRef = useRef<{ x: number; y: number; active: boolean; locked: "horizontal" | "vertical" | null }>({
    x: 0,
    y: 0,
    active: false,
    locked: null,
  })

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    // Only primary mouse button or touch/pen; skip clicks on buttons/links/inputs
    if (e.pointerType === "mouse" && e.button !== 0) return
    const target = e.target as HTMLElement | null
    if (target?.closest("button, a, input, textarea, [data-no-swipe]")) return

    startRef.current = {
      x: e.clientX,
      y: e.clientY,
      active: true,
      locked: null,
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const s = startRef.current
    if (!s.active) return

    const dx = e.clientX - s.x
    const dy = e.clientY - s.y

    if (!s.locked) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
        s.locked = "vertical"
        s.active = false
        return
      }
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
        s.locked = "horizontal"
        setDragging(true)
      } else {
        return
      }
    }

    if (s.locked !== "horizontal") return

    // Messenger swipe direction: slide left on right-aligned (sent) messages, slide right on left-aligned (received) messages
    // Also allow sliding right on any message for natural thumb reach
    const rawDelta = alignRight ? (dx < 0 ? dx : dx * 0.45) : dx > 0 ? dx : dx * 0.3
    const clamped = Math.max(-SWIPE_MAX_PX, Math.min(SWIPE_MAX_PX, rawDelta))
    setOffsetX(clamped)
  }

  function finishSwipe() {
    const s = startRef.current
    if (!s.active && !dragging) return
    s.active = false
    s.locked = null
    const triggered = Math.abs(offsetX) >= SWIPE_TRIGGER_PX
    setDragging(false)
    setOffsetX(0)
    if (triggered) {
      onTriggerReply()
    }
  }

  const progress = Math.min(1, Math.abs(offsetX) / SWIPE_TRIGGER_PX)

  return (
    <div
      data-msg-id={messageId}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishSwipe}
      onPointerCancel={finishSwipe}
      onPointerLeave={dragging ? finishSwipe : undefined}
      className={cn(
        "relative w-full flex touch-pan-y select-none sm:select-text rounded-xl transition-colors duration-500",
        alignRight ? "justify-end" : "justify-start",
        highlighted && "bg-sky-500/12 ring-1 ring-sky-400/35",
      )}
    >
      {/* Peek reply badge revealed while sliding */}
      {Math.abs(offsetX) > 6 && (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute top-1/2 -translate-y-1/2 flex size-8 items-center justify-center rounded-full border transition-transform",
            offsetX > 0 ? "left-1.5" : "right-1.5",
            progress >= 1
              ? "bg-sky-500 text-white border-sky-300/60 scale-105 shadow-md shadow-sky-500/35"
              : "bg-slate-900/90 text-slate-300 border-white/15 scale-90",
          )}
          style={{ opacity: Math.max(0.25, progress) }}
        >
          <Reply className="size-4" />
        </div>
      )}

      <div
        className={cn(
          "flex max-w-full",
          !dragging && "transition-transform duration-200 ease-out",
        )}
        style={{ transform: offsetX !== 0 ? `translateX(${offsetX}px)` : undefined }}
      >
        {children}
      </div>
    </div>
  )
}

export function QuotedReplyChip({
  replyTo,
  alignRight,
  lang,
  onJumpToMessage,
}: {
  replyTo: ChatReplyPreview
  alignRight: boolean
  lang: string
  onJumpToMessage?: (id: string) => void
}) {
  const snippet = getReplySnippet({
    message: replyTo.message,
    attachmentType: replyTo.attachmentType,
  })

  return (
    <button
      type="button"
      data-no-swipe="true"
      onClick={() => onJumpToMessage?.(replyTo.id)}
      className={cn(
        "group/quote mb-1 flex max-w-[260px] flex-col rounded-xl border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5 text-left transition-colors hover:bg-white/[0.08] cursor-pointer",
        alignRight ? "items-end text-right" : "items-start text-left",
      )}
      title={lang === "bn" ? "মূল মেসেজে যান" : "Jump to original message"}
    >
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-300/90">
        <Reply className="size-2.5 shrink-0" />
        <span className="truncate max-w-[180px]">
          {lang === "bn" ? `${replyTo.senderName}-এর উত্তরে` : `Replying to ${replyTo.senderName}`}
        </span>
      </span>
      <span className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-400 group-hover/quote:text-slate-300">
        {snippet}
      </span>
    </button>
  )
}

export function MessageActionBar({
  messageId,
  alignRight,
  pickerOpen,
  onTogglePicker,
  onSelectEmoji,
  onReply,
  lang,
  extraAction,
}: {
  messageId: string
  alignRight: boolean
  pickerOpen: boolean
  onTogglePicker: (id: string | null) => void
  onSelectEmoji: (emoji: ChatReactionEmoji) => void
  onReply: () => void
  lang: string
  extraAction?: React.ReactNode
}) {
  return (
    <div
      data-no-swipe="true"
      className={cn(
        "relative flex items-center gap-0.5 shrink-0 transition-opacity",
        pickerOpen
          ? "opacity-100"
          : "opacity-100 sm:opacity-0 sm:group-hover/msg:opacity-100 sm:group-focus-within/msg:opacity-100",
      )}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onTogglePicker(pickerOpen ? null : messageId)
        }}
        className="flex size-7 items-center justify-center rounded-full text-slate-400 hover:bg-white/[0.09] hover:text-white transition-colors cursor-pointer"
        title={lang === "bn" ? "রিঅ্যাকশন দিন" : "React"}
        aria-label={lang === "bn" ? "রিঅ্যাকশন দিন" : "Add reaction"}
      >
        <SmilePlus className="size-3.5" />
      </button>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onTogglePicker(null)
          onReply()
        }}
        className="flex size-7 items-center justify-center rounded-full text-slate-400 hover:bg-white/[0.09] hover:text-white transition-colors cursor-pointer"
        title={lang === "bn" ? "রিপ্লাই দিন (অথবা স্লাইড করুন)" : "Reply (or slide message)"}
        aria-label={lang === "bn" ? "রিপ্লাই দিন" : "Reply to message"}
      >
        <Reply className="size-3.5" />
      </button>

      {extraAction}

      {pickerOpen && (
        <div
          data-no-swipe="true"
          className={cn(
            "absolute bottom-full mb-1.5 z-40 flex items-center gap-0.5 rounded-full border border-white/[0.14] bg-[#0b1024]/98 px-2 py-1 shadow-xl shadow-black/75 backdrop-blur-md animate-in fade-in zoom-in-95 duration-150",
            alignRight ? "right-0" : "left-0",
          )}
        >
          {CHAT_REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onTogglePicker(null)
                onSelectEmoji(emoji)
              }}
              className="flex size-7 items-center justify-center rounded-full text-base leading-none transition-transform hover:scale-125 hover:bg-white/[0.1] active:scale-95 cursor-pointer"
              aria-label={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function ReactionPills({
  reactions,
  currentUserId,
  alignRight,
  onToggleEmoji,
}: {
  reactions?: ChatReactionsMap
  currentUserId?: string
  alignRight: boolean
  onToggleEmoji: (emoji: ChatReactionEmoji) => void
}) {
  if (!reactions) return null
  const entries = Object.entries(reactions).filter(([, list]) => Array.isArray(list) && list.length > 0)
  if (entries.length === 0) return null

  return (
    <div
      data-no-swipe="true"
      className={cn(
        "relative z-10 -mt-1.5 flex flex-wrap items-center gap-1 px-1",
        alignRight ? "justify-end" : "justify-start",
      )}
    >
      {entries.map(([emoji, users]) => {
        const isMine = Boolean(currentUserId && users.some((u) => u.userId === currentUserId))
        const namesTooltip = users.map((u) => u.userName).join(", ")
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => onToggleEmoji(emoji as ChatReactionEmoji)}
            title={namesTooltip}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] leading-none shadow-sm transition-transform hover:scale-105 active:scale-95 cursor-pointer",
              isMine
                ? "border-sky-400/55 bg-[#12264f] text-sky-100"
                : "border-white/[0.12] bg-[#0f162e] text-slate-200 hover:border-white/[0.25]",
            )}
          >
            <span className="text-[12px]">{emoji}</span>
            {users.length > 1 && <span className="font-mono text-[10px] font-semibold">{users.length}</span>}
          </button>
        )
      })}
    </div>
  )
}

export function ComposerReplyBar({
  replyTarget,
  lang,
  onClear,
}: {
  replyTarget: {
    id: string
    senderName: string
    message: string
    attachmentType?: string | null
    attachmentName?: string | null
  }
  lang: string
  onClear: () => void
}) {
  const snippet = getReplySnippet(replyTarget)

  return (
    <div className="flex items-center justify-between gap-2 border-t border-white/[0.08] bg-[#0b1126] px-3.5 py-2 text-xs">
      <div className="flex min-w-0 items-start gap-2">
        <div className="mt-0.5 h-7 w-0.5 shrink-0 rounded-full bg-sky-400" />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-sky-300 truncate">
            {lang === "bn"
              ? `${replyTarget.senderName}-কে রিপ্লাই দিচ্ছেন`
              : `Replying to ${replyTarget.senderName}`}
          </p>
          <p className="text-[11px] text-slate-400 truncate">{snippet}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="flex size-6 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer"
        aria-label={lang === "bn" ? "রিপ্লাই বাতিল করুন" : "Cancel reply"}
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}
