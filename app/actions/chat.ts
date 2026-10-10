"use server"

import { randomUUID } from "crypto"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { chatMessages, user } from "@/lib/db/schema"
import { getSessionUser, requireStaff } from "@/lib/session"
import { eq, desc, asc, and, sql } from "drizzle-orm"

export async function sendChatMessage(
  messageText: string,
  targetUserId?: string,
  attachmentUrl?: string,
  attachmentType?: string,
  attachmentName?: string
) {
  try {
    const sessionUser = await getSessionUser()
    if (!sessionUser) return { ok: false, error: "Authentication required" }

    const cleanMsg = messageText.trim()
    if (!cleanMsg && !attachmentUrl) return { ok: false, error: "Message or file attachment is required" }
    if (cleanMsg.length > 2000) return { ok: false, error: "Message exceeds limit" }

    const isStaff = sessionUser.role === "admin" || sessionUser.role === "moderator"

    let conversationUserId = sessionUser.id
    if (isStaff && targetUserId) {
      conversationUserId = targetUserId
    }

    await db.insert(chatMessages).values({
      id: randomUUID(),
      userId: conversationUserId,
      senderId: sessionUser.id,
      senderName: sessionUser.name || "User",
      senderRole: sessionUser.role || "user",
      message: cleanMsg || (attachmentType === "image" ? "📷 Image attachment" : "📄 File attachment"),
      attachmentUrl: attachmentUrl || null,
      attachmentType: attachmentType || null,
      attachmentName: attachmentName || null,
      readByStaff: isStaff,
      readByUser: !isStaff,
      createdAt: new Date(),
    })

    revalidatePath("/admin/chat")
    return { ok: true, error: null }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to send message" }
  }
}

export async function getUserChatMessages() {
  try {
    const sessionUser = await getSessionUser()
    if (!sessionUser) return []

    // Mark staff messages as read by user
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
      .limit(100)

    return rows
  } catch (err) {
    console.warn("[Chat] Error fetching user messages:", err)
    return []
  }
}

export async function getStaffChatConversations() {
  try {
    await requireStaff()

    // Get all chat messages ordered by newest first with customer details
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
        createdAt: chatMessages.createdAt,
        userAccountName: user.name,
        userAccountImage: user.image,
      })
      .from(chatMessages)
      .leftJoin(user, eq(chatMessages.userId, user.id))
      .orderBy(desc(chatMessages.createdAt))

    // Group by userId to get latest message and customer identity
    const map = new Map<
      string,
      {
        userId: string
        userName: string
        userImage: string | null
        latestMessage: string
        createdAt: Date
        unread: number
        hasAttachment: boolean
        attachmentType: string | null
      }
    >()

    for (const r of rows) {
      // Determine customer's persistent name:
      // 1. user account name from database
      // 2. if not admin/mod, senderName
      // 3. fallback "Unknown User"
      const resolvedCustomerName =
        r.userAccountName?.trim() ||
        (r.senderRole !== "admin" && r.senderRole !== "moderator" ? r.senderName?.trim() : null) ||
        "Unknown User"

      let previewText = r.message?.trim() || ""
      if (!previewText) {
        if (r.attachmentType === "image" || (r.attachmentUrl && /\.(png|jpe?g|webp|gif)$/i.test(r.attachmentUrl))) {
          previewText = "📷 Image attachment"
        } else if (r.attachmentUrl) {
          previewText = "📄 File attachment"
        } else {
          previewText = "Message"
        }
      }

      if (!map.has(r.userId)) {
        map.set(r.userId, {
          userId: r.userId,
          userName: resolvedCustomerName,
          userImage: r.userAccountImage || null,
          latestMessage: previewText,
          createdAt: r.createdAt,
          unread: !r.readByStaff ? 1 : 0,
          hasAttachment: Boolean(r.attachmentUrl),
          attachmentType: r.attachmentType,
        })
      } else {
        const existing = map.get(r.userId)!
        // If the user's name in existing was Unknown User but we now find an account name or customer senderName, update it
        if ((existing.userName === "Unknown User" || !existing.userName) && resolvedCustomerName !== "Unknown User") {
          existing.userName = resolvedCustomerName
        }
        if (!existing.userImage && r.userAccountImage) {
          existing.userImage = r.userAccountImage
        }
        if (!r.readByStaff) {
          existing.unread += 1
        }
      }
    }

    const conversations = Array.from(map.values())
    return conversations
  } catch (err) {
    console.warn("[Chat] Error fetching staff conversations:", err)
    return []
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

    revalidatePath("/admin/chat")
    return { ok: true, error: null }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to delete message" }
  }
}

/**
 * Admin / Staff bulk moderation action:
 * Deletes all chat messages associated with a specific user's conversation (userId).
 */
export async function deleteUserChatHistory(targetUserId: string) {
  try {
    await requireStaff()

    if (!targetUserId || typeof targetUserId !== "string") {
      return { ok: false, error: "Target user ID is required" }
    }

    const deleted = await db
      .delete(chatMessages)
      .where(eq(chatMessages.userId, targetUserId.trim()))
      .returning({ id: chatMessages.id })

    revalidatePath("/admin/chat")
    return { ok: true, count: deleted.length, error: null }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to delete user chat history" }
  }
}

export async function getStaffChatThread(targetUserId: string) {
  try {
    await requireStaff()

    // Mark as read by staff
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
      .limit(100)

    return rows
  } catch (err) {
    console.warn("[Chat] Error fetching staff thread:", err)
    return []
  }
}
