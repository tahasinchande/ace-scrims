"use server"

import { randomUUID } from "crypto"
import { revalidatePath } from "next/cache"
import { db, ensureChatSchema, ensureSchemaReady } from "@/lib/db"
import {
  chatMessages,
  chatModerationLogs,
  chatSessions,
  session as sessionTable,
  user,
} from "@/lib/db/schema"
import { getSessionUser, requireStaff, logActivity } from "@/lib/session"
import { eq, desc, asc, and, inArray } from "drizzle-orm"
import { isSafeHttpOrRelativeUrl } from "@/lib/url-safety"
import { generateAiSupportReply, moderateUserMessage } from "@/lib/ai-support"
import {
  applyReactionToggle,
  isAllowedReactionEmoji,
  parseChatReactions,
  type ChatReactionsMap,
  type ChatReplyPreview,
} from "@/lib/chat-types"
import {
  isNonOwnerStaffRole,
  isOwnerRole,
  isStaffRole,
  RUSHX_SUPPORT_AVATAR,
  RUSHX_SUPPORT_NAME,
} from "@/lib/roles"

function isMissingSchemaError(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string; message?: string }; message?: string } | null
  const code = e?.code || e?.cause?.code
  if (code === "42703" || code === "42P01") return true
  const msg = `${e?.message || ""} ${e?.cause?.message || ""}`.toLowerCase()
  return (
    msg.includes("does not exist") &&
    (msg.includes("replytoid") ||
      msg.includes("reactions") ||
      msg.includes("chat_messages") ||
      msg.includes("chat_sessions") ||
      msg.includes("chat_moderation_logs"))
  )
}

function safeRevalidateChatPaths(extraPaths: string[] = []) {
  for (const path of ["/admin/live-chat", "/admin/chat", ...extraPaths]) {
    try {
      revalidatePath(path)
    } catch {
      // Ignore revalidation errors outside page render contexts
    }
  }
}

function enrichChatMessages<
  T extends {
    id: string
    senderName: string
    senderRole: string
    message: string
    attachmentType?: string | null
    replyToId?: string | null
    reactions?: string | null
  },
>(rows: T[]) {
  const byId = new Map<string, T>()
  for (const row of rows) {
    byId.set(row.id, row)
  }

  return rows.map((row) => {
    const parent = row.replyToId ? byId.get(row.replyToId) : undefined
    const replyTo: ChatReplyPreview | null = parent
      ? {
          id: parent.id,
          senderName: parent.senderName,
          senderRole: parent.senderRole,
          message: parent.message,
          attachmentType: parent.attachmentType ?? null,
        }
      : null

    return {
      ...row,
      reactionsMap: parseChatReactions(row.reactions),
      replyTo,
    }
  })
}

export type AdminChatConversation = {
  userId: string
  userName: string
  userEmail: string | null
  userImage: string | null
  latestMessage: string
  createdAt: Date
  unread: number
  hasAttachment: boolean
  attachmentType: string | null
  mode: "ai" | "human"
  escalatedAt: Date | null
  takenOverBy: string | null
  banned: boolean
}

async function ensureUserChatSession(userId: string) {
  await ensureSchemaReady()
  await ensureChatSchema()
  const existing = await db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.userId, userId))
    .limit(1)

  if (existing.length > 0) return existing[0]

  const [created] = await db
    .insert(chatSessions)
    .values({
      userId,
      mode: "ai",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning()

  if (created) return created

  const fallback = await db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.userId, userId))
    .limit(1)
  return fallback[0]
}

async function fetchUserChatStateOnce() {
  await ensureSchemaReady()
  await ensureChatSchema()
  const sessionUser = await getSessionUser()
  if (!sessionUser) {
    return {
      authenticated: false,
      banned: false,
      mode: "ai" as "ai" | "human",
      escalatedAt: null as Date | null,
      messages: [],
    }
  }

  const [freshUserRows, chatSession] = await Promise.all([
    db.select({ banned: user.banned }).from(user).where(eq(user.id, sessionUser.id)).limit(1),
    ensureUserChatSession(sessionUser.id),
  ])

  const isBanned = Boolean(freshUserRows[0]?.banned ?? sessionUser.banned)
  if (isBanned) {
    return {
      authenticated: true,
      banned: true,
      mode: (chatSession?.mode === "human" ? "human" : "ai") as "ai" | "human",
      escalatedAt: chatSession?.escalatedAt ?? null,
      messages: [],
    }
  }

  // Mark staff & AI messages as read by user
  await db
    .update(chatMessages)
    .set({ readByUser: true })
    .where(and(eq(chatMessages.userId, sessionUser.id), eq(chatMessages.readByUser, false)))

  const rawRows = await db
    .select({
      id: chatMessages.id,
      userId: chatMessages.userId,
      senderId: chatMessages.senderId,
      senderName: chatMessages.senderName,
      senderRole: chatMessages.senderRole,
      message: chatMessages.message,
      attachmentUrl: chatMessages.attachmentUrl,
      attachmentType: chatMessages.attachmentType,
      attachmentName: chatMessages.attachmentName,
      replyToId: chatMessages.replyToId,
      reactions: chatMessages.reactions,
      readByStaff: chatMessages.readByStaff,
      readByUser: chatMessages.readByUser,
      createdAt: chatMessages.createdAt,
      senderImage: user.image,
      senderCurrentRole: user.role,
    })
    .from(chatMessages)
    .leftJoin(user, eq(chatMessages.senderId, user.id))
    .where(eq(chatMessages.userId, sessionUser.id))
    .orderBy(asc(chatMessages.createdAt))
    .limit(120)

  // Normalize sender presentation server-side so non-Owner staff personal names/avatars
  // are masked to "RushX Support" + the 'R' logo before reaching the client (including reply quotes),
  // while Owner replies always show ONLY the exact replier's name.
  const rows = rawRows.map(({ senderCurrentRole, ...row }) => {
    const effectiveSenderRole =
      isStaffRole(row.senderRole) && isStaffRole(senderCurrentRole)
        ? senderCurrentRole!
        : row.senderRole

    if (isNonOwnerStaffRole(effectiveSenderRole)) {
      return {
        ...row,
        senderRole: effectiveSenderRole,
        senderName: RUSHX_SUPPORT_NAME,
        senderImage: RUSHX_SUPPORT_AVATAR,
      }
    }

    return {
      ...row,
      senderRole: effectiveSenderRole,
    }
  })

  return {
    authenticated: true,
    banned: false,
    mode: (chatSession?.mode === "human" ? "human" : "ai") as "ai" | "human",
    escalatedAt: chatSession?.escalatedAt ?? null,
    messages: enrichChatMessages(rows),
  }
}

export async function getUserChatState() {
  try {
    return await fetchUserChatStateOnce()
  } catch (err) {
    if (isMissingSchemaError(err)) {
      try {
        await ensureChatSchema(true)
        return await fetchUserChatStateOnce()
      } catch (retryErr) {
        console.warn("[Chat] Error fetching user chat state after schema heal:", retryErr)
      }
    } else {
      console.warn("[Chat] Error fetching user chat state:", err)
    }
    return {
      authenticated: false,
      banned: false,
      mode: "ai" as "ai" | "human",
      escalatedAt: null as Date | null,
      messages: [],
    }
  }
}

async function insertMessageWithSchemaHeal(values: typeof chatMessages.$inferInsert) {
  try {
    await db.insert(chatMessages).values(values)
  } catch (err) {
    if (isMissingSchemaError(err)) {
      await ensureChatSchema(true)
      await db.insert(chatMessages).values(values)
      return
    }
    throw err
  }
}

export async function sendChatMessage(
  messageText: string,
  targetUserId?: string,
  attachmentUrl?: string,
  attachmentType?: string,
  attachmentName?: string,
  replyToId?: string,
): Promise<{
  ok: boolean
  error: string | null
  banned?: boolean
  aiUnavailable?: boolean
  mode?: "ai" | "human"
}> {
  try {
    await ensureSchemaReady()
    await ensureChatSchema()
    const sessionUser = await getSessionUser()
    if (!sessionUser) return { ok: false, error: "Authentication required" }

    const [freshUser] = await db
      .select({ banned: user.banned, role: user.role, name: user.name, email: user.email })
      .from(user)
      .where(eq(user.id, sessionUser.id))
      .limit(1)

    if (freshUser?.banned || sessionUser.banned) {
      return {
        ok: false,
        banned: true,
        error: "Your account has been permanently suspended due to a chat safety policy violation.",
      }
    }

    const cleanMsg = messageText.trim()
    const cleanAttachmentUrl = typeof attachmentUrl === "string" ? attachmentUrl.trim() : ""
    if (!cleanMsg && !cleanAttachmentUrl) {
      return { ok: false, error: "Message or file attachment is required" }
    }
    if (cleanMsg.length > 2000) return { ok: false, error: "Message exceeds limit" }
    if (cleanAttachmentUrl && !isSafeHttpOrRelativeUrl(cleanAttachmentUrl)) {
      return { ok: false, error: "Invalid attachment URL scheme" }
    }

    const effectiveRole = freshUser?.role || sessionUser.role || "user"
    const isStaff = isStaffRole(effectiveRole)

    // 1. Two-layer AI + regex safety moderation for player messages
    if (!isStaff && cleanMsg) {
      const mod = await moderateUserMessage(cleanMsg)
      if (mod.flagged) {
        await db.transaction(async (tx) => {
          await tx
            .update(user)
            .set({ banned: true, updatedAt: new Date() })
            .where(eq(user.id, sessionUser.id))

          // Immediately revoke all active login sessions so banned user is forced out
          await tx.delete(sessionTable).where(eq(sessionTable.userId, sessionUser.id))

          await tx.insert(chatModerationLogs).values({
            id: randomUUID(),
            userId: sessionUser.id,
            userName: freshUser?.name || sessionUser.name || "User",
            userEmail: freshUser?.email || sessionUser.email || null,
            messageContent: cleanMsg.slice(0, 1000),
            violationCategory: mod.category === "none" ? "abusive" : mod.category,
            reason: mod.reason,
            confidence: mod.confidence,
            detectorSource: mod.detectorSource === "none" ? "regex" : mod.detectorSource,
            actionTaken: "permanent_ban",
            isResolved: false,
            createdAt: new Date(),
          })

          await tx.insert(chatMessages).values({
            id: randomUUID(),
            userId: sessionUser.id,
            senderId: "rushx-system",
            senderName: "RushX Safety System",
            senderRole: "system",
            message:
              "Automated Moderation: This account was permanently suspended for sending abusive or explicit 18+/NSFW content.",
            readByStaff: false,
            readByUser: true,
            createdAt: new Date(),
          })
        })

        safeRevalidateChatPaths(["/admin/users"])
        return {
          ok: false,
          banned: true,
          error:
            "Account permanently banned: Abusive language or 18+/NSFW content is strictly prohibited on RushX Organization.",
        }
      }
    }

    const conversationUserId = isStaff && targetUserId ? targetUserId : sessionUser.id
    const chatSession = await ensureUserChatSession(conversationUserId)
    const sessionMode = chatSession?.mode === "human" ? "human" : "ai"

    // Validate optional reply target belongs to the exact same conversation (prevents cross-thread IDOR)
    let validReplyToId: string | null = null
    const cleanReplyId = typeof replyToId === "string" ? replyToId.trim() : ""
    if (cleanReplyId) {
      const [parentMsg] = await db
        .select({ id: chatMessages.id, userId: chatMessages.userId })
        .from(chatMessages)
        .where(eq(chatMessages.id, cleanReplyId))
        .limit(1)
      if (parentMsg && parentMsg.userId === conversationUserId) {
        validReplyToId = parentMsg.id
      }
    }

    // Staff reply marks conversation read & keeps mode unless changed explicitly
    const markReadByStaff = isStaff || sessionMode === "ai"
    const insertedMessageId = randomUUID()

    await insertMessageWithSchemaHeal({
      id: insertedMessageId,
      userId: conversationUserId,
      senderId: sessionUser.id,
      senderName: freshUser?.name || sessionUser.name || "User",
      senderRole: effectiveRole,
      message:
        cleanMsg ||
        (attachmentType === "image"
          ? "Photo attachment"
          : attachmentType === "video"
            ? "Video attachment"
            : "File attachment"),
      attachmentUrl: cleanAttachmentUrl || null,
      attachmentType: attachmentType || null,
      attachmentName: attachmentName || null,
      replyToId: validReplyToId,
      reactions: null,
      readByStaff: markReadByStaff,
      readByUser: !isStaff,
      createdAt: new Date(),
    })

    await db
      .update(chatSessions)
      .set({ updatedAt: new Date() })
      .where(eq(chatSessions.userId, conversationUserId))
      .catch(() => {})

    let aiUnavailable = false

    // 2. If user sent a message in AI mode, generate RushX AI Support reply grounded in public DB data.
    // Isolated in its own try/catch so once the user's message is stored, AI errors never fail delivery.
    if (!isStaff && sessionMode === "ai") {
      try {
        const recentRows = await db
          .select({
            senderRole: chatMessages.senderRole,
            senderName: chatMessages.senderName,
            message: chatMessages.message,
          })
          .from(chatMessages)
          .where(eq(chatMessages.userId, conversationUserId))
          .orderBy(desc(chatMessages.createdAt))
          .limit(12)

        const history = [...recentRows].reverse().slice(0, -1)
        const userQuery =
          cleanMsg ||
          (cleanAttachmentUrl
            ? `[User uploaded a ${attachmentType || "file"} attachment: ${attachmentName || "file"}]`
            : "")

        const aiRes = await generateAiSupportReply({
          message: userQuery,
          history,
          userName: freshUser?.name || sessionUser.name || "Player",
        })

        if (aiRes.ok && aiRes.reply) {
          await insertMessageWithSchemaHeal({
            id: randomUUID(),
            userId: conversationUserId,
            senderId: "ace-ai-assistant",
            senderName: "RushX AI Support",
            senderRole: "ai",
            message: aiRes.reply,
            readByStaff: true,
            readByUser: true,
            createdAt: new Date(),
          })
          await db
            .update(chatSessions)
            .set({ lastAiReplyAt: new Date(), updatedAt: new Date() })
            .where(eq(chatSessions.userId, conversationUserId))
            .catch(() => {})
        } else {
          aiUnavailable = true
          // Surface unanswered player messages to staff so nothing gets lost silently
          await db
            .update(chatMessages)
            .set({ readByStaff: false })
            .where(eq(chatMessages.id, insertedMessageId))
            .catch(() => {})

          await insertMessageWithSchemaHeal({
            id: randomUUID(),
            userId: conversationUserId,
            senderId: "ace-ai-assistant",
            senderName: "RushX AI Support",
            senderRole: "ai",
            message:
              "Our AI assistant is temporarily busy. Please tap 'Talk to Human Agent' at the top of this chat to connect directly with our tournament staff.",
            readByStaff: true,
            readByUser: true,
            createdAt: new Date(),
          })
        }
      } catch (aiErr) {
        aiUnavailable = true
        console.warn("[Chat] AI reply generation failed after saving user message:", aiErr)
        await db
          .update(chatMessages)
          .set({ readByStaff: false })
          .where(eq(chatMessages.id, insertedMessageId))
          .catch(() => {})
      }
    }

    safeRevalidateChatPaths()
    return { ok: true, error: null, aiUnavailable, mode: sessionMode }
  } catch (err) {
    console.error("[Chat] sendChatMessage failed:", err)
    return { ok: false, error: "Unable to send message right now. Please try again." }
  }
}

export async function escalateToHumanAgent() {
  try {
    await ensureSchemaReady()
    await ensureChatSchema()
    const sessionUser = await getSessionUser()
    if (!sessionUser) return { ok: false, error: "Authentication required" }
    if (sessionUser.banned) return { ok: false, error: "Account suspended" }

    const chatSession = await ensureUserChatSession(sessionUser.id)
    if (chatSession?.mode === "human") {
      return { ok: true, alreadyHuman: true }
    }

    await db
      .update(chatSessions)
      .set({
        mode: "human",
        escalatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(chatSessions.userId, sessionUser.id))

    await insertMessageWithSchemaHeal({
      id: randomUUID(),
      userId: sessionUser.id,
      senderId: "ace-system",
      senderName: "RushX Support System",
      senderRole: "system",
      message:
        "You have requested a Human Support Agent. Your conversation is now prioritized in our live staff queue.",
      readByStaff: false,
      readByUser: true,
      createdAt: new Date(),
    })

    safeRevalidateChatPaths()
    return { ok: true }
  } catch (err) {
    console.error("[Chat] escalateToHumanAgent failed:", err)
    return { ok: false, error: "Failed to connect to human agent" }
  }
}

export async function takeOverChat(targetUserId: string) {
  try {
    const staff = await requireStaff()
    await ensureUserChatSession(targetUserId)

    await db
      .update(chatSessions)
      .set({
        mode: "human",
        takenOverBy: staff.id,
        takenOverAt: new Date(),
        escalatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(chatSessions.userId, targetUserId))

    const joinMessage = isOwnerRole(staff.role)
      ? `${staff.name?.trim() || "Owner"} joined the conversation.`
      : `${RUSHX_SUPPORT_NAME} joined the conversation.`

    await insertMessageWithSchemaHeal({
      id: randomUUID(),
      userId: targetUserId,
      senderId: "ace-system",
      senderName: "RushX Support System",
      senderRole: "system",
      message: joinMessage,
      readByStaff: true,
      readByUser: false,
      createdAt: new Date(),
    })

    await logActivity(staff.id, staff.role, "chat_take_over", targetUserId)
    safeRevalidateChatPaths()
    return { ok: true }
  } catch (err) {
    console.error("[Chat] takeOverChat failed:", err)
    return { ok: false, error: "Failed to take over chat" }
  }
}

export async function handBackToAi(targetUserId: string) {
  try {
    const staff = await requireStaff()
    await ensureUserChatSession(targetUserId)

    await db
      .update(chatSessions)
      .set({
        mode: "ai",
        takenOverBy: null,
        takenOverAt: null,
        updatedAt: new Date(),
      })
      .where(eq(chatSessions.userId, targetUserId))

    await insertMessageWithSchemaHeal({
      id: randomUUID(),
      userId: targetUserId,
      senderId: "ace-system",
      senderName: "RushX Support System",
      senderRole: "system",
      message: "Support ticket handed back to RushX AI Assistant. You can request a human agent again anytime.",
      readByStaff: true,
      readByUser: false,
      createdAt: new Date(),
    })

    await logActivity(staff.id, staff.role, "chat_hand_back_ai", targetUserId)
    safeRevalidateChatPaths()
    return { ok: true }
  } catch (err) {
    console.error("[Chat] handBackToAi failed:", err)
    return { ok: false, error: "Failed to hand back to AI" }
  }
}

export async function unbanChatUser(targetUserId: string, logId?: string) {
  try {
    const staff = await requireStaff()
    await ensureSchemaReady()
    await ensureChatSchema()

    await db
      .update(user)
      .set({ banned: false, updatedAt: new Date() })
      .where(eq(user.id, targetUserId))

    await db
      .update(chatSessions)
      .set({ mode: "ai", updatedAt: new Date() })
      .where(eq(chatSessions.userId, targetUserId))

    if (logId) {
      await db
        .update(chatModerationLogs)
        .set({ isResolved: true, resolvedBy: staff.id, resolvedAt: new Date() })
        .where(eq(chatModerationLogs.id, logId))
    } else {
      await db
        .update(chatModerationLogs)
        .set({ isResolved: true, resolvedBy: staff.id, resolvedAt: new Date() })
        .where(eq(chatModerationLogs.userId, targetUserId))
    }

    await logActivity(staff.id, staff.role, "unban_chat_user", targetUserId, { logId })
    safeRevalidateChatPaths(["/admin/users"])
    return { ok: true }
  } catch (err) {
    console.error("[Chat] unbanChatUser failed:", err)
    return { ok: false, error: "Failed to unban user" }
  }
}

export async function getUserChatMessages() {
  const state = await getUserChatState()
  return state.messages
}

export async function getStaffChatConversations(): Promise<AdminChatConversation[]> {
  try {
    await requireStaff()
    await ensureSchemaReady()
    await ensureChatSchema()

    const [rows, sessionRows] = await Promise.all([
      db
        .select({
          id: chatMessages.id,
          userId: chatMessages.userId,
          senderId: chatMessages.senderId,
          senderName: chatMessages.senderName,
          senderRole: chatMessages.senderRole,
          message: chatMessages.message,
          attachmentUrl: chatMessages.attachmentUrl,
          attachmentType: chatMessages.attachmentType,
          readByStaff: chatMessages.readByStaff,
          createdAt: chatMessages.createdAt,
          userAccountName: user.name,
          userAccountEmail: user.email,
          userAccountImage: user.image,
          userBanned: user.banned,
        })
        .from(chatMessages)
        .leftJoin(user, eq(chatMessages.userId, user.id))
        .orderBy(desc(chatMessages.createdAt)),
      db.select().from(chatSessions),
    ])

    const sessionMap = new Map(sessionRows.map((s) => [s.userId, s]))
    const map = new Map<string, AdminChatConversation>()

    for (const r of rows) {
      const sRow = sessionMap.get(r.userId)
      const mode: "ai" | "human" = sRow?.mode === "human" ? "human" : "ai"
      const resolvedCustomerName =
        r.userAccountName?.trim() ||
        (r.senderRole === "user" ? r.senderName?.trim() : null) ||
        "Unknown User"

      let previewText = r.message?.trim() || ""
      if (!previewText) {
        if (r.attachmentType === "image") previewText = "Photo attachment"
        else if (r.attachmentType === "video") previewText = "Video attachment"
        else if (r.attachmentUrl) previewText = "File attachment"
        else previewText = "Message"
      }

      const countsAsUnread = !r.readByStaff && r.senderRole === "user"

      if (!map.has(r.userId)) {
        map.set(r.userId, {
          userId: r.userId,
          userName: resolvedCustomerName,
          userEmail: r.userAccountEmail || null,
          userImage: r.userAccountImage || null,
          latestMessage: previewText,
          createdAt: r.createdAt,
          unread: countsAsUnread ? 1 : 0,
          hasAttachment: Boolean(r.attachmentUrl),
          attachmentType: r.attachmentType,
          mode,
          escalatedAt: sRow?.escalatedAt ?? null,
          takenOverBy: sRow?.takenOverBy ?? null,
          banned: Boolean(r.userBanned),
        })
      } else {
        const existing = map.get(r.userId)!
        if ((existing.userName === "Unknown User" || !existing.userName) && resolvedCustomerName !== "Unknown User") {
          existing.userName = resolvedCustomerName
        }
        if (!existing.userImage && r.userAccountImage) {
          existing.userImage = r.userAccountImage
        }
        if (countsAsUnread) {
          existing.unread += 1
        }
      }
    }

    // Also include human-escalated sessions that may have just clicked escalation before messaging
    const missingHumanSessions = sessionRows.filter(
      (sRow) => sRow.mode === "human" && !map.has(sRow.userId)
    )
    if (missingHumanSessions.length > 0) {
      const missingUserIds = missingHumanSessions.map((s) => s.userId)
      const userRows = await db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          banned: user.banned,
        })
        .from(user)
        .where(inArray(user.id, missingUserIds))
      const userMap = new Map(userRows.map((u) => [u.id, u]))

      for (const sRow of missingHumanSessions) {
        const uRow = userMap.get(sRow.userId)
        map.set(sRow.userId, {
          userId: sRow.userId,
          userName: uRow?.name || "Player",
          userEmail: uRow?.email || null,
          userImage: uRow?.image || null,
          latestMessage: "Requested human agent support",
          createdAt: sRow.escalatedAt || sRow.updatedAt,
          unread: 1,
          hasAttachment: false,
          attachmentType: null,
          mode: "human",
          escalatedAt: sRow.escalatedAt,
          takenOverBy: sRow.takenOverBy,
          banned: Boolean(uRow?.banned),
        })
      }
    }

    return Array.from(map.values())
  } catch (err) {
    console.warn("[Chat] Error fetching staff conversations:", err)
    return []
  }
}

export async function getAdminChatHubData() {
  try {
    await requireStaff()
    await ensureSchemaReady()
    await ensureChatSchema()

    const [conversations, modLogs] = await Promise.all([
      getStaffChatConversations(),
      db
        .select({
          id: chatModerationLogs.id,
          userId: chatModerationLogs.userId,
          userName: chatModerationLogs.userName,
          userEmail: chatModerationLogs.userEmail,
          messageContent: chatModerationLogs.messageContent,
          violationCategory: chatModerationLogs.violationCategory,
          reason: chatModerationLogs.reason,
          confidence: chatModerationLogs.confidence,
          detectorSource: chatModerationLogs.detectorSource,
          actionTaken: chatModerationLogs.actionTaken,
          isResolved: chatModerationLogs.isResolved,
          resolvedBy: chatModerationLogs.resolvedBy,
          resolvedAt: chatModerationLogs.resolvedAt,
          createdAt: chatModerationLogs.createdAt,
          currentBanned: user.banned,
        })
        .from(chatModerationLogs)
        .leftJoin(user, eq(chatModerationLogs.userId, user.id))
        .orderBy(desc(chatModerationLogs.createdAt))
        .limit(100),
    ])

    const humanChats = conversations.filter((c) => c.mode === "human")
    const aiChats = conversations.filter((c) => c.mode !== "human")
    const totalHumanUnread = humanChats.reduce((sum, c) => sum + (c.unread || 0), 0)

    return {
      humanChats,
      aiChats,
      moderationLogs: modLogs,
      totalHumanUnread,
    }
  } catch (err) {
    console.warn("[Chat] Error loading admin chat hub data:", err)
    return {
      humanChats: [] as AdminChatConversation[],
      aiChats: [] as AdminChatConversation[],
      moderationLogs: [],
      totalHumanUnread: 0,
    }
  }
}

export async function deleteChatMessage(messageId: string) {
  try {
    await requireStaff()
    await ensureSchemaReady()
    await ensureChatSchema()

    const deleted = await db
      .delete(chatMessages)
      .where(eq(chatMessages.id, messageId))
      .returning({ id: chatMessages.id, userId: chatMessages.userId })

    if (deleted.length === 0) {
      return { ok: false, error: "Message not found" }
    }

    safeRevalidateChatPaths()
    return { ok: true, error: null }
  } catch (err) {
    console.error("[Chat] deleteChatMessage failed:", err)
    return { ok: false, error: "Failed to delete message" }
  }
}

export async function deleteUserChatHistory(targetUserId: string) {
  try {
    await requireStaff()
    await ensureSchemaReady()
    await ensureChatSchema()

    if (!targetUserId || typeof targetUserId !== "string") {
      return { ok: false, error: "Target user ID is required" }
    }

    const cleanId = targetUserId.trim()
    const deleted = await db
      .delete(chatMessages)
      .where(eq(chatMessages.userId, cleanId))
      .returning({ id: chatMessages.id })

    await db
      .update(chatSessions)
      .set({ mode: "ai", escalatedAt: null, takenOverBy: null, takenOverAt: null, updatedAt: new Date() })
      .where(eq(chatSessions.userId, cleanId))

    safeRevalidateChatPaths()
    return { ok: true, count: deleted.length, error: null }
  } catch (err) {
    console.error("[Chat] deleteUserChatHistory failed:", err)
    return { ok: false, error: "Failed to delete user chat history" }
  }
}

async function fetchStaffChatThreadOnce(targetUserId: string) {
  await requireStaff()
  await ensureSchemaReady()
  await ensureChatSchema()

  await db
    .update(chatMessages)
    .set({ readByStaff: true })
    .where(and(eq(chatMessages.userId, targetUserId), eq(chatMessages.readByStaff, false)))

  const rawRows = await db
    .select({
      id: chatMessages.id,
      userId: chatMessages.userId,
      senderId: chatMessages.senderId,
      senderName: chatMessages.senderName,
      senderRole: chatMessages.senderRole,
      message: chatMessages.message,
      attachmentUrl: chatMessages.attachmentUrl,
      attachmentType: chatMessages.attachmentType,
      attachmentName: chatMessages.attachmentName,
      replyToId: chatMessages.replyToId,
      reactions: chatMessages.reactions,
      readByStaff: chatMessages.readByStaff,
      readByUser: chatMessages.readByUser,
      createdAt: chatMessages.createdAt,
      senderImage: user.image,
      senderCurrentRole: user.role,
    })
    .from(chatMessages)
    .leftJoin(user, eq(chatMessages.senderId, user.id))
    .where(eq(chatMessages.userId, targetUserId))
    .orderBy(asc(chatMessages.createdAt))
    .limit(120)

  const rows = rawRows.map(({ senderCurrentRole, ...row }) => {
    const effectiveSenderRole =
      isStaffRole(row.senderRole) && isStaffRole(senderCurrentRole)
        ? senderCurrentRole!
        : row.senderRole

    if (isNonOwnerStaffRole(effectiveSenderRole)) {
      return {
        ...row,
        senderRole: effectiveSenderRole,
        senderName: RUSHX_SUPPORT_NAME,
        senderImage: RUSHX_SUPPORT_AVATAR,
      }
    }

    return {
      ...row,
      senderRole: effectiveSenderRole,
    }
  })

  return enrichChatMessages(rows)
}

export async function getStaffChatThread(targetUserId: string) {
  try {
    return await fetchStaffChatThreadOnce(targetUserId)
  } catch (err) {
    if (isMissingSchemaError(err)) {
      try {
        await ensureChatSchema(true)
        return await fetchStaffChatThreadOnce(targetUserId)
      } catch (retryErr) {
        console.warn("[Chat] Error fetching staff thread after schema heal:", retryErr)
      }
    } else {
      console.warn("[Chat] Error fetching staff thread:", err)
    }
    return []
  }
}

export async function toggleChatReaction(
  messageId: string,
  emoji: string,
): Promise<{ ok: boolean; reactions?: ChatReactionsMap; error?: string }> {
  const executeToggle = async (): Promise<{ ok: boolean; reactions?: ChatReactionsMap; error?: string }> => {
    await ensureSchemaReady()
    await ensureChatSchema()
    const sessionUser = await getSessionUser()
    if (!sessionUser) {
      return { ok: false, error: "Authentication required" }
    }

    const cleanId = typeof messageId === "string" ? messageId.trim() : ""
    if (!cleanId) {
      return { ok: false, error: "Message ID is required" }
    }
    if (!isAllowedReactionEmoji(emoji)) {
      return { ok: false, error: "Unsupported reaction emoji" }
    }

    const [freshUser] = await db
      .select({ banned: user.banned, role: user.role, name: user.name })
      .from(user)
      .where(eq(user.id, sessionUser.id))
      .limit(1)

    if (freshUser?.banned || sessionUser.banned) {
      return { ok: false, error: "Account is suspended" }
    }

    const effectiveRole = freshUser?.role || sessionUser.role || "user"
    const isStaff = isStaffRole(effectiveRole)

    const [targetMsg] = await db
      .select({
        id: chatMessages.id,
        userId: chatMessages.userId,
        senderRole: chatMessages.senderRole,
        reactions: chatMessages.reactions,
      })
      .from(chatMessages)
      .where(eq(chatMessages.id, cleanId))
      .limit(1)

    if (!targetMsg) {
      return { ok: false, error: "Message not found" }
    }
    if (!isStaff && targetMsg.userId !== sessionUser.id) {
      return { ok: false, error: "Unauthorized" }
    }
    if (targetMsg.senderRole === "system") {
      return { ok: false, error: "Cannot react to system notices" }
    }

    const currentMap = parseChatReactions(targetMsg.reactions)
    const nextMap = applyReactionToggle(currentMap, emoji, {
      userId: sessionUser.id,
      userName: freshUser?.name || sessionUser.name || "Player",
    })

    const serialized = Object.keys(nextMap).length > 0 ? JSON.stringify(nextMap) : null

    await db
      .update(chatMessages)
      .set({ reactions: serialized })
      .where(eq(chatMessages.id, targetMsg.id))

    safeRevalidateChatPaths()

    return { ok: true, reactions: nextMap }
  }

  try {
    return await executeToggle()
  } catch (err) {
    if (isMissingSchemaError(err)) {
      try {
        await ensureChatSchema(true)
        return await executeToggle()
      } catch (retryErr) {
        console.error("[Chat] toggleChatReaction error after schema heal:", retryErr)
      }
    } else {
      console.error("[Chat] toggleChatReaction error:", err)
    }
    return { ok: false, error: "Failed to update reaction" }
  }
}
