"use server"

import { randomUUID } from "crypto"
import { revalidatePath } from "next/cache"
import { db, ensureSchemaReady } from "@/lib/db"
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

export async function getUserChatState() {
  try {
    await ensureSchemaReady()
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

    const rows = await db
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
        readByStaff: chatMessages.readByStaff,
        readByUser: chatMessages.readByUser,
        createdAt: chatMessages.createdAt,
        senderImage: user.image,
      })
      .from(chatMessages)
      .leftJoin(user, eq(chatMessages.senderId, user.id))
      .where(eq(chatMessages.userId, sessionUser.id))
      .orderBy(asc(chatMessages.createdAt))
      .limit(120)

    return {
      authenticated: true,
      banned: false,
      mode: (chatSession?.mode === "human" ? "human" : "ai") as "ai" | "human",
      escalatedAt: chatSession?.escalatedAt ?? null,
      messages: rows,
    }
  } catch (err) {
    console.warn("[Chat] Error fetching user chat state:", err)
    return {
      authenticated: false,
      banned: false,
      mode: "ai" as "ai" | "human",
      escalatedAt: null as Date | null,
      messages: [],
    }
  }
}

export async function sendChatMessage(
  messageText: string,
  targetUserId?: string,
  attachmentUrl?: string,
  attachmentType?: string,
  attachmentName?: string
): Promise<{
  ok: boolean
  error: string | null
  banned?: boolean
  aiUnavailable?: boolean
  mode?: "ai" | "human"
}> {
  try {
    await ensureSchemaReady()
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
    const isStaff = effectiveRole === "admin" || effectiveRole === "moderator"

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
            senderId: "ace-system",
            senderName: "ACE Safety System",
            senderRole: "system",
            message:
              "Automated Moderation: This account was permanently suspended for sending abusive or explicit 18+/NSFW content.",
            readByStaff: false,
            readByUser: true,
            createdAt: new Date(),
          })
        })

        revalidatePath("/admin/live-chat")
        revalidatePath("/admin/chat")
        revalidatePath("/admin/users")
        return {
          ok: false,
          banned: true,
          error:
            "Account permanently banned: Abusive language or 18+/NSFW content is strictly prohibited on Ace Scrims.",
        }
      }
    }

    const conversationUserId = isStaff && targetUserId ? targetUserId : sessionUser.id
    const chatSession = await ensureUserChatSession(conversationUserId)
    const sessionMode = chatSession?.mode === "human" ? "human" : "ai"

    // Staff reply marks conversation read & keeps mode unless changed explicitly
    const markReadByStaff = isStaff || sessionMode === "ai"
    const insertedMessageId = randomUUID()

    await db.insert(chatMessages).values({
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
      readByStaff: markReadByStaff,
      readByUser: !isStaff,
      createdAt: new Date(),
    })

    await db
      .update(chatSessions)
      .set({ updatedAt: new Date() })
      .where(eq(chatSessions.userId, conversationUserId))

    let aiUnavailable = false

    // 2. If user sent a message in AI mode, generate ACE AI Support reply grounded in public DB data
    if (!isStaff && sessionMode === "ai") {
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
        await db.insert(chatMessages).values({
          id: randomUUID(),
          userId: conversationUserId,
          senderId: "ace-ai-assistant",
          senderName: "ACE AI Support",
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
      } else {
        aiUnavailable = true
        // Surface unanswered player messages to staff so nothing gets lost silently
        await db
          .update(chatMessages)
          .set({ readByStaff: false })
          .where(eq(chatMessages.id, insertedMessageId))
          .catch(() => {})

        await db.insert(chatMessages).values({
          id: randomUUID(),
          userId: conversationUserId,
          senderId: "ace-ai-assistant",
          senderName: "ACE AI Support",
          senderRole: "ai",
          message:
            "Our AI assistant is temporarily busy. Please tap 'Talk to Human Agent' at the top of this chat to connect directly with our tournament staff.",
          readByStaff: true,
          readByUser: true,
          createdAt: new Date(),
        })
      }
    }

    revalidatePath("/admin/live-chat")
    revalidatePath("/admin/chat")
    return { ok: true, error: null, aiUnavailable, mode: sessionMode }
  } catch (err) {
    console.error("[Chat] sendChatMessage failed:", err)
    return { ok: false, error: err instanceof Error ? err.message : "Failed to send message" }
  }
}

export async function escalateToHumanAgent() {
  try {
    await ensureSchemaReady()
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

    await db.insert(chatMessages).values({
      id: randomUUID(),
      userId: sessionUser.id,
      senderId: "ace-system",
      senderName: "ACE Support System",
      senderRole: "system",
      message:
        "You have requested a Human Support Agent. Your conversation is now prioritized in our live staff queue.",
      readByStaff: false,
      readByUser: true,
      createdAt: new Date(),
    })

    revalidatePath("/admin/live-chat")
    revalidatePath("/admin/chat")
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to connect to human agent" }
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

    await db.insert(chatMessages).values({
      id: randomUUID(),
      userId: targetUserId,
      senderId: "ace-system",
      senderName: "ACE Support System",
      senderRole: "system",
      message: `Human support agent (${staff.name || "Staff"}) joined the conversation.`,
      readByStaff: true,
      readByUser: false,
      createdAt: new Date(),
    })

    await logActivity(staff.id, staff.role, "chat_take_over", targetUserId)
    revalidatePath("/admin/live-chat")
    revalidatePath("/admin/chat")
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to take over chat" }
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

    await db.insert(chatMessages).values({
      id: randomUUID(),
      userId: targetUserId,
      senderId: "ace-system",
      senderName: "ACE Support System",
      senderRole: "system",
      message: "Support ticket handed back to ACE AI Assistant. You can request a human agent again anytime.",
      readByStaff: true,
      readByUser: false,
      createdAt: new Date(),
    })

    await logActivity(staff.id, staff.role, "chat_hand_back_ai", targetUserId)
    revalidatePath("/admin/live-chat")
    revalidatePath("/admin/chat")
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to hand back to AI" }
  }
}

export async function unbanChatUser(targetUserId: string, logId?: string) {
  try {
    const staff = await requireStaff()
    await ensureSchemaReady()

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
    revalidatePath("/admin/live-chat")
    revalidatePath("/admin/chat")
    revalidatePath("/admin/users")
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to unban user" }
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

    const deleted = await db
      .delete(chatMessages)
      .where(eq(chatMessages.id, messageId))
      .returning({ id: chatMessages.id, userId: chatMessages.userId })

    if (deleted.length === 0) {
      return { ok: false, error: "Message not found" }
    }

    revalidatePath("/admin/live-chat")
    revalidatePath("/admin/chat")
    return { ok: true, error: null }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to delete message" }
  }
}

export async function deleteUserChatHistory(targetUserId: string) {
  try {
    await requireStaff()

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

    revalidatePath("/admin/live-chat")
    revalidatePath("/admin/chat")
    return { ok: true, count: deleted.length, error: null }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to delete user chat history" }
  }
}

export async function getStaffChatThread(targetUserId: string) {
  try {
    await requireStaff()
    await ensureSchemaReady()

    await db
      .update(chatMessages)
      .set({ readByStaff: true })
      .where(and(eq(chatMessages.userId, targetUserId), eq(chatMessages.readByStaff, false)))

    const rows = await db
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
        readByStaff: chatMessages.readByStaff,
        readByUser: chatMessages.readByUser,
        createdAt: chatMessages.createdAt,
        senderImage: user.image,
      })
      .from(chatMessages)
      .leftJoin(user, eq(chatMessages.senderId, user.id))
      .where(eq(chatMessages.userId, targetUserId))
      .orderBy(asc(chatMessages.createdAt))
      .limit(120)

    return rows
  } catch (err) {
    console.warn("[Chat] Error fetching staff thread:", err)
    return []
  }
}
