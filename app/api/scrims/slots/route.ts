import { NextResponse } from "next/server"
import { getActiveScrims, getBangladeshActiveDate } from "@/lib/queries/scrims"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const scrims = await getActiveScrims()
    const activeDate = getBangladeshActiveDate()

    return NextResponse.json(
      {
        ok: true,
        activeDate,
        scrims,
        timestamp: Date.now(),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    )
  } catch (err: any) {
    console.error("[API /scrims/slots] Failed to fetch live slots:", err)
    return NextResponse.json(
      { ok: false, error: "Unable to load live scrim slots" },
      { status: 500 }
    )
  }
}
