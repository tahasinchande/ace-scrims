"use client"

import { useState, useEffect, useTransition, useRef, useMemo } from "react"
import Image from "next/image"
import {
  sendChatMessage,
  getStaffChatConversations,
  getStaffChatThread,
  deleteChatMessage,
  deleteUserChatHistory,
} from "@/app/actions/chat"
import { useChatScroll } from "@/lib/hooks/use-chat-scroll"
import { uploadMediaFile } from "@/lib/client-upload"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  MessageSquare,
  Search,
  Send,
  Paperclip,
  Trash2,
  Check,
  CheckCheck,
  Clock,
  User,
  ShieldCheck,
  Loader2,
  X,
  FileText,
  Sparkles,
  ExternalLink,
  RefreshCw,
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
  "Refund has been processed. Check your payment statement.",
  "Please provide your Free Fire Captain UID and registered phone number.",
  "Our support team is reviewing your match report. Please allow up to 1 hour.",
]

export function AdminLiveChatHub({
  initialConversations = [],
  staffUserId,
}: {
  initialConversations: ActiveChatSession[]
  staffUserId: string
}) {
  const [conversations, setConversations] = useState<ActiveChatSession[]>(initialConversations)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(
    initialConversations[0]?.userId || null
  )
  const [search, setSearch] = useState("")
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [loadingThread, setLoadingThread] = useState(false)
  const [inputText, setInputText] = useState("")
  const [isSending, startSending] = useTransition()
  const [uploading, setUploading] = useState(false)
  const [attachedUrl, setAttachedUrl] = useState<string | null>(null)
  const [attachedType, setAttachedType] = useState<string | null>(null)
  const [attachedName, setAttachedName] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    containerRef,
    bottomRef,
    handleScroll,
    scrollToBottom,
    notifyUserSentMessage,
    showScrollBottomButton,
  } = useChatScroll({
    dependency: messages,
    resetTrigger: selectedUserId,
  })

  // Poll conversations list every 5 seconds
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

  // Fetch thread messages on user selection or change
  const fetchThread = async (userId: string, isSilent = false) => {
    if (!isSilent) setLoadingThread(true)
    try {
      const thread = await getStaffChatThread(userId)
      setMessages(thread as MessageItem[])
    } catch (e) {
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

  // Polling thread messages every 3.5 seconds when active
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
      setAttachedUrl(res.url)
      setAttachedType(isImg ? "image" : "file")
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

  async function handleDeleteMessage(msgId: string) {
    if (!confirm("Are you sure you want to delete this message?")) return
    const res = await deleteChatMessage(msgId)
    if (res.ok) {
      setMessages((prev) => prev.filter((m) => m.id !== msgId))
      toast.success("Message deleted")
    } else {
      toast.error(res.error || "Failed to delete message")
    }
  }

  async function handleClearHistory() {
    if (!selectedUserId) return
    if (!confirm(`Are you sure you want to clear the entire chat history with ${selectedConversation?.userName || "this user"}?`)) {
      return
    }
    const res = await deleteUserChatHistory(selectedUserId)
    if (res.ok) {
      setMessages([])
      toast.success("Conversation history cleared")
    } else {
      toast.error(res.error || "Failed to clear history")
    }
  }

  return (
    <div className="glass rounded-2xl overflow-hidden border border-border/60 flex flex-col md:flex-row h-[750px] max-h-[85vh]">
      {/* Left Pane: Conversations List */}
      <div className="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-border/60 flex flex-col bg-background/50 shrink-0">
        <div className="p-4 border-b border-border/60 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-bold uppercase tracking-wider flex items-center gap-2">
              <MessageSquare className="size-4 text-primary" />
              Support Chats
            </h2>
            <Badge variant="outline" className="text-xs font-mono font-bold border-primary/30 text-primary">
              {conversations.length} Threads
            </Badge>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="pl-8 h-8 text-xs bg-secondary/30"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border/20">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
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
                  onClick={() => setSelectedUserId(c.userId)}
                  className={cn(
                    "w-full text-left p-3.5 flex items-start gap-3 transition-colors cursor-pointer",
                    active
                      ? "bg-primary/15 border-l-4 border-primary"
                      : "hover:bg-secondary/40"
                  )}
                >
                  <div className="relative shrink-0">
                    {c.userImage ? (
                      <img
                        src={c.userImage}
                        alt={c.userName || "User"}
                        className="size-9 rounded-full object-cover border border-border"
                      />
                    ) : (
                      <div className="size-9 rounded-full bg-secondary flex items-center justify-center font-bold text-xs text-foreground border border-border">
                        {(c.userName || "U")[0].toUpperCase()}
                      </div>
                    )}
                    {c.unread != null && c.unread > 0 && (
                      <span className="absolute -top-1 -right-1 size-4 rounded-full bg-primary text-black font-bold text-[10px] flex items-center justify-center shadow">
                        {c.unread}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="font-semibold text-xs text-foreground truncate">
                        {c.userName || "Ace Scrims Player"}
                      </p>
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                        {c.createdAt ? new Date(c.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {c.latestMessage || "No messages yet"}
                    </p>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Right Pane: Selected Conversation & Reply */}
      <div className="flex-1 flex flex-col bg-background/80 min-w-0">
        {selectedUserId ? (
          <>
            {/* Thread Header */}
            <div className="p-3.5 px-5 border-b border-border/60 flex items-center justify-between bg-secondary/10 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                {selectedConversation?.userImage ? (
                  <img
                    src={selectedConversation.userImage}
                    alt={selectedConversation.userName || "User"}
                    className="size-9 rounded-full object-cover border border-border shrink-0"
                  />
                ) : (
                  <div className="size-9 rounded-full bg-secondary flex items-center justify-center font-bold text-xs text-foreground border border-border shrink-0">
                    {(selectedConversation?.userName || "U")[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="font-display text-sm font-bold text-foreground truncate">
                    {selectedConversation?.userName || "Player Support Session"}
                  </h3>
                  <p className="text-[11px] text-muted-foreground font-mono truncate">
                    ID: {selectedUserId}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fetchThread(selectedUserId, false)}
                  className="h-8 text-xs gap-1"
                >
                  <RefreshCw className="size-3" />
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleClearHistory}
                  className="h-8 text-xs gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="size-3" />
                  Clear Thread
                </Button>
              </div>
            </div>

            {/* Thread Messages */}
            <div
              ref={containerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-4 space-y-3.5 relative"
            >
              {loadingThread ? (
                <div className="flex items-center justify-center h-full text-xs text-muted-foreground gap-2">
                  <Loader2 className="size-4 animate-spin text-primary" />
                  Loading message history...
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-xs text-muted-foreground p-6">
                  <MessageSquare className="size-10 mb-2 opacity-30 text-primary" />
                  <p className="font-semibold text-foreground">No messages in this conversation yet</p>
                  <p className="text-[11px] mt-1 max-w-xs">
                    Type a reply below or select a quick response template to start the interaction.
                  </p>
                </div>
              ) : (
                messages.map((m) => {
                  const isStaff = m.senderRole === "admin" || m.senderRole === "moderator"
                  return (
                    <div
                      key={m.id}
                      className={cn(
                        "group flex flex-col max-w-[82%] sm:max-w-[70%]",
                        isStaff ? "ml-auto items-end" : "mr-auto items-start"
                      )}
                    >
                      <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-muted-foreground">
                        <span className="font-semibold text-foreground">
                          {isStaff ? "Staff Support" : m.senderName}
                        </span>
                        {isStaff && (
                          <Badge variant="outline" className="text-[9px] py-0 px-1 border-primary/40 text-primary">
                            Staff
                          </Badge>
                        )}
                        <span>•</span>
                        <span className="font-mono text-[10px]">
                          {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                        </span>
                      </div>

                      <div
                        className={cn(
                          "rounded-2xl p-3 text-xs leading-relaxed shadow-md relative",
                          isStaff
                            ? "bg-primary text-black rounded-tr-xs"
                            : "bg-secondary/70 text-foreground border border-border/50 rounded-tl-xs"
                        )}
                      >
                        {m.message && <p className="whitespace-pre-wrap">{m.message}</p>}

                        {/* Image Attachment */}
                        {m.attachmentUrl && m.attachmentType === "image" && (
                          <div className="mt-2 rounded-xl overflow-hidden border border-black/20 bg-black/40 max-w-sm">
                            <a href={m.attachmentUrl} target="_blank" rel="noopener noreferrer">
                              <img
                                src={m.attachmentUrl}
                                alt="Attachment"
                                className="max-h-60 w-auto rounded-xl object-contain hover:opacity-90 transition-opacity"
                              />
                            </a>
                          </div>
                        )}

                        {/* File Attachment */}
                        {m.attachmentUrl && m.attachmentType !== "image" && (
                          <div className="mt-2 flex items-center gap-2 p-2 rounded-lg bg-black/10 border border-black/10">
                            <FileText className="size-4 shrink-0" />
                            <a
                              href={m.attachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline text-[11px] font-mono truncate max-w-xs"
                            >
                              {m.attachmentName || "View File Attachment"}
                            </a>
                          </div>
                        )}

                        {/* Hover Delete Action */}
                        <button
                          type="button"
                          onClick={() => handleDeleteMessage(m.id)}
                          title="Delete message"
                          className={cn(
                            "absolute -top-2 -right-2 size-5 rounded-full bg-background border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:bg-destructive hover:text-white shadow cursor-pointer"
                          )}
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={bottomRef} />
            </div>

            {/* Quick Replies Bar */}
            <div className="px-4 py-2 border-t border-border/40 bg-secondary/10 flex items-center gap-1.5 overflow-x-auto text-[11px] shrink-0">
              <span className="text-muted-foreground font-semibold flex items-center gap-1 shrink-0">
                <Sparkles className="size-3 text-primary" />
                Templates:
              </span>
              {QUICK_REPLIES.map((reply, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setInputText(reply)}
                  className="px-2.5 py-1 rounded-full border border-border/60 bg-secondary/40 text-foreground hover:bg-primary/20 hover:border-primary/40 transition-colors whitespace-nowrap cursor-pointer shrink-0"
                >
                  {reply.slice(0, 32)}...
                </button>
              ))}
            </div>

            {/* Attachment preview if pending */}
            {attachedUrl && (
              <div className="px-4 py-1.5 border-t border-border/40 bg-secondary/20 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Paperclip className="size-3.5 text-primary" />
                  <span className="font-mono text-[11px] truncate max-w-xs">{attachedName || "Ready to send"}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAttachedUrl(null)
                    setAttachedType(null)
                    setAttachedName(null)
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}

            {/* Chat Input Box */}
            <form onSubmit={handleSend} className="p-3 border-t border-border/60 bg-background/90 flex items-end gap-2 shrink-0">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf,.doc,.docx"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || isSending}
                title="Attach screenshot or file"
                className="size-9 p-0 shrink-0 border-border"
              >
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
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
                placeholder="Type your response to the player (Press Enter to send)..."
                rows={1}
                className="min-h-[38px] max-h-32 text-xs resize-none"
              />

              <Button
                type="submit"
                size="sm"
                disabled={(!inputText.trim() && !attachedUrl) || isSending}
                className="glow-primary size-9 p-0 shrink-0 font-bold"
              >
                {isSending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </Button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
            <MessageSquare className="size-12 mb-3 opacity-30 text-primary" />
            <h3 className="font-display font-bold text-base text-foreground">Select a Player Conversation</h3>
            <p className="text-xs max-w-sm mt-1">
              Select a conversation from the sidebar to review customer messages, send replies, or share room credentials and verification updates.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
