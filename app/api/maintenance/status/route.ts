import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { settings } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(settings)
      .where(eq(settings.key, "maintenance_mode"))
      .limit(1)

    const isMaintenanceOn = rows[0]?.value === "true"
    return NextResponse.json(
      { maintenance: isMaintenanceOn },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        },
      }
    )
  } catch {
    return NextResponse.json({ maintenance: false })
  }
}
