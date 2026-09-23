import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { chatMessages } from "@/lib/db/schema"
import { getSessionUser } from "@/lib/session"
import { eq } from "drizzle-orm"

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user || (user.role !== "admin" && user.role !== "moderator")) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const { messageId } = body

    if (!messageId || typeof messageId !== "string") {
      return NextResponse.json({ ok: false, error: "Invalid messageId" }, { status: 400 })
    }

    const deleted = await db
      .delete(chatMessages)
      .where(eq(chatMessages.id, messageId))
      .returning({ id: chatMessages.id })

    if (deleted.length === 0) {
      return NextResponse.json({ ok: false, error: "Message not found" }, { status: 404 })
    }

    return NextResponse.json({ ok: true, id: messageId })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    )
  }
}
