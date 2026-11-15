"use client"

import { useState, useEffect, useTransition, useRef, useMemo } from "react"
import {
  sendChatMessage,
  getStaffChatConversations,
  getStaffChatThread,
  deleteChatMessage,
  deleteUserChatHistory,
} from "@/app/actions/chat"
import { useChatScroll } from "@/lib/hooks/use-chat-scroll"
import { uploadMediaFile } from "@/lib/client-upload"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { MediaLightbox, type MediaLightboxItem } from "@/components/chat/media-lightbox"
import { resolveImageUrl } from "@/lib/image-url"
import {
  MessageSquare,
  Search,
  Send,
  Paperclip,
  Trash2,
  Check,
  CheckCheck,
  Loader2,
  X,
  FileText,
  Sparkles,
  RefreshCw,
  Play,
  ExternalLink,
  ChevronLeft,
} from "lucide-react"
import { toast } from "sonner"
import type { ActiveChatSession } from "./active-chat-sidebar"

type MessageItem = {
  id: string
  userId: string
  senderId: string
  senderName: string
  senderRole: string
  message: string
  attachmentUrl?: string | null
  attachmentType?: string | null
  attachmentName?: string | null
  readByStaff: boolean
  readByUser: boolean
  createdAt: Date | string
  senderImage?: string | null
}

const QUICK_REPLIES = [
  "Room credentials have been published in your lobby. Good luck!",
  "Your transaction has been verified and team slot confirmed.",
  "Refund has been processed. Check your wallet statement.",
  "Please provide your Free Fire Captain UID and registered phone number.",
  "Our support team is reviewing your match report. Please allow up to 1 hour.",
]

function detectAttachmentKind(m: MessageItem): "image" | "video" | "file" | null {
  if (!m.attachmentUrl) return null
  if (
    m.attachmentType === "video" ||
    /\.(mp4|webm|mov|mkv|avi)(\?|$)/i.test(m.attachmentUrl) ||
    m.attachmentUrl.startsWith("data:video/")
  ) {
    return "video"
  }
  if (
    m.attachmentType === "image" ||
    /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(m.attachmentUrl) ||
    m.attachmentUrl.startsWith("data:image/")
  ) {
    return "image"
  }
  return "file"
}

export function AdminLiveChatHub({
  initialConversations = [],
  staffUserId: _staffUserId,
}: {
  initialConversations: ActiveChatSession[]
  staffUserId: string
}) {
  const [conversations, setConversations] = useState<ActiveChatSession[]>(initialConversations)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(
    initialConversations[0]?.userId || null
  )
  const [mobileShowThread, setMobileShowThread] = useState(Boolean(initialConversations[0]?.userId))
  const [search, setSearch] = useState("")
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [loadingThread, setLoadingThread] = useState(false)
  const [inputText, setInputText] = useState("")
  const [isSending, startSending] = useTransition()
  const [uploading, setUploading] = useState(false)
  const [attachedUrl, setAttachedUrl] = useState<string | null>(null)
  const [attachedType, setAttachedType] = useState<string | null>(null)
  const [attachedName, setAttachedName] = useState<string | null>(null)

  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  const [deleteMsgTarget, setDeleteMsgTarget] = useState<string | null>(null)
  const [clearThreadConfirmOpen, setClearThreadConfirmOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    containerRef,
    bottomRef,
    handleScroll,
    notifyUserSentMessage,
  } = useChatScroll({
    dependency: messages,
    resetTrigger: selectedUserId,
  })

  const lightboxItems = useMemo<MediaLightboxItem[]>(() => {
    const items: MediaLightboxItem[] = []
    for (const m of messages) {
      const kind = detectAttachmentKind(m)
      if ((kind === "image" || kind === "video") && m.attachmentUrl) {
        items.push({
          url: resolveImageUrl(m.attachmentUrl),
          type: kind,
          name: m.attachmentName,
          caption:
            m.message && m.message !== "📷 Photo" && m.message !== "🎬 Video"
              ? m.message
              : m.attachmentName,
        })
      }
    }
    return items
  }, [messages])

  function openLightbox(url: string) {
    const resolved = resolveImageUrl(url)
    const idx = lightboxItems.findIndex((i) => i.url === resolved)
    setLightboxIndex(idx >= 0 ? idx : 0)
    setLightboxOpen(true)
  }

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const fresh = await getStaffChatConversations()
        if (fresh && Array.isArray(fresh)) {
          setConversations(fresh)
        }
      } catch {}
    }, 5000)
    return () => clearInterval(timer)
  }, [])

  const fetchThread = async (userId: string, isSilent = false) => {
    if (!isSilent) setLoadingThread(true)
    try {
      const thread = await getStaffChatThread(userId)
      setMessages(thread as MessageItem[])
    } catch {
      if (!isSilent) toast.error("Could not load chat messages")
    } finally {
      if (!isSilent) setLoadingThread(false)
    }
  }

  useEffect(() => {
    if (selectedUserId) {
      fetchThread(selectedUserId, false)
    } else {
      setMessages([])
    }
  }, [selectedUserId])

  useEffect(() => {
    if (!selectedUserId) return
    const timer = setInterval(() => {
      fetchThread(selectedUserId, true)
    }, 3500)
    return () => clearInterval(timer)
  }, [selectedUserId])

  const selectedConversation = conversations.find((c) => c.userId === selectedUserId)

  const filteredConversations = useMemo(() => {
    if (!search.trim()) return conversations
    const q = search.toLowerCase()
    return conversations.filter(
      (c) =>
        (c.userName || "").toLowerCase().includes(q) ||
        (c.latestMessage || "").toLowerCase().includes(q) ||
        c.userId.toLowerCase().includes(q)
    )
  }, [conversations, search])

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const res = await uploadMediaFile(file, "chat")
      const isImg = file.type.startsWith("image/")
      const isVid = file.type.startsWith("video/") || /\.(mp4|mov|webm|mkv|avi)$/i.test(file.name)
      setAttachedUrl(res.url)
      setAttachedType(isImg ? "image" : isVid ? "video" : "file")
      setAttachedName(file.name)
      toast.success("Attachment ready to send")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload attachment")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  function handleSend(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!selectedUserId) return
    const clean = inputText.trim()
    if (!clean && !attachedUrl) return

    const targetUser = selectedUserId
    const textToSend = clean
    const urlToSend = attachedUrl || undefined
    const typeToSend = attachedType || undefined
    const nameToSend = attachedName || undefined

    setInputText("")
    setAttachedUrl(null)
    setAttachedType(null)
    setAttachedName(null)

    startSending(async () => {
      notifyUserSentMessage()
      const res = await sendChatMessage(
        textToSend,
        targetUser,
        urlToSend,
        typeToSend,
        nameToSend
      )
      if (res.ok) {
        await fetchThread(targetUser, true)
      } else {
        toast.error(res.error || "Failed to send message")
      }
    })
  }

  async function confirmDeleteMessage() {
    if (!deleteMsgTarget) return
    setIsDeleting(true)
    try {
      const res = await deleteChatMessage(deleteMsgTarget)
      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== deleteMsgTarget))
        toast.success("Message deleted")
        setDeleteMsgTarget(null)
      } else {
        toast.error(res.error || "Failed to delete message")
      }
    } finally {
      setIsDeleting(false)
    }
  }

  async function confirmClearHistory() {
    if (!selectedUserId) return
    setIsDeleting(true)
    try {
      const res = await deleteUserChatHistory(selectedUserId)
      if (res.ok) {
        setMessages([])
        toast.success("Conversation history cleared")
        setClearThreadConfirmOpen(false)
      } else {
        toast.error(res.error || "Failed to clear history")
      }
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      <div className="rounded-2xl overflow-hidden border border-zinc-800 bg-[#18191A] flex flex-col md:flex-row h-[760px] max-h-[85vh] shadow-xl">
        {/* Left Pane: Messenger Conversations Sidebar */}
        <div
          className={cn(
            "w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-zinc-800 flex flex-col bg-[#242526] shrink-0",
            mobileShowThread && selectedUserId ? "hidden md:flex" : "flex flex-1 md:flex-none"
          )}
        >
          <div className="p-4 border-b border-zinc-800 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-bold uppercase tracking-wider flex items-center gap-2 text-zinc-100">
                <MessageSquare className="size-4 text-[#0084FF]" />
                Chats
              </h2>
              <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs font-mono font-bold text-zinc-300">
                {conversations.length}
              </span>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search Messenger..."
                className="pl-8 h-9 rounded-full text-xs bg-[#3A3B3C] border-zinc-700 text-zinc-100 placeholder:text-zinc-400"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-400">
                <MessageSquare className="size-8 mx-auto mb-2 opacity-30" />
                <p>No active conversations found</p>
              </div>
            ) : (
              filteredConversations.map((c) => {
                const active = c.userId === selectedUserId
                return (
                  <button
                    key={c.userId}
                    type="button"
                    onClick={() => {
                      setSelectedUserId(c.userId)
                      setMobileShowThread(true)
                    }}
                    className={cn(
                      "w-full text-left p-2.5 rounded-xl flex items-center gap-3 transition-colors cursor-pointer",
                      active ? "bg-[#0084FF]/15 ring-1 ring-[#0084FF]/40" : "hover:bg-[#3A3B3C]/60"
                    )}
                  >
                    <div className="relative shrink-0">
                      {c.userImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={resolveImageUrl(c.userImage)}
                          alt={c.userName || "User"}
                          className="size-11 rounded-full object-cover border border-zinc-700"
                        />
                      ) : (
                        <div className="size-11 rounded-full bg-[#3A3B3C] flex items-center justify-center font-bold text-sm text-zinc-200 border border-zinc-700">
                          {(c.userName || "U")[0].toUpperCase()}
                        </div>
                      )}
                      {c.unread != null && c.unread > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#0084FF] text-white font-bold text-[10px] flex items-center justify-center shadow">
                          {c.unread}
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className={cn("text-xs truncate", c.unread ? "font-bold text-white" : "font-semibold text-zinc-200")}>
                          {c.userName || "Ace Scrims Player"}
                        </p>
                        <span className="text-[10px] text-zinc-400 font-mono shrink-0">
                          {c.createdAt ? new Date(c.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                        </span>
                      </div>
                      <p className={cn("text-[11px] truncate mt-0.5", c.unread ? "text-zinc-200 font-medium" : "text-zinc-400")}>
                        {c.latestMessage || "No messages yet"}
                      </p>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* Right Pane: Messenger Thread & Composer */}
        <div
          className={cn(
            "flex-1 flex flex-col bg-[#18191A] min-w-0",
            mobileShowThread && selectedUserId ? "flex" : "hidden md:flex"
          )}
        >
          {selectedUserId ? (
            <>
              {/* Header */}
              <div className="p-3.5 px-4 border-b border-zinc-800 flex items-center justify-between bg-[#242526] shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => setMobileShowThread(false)}
                    className="md:hidden rounded-full p-1.5 text-zinc-300 hover:bg-zinc-700"
                    aria-label="Back to conversations"
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                  {selectedConversation?.userImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={resolveImageUrl(selectedConversation.userImage)}
                      alt={selectedConversation.userName || "User"}
                      className="size-10 rounded-full object-cover border border-zinc-700 shrink-0"
                    />
                  ) : (
                    <div className="size-10 rounded-full bg-[#3A3B3C] flex items-center justify-center font-bold text-sm text-zinc-200 border border-zinc-700 shrink-0">
                      {(selectedConversation?.userName || "U")[0].toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="font-display text-sm font-bold text-zinc-100 truncate">
                      {selectedConversation?.userName || "Player Support Session"}
                    </h3>
                    <p className="text-[11px] text-zinc-400 font-mono truncate">
                      ID: {selectedUserId}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchThread(selectedUserId, false)}
                    className="h-8 text-xs gap-1 border-zinc-700 bg-[#3A3B3C] text-zinc-100 hover:bg-zinc-700"
                  >
                    <RefreshCw className="size-3" />
                    <span className="hidden sm:inline">Refresh</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setClearThreadConfirmOpen(true)}
                    className="h-8 text-xs gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="size-3" />
                    <span className="hidden sm:inline">Clear Thread</span>
                  </Button>
                </div>
              </div>

              {/* Message Feed */}
              <div
                ref={containerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 flex flex-col gap-1.5 relative bg-[#18191A]"
              >
                {loadingThread ? (
                  <div className="flex items-center justify-center h-full text-xs text-zinc-400 gap-2">
                    <Loader2 className="size-4 animate-spin text-[#0084FF]" />
                    Loading message history...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-xs text-zinc-400 p-6">
                    <MessageSquare className="size-10 mb-2 opacity-30 text-[#0084FF]" />
                    <p className="font-semibold text-zinc-100">No messages in this conversation yet</p>
                    <p className="text-[11px] mt-1 max-w-xs">
                      Type a reply below or pick a quick response template to respond immediately.
                    </p>
                  </div>
                ) : (
                  messages.map((m, idx) => {
                    const isStaff = m.senderRole === "admin" || m.senderRole === "moderator"
                    const prevSameSender = idx > 0 && (
                      (messages[idx - 1].senderRole === "admin" || messages[idx - 1].senderRole === "moderator") === isStaff
                    )
                    const nextSameSender = idx < messages.length - 1 && (
                      (messages[idx + 1].senderRole === "admin" || messages[idx + 1].senderRole === "moderator") === isStaff
                    )
                    const mediaKind = detectAttachmentKind(m)
                    const isDefaultCaption =
                      m.message === "📷 Photo" ||
                      m.message === "📷 Image attachment" ||
                      m.message === "🎬 Video" ||
                      m.message === "📄 File attachment"
                    const hasText = Boolean(m.message && m.message.trim() && !(mediaKind && isDefaultCaption))

                    return (
                      <div
                        key={m.id}
                        className={cn(
                          "group flex flex-col max-w-[82%] sm:max-w-[70%]",
                          isStaff ? "ml-auto items-end" : "mr-auto items-start",
                          !prevSameSender ? "mt-2" : "mt-0.5"
                        )}
                      >
                        {!prevSameSender && (
                          <div className="flex items-center gap-1.5 mb-0.5 px-1 text-[10px] text-zinc-400">
                            <span className="font-semibold text-zinc-300">
                              {isStaff ? `${m.senderName} (Staff)` : m.senderName}
                            </span>
                          </div>
                        )}

                        <div className="relative flex items-center gap-1.5">
                          {/* Hover Delete on Left of Staff Bubbles */}
                          {isStaff && (
                            <button
                              type="button"
                              onClick={() => setDeleteMsgTarget(m.id)}
                              title="Delete message"
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full text-zinc-400 hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}

                          <div className="flex flex-col gap-1">
                            {mediaKind === "image" && m.attachmentUrl ? (
                              <div className="flex flex-col gap-1">
                                <button
                                  type="button"
                                  onClick={() => openLightbox(m.attachmentUrl!)}
                                  className="group/media relative overflow-hidden rounded-2xl border border-white/10 bg-black cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0084FF]"
                                  title="Click to inspect full image"
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={resolveImageUrl(m.attachmentUrl)}
                                    alt={m.attachmentName || "Attachment"}
                                    className="max-h-64 w-auto max-w-[280px] object-cover transition-transform duration-200 group-hover/media:scale-[1.02]"
                                  />
                                </button>
                                {hasText && (
                                  <div
                                    className={cn(
                                      "rounded-2xl px-3.5 py-2 text-[13px] leading-snug shadow",
                                      isStaff ? "bg-[#0084FF] text-white" : "bg-[#242526] text-zinc-100"
                                    )}
                                  >
                                    <p className="whitespace-pre-wrap break-words">{m.message}</p>
                                  </div>
                                )}
                              </div>
                            ) : mediaKind === "video" && m.attachmentUrl ? (
                              <div className="flex flex-col gap-1">
                                <button
                                  type="button"
                                  onClick={() => openLightbox(m.attachmentUrl!)}
                                  className="group/media relative overflow-hidden rounded-2xl border border-white/10 bg-black cursor-pointer w-[260px] aspect-video focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0084FF]"
                                  title="Click to play video"
                                >
                                  <video
                                    src={resolveImageUrl(m.attachmentUrl)}
                                    muted
                                    playsInline
                                    preload="metadata"
                                    className="h-full w-full object-cover opacity-85"
                                  />
                                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover/media:bg-black/45 transition-colors">
                                    <span className="flex size-11 items-center justify-center rounded-full bg-white/90 text-black shadow-lg">
                                      <Play className="size-5 fill-current ml-0.5" />
                                    </span>
                                  </div>
                                </button>
                                {hasText && (
                                  <div
                                    className={cn(
                                      "rounded-2xl px-3.5 py-2 text-[13px] leading-snug shadow",
                                      isStaff ? "bg-[#0084FF] text-white" : "bg-[#242526] text-zinc-100"
                                    )}
                                  >
                                    <p className="whitespace-pre-wrap break-words">{m.message}</p>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div
                                className={cn(
                                  "px-3.5 py-2 text-[13px] leading-snug shadow-sm flex flex-col gap-1.5",
                                  isStaff
                                    ? cn(
                                        "bg-[#0084FF] text-white rounded-2xl",
                                        prevSameSender && "rounded-tr-md",
                                        nextSameSender && "rounded-br-md"
                                      )
                                    : cn(
                                        "bg-[#242526] text-zinc-100 rounded-2xl",
                                        prevSameSender && "rounded-tl-md",
                                        nextSameSender && "rounded-bl-md"
                                      )
                                )}
                              >
                                {m.message && <p className="whitespace-pre-wrap break-words">{m.message}</p>}

                                {m.attachmentUrl && (
                                  <a
                                    href={resolveImageUrl(m.attachmentUrl)}
                                    download={m.attachmentName || "file"}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={cn(
                                      "flex items-center gap-2 p-2 rounded-xl text-[11px] font-medium transition-colors",
                                      isStaff
                                        ? "bg-black/20 hover:bg-black/30 text-white"
                                        : "bg-[#3A3B3C] hover:bg-[#4E4F50] text-zinc-100"
                                    )}
                                  >
                                    <FileText className="size-4 shrink-0" />
                                    <span className="truncate max-w-xs">{m.attachmentName || "View Document"}</span>
                                    <ExternalLink className="size-3 opacity-75 ml-auto shrink-0" />
                                  </a>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Hover Delete on Right of Player Bubbles */}
                          {!isStaff && (
                            <button
                              type="button"
                              onClick={() => setDeleteMsgTarget(m.id)}
                              title="Delete message"
                              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full text-zinc-400 hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>

                        {!nextSameSender && (
                          <div className="flex items-center gap-1 mt-0.5 px-1 text-[10px] text-zinc-500">
                            <span className="font-mono">
                              {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                            </span>
                            {isStaff && (
                              m.readByUser ? (
                                <CheckCheck className="size-3 text-[#0084FF]" />
                              ) : (
                                <Check className="size-3 text-zinc-500" />
                              )
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
                <div ref={bottomRef} />
              </div>

              {/* Quick Replies Bar */}
              <div className="px-4 py-2 border-t border-zinc-800 bg-[#242526]/70 flex items-center gap-1.5 overflow-x-auto text-[11px] shrink-0">
                <span className="text-zinc-400 font-semibold flex items-center gap-1 shrink-0">
                  <Sparkles className="size-3 text-[#0084FF]" />
                  Quick:
                </span>
                {QUICK_REPLIES.map((reply, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setInputText(reply)}
                    className="px-2.5 py-1 rounded-full border border-zinc-700 bg-[#3A3B3C] text-zinc-100 hover:bg-[#0084FF]/20 hover:border-[#0084FF]/50 transition-colors whitespace-nowrap cursor-pointer shrink-0"
                  >
                    {reply.slice(0, 32)}...
                  </button>
                ))}
              </div>

              {attachedUrl && (
                <div className="px-4 py-1.5 border-t border-zinc-800 bg-[#242526] flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Paperclip className="size-3.5 text-[#0084FF]" />
                    <span className="font-mono text-[11px] text-zinc-200 truncate max-w-xs">{attachedName || "Ready to send"}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAttachedUrl(null)
                      setAttachedType(null)
                      setAttachedName(null)
                    }}
                    className="text-zinc-400 hover:text-white"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              )}

              {/* Composer */}
              <form onSubmit={handleSend} className="p-3 border-t border-zinc-800 bg-[#242526] flex items-end gap-2 shrink-0">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*,.pdf,.doc,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || isSending}
                  title="Attach photo, video, or file"
                  className="size-9 p-0 shrink-0 rounded-full text-[#0084FF] hover:bg-zinc-700/50"
                >
                  {uploading ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4.5" />}
                </Button>

                <Textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  placeholder="Aa"
                  rows={1}
                  className="min-h-[38px] max-h-32 text-[13px] resize-none rounded-2xl bg-[#3A3B3C] border-zinc-700 text-zinc-100 placeholder:text-zinc-400"
                />

                <Button
                  type="submit"
                  size="sm"
                  disabled={(!inputText.trim() && !attachedUrl) || isSending}
                  className="size-9 p-0 shrink-0 rounded-full bg-[#0084FF] hover:bg-[#0073E6] text-white"
                >
                  {isSending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                </Button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-400">
              <MessageSquare className="size-12 mb-3 opacity-30 text-[#0084FF]" />
              <h3 className="font-display font-bold text-base text-zinc-100">Select a Player Conversation</h3>
              <p className="text-xs max-w-sm mt-1">
                Pick a player thread from the Messenger sidebar to review screenshots, video clips, and respond immediately.
              </p>
            </div>
          )}
        </div>
      </div>

      <MediaLightbox
        items={lightboxItems}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />

      <ConfirmDialog
        open={Boolean(deleteMsgTarget)}
        onOpenChange={(open) => !open && setDeleteMsgTarget(null)}
        title="Delete Message?"
        description="This message will be permanently removed from the conversation for both player and staff."
        confirmLabel="Delete Message"
        loading={isDeleting}
        onConfirm={confirmDeleteMessage}
      />

      <ConfirmDialog
        open={clearThreadConfirmOpen}
        onOpenChange={setClearThreadConfirmOpen}
        title="Clear Conversation History?"
        description={`Are you sure you want to delete all chat messages with ${selectedConversation?.userName || "this player"}? This cannot be undone.`}
        confirmLabel="Clear Thread"
        loading={isDeleting}
        onConfirm={confirmClearHistory}
      />
    </>
  )
}
