import { NextResponse } from "next/server"
import {
  getActiveScrims,
  getScrimById,
  getBangladeshActiveDate,
  getRoomMultiplier,
  getEvaluatedScheduleOverride,
} from "@/lib/queries/scrims"
import { sanitizePublicScrim } from "@/lib/iceberg"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const scrimId = searchParams.get("scrimId")?.trim()
    const activeDate = getBangladeshActiveDate()
    const [roomMultiplier, scheduleInfo] = await Promise.all([
      getRoomMultiplier().catch(() => 1),
      getEvaluatedScheduleOverride().catch(() => null),
    ])

    if (scrimId) {
      const scrim = await getScrimById(scrimId)
      if (!scrim) {
        return NextResponse.json(
          { ok: false, error: "Scrim not found" },
          { status: 404, headers: NO_STORE_HEADERS }
        )
      }
      return NextResponse.json(
        {
          ok: true,
          activeDate,
          roomMultiplier,
          scheduleStatus: scheduleInfo?.status ?? null,
          scrim: sanitizePublicScrim(scrim),
          timestamp: Date.now(),
        },
        { headers: NO_STORE_HEADERS }
      )
    }

    const scrims = await getActiveScrims()
    return NextResponse.json(
      {
        ok: true,
        activeDate,
        roomMultiplier,
        scheduleStatus: scheduleInfo?.status ?? null,
        scrims: scrims.map((s) => sanitizePublicScrim(s)),
        timestamp: Date.now(),
      },
      { headers: NO_STORE_HEADERS }
    )
  } catch (err: any) {
    console.error("[API /scrims/slots] Failed to fetch live slots:", err)
    return NextResponse.json(
      { ok: false, error: "Unable to load live scrim slots" },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}
