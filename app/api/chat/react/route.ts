import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/session"
import { toggleChatReaction } from "@/app/actions/chat"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
}

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser()
    if (!sessionUser) {
      return NextResponse.json(
        { ok: false, error: "Authentication required" },
        { status: 401, headers: NO_STORE_HEADERS },
      )
    }

    const body = (await req.json().catch(() => null)) as {
      messageId?: string
      emoji?: string
    } | null

    if (!body || typeof body.messageId !== "string" || typeof body.emoji !== "string") {
      return NextResponse.json(
        { ok: false, error: "Invalid reaction payload" },
        { status: 400, headers: NO_STORE_HEADERS },
      )
    }

    const res = await toggleChatReaction(body.messageId, body.emoji)
    if (!res.ok) {
      const status =
        res.error === "Unauthorized" || res.error === "Account is suspended"
          ? 403
          : res.error === "Message not found"
            ? 404
            : 400
      return NextResponse.json(res, { status, headers: NO_STORE_HEADERS })
    }

    return NextResponse.json(res, { status: 200, headers: NO_STORE_HEADERS })
  } catch (err) {
    console.error("[API /chat/react POST] Failed:", err)
    return NextResponse.json(
      { ok: false, error: "Unable to update reaction" },
      { status: 500, headers: NO_STORE_HEADERS },
    )
  }
}
