import { NextRequest, NextResponse } from "next/server"
import { db, ensureSchemaReady } from "@/lib/db"
import { chatMessages, chatSessions } from "@/lib/db/schema"
import { getSessionUser } from "@/lib/session"
import { isStaffRole } from "@/lib/roles"
import { eq } from "drizzle-orm"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user || user.banned || !isStaffRole(user.role)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: NO_STORE_HEADERS })
    }

    await ensureSchemaReady()

    const body = (await req.json().catch(() => null)) as { userId?: unknown; targetUserId?: unknown } | null
    const rawUserId = typeof body?.userId === "string" ? body.userId : typeof body?.targetUserId === "string" ? body.targetUserId : ""
    const userId = rawUserId.trim()

    if (!userId) {
      return NextResponse.json({ ok: false, error: "Invalid or missing userId" }, { status: 400, headers: NO_STORE_HEADERS })
    }

    const deleted = await db
      .delete(chatMessages)
      .where(eq(chatMessages.userId, userId))
      .returning({ id: chatMessages.id })

    // Reset session back to AI mode cleanly so cleared threads don't remain stuck in human queue
    await db
      .update(chatSessions)
      .set({
        mode: "ai",
        takenOverBy: null,
        takenOverAt: null,
        escalatedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(chatSessions.userId, userId))
      .catch(() => {})

    return NextResponse.json({ ok: true, count: deleted.length, userId }, { headers: NO_STORE_HEADERS })
  } catch (error) {
    console.error("[API /chat/delete-user POST] Failed:", error)
    return NextResponse.json(
      { ok: false, error: "Unable to clear conversation history" },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}
