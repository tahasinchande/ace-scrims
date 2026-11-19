import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/session"
import { escalateToHumanAgent, getUserChatState } from "@/app/actions/chat"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
}

export async function POST() {
  try {
    const sessionUser = await getSessionUser()
    if (!sessionUser) {
      return NextResponse.json(
        { ok: false, error: "Authentication required" },
        { status: 401, headers: NO_STORE_HEADERS },
      )
    }

    const res = await escalateToHumanAgent()
    if (!res.ok) {
      return NextResponse.json(res, { status: 400, headers: NO_STORE_HEADERS })
    }

    const state = await getUserChatState().catch(() => null)
    return NextResponse.json(
      {
        ...res,
        ...(state ? { state } : {}),
      },
      { status: 200, headers: NO_STORE_HEADERS },
    )
  } catch (err) {
    console.error("[API /chat/escalate POST] Failed:", err)
    return NextResponse.json(
      { ok: false, error: "Failed to connect to human support agent" },
      { status: 500, headers: NO_STORE_HEADERS },
    )
  }
}
