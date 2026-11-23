export const CHAT_REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"] as const

export type ChatReactionEmoji = (typeof CHAT_REACTION_EMOJIS)[number]

export type ChatReactionEntry = {
  userId: string
  userName: string
}

export type ChatReactionsMap = Record<string, ChatReactionEntry[]>

export type ChatReplyPreview = {
  id: string
  senderName: string
  senderRole: string
  message: string
  attachmentType?: string | null
}

const ALLOWED_EMOJIS = new Set<string>(CHAT_REACTION_EMOJIS)

export function isAllowedReactionEmoji(value: unknown): value is ChatReactionEmoji {
  return typeof value === "string" && ALLOWED_EMOJIS.has(value)
}

export function parseChatReactions(raw?: string | null): ChatReactionsMap {
  if (!raw || typeof raw !== "string") return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    const out: ChatReactionsMap = {}
    for (const [emoji, entries] of Object.entries(parsed as Record<string, unknown>)) {
      if (!ALLOWED_EMOJIS.has(emoji) || !Array.isArray(entries)) continue
      const cleanEntries: ChatReactionEntry[] = []
      const seenUsers = new Set<string>()
      for (const item of entries) {
        if (!item || typeof item !== "object") continue
        const rec = item as Record<string, unknown>
        const userId = typeof rec.userId === "string" ? rec.userId.trim() : ""
        const userName = typeof rec.userName === "string" ? rec.userName.trim() : "Player"
        if (!userId || seenUsers.has(userId)) continue
        seenUsers.add(userId)
        cleanEntries.push({ userId, userName: userName.slice(0, 60) })
      }
      if (cleanEntries.length > 0) {
        out[emoji] = cleanEntries
      }
    }
    return out
  } catch {
    return {}
  }
}

export function applyReactionToggle(
  current: ChatReactionsMap,
  emoji: ChatReactionEmoji,
  actor: ChatReactionEntry,
): ChatReactionsMap {
  const next: ChatReactionsMap = {}
  let alreadyHadSameEmoji = false

  for (const [key, list] of Object.entries(current)) {
    const hasActor = list.some((entry) => entry.userId === actor.userId)
    if (key === emoji && hasActor) {
      alreadyHadSameEmoji = true
    }
    // Like Messenger, each user holds one active reaction per message (clicking a new emoji switches it; clicking the same removes it)
    const filtered = list.filter((entry) => entry.userId !== actor.userId)
    if (filtered.length > 0) {
      next[key] = filtered
    }
  }

  if (!alreadyHadSameEmoji) {
    next[emoji] = [...(next[emoji] || []), { userId: actor.userId, userName: actor.userName.slice(0, 60) }]
  }

  return next
}

export function getReplySnippet(msg: {
  message?: string | null
  attachmentType?: string | null
  attachmentName?: string | null
}): string {
  const clean = (msg.message || "").trim()
  if (clean) return clean.length > 96 ? `${clean.slice(0, 96)}…` : clean
  if (msg.attachmentType === "image") return "Photo attachment"
  if (msg.attachmentType === "video") return "Video attachment"
  if (msg.attachmentName) return msg.attachmentName
  return "Attachment"
}
