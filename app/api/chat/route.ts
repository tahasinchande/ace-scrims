import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/session"
import { getUserChatState, sendChatMessage } from "@/app/actions/chat"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
}

export async function GET() {
  try {
    const sessionUser = await getSessionUser()
    if (!sessionUser) {
      return NextResponse.json(
        { ok: false, authenticated: false, error: "Authentication required" },
        { status: 401, headers: NO_STORE_HEADERS },
      )
    }

    const state = await getUserChatState()
    return NextResponse.json(
      { ok: true, ...state },
      { status: 200, headers: NO_STORE_HEADERS },
    )
  } catch (err) {
    console.error("[API /chat GET] Failed:", err)
    return NextResponse.json(
      { ok: false, error: "Unable to load support chat messages" },
      { status: 500, headers: NO_STORE_HEADERS },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser()
    if (!sessionUser) {
      return NextResponse.json(
        { ok: false, error: "Please sign in to send messages to support" },
        { status: 401, headers: NO_STORE_HEADERS },
      )
    }

    const body = (await req.json().catch(() => null)) as {
      message?: string
      targetUserId?: string
      attachmentUrl?: string
      attachmentType?: string
      attachmentName?: string
    } | null

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Invalid message payload" },
        { status: 400, headers: NO_STORE_HEADERS },
      )
    }

    const res = await sendChatMessage(
      typeof body.message === "string" ? body.message : "",
      typeof body.targetUserId === "string" ? body.targetUserId : undefined,
      typeof body.attachmentUrl === "string" ? body.attachmentUrl : undefined,
      typeof body.attachmentType === "string" ? body.attachmentType : undefined,
      typeof body.attachmentName === "string" ? body.attachmentName : undefined,
    )

    if (!res.ok) {
      const status = res.banned ? 403 : 400
      return NextResponse.json(res, { status, headers: NO_STORE_HEADERS })
    }

    const state = !body.targetUserId ? await getUserChatState().catch(() => null) : null
    return NextResponse.json(
      {
        ...res,
        ...(state ? { state } : {}),
      },
      { status: 200, headers: NO_STORE_HEADERS },
    )
  } catch (err) {
    console.error("[API /chat POST] Failed:", err)
    return NextResponse.json(
      { ok: false, error: "Failed to deliver message. Please try again." },
      { status: 500, headers: NO_STORE_HEADERS },
    )
  }
}
