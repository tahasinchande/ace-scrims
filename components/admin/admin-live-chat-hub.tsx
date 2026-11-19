"use client"

import { useState, useEffect, useTransition, useRef, useMemo, useCallback } from "react"
import {
  sendChatMessage,
  getAdminChatHubData,
  getStaffChatThread,
  deleteChatMessage,
  deleteUserChatHistory,
  takeOverChat,
  handBackToAi,
  unbanChatUser,
  type AdminChatConversation,
} from "@/app/actions/chat"
import { useChatScroll } from "@/lib/hooks/use-chat-scroll"
import { uploadMediaFile } from "@/lib/client-upload"
import { useLanguage } from "@/lib/language"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { MediaLightbox, type MediaLightboxItem } from "@/components/chat/media-lightbox"
import { resolveImageUrl } from "@/lib/image-url"
import { formatDate } from "@/lib/format"
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
  Headset,
  Bot,
  ShieldAlert,
  UserCheck,
  Volume2,
} from "lucide-react"
import { toast } from "sonner"

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

type ModerationLogItem = {
  id: string
  userId: string
  userName: string | null
  userEmail: string | null
  messageContent: string
  violationCategory: string
  reason: string
  confidence: number
  detectorSource: string
  actionTaken: string
  isResolved: boolean
  resolvedBy: string | null
  resolvedAt: Date | string | null
  createdAt: Date | string
  currentBanned: boolean | null
}

export type AdminChatHubInitialData = {
  humanChats: AdminChatConversation[]
  aiChats: AdminChatConversation[]
  moderationLogs: ModerationLogItem[]
  totalHumanUnread: number
}

const QUICK_REPLIES_EN = [
  "Room credentials have been published in your lobby. Good luck!",
  "Your transaction has been verified and team slot confirmed.",
  "Refund has been processed. Check your wallet statement.",
  "Please provide your Free Fire Captain UID and registered phone number.",
  "Our support team is reviewing your match report. Please allow up to 1 hour.",
]

const QUICK_REPLIES_BN = [
  "আপনার লবিতে রুম আইডি ও পাসওয়ার্ড প্রকাশ করা হয়েছে। শুভকামনা!",
  "আপনার পেমেন্ট ভেরিফাই হয়েছে এবং টিম স্লট কনফার্ম করা হয়েছে।",
  "রিফান্ড আপনার ওয়ালেট ব্যালেন্সে যোগ করা হয়েছে।",
  "অনুগ্রহ করে আপনার ফ্রি ফায়ার ক্যাপ্টেন UID ও রেজিস্টার্ড নম্বর দিন।",
  "আমাদের সাপোর্ট টিম আপনার রিপোর্টটি পর্যালোচনা করছে।",
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

function playNotificationChime() {
  if (typeof window === "undefined") return
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {})
    }
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = "sine"
    osc.frequency.setValueAtTime(660, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.14)
    gain.gain.setValueAtTime(0.08, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.3)
  } catch {
    // Browser autoplay policies may block sound before user gesture; fail silently
  }
}

export function AdminLiveChatHub({
  initialHubData,
  initialConversations,
  staffUserId: _staffUserId,
}: {
  initialHubData?: AdminChatHubInitialData
  initialConversations?: AdminChatConversation[]
  staffUserId: string
}) {
  const { lang, t } = useLanguage()

  const fallbackHuman = initialConversations?.filter((c) => c.mode === "human") || []
  const fallbackAi = initialConversations?.filter((c) => c.mode !== "human") || []

  const [activeTab, setActiveTab] = useState<"human" | "ai" | "moderation">("human")
  const [humanChats, setHumanChats] = useState<AdminChatConversation[]>(
    initialHubData?.humanChats ?? fallbackHuman
  )
  const [aiChats, setAiChats] = useState<AdminChatConversation[]>(
    initialHubData?.aiChats ?? fallbackAi
  )
  const [moderationLogs, setModerationLogs] = useState<ModerationLogItem[]>(
    initialHubData?.moderationLogs ?? []
  )
  const [totalHumanUnread, setTotalHumanUnread] = useState<number>(
    initialHubData?.totalHumanUnread ?? fallbackHuman.reduce((s, c) => s + (c.unread || 0), 0)
  )
  const prevUnreadRef = useRef<number>(
    initialHubData?.totalHumanUnread ?? fallbackHuman.reduce((s, c) => s + (c.unread || 0), 0)
  )

  const defaultSelected =
    (initialHubData?.humanChats?.[0]?.userId ?? initialHubData?.aiChats?.[0]?.userId) || null

  const [selectedUserId, setSelectedUserId] = useState<string | null>(defaultSelected)
  const [mobileShowThread, setMobileShowThread] = useState(Boolean(defaultSelected))
  const [search, setSearch] = useState("")
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [loadingThread, setLoadingThread] = useState(false)
  const [inputText, setInputText] = useState("")
  const [isSending, startSending] = useTransition()
  const [switchingMode, setSwitchingMode] = useState(false)
  const [unbanningId, setUnbanningId] = useState<string | null>(null)

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

  const refreshHub = useCallback(async () => {
    try {
      const fresh = await getAdminChatHubData()
      setHumanChats(fresh.humanChats)
      setAiChats(fresh.aiChats)
      setModerationLogs(fresh.moderationLogs as ModerationLogItem[])
      setTotalHumanUnread(fresh.totalHumanUnread)

      if (fresh.totalHumanUnread > prevUnreadRef.current) {
        playNotificationChime()
        toast.info(
          lang === "bn"
            ? "নতুন হিউম্যান সাপোর্ট চ্যাট বার্তা এসেছে"
            : "New Human Agent support message received",
          { icon: <Volume2 className="size-4 text-primary" /> }
        )
      }
      prevUnreadRef.current = fresh.totalHumanUnread
    } catch {}
  }, [lang])

  useEffect(() => {
    const timer = setInterval(refreshHub, 4500)
    return () => clearInterval(timer)
  }, [refreshHub])

  const fetchThread = useCallback(
    async (userId: string, isSilent = false) => {
      if (!isSilent) setLoadingThread(true)
      try {
        const thread = await getStaffChatThread(userId)
        setMessages(thread as MessageItem[])
      } catch {
        if (!isSilent) toast.error(lang === "bn" ? "চ্যাট লোড করা যায়নি" : "Could not load chat messages")
      } finally {
        if (!isSilent) setLoadingThread(false)
      }
    },
    [lang]
  )

  useEffect(() => {
    if (selectedUserId && activeTab !== "moderation") {
      fetchThread(selectedUserId, false)
    } else if (!selectedUserId) {
      setMessages([])
    }
  }, [selectedUserId, activeTab, fetchThread])

  useEffect(() => {
    if (!selectedUserId || activeTab === "moderation") return
    const timer = setInterval(() => {
      fetchThread(selectedUserId, true)
    }, 3500)
    return () => clearInterval(timer)
  }, [selectedUserId, activeTab, fetchThread])

  const currentTabConversations = activeTab === "human" ? humanChats : aiChats
  const allConversations = useMemo(() => [...humanChats, ...aiChats], [humanChats, aiChats])
  const selectedConversation = allConversations.find((c) => c.userId === selectedUserId)

  const filteredConversations = useMemo(() => {
    if (!search.trim()) return currentTabConversations
    const q = search.toLowerCase()
    return currentTabConversations.filter(
      (c) =>
        (c.userName || "").toLowerCase().includes(q) ||
        (c.userEmail || "").toLowerCase().includes(q) ||
        (c.latestMessage || "").toLowerCase().includes(q) ||
        c.userId.toLowerCase().includes(q)
    )
  }, [currentTabConversations, search])

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
      toast.success(lang === "bn" ? "অ্যাটাচমেন্ট পাঠানোর জন্য প্রস্তুত" : "Attachment ready to send")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : lang === "bn" ? "আপলোড ব্যর্থ হয়েছে" : "Failed to upload attachment")
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
      try {
        notifyUserSentMessage()
        const res = await sendChatMessage(
          textToSend,
          targetUser,
          urlToSend,
          typeToSend,
          nameToSend
        )
        if (res.ok) {
          await Promise.all([fetchThread(targetUser, true), refreshHub()])
        } else {
          setInputText(textToSend)
          if (urlToSend) {
            setAttachedUrl(urlToSend)
            setAttachedType(typeToSend || null)
            setAttachedName(nameToSend || null)
          }
          toast.error(res.error || (lang === "bn" ? "মেসেজ পাঠানো যায়নি" : "Failed to send message"))
        }
      } catch (err) {
        setInputText(textToSend)
        if (urlToSend) {
          setAttachedUrl(urlToSend)
          setAttachedType(typeToSend || null)
          setAttachedName(nameToSend || null)
        }
        toast.error(err instanceof Error ? err.message : lang === "bn" ? "মেসেজ পাঠানো যায়নি" : "Failed to send message")
      }
    })
  }

  async function handleTakeOver(targetUserId: string) {
    setSwitchingMode(true)
    try {
      const res = await takeOverChat(targetUserId)
      if (res.ok) {
        toast.success(lang === "bn" ? "হিউম্যান এজেন্ট হিসেবে চ্যাট নেওয়া হয়েছে" : "Took over chat as Human Agent")
        setActiveTab("human")
        await Promise.all([fetchThread(targetUserId, true), refreshHub()])
      } else {
        toast.error(res.error || "Failed to take over chat")
      }
    } finally {
      setSwitchingMode(false)
    }
  }

  async function handleHandBackToAi(targetUserId: string) {
    setSwitchingMode(true)
    try {
      const res = await handBackToAi(targetUserId)
      if (res.ok) {
        toast.success(lang === "bn" ? "চ্যাটটি ACE AI অ্যাসিস্ট্যান্টের কাছে ফেরত দেওয়া হয়েছে" : "Chat handed back to ACE AI Assistant")
        setActiveTab("ai")
        await Promise.all([fetchThread(targetUserId, true), refreshHub()])
      } else {
        toast.error(res.error || "Failed to hand back to AI")
      }
    } finally {
      setSwitchingMode(false)
    }
  }

  async function handleUnban(userId: string, logId: string) {
    setUnbanningId(logId)
    try {
      const res = await unbanChatUser(userId, logId)
      if (res.ok) {
        toast.success(lang === "bn" ? "ইউজার সফলভাবে আনব্যান হয়েছে" : "User unbanned successfully")
        await refreshHub()
      } else {
        toast.error(res.error || "Failed to unban user")
      }
    } finally {
      setUnbanningId(null)
    }
  }

  async function confirmDeleteMessage() {
    if (!deleteMsgTarget) return
    setIsDeleting(true)
    try {
      const res = await deleteChatMessage(deleteMsgTarget)
      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== deleteMsgTarget))
        toast.success(lang === "bn" ? "মেসেজ মুছে ফেলা হয়েছে" : "Message deleted")
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
        toast.success(lang === "bn" ? "কথোপকথনের ইতিহাস মুছে ফেলা হয়েছে" : "Conversation history cleared")
        setClearThreadConfirmOpen(false)
        await refreshHub()
      } else {
        toast.error(res.error || "Failed to clear history")
      }
    } finally {
      setIsDeleting(false)
    }
  }

  const quickReplies = lang === "bn" ? QUICK_REPLIES_BN : QUICK_REPLIES_EN
  const unresolvedModCount = moderationLogs.filter((l) => l.currentBanned || !l.isResolved).length

  return (
    <div className="space-y-5">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
            {t("admin_chat_title", "Live Support Hub")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("admin_chat_sub")}
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => refreshHub()}
          className="self-start sm:self-auto gap-1.5 text-xs"
        >
          <RefreshCw className="size-3.5" />
          {lang === "bn" ? "রিফ্রেশ" : "Refresh"}
        </Button>
      </div>

      {/* Dual-Section + Moderation Tab Switcher */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/80 bg-secondary/40 p-1.5">
        <button
          type="button"
          onClick={() => {
            setActiveTab("human")
            if (humanChats.length > 0 && !humanChats.some((c) => c.userId === selectedUserId)) {
              setSelectedUserId(humanChats[0].userId)
            }
          }}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer",
            activeTab === "human"
              ? "bg-[#0084FF] text-white shadow"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/70"
          )}
        >
          <Headset className="size-4" />
          <span>{t("admin_chat_tab_human", "Human Agent Chats")}</span>
          <span className="rounded-full bg-black/25 px-2 py-0.5 font-mono text-[11px]">
            {humanChats.length}
          </span>
          {totalHumanUnread > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] text-white animate-pulse">
              {totalHumanUnread} {lang === "bn" ? "নতুন" : "new"}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("ai")
            if (aiChats.length > 0 && !aiChats.some((c) => c.userId === selectedUserId)) {
              setSelectedUserId(aiChats[0].userId)
            }
          }}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer",
            activeTab === "ai"
              ? "bg-indigo-600 text-white shadow"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/70"
          )}
        >
          <Bot className="size-4" />
          <span>{t("admin_chat_tab_ai", "AI Bot Chats")}</span>
          <span className="rounded-full bg-black/25 px-2 py-0.5 font-mono text-[11px]">
            {aiChats.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("moderation")}
          className={cn(
            "flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer",
            activeTab === "moderation"
              ? "bg-rose-600 text-white shadow"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/70"
          )}
        >
          <ShieldAlert className="size-4" />
          <span>{t("admin_chat_tab_mod", "Moderation & Bans")}</span>
          {unresolvedModCount > 0 && (
            <span className="rounded-full bg-rose-500/20 border border-rose-400/50 px-2 py-0.5 font-mono text-[11px] text-rose-200">
              {unresolvedModCount}
            </span>
          )}
        </button>
      </div>

      {/* Tab 3: Moderation & Bans */}
      {activeTab === "moderation" ? (
        <div className="glass rounded-2xl border border-border/80 overflow-hidden">
          {moderationLogs.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
              <ShieldAlert className="size-10 opacity-30 text-rose-400" />
              <p>{t("admin_chat_no_mod")}</p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {moderationLogs.map((log) => {
                const isStillBanned = Boolean(log.currentBanned)
                return (
                  <div key={log.id} className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-display font-bold text-sm text-foreground">
                          {log.userName || "Player"}
                        </span>
                        {log.userEmail && (
                          <span className="text-xs text-muted-foreground font-mono">
                            ({log.userEmail})
                          </span>
                        )}
                        <Badge variant="destructive" className="uppercase text-[10px]">
                          {log.violationCategory}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {log.detectorSource} · {log.confidence}%
                        </Badge>
                        {isStillBanned ? (
                          <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-[10px]">
                            {t("admin_chat_banned_pill")}
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px]">
                            {t("admin_chat_unbanned")}
                          </Badge>
                        )}
                      </div>

                      <div className="rounded-xl bg-rose-950/20 border border-rose-500/25 px-3 py-2 text-xs text-rose-200 break-words">
                        <strong className="text-rose-300 mr-1.5">{t("admin_chat_mod_message")}:</strong>
                        {log.messageContent}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                        <span>
                          <strong>{t("admin_chat_mod_reason")}:</strong> {log.reason}
                        </span>
                        <span className="font-mono">
                          {formatDate(log.createdAt)}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {isStillBanned ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={unbanningId === log.id}
                          onClick={() => handleUnban(log.userId, log.id)}
                          className="border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 gap-1.5 text-xs font-bold"
                        >
                          {unbanningId === log.id ? (
                            <>
                              <Loader2 className="size-3.5 animate-spin" />
                              {t("admin_chat_unbanning")}
                            </>
                          ) : (
                            <>
                              <UserCheck className="size-3.5" />
                              {t("admin_chat_unban")}
                            </>
                          )}
                        </Button>
                      ) : (
                        <span className="text-xs font-semibold text-emerald-400">
                          {t("admin_chat_unbanned")}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        /* Tabs 1 & 2: Two-Pane Messenger Thread View */
        <div className="rounded-2xl overflow-hidden border border-zinc-800 bg-[#18191A] flex flex-col md:flex-row h-[720px] max-h-[82vh] shadow-xl">
          {/* Left Pane */}
          <div
            className={cn(
              "w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-zinc-800 flex flex-col bg-[#242526] shrink-0",
              mobileShowThread && selectedUserId ? "hidden md:flex" : "flex flex-1 md:flex-none"
            )}
          >
            <div className="p-4 border-b border-zinc-800 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-sm font-bold uppercase tracking-wider flex items-center gap-2 text-zinc-100">
                  {activeTab === "human" ? (
                    <Headset className="size-4 text-[#0084FF]" />
                  ) : (
                    <Bot className="size-4 text-indigo-400" />
                  )}
                  {activeTab === "human"
                    ? t("admin_chat_tab_human")
                    : t("admin_chat_tab_ai")}
                </h2>
                <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-xs font-mono font-bold text-zinc-300">
                  {currentTabConversations.length}
                </span>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-zinc-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("admin_chat_search_placeholder")}
                  className="pl-8 h-9 rounded-full text-xs bg-[#3A3B3C] border-zinc-700 text-zinc-100 placeholder:text-zinc-400"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredConversations.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-400">
                  <MessageSquare className="size-8 mx-auto mb-2 opacity-30" />
                  <p>
                    {activeTab === "human"
                      ? t("admin_chat_no_human")
                      : t("admin_chat_no_ai")}
                  </p>
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
                          <div className="flex items-center gap-1.5 min-w-0">
                            <p className={cn("text-xs truncate", c.unread ? "font-bold text-white" : "font-semibold text-zinc-200")}>
                              {c.userName || "Ace Scrims Player"}
                            </p>
                            {c.banned && (
                              <span className="rounded bg-rose-500/20 px-1 py-0.2 text-[9px] font-bold text-rose-300">
                                {t("admin_chat_banned_pill")}
                              </span>
                            )}
                          </div>
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

          {/* Right Pane */}
          <div
            className={cn(
              "flex-1 flex flex-col bg-[#18191A] min-w-0",
              mobileShowThread && selectedUserId ? "flex" : "hidden md:flex"
            )}
          >
            {selectedUserId ? (
              <>
                <div className="p-3.5 px-4 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-2 bg-[#242526] shrink-0">
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-display text-sm font-bold text-zinc-100 truncate">
                          {selectedConversation?.userName || "Player Support Session"}
                        </h3>
                        <span
                          className={cn(
                            "rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase",
                            selectedConversation?.mode === "human"
                              ? "bg-[#0084FF]/20 text-[#4DA6FF]"
                              : "bg-indigo-500/20 text-indigo-300"
                          )}
                        >
                          {selectedConversation?.mode === "human" ? "Human" : "AI"}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 font-mono truncate">
                        {selectedConversation?.userEmail || `ID: ${selectedUserId}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {selectedConversation?.mode === "human" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={switchingMode}
                        onClick={() => handleHandBackToAi(selectedUserId)}
                        className="h-8 text-xs gap-1.5 border-indigo-500/40 bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25"
                      >
                        <Bot className="size-3.5" />
                        <span>{t("admin_chat_hand_back")}</span>
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={switchingMode}
                        onClick={() => handleTakeOver(selectedUserId)}
                        className="h-8 text-xs gap-1.5 border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                      >
                        <Headset className="size-3.5" />
                        <span>{t("admin_chat_take_over")}</span>
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchThread(selectedUserId, false)}
                      className="h-8 text-xs gap-1 border-zinc-700 bg-[#3A3B3C] text-zinc-100 hover:bg-zinc-700"
                    >
                      <RefreshCw className="size-3" />
                      <span className="hidden sm:inline">{lang === "bn" ? "রিফ্রেশ" : "Refresh"}</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setClearThreadConfirmOpen(true)}
                      className="h-8 text-xs gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="size-3" />
                      <span className="hidden sm:inline">{t("admin_chat_delete_thread")}</span>
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
                      {lang === "bn" ? "চ্যাট ইতিহাস লোড হচ্ছে..." : "Loading message history..."}
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center text-xs text-zinc-400 p-6">
                      <MessageSquare className="size-10 mb-2 opacity-30 text-[#0084FF]" />
                      <p className="font-semibold text-zinc-100">
                        {lang === "bn" ? "এই চ্যাটে এখনো কোনো মেসেজ নেই" : "No messages in this conversation yet"}
                      </p>
                    </div>
                  ) : (
                    messages.map((m, idx) => {
                      if (m.senderRole === "system") {
                        return (
                          <div key={m.id} className="my-2 flex justify-center">
                            <div className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700/70 bg-zinc-800/80 px-3 py-1 text-[11px] text-zinc-300 text-center max-w-[90%]">
                              <ShieldAlert className="size-3.5 shrink-0 text-amber-400" />
                              <span>{m.message}</span>
                            </div>
                          </div>
                        )
                      }

                      const isStaff = m.senderRole === "admin" || m.senderRole === "moderator"
                      const isAi = m.senderRole === "ai"
                      const isRightAligned = isStaff || isAi
                      const prevSameSender = idx > 0 && messages[idx - 1].senderRole === m.senderRole
                      const nextSameSender = idx < messages.length - 1 && messages[idx + 1].senderRole === m.senderRole
                      const mediaKind = detectAttachmentKind(m)
                      const isDefaultCaption =
                        m.message === "📷 Photo" ||
                        m.message === "Photo attachment" ||
                        m.message === "📷 Image attachment" ||
                        m.message === "🎬 Video" ||
                        m.message === "Video attachment" ||
                        m.message === "📄 File attachment" ||
                        m.message === "File attachment"
                      const hasText = Boolean(m.message && m.message.trim() && !(mediaKind && isDefaultCaption))

                      return (
                        <div
                          key={m.id}
                          className={cn(
                            "group flex flex-col max-w-[82%] sm:max-w-[70%]",
                            isRightAligned ? "ml-auto items-end" : "mr-auto items-start",
                            !prevSameSender ? "mt-2" : "mt-0.5"
                          )}
                        >
                          {!prevSameSender && (
                            <div className="flex items-center gap-1.5 mb-0.5 px-1 text-[10px] text-zinc-400">
                              {isAi && <Bot className="size-3 text-indigo-400" />}
                              <span className="font-semibold text-zinc-300">
                                {isAi
                                  ? `${m.senderName} (${t("chat_ai_badge")})`
                                  : isStaff
                                    ? `${m.senderName} (${t("chat_staff_badge")})`
                                    : m.senderName}
                              </span>
                            </div>
                          )}

                          <div className="relative flex items-center gap-1.5">
                            {isRightAligned && (
                              <button
                                type="button"
                                onClick={() => setDeleteMsgTarget(m.id)}
                                title={lang === "bn" ? "মেসেজ মুছুন" : "Delete message"}
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
                                        isStaff ? "bg-[#0084FF] text-white" : isAi ? "bg-indigo-600/80 text-white" : "bg-[#242526] text-zinc-100"
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
                                      : isAi
                                        ? cn(
                                            "bg-indigo-900/75 border border-indigo-500/40 text-zinc-100 rounded-2xl",
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

                            {!isRightAligned && (
                              <button
                                type="button"
                                onClick={() => setDeleteMsgTarget(m.id)}
                                title={lang === "bn" ? "মেসেজ মুছুন" : "Delete message"}
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
                    {lang === "bn" ? "দ্রুত উত্তর:" : "Quick:"}
                  </span>
                  {quickReplies.map((reply, idx) => (
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
                    title={lang === "bn" ? "ছবি, ভিডিও বা ফাইল যুক্ত করুন" : "Attach photo, video, or file"}
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
                    placeholder={t("chat_composer_placeholder", "Write a reply...")}
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
                <p className="text-xs max-w-sm mt-1">{t("admin_chat_select_thread")}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <MediaLightbox
        items={lightboxItems}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
      />

      <ConfirmDialog
        open={Boolean(deleteMsgTarget)}
        onOpenChange={(open) => !open && setDeleteMsgTarget(null)}
        title={lang === "bn" ? "মেসেজ মুছবেন?" : "Delete Message?"}
        description={
          lang === "bn"
            ? "এই মেসেজটি কথোপকথন থেকে স্থায়ীভাবে মুছে ফেলা হবে।"
            : "This message will be permanently removed from the conversation for both player and staff."
        }
        confirmLabel={t("admin_chat_confirm")}
        cancelLabel={t("admin_chat_cancel")}
        loading={isDeleting}
        onConfirm={confirmDeleteMessage}
      />

      <ConfirmDialog
        open={clearThreadConfirmOpen}
        onOpenChange={setClearThreadConfirmOpen}
        title={t("admin_chat_delete_thread")}
        description={t("admin_chat_confirm_clear")}
        confirmLabel={t("admin_chat_confirm")}
        cancelLabel={t("admin_chat_cancel")}
        loading={isDeleting}
        onConfirm={confirmClearHistory}
      />
    </div>
  )
}
