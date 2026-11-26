import { type NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/session"
import { isAdminOrOwner } from "@/lib/roles"
import { removeTeamFromScrimAction } from "@/app/actions/admin"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const revalidate = 0
export const fetchCache = "force-no-store"

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser().catch(() => null)
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized: Valid session required." },
        { status: 401 }
      )
    }
    if (user.banned || !isAdminOrOwner(user.role)) {
      return NextResponse.json(
        { ok: false, error: "Forbidden: Admin privileges required." },
        { status: 403 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const bookingId = typeof body?.bookingId === "string" ? body.bookingId.trim() : ""
    const scrimId = typeof body?.scrimId === "string" ? body.scrimId.trim() : undefined

    if (!bookingId) {
      return NextResponse.json(
        { ok: false, error: "Missing bookingId in request body." },
        { status: 400, headers: { "Cache-Control": "no-store, private" } }
      )
    }

    const result = await removeTeamFromScrimAction(bookingId, scrimId)
    if (!result.ok) {
      return NextResponse.json(result, {
        status: 400,
        headers: { "Cache-Control": "no-store, private" },
      })
    }

    return NextResponse.json(result, { headers: { "Cache-Control": "no-store, private" } })
  } catch (err) {
    console.error("[API /api/admin/scrims/remove-team Error]:", err)
    return NextResponse.json(
      { ok: false, error: "Internal Server Error" },
      { status: 500, headers: { "Cache-Control": "no-store, private" } }
    )
  }
}

export async function DELETE(req: NextRequest) {
  return POST(req)
}
