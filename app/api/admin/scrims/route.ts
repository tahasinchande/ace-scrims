import { NextResponse } from "next/server"
import { getSessionUser } from "@/lib/session"
import { getAdminScrims, getAllBookingsByScrim } from "@/lib/queries/admin"
import { isRoom2Enabled } from "@/lib/queries/scrims"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
}

export async function GET() {
  try {
    const user = await getSessionUser().catch(() => null)
    if (!user || (user.role !== "admin" && user.role !== "moderator") || user.banned) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized: Staff privileges required." },
        { status: 401, headers: NO_STORE_HEADERS }
      )
    }

    const [scrims, bookingsByScrim, room2Enabled] = await Promise.all([
      getAdminScrims({ includeDeleted: true }),
      getAllBookingsByScrim().catch(() => ({})),
      isRoom2Enabled().catch(() => false),
    ])

    return NextResponse.json(
      {
        ok: true,
        scrims,
        bookingsByScrim,
        room2Enabled,
        timestamp: Date.now(),
      },
      { headers: NO_STORE_HEADERS }
    )
  } catch (err: any) {
    console.error("[API /api/admin/scrims] Error:", err)
    return NextResponse.json(
      { ok: false, error: "Unable to load live admin scrims" },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}
