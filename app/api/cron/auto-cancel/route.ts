import { timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"
import { autoCancelUnderfilledScrims } from "@/lib/not-hosted-service"
import { getSessionUser } from "@/lib/session"
import { isAdminOrOwner } from "@/lib/roles"

export const dynamic = "force-dynamic"

function isValidCronBearer(authHeader: string | null, secret: string | undefined): boolean {
  if (!authHeader || !secret) return false
  const expected = Buffer.from(`Bearer ${secret}`, "utf8")
  const provided = Buffer.from(authHeader, "utf8")
  if (expected.length !== provided.length) return false
  return timingSafeEqual(expected, provided)
}

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET?.trim()

    const hasValidCronToken = isValidCronBearer(authHeader, cronSecret)
    if (!hasValidCronToken) {
      const user = await getSessionUser().catch(() => null)
      if (!user || user.banned || !isAdminOrOwner(user.role)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
    }

    const result = await autoCancelUnderfilledScrims()
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store, private" } })
  } catch (err) {
    console.error("[API /api/cron/auto-cancel Error]:", err)
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500, headers: { "Cache-Control": "no-store, private" } }
    )
  }
}

export async function POST(req: Request) {
  return GET(req)
}
