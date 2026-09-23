"use client"

export const dynamic = "force-dynamic"

import { useState, useEffect, useRef } from "react"
import { getStaffChatConversations, getStaffChatThread, sendChatMessage, deleteChatMessage, deleteUserChatHistory } from "@/app/actions/chat"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MessageSquare, Send, Loader2, User, RefreshCw, Paperclip, FileText, ExternalLink, X, ChevronDown, ArrowLeft, Trash2 } from "lucide-react"
import { resolveImageUrl } from "@/lib/image-url"
import { toast } from "sonner"
import type { ChatMessage } from "@/lib/db/schema"
import { ActiveChatSidebar, type ActiveChatSession } from "@/components/admin/active-chat-sidebar"
import { useChatScroll } from "@/lib/hooks/use-chat-scroll"

type Conversation = ActiveChatSession

type ThreadMessage = ChatMessage & {
  senderImage?: string | null
}

export default function StaffChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeUserId, setActiveUserId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [replyText, setReplyText] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deletingUserHistory, setDeletingUserHistory] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<Array<{ url: string; name: string; type: string }>>([])
  const [failedHeaderAvatar, setFailedHeaderAvatar] = useState<Record<string, boolean>>({})
  const [failedMsgAvatars, setFailedMsgAvatars] = useState<Record<string, boolean>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleDeleteMessage(messageId: string) {
    if (!confirm("Are you sure you want to delete this chat message?")) return
    setDeletingId(messageId)
    try {
      const res = await deleteChatMessage(messageId)
      if (res.ok) {
        toast.success("Message deleted successfully")
        setMessages((prev) => prev.filter((m) => m.id !== messageId))
      } else {
        toast.error(res.error || "Failed to delete message")
      }
    } catch {
      toast.error("Failed to delete message")
    } finally {
      setDeletingId(null)
    }
  }

  async function handleDeleteUserHistory() {
    if (!activeUserId) return
    const currentUserName = activeUser?.userName || "this user"
    if (
      !confirm(
        `Are you sure you want to delete the ENTIRE chat history for ${currentUserName}?\n\nThis will permanently delete all messages in this conversation.`
      )
    ) {
      return
    }

    setDeletingUserHistory(true)
    try {
      const res = await deleteUserChatHistory(activeUserId)
      if (res.ok) {
        toast.success(`Deleted ${res.count ?? "all"} messages from user's chat history`)
        setMessages([])
        loadConversations()
      } else {
        toast.error(res.error || "Failed to delete user chat history")
      }
    } catch {
      toast.error("Failed to delete user chat history")
    } finally {
      setDeletingUserHistory(false)
    }
  }

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
    resetTrigger: activeUserId,
    enabled: Boolean(activeUserId),
  })

  async function loadConversations() {
    const list = await getStaffChatConversations()
    setConversations(list)
    setActiveUserId((current) => {
      if (!current && list.length > 0) {
        if (typeof window !== "undefined" && window.innerWidth >= 768) {
          return list[0].userId
        }
      }
      return current
    })
  }

  async function loadThread(userId: string) {
    const thread = await getStaffChatThread(userId)
    setMessages(thread)
  }

  useEffect(() => {
    loadConversations().finally(() => setLoading(false))
    const interval = setInterval(loadConversations, 5000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (activeUserId) {
      loadThread(activeUserId)
      const interval = setInterval(() => loadThread(activeUserId), 3000)
      return () => clearInterval(interval)
    }
  }, [activeUserId])

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    for (const file of files) {
      if (file.size > 25 * 1024 * 1024) {
        toast.error(`File "${file.name}" is over 25MB`)
        return
      }
    }

    setUploading(true)
    try {
      const uploaded: Array<{ url: string; name: string; type: string }> = []
      for (const file of files) {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("folder", "chat")

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        })

        const data = await res.json()
        if (data.ok) {
          uploaded.push({
            url: data.url,
            name: data.fileName || file.name,
            type: data.fileType || (file.type.startsWith("image/") ? "image" : "file"),
          })
        }
      }
      setSelectedFiles((prev) => [...prev, ...uploaded])
      toast.success(`${uploaded.length} attachment${uploaded.length > 1 ? "s" : ""} uploaded`)
    } catch {
      toast.error("Error uploading attachments")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  function removeAttachment(idx: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault()
    if (!activeUserId || (!replyText.trim() && selectedFiles.length === 0)) return

    const text = replyText.trim()
    const filesToSend = [...selectedFiles]
    setReplyText("")
    setSelectedFiles([])
    setSending(true)

    try {
      if (filesToSend.length === 0) {
        const res = await sendChatMessage(text, activeUserId)
        if (!res.ok) toast.error(res.error || "Failed to send reply")
      } else {
        for (let i = 0; i < filesToSend.length; i++) {
          const f = filesToSend[i]
          const curText = i === 0 ? text : ""
          const res = await sendChatMessage(curText, activeUserId, f.url, f.type, f.name)
          if (!res.ok) toast.error(res.error || "Failed to send attachment")
        }
      }
      notifyUserSentMessage()
      await loadThread(activeUserId)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send reply")
    } finally {
      setSending(false)
    }
  }

  const activeUser =
    conversations.find((c) => c.userId === activeUserId) ||
    (activeUserId
      ? {
          userId: activeUserId,
          userName:
            messages.find((m) => m.senderRole !== "admin" && m.senderRole !== "moderator")?.senderName ||
            "Customer",
          userImage:
            messages.find((m) => m.senderRole !== "admin" && m.senderRole !== "moderator")?.senderImage ||
            null,
          latestMessage: "",
          createdAt: new Date(),
          unread: 0,
          hasAttachment: false,
          attachmentType: null,
        }
      : null)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-wider flex items-center gap-2">
            <MessageSquare className="size-6 text-primary" />
            Live Support Chat
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time customer service and user support messages.
          </p>
        </div>

        <Button
          onClick={() => {
            setLoading(true)
            loadConversations().finally(() => setLoading(false))
          }}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="glass flex flex-col md:flex-row h-[750px] min-h-[600px] max-h-[calc(100vh-180px)] rounded-2xl border border-border/80 overflow-hidden shadow-2xl bg-card/40 backdrop-blur-md">
        {/* Conversations Sidebar */}
        <ActiveChatSidebar
          conversations={conversations}
          activeUserId={activeUserId}
          onSelectUser={(userId) => setActiveUserId(userId)}
          className={activeUserId ? "hidden md:flex w-full md:w-[340px] md:shrink-0" : "flex w-full md:w-[340px] md:shrink-0"}
        />

        {/* Thread Column */}
        <div className={`flex-1 flex flex-col min-h-0 bg-black/40 ${!activeUserId ? "hidden md:flex" : "flex"}`}>
          {activeUser ? (
            <>
              {/* Thread Header */}
              <div className="h-16 px-4 border-b border-border/80 bg-card/80 flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveUserId(null)}
                  className="md:hidden flex size-9 items-center justify-center rounded-xl bg-secondary text-foreground hover:bg-secondary/80 border border-border/60 transition-colors shrink-0 mr-1 cursor-pointer"
                  aria-label="Back to conversations list"
                  title="Back to conversations"
                >
                  <ArrowLeft className="size-4" />
                </button>

                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl overflow-hidden bg-primary/20 text-primary border border-primary/30 font-bold">
                  {activeUser.userImage && !failedHeaderAvatar[activeUser.userId] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={resolveImageUrl(activeUser.userImage)}
                      alt={`${activeUser.userName}'s avatar`}
                      onError={() => setFailedHeaderAvatar((prev) => ({ ...prev, [activeUser.userId]: true }))}
                      className="size-full object-cover"
                    />
                  ) : activeUser.userName && activeUser.userName !== "Unknown User" && activeUser.userName !== "Customer" ? (
                    <span className="font-display font-bold text-xs uppercase">
                      {activeUser.userName.slice(0, 2).toUpperCase()}
                    </span>
                  ) : (
                    <User className="size-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-display font-bold text-sm text-foreground uppercase truncate">
                    {activeUser.userName}
                  </h2>
                  <p className="text-[11px] text-muted-foreground truncate">Customer ID: {activeUser.userId}</p>
                </div>

                {/* Moderation Tool: Delete User's Entire Chat History */}
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteUserHistory}
                  disabled={deletingUserHistory || messages.length === 0}
                  className="shrink-0 h-8 gap-1.5 text-xs font-semibold bg-destructive/15 text-destructive hover:bg-destructive hover:text-destructive-foreground border border-destructive/30 transition-all cursor-pointer"
                  title="Delete User's Entire Chat History"
                >
                  {deletingUserHistory ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                  <span className="hidden sm:inline">Delete User&apos;s Chat History</span>
                  <span className="sm:hidden">Delete History</span>
                </Button>
              </div>

              {/* Messages Container */}
              <div
                ref={containerRef}
                onScroll={handleScroll}
                className="relative flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-3"
              >
                {messages.length === 0 ? (
                  <div className="my-auto text-center text-xs text-muted-foreground">
                    No messages in this conversation.
                  </div>
                ) : (
                  messages.map((m) => {
                    const isStaffMsg = m.senderRole === "admin" || m.senderRole === "moderator"
                    const isImageAttachment =
                      m.attachmentType === "image" ||
                      (Boolean(m.attachmentUrl) && /\.(png|jpe?g|webp|gif|svg)$/i.test(m.attachmentUrl || ""))
                    const hasText = Boolean(m.message && m.message.trim())

                    return (
                      <div
                        key={m.id}
                        className={`group relative flex flex-col max-w-[80%] ${
                          isStaffMsg ? "self-end items-end" : "self-start items-start"
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] text-muted-foreground">
                          {/* Mini sender avatar */}
                          {m.senderImage && !failedMsgAvatars[m.id] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={resolveImageUrl(m.senderImage)}
                              alt={`${m.senderName}'s avatar`}
                              onError={() => setFailedMsgAvatars((prev) => ({ ...prev, [m.id]: true }))}
                              className="size-4 rounded-full object-cover border border-border/60"
                            />
                          ) : (
                            <span className="flex size-4 items-center justify-center rounded-full bg-secondary text-[8px] font-bold text-foreground">
                              {m.senderName ? m.senderName.slice(0, 1).toUpperCase() : "U"}
                            </span>
                          )}
                          <span className="font-semibold text-foreground">{m.senderName}</span>
                          {isStaffMsg && (
                            <span className="bg-primary/20 text-primary border border-primary/30 px-1.5 py-0.2 rounded font-bold uppercase text-[9px]">
                              {m.senderRole}
                            </span>
                          )}
                        </div>

                        {isImageAttachment ? (
                          /* Seamless Edge-to-Edge Image Bubble */
                          <div
                            className={`flex flex-col w-full max-w-xs sm:max-w-sm overflow-hidden shadow-lg transition-all ${
                              isStaffMsg
                                ? hasText
                                  ? "rounded-2xl sm:rounded-3xl rounded-br-[4px] bg-gradient-to-tr from-indigo-600 via-indigo-600 to-purple-600 text-white shadow-indigo-500/10"
                                  : "rounded-2xl sm:rounded-3xl rounded-br-[4px]"
                                : hasText
                                ? "rounded-2xl sm:rounded-3xl rounded-bl-[4px] bg-zinc-800 text-zinc-100 border border-zinc-700/60"
                                : "rounded-2xl sm:rounded-3xl rounded-bl-[4px] border border-zinc-800/80"
                            }`}
                          >
                            <a
                              href={resolveImageUrl(m.attachmentUrl!)}
                              target="_blank"
                              rel="noreferrer"
                              className="group relative block overflow-hidden bg-black/40"
                              title="Click to open full resolution image"
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
                              isStaffMsg
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
                                  className={`flex items-center gap-2 rounded-2xl p-2.5 text-xs font-semibold transition-colors ${
                                    isStaffMsg
                                      ? "bg-black/20 hover:bg-black/30 text-white border border-white/10"
                                      : "bg-zinc-900/80 hover:bg-zinc-900 text-zinc-200 border border-zinc-700/60"
                                  }`}
                                >
                                  <FileText className={`size-4 shrink-0 ${isStaffMsg ? "text-white" : "text-indigo-400"}`} />
                                  <span className="truncate max-w-[220px]">{m.attachmentName || "Attachment File"}</span>
                                  <ExternalLink className="size-3 opacity-70 ml-auto shrink-0" />
                                </a>
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex items-center gap-2 mt-1 px-1.5">
                          <span className="text-[9.5px] text-zinc-500">
                            {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          <button
                            type="button"
                            disabled={deletingId === m.id}
                            onClick={() => handleDeleteMessage(m.id)}
                            title="Delete message"
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-zinc-500 hover:text-red-400 rounded hover:bg-zinc-800 disabled:opacity-50"
                          >
                            {deletingId === m.id ? (
                              <Loader2 className="size-3 animate-spin text-red-400" />
                            ) : (
                              <Trash2 className="size-3" />
                            )}
                          </button>
                        </div>
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

              {/* Pending Attachments List */}
              {selectedFiles.length > 0 && !uploading && (
                <div className="flex flex-wrap gap-1.5 bg-zinc-900/90 p-2.5 border-t border-zinc-800/80 max-h-24 overflow-y-auto">
                  {selectedFiles.map((file, idx) => (
                    <div
                      key={`${file.url}-${idx}`}
                      className="flex items-center gap-1.5 bg-zinc-800/90 border border-zinc-700/60 rounded-full px-3 py-1 text-[11px] text-zinc-200 max-w-[200px]"
                    >
                      <Paperclip className="size-3 text-indigo-400 shrink-0" />
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

              {/* Reply Form */}
              <form onSubmit={handleSendReply} className="flex items-center gap-2 p-3 border-t border-zinc-800/80 bg-zinc-900/95 backdrop-blur-md">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                  accept="image/*,application/pdf,.doc,.docx,.txt,.zip"
                />

                <div className="flex flex-1 items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/80 px-3 py-1.5 transition-all focus-within:border-indigo-500/70 focus-within:ring-2 focus-within:ring-indigo-500/20">
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="flex size-8 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-800 hover:text-indigo-400 transition-colors disabled:opacity-50"
                    title="Attach files (images or documents)"
                    aria-label="Attach files"
                  >
                    {uploading ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
                  </button>

                  <input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={`Reply to ${activeUser.userName}...`}
                    className="flex-1 bg-transparent text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none py-1"
                  />
                </div>

                <button
                  type="submit"
                  disabled={sending || uploading || (!replyText.trim() && selectedFiles.length === 0)}
                  className="flex h-10 px-5 items-center justify-center gap-2 rounded-full bg-gradient-to-tr from-indigo-600 via-indigo-600 to-purple-600 text-white font-display text-xs font-bold uppercase tracking-wider shadow-md shadow-indigo-500/25 transition-all duration-200 hover:scale-105 hover:shadow-indigo-500/40 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 disabled:shadow-none cursor-pointer"
                >
                  {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-3.5" />}
                  <span>Send</span>
                </button>
              </form>
            </>
          ) : (
            <div className="my-auto flex flex-col items-center justify-center p-8 text-center text-muted-foreground gap-2">
              <MessageSquare className="size-10 text-muted-foreground/50" />
              <p className="text-sm">Select a user conversation on the left to start replying.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
