"use client"

import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { usePathname } from "next/navigation"
import { useSession } from "@/lib/auth-client"
import { useLanguage } from "@/lib/language"
import {
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
  Bot,
  ShieldAlert,
  Headset,
  Sparkles,
  AlertCircle,
} from "lucide-react"
import { resolveImageUrl } from "@/lib/image-url"
import {
  isNonOwnerStaffRole,
  isOwnerRole,
  RUSHX_SUPPORT_AVATAR,
  RUSHX_SUPPORT_NAME,
} from "@/lib/roles"
import { uploadMediaFile } from "@/lib/client-upload"
import { toast } from "sonner"
import type { ChatMessage } from "@/lib/db/schema"
import { useChatScroll } from "@/lib/hooks/use-chat-scroll"
import { MediaLightbox, type MediaLightboxItem } from "@/components/chat/media-lightbox"
import { LiveSupportButton } from "@/components/site/live-support-button"
import { cn } from "@/lib/utils"
import {
  applyReactionToggle,
  type ChatReactionEmoji,
  type ChatReactionsMap,
  type ChatReplyPreview,
} from "@/lib/chat-types"
import {
  ComposerReplyBar,
  MessageActionBar,
  QuotedReplyChip,
  ReactionPills,
  SwipeableReplyRow,
} from "@/components/chat/messenger-interactions"

type ChatThreadItem = ChatMessage & {
  senderImage?: string | null
  reactionsMap?: ChatReactionsMap
  replyTo?: ChatReplyPreview | null
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
  const { data: session, isPending: sessionPending } = useSession()
  const { lang, t } = useLanguage()

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatThreadItem[]>([])
  const [chatMode, setChatMode] = useState<"ai" | "human">("ai")
  const [isBanned, setIsBanned] = useState(false)
  const [escalating, setEscalating] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  const [text, setText] = useState("")
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [loading, setLoading] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<Array<{ url: string; name: string; type: string }>>([])
  const [failedSenderAvatars, setFailedSenderAvatars] = useState<Record<string, boolean>>({})
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [replyingTo, setReplyingTo] = useState<ChatThreadItem | null>(null)
  const [openPickerId, setOpenPickerId] = useState<string | null>(null)
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const mutationEpochRef = useRef(0)

  const {
    containerRef,
    bottomRef,
    handleScroll,
    scrollToBottom,
    notifyUserSentMessage,
    showScrollBottomButton,
  } = useChatScroll({
    dependency: messages,
    enabled: open && Boolean(session?.user) && !isBanned,
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

  const applyChatState = useCallback(
    (state: { messages?: ChatThreadItem[]; mode?: "ai" | "human"; banned?: boolean } | null | undefined) => {
      if (!state) return
      if (Array.isArray(state.messages)) {
        setMessages(state.messages)
      }
      if (state.mode === "human" || state.mode === "ai") {
        setChatMode(state.mode)
      }
      if (typeof state.banned === "boolean") {
        setIsBanned(state.banned)
      }
    },
    [],
  )

  const sessionUserId = session?.user?.id ?? null

  const loadChatState = useCallback(async () => {
    if (!sessionUserId) return
    const pollEpoch = mutationEpochRef.current
    try {
      const res = await fetch("/api/chat", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      })
      if (!res.ok) return
      const data = await res.json().catch(() => null)
      // Drop stale poll responses if a send/reaction/escalation started while this poll was in flight
      if (pollEpoch !== mutationEpochRef.current) return
      if (data?.ok) {
        applyChatState(data)
      }
    } catch {
      // Silent retry on next poll interval
    }
  }, [sessionUserId, applyChatState])

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
    if (open && sessionUserId && !pathname?.startsWith("/admin")) {
      setLoading(true)
      loadChatState().finally(() => setLoading(false))
      const interval = setInterval(loadChatState, 3500)
      return () => clearInterval(interval)
    }
  }, [open, sessionUserId, pathname, loadChatState])

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
    if (isBanned) return
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    for (const file of files) {
      if (file.size > 100 * 1024 * 1024) {
        toast.error(
          lang === "bn"
            ? `"${file.name}" ১০০MB সীমার চেয়ে বড়`
            : `File "${file.name}" exceeds the 100MB attachment limit`
        )
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
      toast.success(
        lang === "bn"
          ? `${files.length}টি ফাইল পাঠানোর জন্য প্রস্তুত`
          : `${files.length} attachment${files.length > 1 ? "s" : ""} ready to send`
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : lang === "bn" ? "আপলোড ব্যর্থ হয়েছে" : "Upload failed")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  function removeAttachment(indexToRemove: number) {
    setSelectedFiles((prev) => prev.filter((_, idx) => idx !== indexToRemove))
  }

  async function handleEscalateToHuman() {
    if (!session?.user || isBanned || escalating || chatMode === "human") return
    setEscalating(true)
    setSendError(null)
    try {
      const res = await fetch("/api/chat/escalate", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok) {
        setChatMode("human")
        if (data.state) {
          applyChatState(data.state)
        } else {
          await loadChatState()
        }
        toast.success(
          lang === "bn"
            ? "হিউম্যান এজেন্টের সাথে সংযুক্ত করা হয়েছে"
            : "Connected to Human Agent queue"
        )
      } else {
        const errMsg =
          data?.error || (lang === "bn" ? "সংযোগ করা যায়নি" : "Failed to connect to human agent")
        setSendError(errMsg)
        toast.error(errMsg)
      }
    } catch (err) {
      const errMsg =
        err instanceof Error
          ? err.message
          : lang === "bn"
            ? "সংযোগ করা যায়নি"
            : "Failed to connect to human agent"
      setSendError(errMsg)
      toast.error(errMsg)
    } finally {
      setEscalating(false)
    }
  }

  function triggerReply(msg: ChatThreadItem) {
    setReplyingTo(msg)
    setOpenPickerId(null)
    requestAnimationFrame(() => {
      textareaRef.current?.focus()
    })
  }

  function jumpToMessage(targetId: string) {
    const container = containerRef.current
    if (!container) return
    const el = container.querySelector(`[data-msg-id="${CSS.escape(targetId)}"]`) as HTMLElement | null
    if (!el) return
    el.scrollIntoView({ behavior: "smooth", block: "center" })
    setHighlightedMsgId(targetId)
    window.setTimeout(() => {
      setHighlightedMsgId((prev) => (prev === targetId ? null : prev))
    }, 1500)
  }

  async function handleToggleReaction(messageId: string, emoji: ChatReactionEmoji) {
    if (!session?.user || isBanned) return
    mutationEpochRef.current += 1
    const actor = {
      userId: session.user.id,
      userName: session.user.name || "Player",
    }

    // Optimistic update
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? { ...m, reactionsMap: applyReactionToggle(m.reactionsMap || {}, emoji, actor) }
          : m,
      ),
    )

    try {
      const res = await fetch("/api/chat/react", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ messageId, emoji }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok && data.reactions) {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, reactionsMap: data.reactions } : m)),
        )
      } else {
        await loadChatState()
      }
    } catch {
      await loadChatState()
    }
  }

  async function postSingleChatPayload(payload: {
    message: string
    attachmentUrl?: string
    attachmentType?: string
    attachmentName?: string
    replyToId?: string
  }) {
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), 20000)
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => null)
      return { status: res.status, ok: res.ok && Boolean(data?.ok), data }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return {
          status: 408,
          ok: false,
          data: {
            ok: false,
            error:
              lang === "bn"
                ? "রিকোয়েস্ট টাইমআউট হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।"
                : "Request timed out. Please try sending your message again.",
          },
        }
      }
      throw err
    } finally {
      window.clearTimeout(timeoutId)
    }
  }

  async function handleSend(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (isBanned || sending) return
    if (!text.trim() && selectedFiles.length === 0) return
    if (!session?.user) {
      toast.error(lang === "bn" ? "সাপোর্টে মেসেজ দিতে সাইন ইন করুন" : "Please sign in to send messages to support")
      return
    }

    const msgText = text.trim()
    const filesToSend = [...selectedFiles]
    const activeReply = replyingTo
    const activeReplyId = activeReply?.id
    mutationEpochRef.current += 1
    setSendError(null)
    setSending(true)
    let optimisticId: string | null = null

    try {
      if (filesToSend.length === 0) {
        optimisticId = `optimistic-${Date.now()}`
        const optimisticMsg: ChatThreadItem = {
          id: optimisticId,
          userId: session.user.id,
          senderId: session.user.id,
          senderName: session.user.name || "You",
          senderRole: "user",
          message: msgText,
          attachmentUrl: null,
          attachmentType: null,
          attachmentName: null,
          replyToId: activeReplyId ?? null,
          reactions: null,
          reactionsMap: {},
          replyTo: activeReply
            ? {
                id: activeReply.id,
                senderName: activeReply.senderName,
                senderRole: activeReply.senderRole,
                message: activeReply.message,
                attachmentType: activeReply.attachmentType ?? null,
              }
            : null,
          readByStaff: false,
          readByUser: true,
          createdAt: new Date(),
        }

        setMessages((prev) => [...prev, optimisticMsg])
        setText("")
        setReplyingTo(null)
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto"
        }
        notifyUserSentMessage()

        const { ok, data } = await postSingleChatPayload({
          message: msgText,
          replyToId: activeReplyId,
        })
        if (data?.banned) {
          setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
          setIsBanned(true)
          toast.error(data.error || t("chat_banned_title"))
        } else if (!ok) {
          setMessages((prev) => prev.filter((m) => m.id !== optimisticId))
          setText(msgText)
          if (activeReply) setReplyingTo(activeReply)
          const errMsg = data?.error || (lang === "bn" ? "মেসেজ পাঠানো যায়নি" : "Failed to send message")
          setSendError(errMsg)
          toast.error(errMsg)
          return
        } else {
          if (data?.state) {
            applyChatState(data.state)
          } else {
            await loadChatState()
          }
          notifyUserSentMessage()
        }
      } else {
        const unsentFiles: Array<{ url: string; name: string; type: string }> = []
        let latestState: { messages?: ChatThreadItem[]; mode?: "ai" | "human"; banned?: boolean } | null = null
        let firstError: string | null = null
        let textConsumed = false

        for (let i = 0; i < filesToSend.length; i++) {
          const f = filesToSend[i]
          const currentText = !textConsumed ? msgText : ""
          const { ok, data } = await postSingleChatPayload({
            message: currentText,
            attachmentUrl: f.url,
            attachmentType: f.type,
            attachmentName: f.name,
            replyToId: i === 0 ? activeReplyId : undefined,
          })

          if (data?.banned) {
            setIsBanned(true)
            setText("")
            setSelectedFiles([])
            setReplyingTo(null)
            toast.error(data.error || t("chat_banned_title"))
            return
          } else if (!ok) {
            firstError =
              firstError ||
              data?.error ||
              (lang === "bn" ? "অ্যাটাচমেন্ট পাঠানো যায়নি" : "Failed to send attachment")
            unsentFiles.push(f)
          } else {
            if (currentText) textConsumed = true
            if (data?.state) latestState = data.state
          }
        }

        if (textConsumed) {
          setText("")
          if (textareaRef.current) {
            textareaRef.current.style.height = "auto"
          }
        }
        setReplyingTo(null)
        setSelectedFiles(unsentFiles)

        if (firstError) {
          setSendError(firstError)
          toast.error(firstError)
        }

        if (latestState) {
          applyChatState(latestState)
        } else {
          await loadChatState()
        }
        notifyUserSentMessage()
      }
    } catch (err) {
      if (optimisticId) {
        const failedId = optimisticId
        setMessages((prev) => prev.filter((m) => m.id !== failedId))
        setText(msgText)
        if (activeReply) setReplyingTo(activeReply)
      }
      const errMsg =
        err instanceof Error
          ? err.message
          : lang === "bn"
            ? "মেসেজ পাঠাতে ত্রুটি হয়েছে"
            : "Error sending message. Please check your connection and try again."
      setSendError(errMsg)
      toast.error(errMsg)
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
        <LiveSupportButton
          variant="floating"
          onClick={(e) => {
            e.preventDefault()
            setOpen(true)
          }}
          label={t("chat_live_support", "Live Support")}
          aria-label={t("chat_live_support", "Live Support")}
        />
      )}

      {open && (
        <div
          onClick={() => openPickerId && setOpenPickerId(null)}
          className="glass-strong flex h-[640px] max-h-[88vh] w-[92vw] sm:w-[420px] flex-col rounded-2xl border border-sky-400/20 shadow-2xl shadow-black/85 overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-200"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.08] bg-[#0b1124]/95 px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-sky-500/12 border border-sky-400/35 p-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/brand/rushx-symbol.png"
                  alt="RushX Organization"
                  className="size-7 object-contain"
                />
                <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-400 border-2 border-[#0b1124]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="font-display font-bold text-sm tracking-tight text-white">
                    {t("chat_title", "RushX Support")}
                  </h3>
                  <span className="rounded-md bg-sky-500/18 border border-sky-400/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-200">
                    {chatMode === "human"
                      ? t("chat_mode_human", "Human Support Agent")
                      : t("chat_mode_ai", "RushX AI Support")}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">
                  {chatMode === "human"
                    ? t("chat_status_human", "Connected to Human Support · Live Queue")
                    : t("chat_status_ai", "AI Assistant Active · Instant Answers")}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-2 text-slate-400 hover:bg-white/[0.08] hover:text-white transition-colors shrink-0 cursor-pointer"
              aria-label={lang === "bn" ? "চ্যাট বন্ধ করুন" : "Close support chat"}
            >
              <X className="size-4.5" />
            </button>
          </div>

          {/* Safety Policy Disclaimer & Escalation Bar */}
          {session?.user && !isBanned && (
            <div className="flex flex-col gap-1.5 border-b border-white/[0.08] bg-[#0a0e20]/95 px-3.5 py-2">
              <div className="flex items-start gap-2 text-[10.5px] leading-snug text-amber-300/90">
                <ShieldAlert className="size-3.5 shrink-0 mt-0.5 text-amber-400" />
                <span>{t("chat_disclaimer")}</span>
              </div>
              <div className="flex items-center justify-between gap-2 pt-0.5">
                {chatMode === "ai" ? (
                  <button
                    type="button"
                    disabled={escalating}
                    onClick={handleEscalateToHuman}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500/25 transition-colors disabled:opacity-60 cursor-pointer"
                  >
                    {escalating ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Headset className="size-3" />
                    )}
                    <span>{escalating ? t("chat_escalating") : t("chat_talk_to_human")}</span>
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-2.5 py-1 text-[11px] font-bold text-cyan-200">
                    <Headset className="size-3" />
                    <span>{t("chat_escalated_badge")}</span>
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Thread Body */}
          <div
            ref={containerRef}
            onScroll={handleScroll}
            className="relative flex-1 min-h-0 overflow-y-auto px-3.5 py-4 flex flex-col gap-1.5 bg-[#070a17]"
          >
            {sessionPending ? (
              <div className="my-auto flex flex-col items-center justify-center gap-2 p-6 text-center">
                <Loader2 className="size-7 animate-spin text-sky-400" />
                <p className="text-xs text-slate-400">
                  {lang === "bn" ? "সেশন যাচাই হচ্ছে..." : "Checking your session..."}
                </p>
              </div>
            ) : !session?.user ? (
              <div className="my-auto flex flex-col items-center justify-center p-6 text-center gap-3.5">
                <div className="size-12 rounded-full bg-sky-500/15 border border-sky-400/30 flex items-center justify-center text-sky-300">
                  <User className="size-6" />
                </div>
                <div>
                  <h4 className="font-display text-sm font-bold text-white uppercase tracking-wide">
                    {t("chat_signin_title", "Sign In Required")}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                    {t("chat_signin_sub")}
                  </p>
                </div>
                <a
                  href="/sign-in"
                  className="rushx-primary-btn rushx-btn-splash inline-flex h-9 items-center justify-center rounded-full px-6 font-display text-xs font-bold uppercase tracking-wider text-white transition-all"
                >
                  {t("nav_signin", "Sign In")}
                </a>
              </div>
            ) : isBanned ? (
              <div className="my-auto flex flex-col items-center justify-center p-6 text-center gap-3.5 rounded-2xl border border-rose-500/30 bg-rose-950/25 mx-2">
                <div className="size-12 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                  <ShieldAlert className="size-6" />
                </div>
                <div>
                  <h4 className="font-display text-sm font-bold text-rose-300 uppercase tracking-wide">
                    {t("chat_banned_title")}
                  </h4>
                  <p className="text-xs text-slate-300 mt-1.5 max-w-xs leading-relaxed">
                    {t("chat_banned_sub")}
                  </p>
                </div>
              </div>
            ) : loading && messages.length === 0 ? (
              <div className="my-auto flex justify-center">
                <Loader2 className="size-7 animate-spin text-sky-400" />
              </div>
            ) : messages.length === 0 ? (
              <div className="my-auto text-center text-xs text-slate-400 leading-relaxed p-5 dc-surface rounded-2xl max-w-xs mx-auto">
                <div className="size-10 rounded-full bg-sky-500/15 text-sky-300 flex items-center justify-center mx-auto mb-2.5">
                  <Sparkles className="size-5" />
                </div>
                <p className="font-semibold text-white mb-1">{t("chat_welcome_title")}</p>
                <p className="text-slate-400 text-[11px]">{t("chat_welcome_sub")}</p>
              </div>
            ) : (
              messages.map((m, idx) => {
                if (m.senderRole === "system") {
                  return (
                    <div key={m.id} className="my-2 flex justify-center px-2">
                      <div className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700/70 bg-zinc-800/80 px-3 py-1 text-[10.5px] text-zinc-300 text-center max-w-[92%]">
                        <ShieldAlert className="size-3 shrink-0 text-amber-400" />
                        <span>{m.message}</span>
                      </div>
                    </div>
                  )
                }

                const isMe = m.senderId === session.user.id
                const prevSameSender =
                  idx > 0 &&
                  messages[idx - 1].senderId === m.senderId &&
                  messages[idx - 1].senderRole === m.senderRole
                const nextSameSender =
                  idx < messages.length - 1 &&
                  messages[idx + 1].senderId === m.senderId &&
                  messages[idx + 1].senderRole === m.senderRole
                const isAi = m.senderRole === "ai"
                const isOwner = isOwnerRole(m.senderRole)
                const isNonOwnerStaff = isNonOwnerStaffRole(m.senderRole)
                const mediaKind = isMediaType(m)
                const isDefaultCaption =
                  m.message === "📷 Photo" ||
                  m.message === "Photo attachment" ||
                  m.message === "📷 Image attachment" ||
                  m.message === "🎬 Video" ||
                  m.message === "Video attachment" ||
                  m.message === "📄 File attachment" ||
                  m.message === "File attachment"
                const hasMeaningfulText = Boolean(m.message && m.message.trim() && !(mediaKind && isDefaultCaption))

                return (
                  <SwipeableReplyRow
                    key={m.id}
                    messageId={m.id}
                    alignRight={isMe}
                    highlighted={highlightedMsgId === m.id}
                    onTriggerReply={() => triggerReply(m)}
                  >
                    <div
                      className={cn(
                        "group/msg flex items-end gap-1.5 max-w-[92%]",
                        isMe ? "flex-row-reverse" : "flex-row",
                        !prevSameSender ? "mt-2" : "mt-0.5",
                      )}
                    >
                      {!isMe && (
                        <div className="w-7 shrink-0">
                          {!nextSameSender &&
                            (isAi ? (
                              <span className="flex size-7 items-center justify-center rounded-full bg-sky-500/20 border border-sky-400/40 text-sky-300">
                                <Bot className="size-4" />
                              </span>
                            ) : isNonOwnerStaff ? (
                              <span className="flex size-7 items-center justify-center rounded-full bg-[#101830] p-1 border border-sky-400/35">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={RUSHX_SUPPORT_AVATAR}
                                  alt={RUSHX_SUPPORT_NAME}
                                  className="size-4 object-contain"
                                />
                              </span>
                            ) : m.senderImage && !failedSenderAvatars[m.id] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={resolveImageUrl(m.senderImage)}
                                alt={m.senderName}
                                onError={() => setFailedSenderAvatars((prev) => ({ ...prev, [m.id]: true }))}
                                className="size-7 rounded-full object-cover border border-zinc-700"
                              />
                            ) : (
                              <span className="flex size-7 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-slate-200 border border-white/10">
                                {(m.senderName || "R").slice(0, 1).toUpperCase()}
                              </span>
                            ))}
                        </div>
                      )}

                      <div className={cn("flex flex-col min-w-0", isMe ? "items-end" : "items-start")}>
                        {!isMe && !prevSameSender && (
                          <span className="text-[10px] text-slate-400 px-2 mb-0.5 font-medium">
                            {isAi
                              ? `${m.senderName} · ${t("chat_ai_badge")}`
                              : isOwner
                                ? m.senderName
                                : isNonOwnerStaff
                                  ? RUSHX_SUPPORT_NAME
                                  : m.senderName}
                          </span>
                        )}

                        {m.replyTo && (
                          <QuotedReplyChip
                            replyTo={m.replyTo}
                            alignRight={isMe}
                            lang={lang}
                            onJumpToMessage={jumpToMessage}
                          />
                        )}

                        <div className={cn("flex items-center gap-1", isMe ? "flex-row-reverse" : "flex-row")}>
                          <div className={cn("flex flex-col", isMe ? "items-end" : "items-start")}>
                            {mediaKind === "image" && m.attachmentUrl ? (
                              <div className="flex flex-col gap-1">
                                <button
                                  type="button"
                                  onClick={() => openMediaInLightbox(m.attachmentUrl!)}
                                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                                  title={lang === "bn" ? "ছবি বড় করে দেখুন" : "Open photo"}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={resolveImageUrl(m.attachmentUrl)}
                                    alt={m.attachmentName || "Shared photo"}
                                    className="max-h-64 w-auto max-w-[240px] object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                                    loading="lazy"
                                  />
                                </button>
                                {hasMeaningfulText && (
                                  <div
                                    className={cn(
                                      "px-3.5 py-2 text-[13px] leading-snug break-words whitespace-pre-wrap rounded-2xl",
                                      isMe
                                        ? "bg-gradient-to-r from-[#2563eb] to-[#0ea5e9] text-white"
                                        : "bg-[#121933] text-slate-100 border border-white/[0.06]",
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
                                  className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black cursor-pointer w-[230px] aspect-video focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                                  title={lang === "bn" ? "ভিডিও দেখুন" : "Play video in viewer"}
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
                                      isMe
                                        ? "bg-gradient-to-r from-[#2563eb] to-[#0ea5e9] text-white"
                                        : "bg-[#121933] text-slate-100 border border-white/[0.06]",
                                    )}
                                  >
                                    {m.message}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div
                                className={cn(
                                  "px-3.5 py-2 text-[13px] leading-snug flex flex-col gap-1.5 max-w-[265px]",
                                  isMe
                                    ? cn(
                                        "bg-gradient-to-r from-[#2563eb] to-[#0ea5e9] text-white rounded-2xl shadow-sm shadow-blue-600/20",
                                        prevSameSender && "rounded-tr-md",
                                        nextSameSender && "rounded-br-md",
                                      )
                                    : isAi
                                      ? cn(
                                          "bg-sky-950/50 border border-sky-500/30 text-slate-100 rounded-2xl",
                                          prevSameSender && "rounded-tl-md",
                                          nextSameSender && "rounded-bl-md",
                                        )
                                      : cn(
                                          "bg-[#121933] border border-white/[0.07] text-slate-100 rounded-2xl",
                                          prevSameSender && "rounded-tl-md",
                                          nextSameSender && "rounded-bl-md",
                                        ),
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
                                        : "bg-white/[0.06] hover:bg-white/[0.12] text-slate-100",
                                    )}
                                  >
                                    <FileText className="size-4 shrink-0" />
                                    <span className="truncate max-w-[160px]">{m.attachmentName || "Document"}</span>
                                    <ExternalLink className="size-3 opacity-75 ml-auto shrink-0" />
                                  </a>
                                )}
                              </div>
                            )}

                            <ReactionPills
                              reactions={m.reactionsMap}
                              currentUserId={session.user.id}
                              alignRight={isMe}
                              onToggleEmoji={(emoji) => handleToggleReaction(m.id, emoji)}
                            />
                          </div>

                          <MessageActionBar
                            messageId={m.id}
                            alignRight={isMe}
                            pickerOpen={openPickerId === m.id}
                            onTogglePicker={setOpenPickerId}
                            onSelectEmoji={(emoji) => handleToggleReaction(m.id, emoji)}
                            onReply={() => triggerReply(m)}
                            lang={lang}
                          />
                        </div>

                        {!nextSameSender && (
                          <div className="flex items-center gap-1 mt-0.5 px-1 text-[10px] text-slate-500">
                            <span>
                              {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                            {isMe &&
                              (m.readByStaff ? (
                                <CheckCheck className="size-3 text-sky-400" />
                              ) : (
                                <Check className="size-3 text-slate-500" />
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </SwipeableReplyRow>
                )
              })
            )}
            <div ref={bottomRef} />

            {showScrollBottomButton && !isBanned && (
              <button
                type="button"
                onClick={() => scrollToBottom(true)}
                className="sticky bottom-2 self-center z-20 flex items-center gap-1.5 rounded-full bg-[#101834] border border-sky-400/25 text-slate-100 px-3.5 py-1.5 text-xs font-semibold shadow-lg hover:bg-[#16224a] transition-colors cursor-pointer"
                aria-label={t("chat_latest_messages")}
              >
                <ChevronDown className="size-3.5 text-sky-300" />
                <span>{t("chat_latest_messages")}</span>
              </button>
            )}
          </div>

          {uploading && !isBanned && (
            <div className="bg-[#0b1124] px-4 py-2 border-t border-white/[0.08]">
              <div className="flex items-center justify-between text-xs text-slate-200 font-semibold mb-1">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="size-3.5 animate-spin text-sky-400" /> {t("chat_uploading_attachment")}
                </span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#2563eb] to-[#38bdf8] transition-all duration-300 rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {selectedFiles.length > 0 && !uploading && !isBanned && (
            <div className="flex flex-wrap gap-1.5 bg-[#0b1124] p-2.5 border-t border-white/[0.08] max-h-24 overflow-y-auto">
              {selectedFiles.map((file, idx) => (
                <div
                  key={`${file.url}-${idx}`}
                  className="flex items-center gap-1.5 bg-[#121d3e] border border-sky-400/20 rounded-full px-3 py-1 text-[11px] text-slate-100 max-w-[200px]"
                >
                  {file.type === "image" ? (
                    <ImageIcon className="size-3 text-sky-300 shrink-0" />
                  ) : file.type === "video" ? (
                    <Film className="size-3 text-sky-300 shrink-0" />
                  ) : (
                    <Paperclip className="size-3 text-sky-300 shrink-0" />
                  )}
                  <span className="truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    className="text-slate-400 hover:text-rose-400 shrink-0 p-0.5 ml-0.5"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {sendError && !isBanned && (
            <div className="flex items-start justify-between gap-2 border-t border-rose-500/30 bg-rose-950/40 px-3.5 py-2 text-[11px] text-rose-200">
              <div className="flex items-start gap-2 min-w-0">
                <AlertCircle className="size-3.5 shrink-0 mt-0.5 text-rose-400" />
                <span className="break-words">{sendError}</span>
              </div>
              <button
                type="button"
                onClick={() => setSendError(null)}
                className="shrink-0 text-rose-300 hover:text-white p-0.5"
                aria-label="Dismiss error"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}

          {replyingTo && session?.user && !isBanned && (
            <ComposerReplyBar
              replyTarget={replyingTo}
              lang={lang}
              onClear={() => setReplyingTo(null)}
            />
          )}

          {session?.user && !isBanned && (
            <form
              onSubmit={handleSend}
              className="flex items-center gap-2 border-t border-white/[0.08] p-2.5 bg-[#0b1124]"
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
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-sky-300 hover:bg-sky-500/15 transition-colors disabled:opacity-50 cursor-pointer"
                title={lang === "bn" ? "ছবি, ভিডিও বা ফাইল যুক্ত করুন" : "Attach photos, videos, or documents"}
                aria-label={lang === "bn" ? "ফাইল যুক্ত করুন" : "Attach files"}
              >
                <Paperclip className="size-4.5" />
              </button>

              <div className="flex flex-1 items-center rounded-2xl bg-[#121a35] border border-white/[0.08] px-3.5 py-1.5">
                <textarea
                  ref={textareaRef}
                  value={text}
                  rows={1}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t("chat_composer_placeholder", "Ask a question or write a message...")}
                  className="w-full resize-none bg-transparent text-[13px] text-slate-100 placeholder:text-slate-400 focus:outline-none min-h-[22px] max-h-[100px] leading-snug py-0.5"
                />
              </div>

              <button
                type="submit"
                disabled={sending || uploading || (!text.trim() && selectedFiles.length === 0)}
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-sky-300 hover:bg-sky-500/15 transition-all disabled:opacity-35 cursor-pointer"
                aria-label={lang === "bn" ? "মেসেজ পাঠান" : "Send message"}
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
