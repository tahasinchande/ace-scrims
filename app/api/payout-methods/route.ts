import { NextResponse } from "next/server"
import { getActivePayoutMethods } from "@/lib/queries/payout-methods"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const methods = await getActivePayoutMethods()
    return NextResponse.json(
      { ok: true, methods },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    )
  } catch (err) {
    console.error("[API /payout-methods] Failed:", err)
    return NextResponse.json(
      { ok: false, error: "Failed to load payout methods" },
      { status: 500 }
    )
  }
}
