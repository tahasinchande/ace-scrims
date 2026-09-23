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

    const body = await req.json().catch(() => ({}))
    const userId = body.userId || body.targetUserId

    if (!userId || typeof userId !== "string") {
      return NextResponse.json({ ok: false, error: "Invalid or missing userId" }, { status: 400 })
    }

    const deleted = await db
      .delete(chatMessages)
      .where(eq(chatMessages.userId, userId.trim()))
      .returning({ id: chatMessages.id })

    return NextResponse.json({ ok: true, count: deleted.length, userId })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    )
  }
}
