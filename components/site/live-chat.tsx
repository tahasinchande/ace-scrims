"use client"

import { useState, useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { sendChatMessage, getUserChatMessages } from "@/app/actions/chat"
import { useSession } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
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
} from "lucide-react"
import { resolveImageUrl } from "@/lib/image-url"
import { uploadMediaFile } from "@/lib/client-upload"
import { toast } from "sonner"
import type { ChatMessage } from "@/lib/db/schema"
import { useChatScroll } from "@/lib/hooks/use-chat-scroll"

type ChatThreadItem = ChatMessage & {
  senderImage?: string | null
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Smart Auto-Scroll Hook
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
    if (open && session?.user && !pathname?.startsWith("/botsito") && !pathname?.startsWith("/admin")) {
      setLoading(true)
      loadMessages().finally(() => setLoading(false))
      const interval = setInterval(loadMessages, 3500)
      return () => clearInterval(interval)
    }
  }, [open, session?.user, pathname])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [text])

  // Conditionally hide in admin panel to avoid overlapping admin controls
  if (pathname?.startsWith("/botsito") || pathname?.startsWith("/admin")) {
    return null
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    for (const file of files) {
      if (file.size > 50 * 1024 * 1024) {
        toast.error(`File "${file.name}" is over 50MB`)
        return
      }
    }

    setUploading(true)
    setUploadProgress(10)
    try {
      const newAttachments: Array<{ url: string; name: string; type: string }> = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const isImg = file.type.startsWith("image/")
        const res = await uploadMediaFile(file, "chat", (pct) => {
          const overallPct = Math.round(((i + pct / 100) / files.length) * 100)
          setUploadProgress(overallPct)
        })
        newAttachments.push({
          url: res.url,
          name: file.name,
          type: isImg ? "image" : "file",
        })
      }
      setSelectedFiles((prev) => [...prev, ...newAttachments])
      setUploadProgress(100)
      toast.success(`${files.length} attachment${files.length > 1 ? "s" : ""} ready to send`)
    } catch (err) {
      toast.error("Error uploading attachment: " + (err instanceof Error ? err.message : "Upload failed"))
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
        // First attachment gets the user's text message (if any)
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
      {/* Widget Trigger Button */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group relative flex items-center gap-2.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-black h-12 px-5 font-display font-bold uppercase tracking-wider text-xs shadow-xl shadow-orange-500/25 transition-all duration-200 hover:scale-105 active:scale-95 cursor-pointer border border-orange-400/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
          aria-label="Open Live Support Chat"
        >
          <div className="relative flex items-center justify-center">
            <MessageSquare className="size-4.5 transition-transform duration-300 group-hover:scale-110 text-black" />
            <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-emerald-400 border-2 border-black animate-pulse" />
          </div>
          <span>Live Support</span>
        </button>
      )}

      {/* Chat Dialog Window */}
      {open && (
        <div className="flex h-[600px] max-h-[85vh] w-[92vw] sm:w-[440px] md:w-[460px] flex-col rounded-3xl border border-zinc-800/80 bg-zinc-950/95 backdrop-blur-2xl shadow-2xl shadow-black/80 overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-bottom-5 duration-300">
          {/* Header - Modern Messenger Profile Bar */}
          <div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/90 px-4 py-3.5 backdrop-blur-md">
            <div className="flex items-center gap-3">
              {/* Official Brand Avatar with Active Status Dot */}
              <div className="relative flex size-10 items-center justify-center rounded-xl bg-zinc-900 border border-primary/40 p-1.5 shadow-md shadow-primary/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/icon.svg" alt="Ace Scrims" className="size-6 object-contain" />
                <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-500 border-2 border-zinc-950 ring-1 ring-emerald-400/40 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-display font-bold text-sm tracking-tight text-zinc-100">Ace Support</h3>
                  <span className="rounded-full bg-primary/15 border border-primary/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                    Official
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 flex items-center gap-1.5 mt-0.5">
                  <span className="size-1.5 rounded-full bg-emerald-400" />
                  Typically replies in minutes
                </p>
              </div>
            </div>

            <button
              onClick={() => setOpen(false)}
              className="rounded-full p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
              aria-label="Close support chat"
            >
              <X className="size-4.5" />
            </button>
          </div>

          {/* Body - Message Stream */}
          <div
            ref={containerRef}
            onScroll={handleScroll}
            className="relative flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-3 bg-zinc-950/60"
          >
            {!session?.user ? (
              <div className="my-auto flex flex-col items-center justify-center p-6 text-center gap-3.5">
                <div className="size-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
                  <User className="size-6 text-indigo-400" />
                </div>
                <div>
                  <h4 className="font-display text-sm font-bold text-zinc-100 uppercase tracking-wide">Sign In Required</h4>
                  <p className="text-xs text-zinc-400 mt-1 max-w-xs leading-relaxed">
                    Please sign in to your account to chat with our staff and send attachments.
                  </p>
                </div>
                <a
                  href="/sign-in"
                  className="inline-flex h-9.5 items-center justify-center rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-6 font-display text-xs font-bold uppercase tracking-wider text-white shadow-md shadow-indigo-500/25 hover:opacity-95 transition-opacity"
                >
                  Sign In
                </a>
              </div>
            ) : loading && messages.length === 0 ? (
              <div className="my-auto flex justify-center">
                <Loader2 className="size-7 animate-spin text-indigo-500" />
              </div>
            ) : messages.length === 0 ? (
              <div className="my-auto text-center text-xs text-zinc-400 leading-relaxed p-5 bg-zinc-900/60 rounded-3xl border border-zinc-800/60 max-w-xs mx-auto">
                <div className="size-9 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto mb-2.5">
                  <MessageSquare className="size-4" />
                </div>
                <p className="font-semibold text-zinc-200 mb-1">Welcome to Ace Support!</p>
                <p className="text-zinc-400 text-[11px]">
                  How can we help you today? Send a message or proof screenshot to connect with our team.
                </p>
              </div>
            ) : (
              messages.map((m) => {
                const isMe = m.senderId === session.user.id
                const isStaff = m.senderRole === "admin" || m.senderRole === "moderator"
                const isImageAttachment =
                  m.attachmentType === "image" ||
                  (Boolean(m.attachmentUrl) && /\.(png|jpe?g|webp|gif|svg)$/i.test(m.attachmentUrl || ""))
                const hasText = Boolean(m.message && m.message.trim())

                return (
                  <div
                    key={m.id}
                    className={`flex flex-col max-w-[85%] sm:max-w-[80%] ${isMe ? "self-end items-end" : "self-start items-start"}`}
                  >
                    {!isMe && (
                      <div className="flex items-center gap-1.5 mb-1 px-1.5 text-[10px] text-zinc-400">
                        {m.senderImage && !failedSenderAvatars[m.id] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={resolveImageUrl(m.senderImage)}
                            alt={`${m.senderName}'s avatar`}
                            onError={() => setFailedSenderAvatars((prev) => ({ ...prev, [m.id]: true }))}
                            className="size-4 rounded-full object-cover border border-zinc-700/60"
                          />
                        ) : isStaff ? (
                          <span className="flex size-4 items-center justify-center rounded-full bg-primary/20 p-0.5 border border-primary/40">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/icon.svg" alt="Staff" className="size-3 object-contain" />
                          </span>
                        ) : (
                          <span className="flex size-4 items-center justify-center rounded-full bg-zinc-800 text-[8px] font-bold text-zinc-300">
                            {m.senderName ? m.senderName.slice(0, 1).toUpperCase() : "S"}
                          </span>
                        )}
                        <span className="font-semibold text-zinc-300">{m.senderName}</span>
                        {isStaff && (
                          <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.2 rounded-full font-bold uppercase text-[8.5px] tracking-wider">
                            Staff
                          </span>
                        )}
                      </div>
                    )}

                    {isImageAttachment ? (
                      /* Seamless Edge-to-Edge Image Bubble */
                      <div
                        className={`flex flex-col w-full max-w-xs sm:max-w-sm overflow-hidden shadow-lg transition-all ${
                          isMe
                            ? hasText
                              ? "rounded-2xl sm:rounded-3xl rounded-br-[4px] bg-gradient-to-tr from-indigo-600 via-indigo-600 to-purple-600 text-white shadow-indigo-500/10"
                              : "rounded-2xl sm:rounded-3xl rounded-br-[4px]"
                            : hasText
                            ? "rounded-2xl sm:rounded-3xl rounded-bl-[4px] bg-zinc-850 text-zinc-100 border border-zinc-750"
                            : "rounded-2xl sm:rounded-3xl rounded-bl-[4px] border border-zinc-800/80"
                        }`}
                      >
                        <a
                          href={resolveImageUrl(m.attachmentUrl!)}
                          target="_blank"
                          rel="noreferrer"
                          className="group relative block overflow-hidden bg-black/50"
                          title="Click to view full resolution image"
                        >
                          <img
                            src={resolveImageUrl(m.attachmentUrl!)}
                            alt="Attachment"
                            className="w-full max-h-72 sm:max-h-80 object-cover block transition-transform duration-300 group-hover:scale-105"
                            loading="lazy"
                          />
                        </a>

                        {hasText && (
                          <div className="px-4 py-2.5 text-xs leading-relaxed break-words whitespace-pre-wrap font-normal">
                            {m.message}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Messenger Style Text & Document Bubble */
                      <div
                        className={`px-4 py-2.5 text-xs leading-relaxed flex flex-col gap-2 shadow-md transition-all ${
                          isMe
                            ? "rounded-2xl sm:rounded-3xl rounded-br-[4px] bg-gradient-to-tr from-indigo-600 via-indigo-600 to-purple-600 text-white font-normal shadow-indigo-500/15"
                            : "rounded-2xl sm:rounded-3xl rounded-bl-[4px] bg-zinc-800/90 text-zinc-100 border border-zinc-700/50"
                        }`}
                      >
                        {m.message && (
                          <p className="whitespace-pre-wrap break-words break-all text-xs leading-relaxed max-w-full">
                            {m.message}
                          </p>
                        )}

                        {m.attachmentUrl && (
                          <div className="mt-0.5">
                            <a
                              href={resolveImageUrl(m.attachmentUrl)}
                              target="_blank"
                              rel="noreferrer"
                              className={`flex items-center gap-2 rounded-2xl p-2.5 text-[11px] font-semibold transition-colors ${
                                isMe
                                  ? "bg-black/20 hover:bg-black/30 text-white border border-white/10"
                                  : "bg-zinc-900/80 hover:bg-zinc-900 text-zinc-200 border border-zinc-700/60"
                              }`}
                            >
                              <FileText className={`size-4 shrink-0 ${isMe ? "text-white" : "text-indigo-400"}`} />
                              <span className="truncate max-w-[180px]">{m.attachmentName || "Attached Document"}</span>
                              <ExternalLink className="size-3 opacity-70 ml-auto shrink-0" />
                            </a>
                          </div>
                        )}
                      </div>
                    )}

                    <span className="text-[9.5px] text-zinc-500 mt-1 px-1.5">
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                )
              })
            )}
            <div ref={bottomRef} />

            {/* Floating Jump to Bottom Button */}
            {showScrollBottomButton && (
              <button
                type="button"
                onClick={() => scrollToBottom(true)}
                className="sticky bottom-2 self-center z-20 flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-3.5 py-1.5 text-xs font-semibold shadow-lg shadow-indigo-500/25 hover:opacity-95 transition-all duration-200 animate-in fade-in zoom-in-90 cursor-pointer"
                aria-label="Scroll to newest messages"
              >
                <ChevronDown className="size-3.5" />
                <span>New messages below</span>
              </button>
            )}
          </div>

          {/* Uploading progress bar */}
          {uploading && (
            <div className="bg-indigo-950/40 px-4 py-2 border-t border-indigo-500/20 backdrop-blur-sm">
              <div className="flex items-center justify-between text-xs text-indigo-300 font-semibold mb-1">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="size-3.5 animate-spin text-indigo-400" /> Uploading attachment...
                </span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300 rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Pending Attachments List */}
          {selectedFiles.length > 0 && !uploading && (
            <div className="flex flex-wrap gap-1.5 bg-zinc-900/90 p-2.5 border-t border-zinc-800/80 max-h-24 overflow-y-auto">
              {selectedFiles.map((file, idx) => (
                <div
                  key={`${file.url}-${idx}`}
                  className="flex items-center gap-1.5 bg-zinc-800/90 border border-zinc-700/60 rounded-full px-3 py-1 text-[11px] text-zinc-200 max-w-[200px]"
                >
                  {file.type === "image" ? (
                    <ImageIcon className="size-3 text-indigo-400 shrink-0" />
                  ) : (
                    <Paperclip className="size-3 text-indigo-400 shrink-0" />
                  )}
                  <span className="truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    className="text-zinc-400 hover:text-rose-400 shrink-0 p-0.5 ml-0.5 transition-colors"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Modern Messenger Input Area with Pill-Shape */}
          {session?.user && (
            <form
              onSubmit={handleSend}
              className="flex items-center gap-2 border-t border-zinc-800/80 p-3 bg-zinc-900/95 backdrop-blur-md"
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                accept="image/*,application/pdf,.doc,.docx,.txt,.zip"
              />

              {/* Pill Container for Attach Button + Textarea */}
              <div className="flex flex-1 items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/80 px-3 py-1.5 transition-all focus-within:border-indigo-500/70 focus-within:ring-2 focus-within:ring-indigo-500/20">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-indigo-400 transition-colors disabled:opacity-50"
                  title="Attach multiple images or documents (up to 50MB each)"
                  aria-label="Attach files"
                >
                  <Paperclip className="size-4" />
                </button>

                <textarea
                  ref={textareaRef}
                  value={text}
                  rows={1}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
                  className="flex-1 resize-none bg-transparent text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none min-h-[22px] max-h-[100px] leading-relaxed py-1"
                />
              </div>

              {/* Send Button as Sleek Circular Pill */}
              <button
                type="submit"
                disabled={sending || uploading || (!text.trim() && selectedFiles.length === 0)}
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 via-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/25 transition-all duration-200 hover:scale-105 hover:shadow-indigo-500/40 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 disabled:shadow-none cursor-pointer"
                aria-label="Send message"
              >
                {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4 -translate-x-0.5 translate-y-0.5" />}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
