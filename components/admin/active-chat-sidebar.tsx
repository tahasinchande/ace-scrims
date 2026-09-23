"use client"

import { useState } from "react"
import { MessageSquare, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { resolveImageUrl } from "@/lib/image-url"

export type ActiveChatSession = {
  userId: string
  userName: string | null | undefined
  userImage?: string | null | undefined
  latestMessage: string | null | undefined
  createdAt: Date | string | number
  unread?: number
  hasAttachment?: boolean
  attachmentType?: string | null
}

interface ActiveChatSidebarProps {
  conversations: ActiveChatSession[]
  activeUserId: string | null
  onSelectUser: (userId: string) => void
  searchQuery?: string
  className?: string
}

function formatChatTimestamp(dateValue: Date | string | number): string {
  if (!dateValue) return ""
  const date = new Date(dateValue)
  if (isNaN(date.getTime())) return ""

  const now = new Date()
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()

  if (isToday) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()

  if (isYesterday) {
    return "Yesterday"
  }

  return date.toLocaleDateString([], { month: "short", day: "numeric" })
}

function getMessagePreview(
  latestMessage?: string | null,
  attachmentType?: string | null,
  hasAttachment?: boolean
): { text: string; isAttachment: boolean } {
  if (latestMessage && latestMessage.trim()) {
    return { text: latestMessage.trim(), isAttachment: false }
  }

  if (attachmentType === "image" || hasAttachment) {
    return { text: "📷 Image attachment", isAttachment: true }
  }

  if (attachmentType === "file") {
    return { text: "📄 File attachment", isAttachment: true }
  }

  return { text: "No message yet", isAttachment: false }
}

export function ActiveChatSidebar({
  conversations,
  activeUserId,
  onSelectUser,
  className,
}: ActiveChatSidebarProps) {
  const [failedAvatars, setFailedAvatars] = useState<Record<string, boolean>>({})

  return (
    <div className={cn("border-r border-border/80 bg-card/60 flex flex-col h-full min-h-0", className)}>
      {/* Header */}
      <div className="p-4 border-b border-border/80 flex items-center justify-between shrink-0">
        <div className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <MessageSquare className="size-3.5 text-primary" />
          <span>Active User Messages</span>
        </div>
        <span className="inline-flex items-center justify-center px-2 py-0.5 text-[11px] font-bold rounded-full bg-secondary text-foreground border border-border/60">
          {conversations.length}
        </span>
      </div>

      {/* Sessions List */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col divide-y divide-border/40">
        {conversations.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
            <MessageSquare className="size-8 text-muted-foreground/40 stroke-[1.5]" />
            <p>No active support chats yet.</p>
          </div>
        ) : (
          conversations.map((session) => {
            const isActive = activeUserId === session.userId
            // 1. Customer Name fallback: If null/empty/undefined -> "Unknown User"
            const customerName = session.userName?.trim() || "Unknown User"
            const formattedTime = formatChatTimestamp(session.createdAt)
            const preview = getMessagePreview(
              session.latestMessage,
              session.attachmentType,
              session.hasAttachment
            )
            const unreadCount = session.unread ?? 0
            const hasCustomAvatar =
              Boolean(session.userImage && session.userImage.trim()) && !failedAvatars[session.userId]

            return (
              <button
                key={session.userId}
                type="button"
                onClick={() => onSelectUser(session.userId)}
                className={cn(
                  "group relative flex items-start gap-3 p-3.5 text-left transition-all duration-150 w-full outline-none cursor-pointer",
                  isActive
                    ? "bg-primary/15 border-l-4 border-primary text-foreground shadow-inner"
                    : "hover:bg-secondary/60 hover:text-foreground text-muted-foreground border-l-4 border-transparent"
                )}
              >
                {/* User Avatar / Status */}
                <div className="relative shrink-0 mt-0.5">
                  <div
                    className={cn(
                      "flex size-9 items-center justify-center rounded-xl overflow-hidden font-display font-bold text-xs uppercase border transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-secondary text-foreground border-border/80 group-hover:border-primary/40"
                    )}
                  >
                    {hasCustomAvatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resolveImageUrl(session.userImage!)}
                        alt={`${customerName}'s avatar`}
                        onError={() => setFailedAvatars((prev) => ({ ...prev, [session.userId]: true }))}
                        className="size-full object-cover"
                      />
                    ) : customerName !== "Unknown User" ? (
                      customerName.slice(0, 2).toUpperCase()
                    ) : (
                      <User className="size-4" />
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 flex size-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                      <span className="relative inline-flex rounded-full size-2.5 bg-primary" />
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Top Row: Customer Name (Top-Left, Bold) & Timestamp (Top-Right) */}
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={cn(
                        "font-display font-bold text-sm tracking-tight truncate leading-tight",
                        isActive ? "text-primary" : "text-foreground"
                      )}
                      title={customerName}
                    >
                      {customerName}
                    </span>

                    <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0 font-medium">
                      {formattedTime}
                    </span>
                  </div>

                  {/* Bottom Row: Message Preview underneath Customer Name */}
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <p
                      className={cn(
                        "text-xs truncate leading-snug flex-1",
                        unreadCount > 0
                          ? "font-semibold text-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      {preview.text}
                    </p>

                    {unreadCount > 0 && (
                      <span className="shrink-0 bg-primary text-primary-foreground font-bold text-[10px] px-1.5 py-0.2 rounded-full">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
