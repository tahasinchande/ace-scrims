import { NextRequest, NextResponse } from "next/server"
import { db, ensureSchemaReady } from "@/lib/db"
import { chatMessages } from "@/lib/db/schema"
import { getSessionUser } from "@/lib/session"
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
    if (!user || user.banned || (user.role !== "admin" && user.role !== "moderator")) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401, headers: NO_STORE_HEADERS })
    }

    await ensureSchemaReady()

    const body = (await req.json().catch(() => null)) as { messageId?: unknown } | null
    const messageId = typeof body?.messageId === "string" ? body.messageId.trim() : ""

    if (!messageId) {
      return NextResponse.json({ ok: false, error: "Invalid messageId" }, { status: 400, headers: NO_STORE_HEADERS })
    }

    const deleted = await db
      .delete(chatMessages)
      .where(eq(chatMessages.id, messageId))
      .returning({ id: chatMessages.id })

    if (deleted.length === 0) {
      return NextResponse.json({ ok: false, error: "Message not found" }, { status: 404, headers: NO_STORE_HEADERS })
    }

    return NextResponse.json({ ok: true, id: messageId }, { headers: NO_STORE_HEADERS })
  } catch (error) {
    console.error("[API /chat/delete POST] Failed:", error)
    return NextResponse.json(
      { ok: false, error: "Unable to delete message" },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}
