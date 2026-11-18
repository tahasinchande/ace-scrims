import { type NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/session"
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
    if (user.banned || user.role !== "admin") {
      return NextResponse.json(
        { ok: false, error: "Forbidden: Admin privileges required." },
        { status: 403 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const { bookingId, scrimId } = body

    if (!bookingId) {
      return NextResponse.json(
        { ok: false, error: "Missing bookingId in request body." },
        { status: 400 }
      )
    }

    const result = await removeTeamFromScrimAction(bookingId, scrimId)
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (err: any) {
    console.error("[API /api/admin/scrims/remove-team Error]:", err)
    return NextResponse.json(
      { ok: false, error: err?.message || "Internal Server Error" },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  return POST(req)
}
