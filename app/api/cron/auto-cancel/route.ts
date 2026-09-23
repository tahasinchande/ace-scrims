import { NextResponse } from "next/server"
import { autoCancelUnderfilledScrims } from "@/app/actions/not-hosted"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    // If a CRON_SECRET is configured, enforce Bearer authorization
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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
