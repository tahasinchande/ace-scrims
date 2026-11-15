"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { usePathname } from "next/navigation"
import { sendChatMessage, getUserChatMessages } from "@/app/actions/chat"
import { useSession } from "@/lib/auth-client"
import {
  MessageSquare,
  X,
  Send,
  Loader2,
  User,
  Paperclip,
  FileText,
  ExternalLink,
  ChevronDown,
  Image as ImageIcon,
  Play,
  Film,
  Check,
  CheckCheck,
} from "lucide-react"
import { resolveImageUrl } from "@/lib/image-url"
import { uploadMediaFile } from "@/lib/client-upload"
import { toast } from "sonner"
import type { ChatMessage } from "@/lib/db/schema"
import { useChatScroll } from "@/lib/hooks/use-chat-scroll"
import { MediaLightbox, type MediaLightboxItem } from "@/components/chat/media-lightbox"
import { cn } from "@/lib/utils"

type ChatThreadItem = ChatMessage & {
  senderImage?: string | null
}

function isMediaType(m: ChatThreadItem): "image" | "video" | "file" | null {
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

export function LiveChatWidget() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatThreadItem[]>([])
  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [loading, setLoading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<Array<{ url: string; name: string; type: string }>>([])
  const [failedSenderAvatars, setFailedSenderAvatars] = useState<Record<string, boolean>>({})
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const {
    containerRef,
    bottomRef,
    handleScroll,
    scrollToBottom,
    notifyUserSentMessage,
    showScrollBottomButton,
  } = useChatScroll({
    dependency: messages,
    enabled: open && Boolean(session?.user),
  })

  const lightboxItems = useMemo<MediaLightboxItem[]>(() => {
    const list: MediaLightboxItem[] = []
    for (const m of messages) {
      const kind = isMediaType(m)
      if ((kind === "image" || kind === "video") && m.attachmentUrl) {
        list.push({
          url: resolveImageUrl(m.attachmentUrl),
          type: kind,
          name: m.attachmentName,
          caption: m.message && m.message !== "📷 Photo" && m.message !== "🎬 Video" ? m.message : m.attachmentName,
        })
      }
    }
    return list
  }, [messages])

  function openMediaInLightbox(url: string) {
    const resolved = resolveImageUrl(url)
    const idx = lightboxItems.findIndex((item) => item.url === resolved)
    setLightboxIndex(idx >= 0 ? idx : 0)
    setLightboxOpen(true)
  }

  async function loadMessages() {
    if (!session?.user) return
    const list = await getUserChatMessages()
    setMessages(list)
  }

  useEffect(() => {
    const handleOpen = () => setOpen(true)
    window.addEventListener("open-live-chat", handleOpen)
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      if (params.get("openChat") === "true") {
        setOpen(true)
      }
    }
    return () => window.removeEventListener("open-live-chat", handleOpen)
  }, [])

  useEffect(() => {
    if (open && session?.user && !pathname?.startsWith("/admin")) {
      setLoading(true)
      loadMessages().finally(() => setLoading(false))
      const interval = setInterval(loadMessages, 3500)
      return () => clearInterval(interval)
    }
  }, [open, session?.user, pathname])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 110)}px`
    }
  }, [text])

  if (pathname?.startsWith("/admin")) {
    return null
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    for (const file of files) {
      if (file.size > 100 * 1024 * 1024) {
        toast.error(`File "${file.name}" exceeds the 100MB attachment limit`)
        return
      }
    }

    setUploading(true)
    setUploadProgress(5)
    try {
      const newAttachments: Array<{ url: string; name: string; type: string }> = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const isImg = file.type.startsWith("image/")
        const isVid = file.type.startsWith("video/") || /\.(mp4|mov|webm|mkv|avi)$/i.test(file.name)
        const res = await uploadMediaFile(file, "chat", (pct) => {
          const overallPct = Math.round(((i + pct / 100) / files.length) * 100)
          setUploadProgress(overallPct)
        })
        newAttachments.push({
          url: res.url,
          name: file.name,
          type: isImg ? "image" : isVid ? "video" : "file",
        })
      }
      setSelectedFiles((prev) => [...prev, ...newAttachments])
      setUploadProgress(100)
      toast.success(`${files.length} attachment${files.length > 1 ? "s" : ""} ready to send`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  function removeAttachment(indexToRemove: number) {
    setSelectedFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove))
  }

  async function handleSend(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!text.trim() && selectedFiles.length === 0) return
    if (!session?.user) {
      toast.error("Please sign in to send messages to support")
      return
    }

    const msgText = text.trim()
    const filesToSend = [...selectedFiles]
    setText("")
    setSelectedFiles([])
    setSending(true)

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }

    try {
      if (filesToSend.length === 0) {
        const res = await sendChatMessage(msgText)
        if (!res.ok) toast.error(res.error || "Failed to send message")
      } else {
        for (let i = 0; i < filesToSend.length; i++) {
          const f = filesToSend[i]
          const currentText = i === 0 ? msgText : ""
          const res = await sendChatMessage(currentText, undefined, f.url, f.type, f.name)
          if (!res.ok) toast.error(res.error || "Failed to send attachment")
        }
      }
      notifyUserSentMessage()
      await loadMessages()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error sending message")
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group relative flex items-center gap-2.5 rounded-full bg-[#0084FF] hover:bg-[#0073E6] text-white h-12 px-5 font-display font-bold uppercase tracking-wider text-xs shadow-xl shadow-[#0084FF]/30 transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer border border-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0084FF]"
          aria-label="Open Live Support Chat"
        >
          <div className="relative flex items-center justify-center">
            <MessageSquare className="size-4.5 transition-transform duration-300 group-hover:scale-110" />
            <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-emerald-400 border-2 border-[#0084FF]" />
          </div>
          <span>Live Support</span>
        </button>
      )}

      {open && (
        <div className="flex h-[610px] max-h-[86vh] w-[92vw] sm:w-[420px] flex-col rounded-2xl border border-zinc-800 bg-[#18191A] shadow-2xl shadow-black/80 overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-200">
          {/* Messenger Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 bg-[#242526] px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="relative flex size-10 items-center justify-center rounded-full bg-[#18191A] border border-primary/40 p-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icon.svg" alt="Ace Scrims" className="size-6 object-contain" />
                <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 border-2 border-[#242526]" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-display font-bold text-sm tracking-tight text-zinc-100">Ace Support</h3>
                  <span className="rounded-md bg-[#0084FF]/20 border border-[#0084FF]/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#4DA6FF]">
                    Official
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400">Active now · Replies in minutes</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-2 text-zinc-400 hover:bg-zinc-700/60 hover:text-zinc-100 transition-colors"
              aria-label="Close support chat"
            >
              <X className="size-4.5" />
            </button>
          </div>

          {/* Messenger Thread Body */}
          <div
            ref={containerRef}
            onScroll={handleScroll}
            className="relative flex-1 min-h-0 overflow-y-auto px-3.5 py-4 flex flex-col gap-1.5 bg-[#18191A]"
          >
            {!session?.user ? (
              <div className="my-auto flex flex-col items-center justify-center p-6 text-center gap-3.5">
                <div className="size-12 rounded-full bg-[#242526] border border-zinc-700 flex items-center justify-center text-[#0084FF]">
                  <User className="size-6" />
                </div>
                <div>
                  <h4 className="font-display text-sm font-bold text-zinc-100 uppercase tracking-wide">Sign In Required</h4>
                  <p className="text-xs text-zinc-400 mt-1 max-w-xs leading-relaxed">
                    Please sign in to chat with our staff and share match proof photos or videos.
                  </p>
                </div>
                <a
                  href="/sign-in"
                  className="inline-flex h-9 items-center justify-center rounded-full bg-[#0084FF] px-6 font-display text-xs font-bold uppercase tracking-wider text-white hover:bg-[#0073E6] transition-colors"
                >
                  Sign In
                </a>
              </div>
            ) : loading && messages.length === 0 ? (
              <div className="my-auto flex justify-center">
                <Loader2 className="size-7 animate-spin text-[#0084FF]" />
              </div>
            ) : messages.length === 0 ? (
              <div className="my-auto text-center text-xs text-zinc-400 leading-relaxed p-5 bg-[#242526] rounded-2xl border border-zinc-800 max-w-xs mx-auto">
                <div className="size-10 rounded-full bg-[#0084FF]/15 text-[#0084FF] flex items-center justify-center mx-auto mb-2.5">
                  <MessageSquare className="size-5" />
                </div>
                <p className="font-semibold text-zinc-100 mb-1">Welcome to Ace Support</p>
                <p className="text-zinc-400 text-[11px]">
                  Send a message, photo, or clip directly to our tournament moderators.
                </p>
              </div>
            ) : (
              messages.map((m, idx) => {
                const isMe = m.senderId === session.user.id
                const prevSameSender = idx > 0 && messages[idx - 1].senderId === m.senderId
                const nextSameSender = idx < messages.length - 1 && messages[idx + 1].senderId === m.senderId
                const isStaff = m.senderRole === "admin" || m.senderRole === "moderator"
                const mediaKind = isMediaType(m)
                const isDefaultCaption =
                  m.message === "📷 Photo" ||
                  m.message === "📷 Image attachment" ||
                  m.message === "🎬 Video" ||
                  m.message === "📄 File attachment"
                const hasMeaningfulText = Boolean(m.message && m.message.trim() && !(mediaKind && isDefaultCaption))

                return (
                  <div
                    key={m.id}
                    className={cn(
                      "flex items-end gap-2 max-w-[85%]",
                      isMe ? "self-end flex-row-reverse" : "self-start flex-row",
                      !prevSameSender ? "mt-2" : "mt-0.5"
                    )}
                  >
                    {/* Incoming Sender Avatar (aligned at bottom of sender group like Messenger) */}
                    {!isMe && (
                      <div className="w-7 shrink-0">
                        {!nextSameSender && (
                          m.senderImage && !failedSenderAvatars[m.id] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={resolveImageUrl(m.senderImage)}
                              alt={m.senderName}
                              onError={() => setFailedSenderAvatars((prev) => ({ ...prev, [m.id]: true }))}
                              className="size-7 rounded-full object-cover border border-zinc-700"
                            />
                          ) : isStaff ? (
                            <span className="flex size-7 items-center justify-center rounded-full bg-[#242526] p-1 border border-zinc-700">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src="/icon.svg" alt="Staff" className="size-4 object-contain" />
                            </span>
                          ) : (
                            <span className="flex size-7 items-center justify-center rounded-full bg-zinc-700 text-[10px] font-bold text-zinc-200">
                              {(m.senderName || "S").slice(0, 1).toUpperCase()}
                            </span>
                          )
                        )}
                      </div>
                    )}

                    <div className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                      {!isMe && !prevSameSender && (
                        <span className="text-[10px] text-zinc-400 px-2 mb-0.5 font-medium">
                          {isStaff ? `${m.senderName} · Staff` : m.senderName}
                        </span>
                      )}

                      {mediaKind === "image" && m.attachmentUrl ? (
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => openMediaInLightbox(m.attachmentUrl!)}
                            className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0084FF]"
                            title="Open photo"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={resolveImageUrl(m.attachmentUrl)}
                              alt={m.attachmentName || "Shared photo"}
                              className="max-h-64 w-auto max-w-[260px] object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                              loading="lazy"
                            />
                          </button>
                          {hasMeaningfulText && (
                            <div
                              className={cn(
                                "px-3.5 py-2 text-[13px] leading-snug break-words whitespace-pre-wrap rounded-2xl",
                                isMe ? "bg-[#0084FF] text-white" : "bg-[#242526] text-zinc-100"
                              )}
                            >
                              {m.message}
                            </div>
                          )}
                        </div>
                      ) : mediaKind === "video" && m.attachmentUrl ? (
                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() => openMediaInLightbox(m.attachmentUrl!)}
                            className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black cursor-pointer w-[240px] aspect-video focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0084FF]"
                            title="Play video in viewer"
                          >
                            <video
                              src={resolveImageUrl(m.attachmentUrl)}
                              muted
                              playsInline
                              preload="metadata"
                              className="h-full w-full object-cover opacity-85"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/45 transition-colors">
                              <span className="flex size-11 items-center justify-center rounded-full bg-white/90 text-black shadow-lg">
                                <Play className="size-5 fill-current ml-0.5" />
                              </span>
                            </div>
                          </button>
                          {hasMeaningfulText && (
                            <div
                              className={cn(
                                "px-3.5 py-2 text-[13px] leading-snug break-words whitespace-pre-wrap rounded-2xl",
                                isMe ? "bg-[#0084FF] text-white" : "bg-[#242526] text-zinc-100"
                              )}
                            >
                              {m.message}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div
                          className={cn(
                            "px-3.5 py-2 text-[13px] leading-snug flex flex-col gap-1.5",
                            isMe
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
                          {m.message && (
                            <p className="whitespace-pre-wrap break-words">{m.message}</p>
                          )}

                          {m.attachmentUrl && (
                            <a
                              href={resolveImageUrl(m.attachmentUrl)}
                              download={m.attachmentName || "attachment"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(
                                "flex items-center gap-2 rounded-xl p-2 text-[11px] font-semibold transition-colors",
                                isMe
                                  ? "bg-black/20 hover:bg-black/30 text-white"
                                  : "bg-[#3A3B3C] hover:bg-[#4E4F50] text-zinc-100"
                              )}
                            >
                              <FileText className="size-4 shrink-0" />
                              <span className="truncate max-w-[165px]">{m.attachmentName || "Document"}</span>
                              <ExternalLink className="size-3 opacity-75 ml-auto shrink-0" />
                            </a>
                          )}
                        </div>
                      )}

                      {!nextSameSender && (
                        <div className="flex items-center gap-1 mt-0.5 px-1 text-[10px] text-zinc-500">
                          <span>
                            {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {isMe && (
                            m.readByStaff ? (
                              <CheckCheck className="size-3 text-[#0084FF]" />
                            ) : (
                              <Check className="size-3 text-zinc-500" />
                            )
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
            <div ref={bottomRef} />

            {showScrollBottomButton && (
              <button
                type="button"
                onClick={() => scrollToBottom(true)}
                className="sticky bottom-2 self-center z-20 flex items-center gap-1.5 rounded-full bg-[#242526] border border-zinc-700 text-zinc-100 px-3.5 py-1.5 text-xs font-semibold shadow-lg hover:bg-zinc-800 transition-colors cursor-pointer"
                aria-label="Scroll to newest messages"
              >
                <ChevronDown className="size-3.5 text-[#0084FF]" />
                <span>Latest messages</span>
              </button>
            )}
          </div>

          {uploading && (
            <div className="bg-[#242526] px-4 py-2 border-t border-zinc-800">
              <div className="flex items-center justify-between text-xs text-zinc-200 font-semibold mb-1">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="size-3.5 animate-spin text-[#0084FF]" /> Uploading attachment...
                </span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-[#0084FF] transition-all duration-300 rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {selectedFiles.length > 0 && !uploading && (
            <div className="flex flex-wrap gap-1.5 bg-[#242526] p-2.5 border-t border-zinc-800 max-h-24 overflow-y-auto">
              {selectedFiles.map((file, idx) => (
                <div
                  key={`${file.url}-${idx}`}
                  className="flex items-center gap-1.5 bg-[#3A3B3C] rounded-full px-3 py-1 text-[11px] text-zinc-100 max-w-[200px]"
                >
                  {file.type === "image" ? (
                    <ImageIcon className="size-3 text-[#4DA6FF] shrink-0" />
                  ) : file.type === "video" ? (
                    <Film className="size-3 text-[#4DA6FF] shrink-0" />
                  ) : (
                    <Paperclip className="size-3 text-[#4DA6FF] shrink-0" />
                  )}
                  <span className="truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    className="text-zinc-400 hover:text-rose-400 shrink-0 p-0.5 ml-0.5"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {session?.user && (
            <form
              onSubmit={handleSend}
              className="flex items-center gap-2 border-t border-zinc-800 p-2.5 bg-[#242526]"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                accept="image/*,video/*,application/pdf,.doc,.docx,.txt,.zip"
              />

              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-[#0084FF] hover:bg-zinc-700/50 transition-colors disabled:opacity-50"
                title="Attach photos, videos, or documents"
                aria-label="Attach files"
              >
                <Paperclip className="size-4.5" />
              </button>

              <div className="flex flex-1 items-center rounded-2xl bg-[#3A3B3C] px-3.5 py-1.5">
                <textarea
                  ref={textareaRef}
                  value={text}
                  rows={1}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Aa"
                  className="w-full resize-none bg-transparent text-[13px] text-zinc-100 placeholder:text-zinc-400 focus:outline-none min-h-[22px] max-h-[100px] leading-snug py-0.5"
                />
              </div>

              <button
                type="submit"
                disabled={sending || uploading || (!text.trim() && selectedFiles.length === 0)}
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-[#0084FF] hover:bg-zinc-700/50 transition-all disabled:opacity-35 cursor-pointer"
                aria-label="Send message"
              >
                {sending ? <Loader2 className="size-4.5 animate-spin" /> : <Send className="size-4.5" />}
              </button>
            </form>
          )}
        </div>
      )}

      <MediaLightbox
        items={lightboxItems}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />
    </div>
  )
}
