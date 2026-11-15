import { NextResponse } from "next/server"
import { autoCancelUnderfilledScrims } from "@/app/actions/not-hosted"
import { getSessionUser } from "@/lib/session"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET?.trim()

    const hasValidCronToken = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`)
    if (!hasValidCronToken) {
      const user = await getSessionUser().catch(() => null)
      if (!user || user.banned || user.role !== "admin") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }

    const result = await autoCancelUnderfilledScrims()
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  return GET(req)
}
