import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/session"
import { getAdminCreditUsers, getAdminCreditStats, getAdminCreditTransactions } from "@/lib/queries/admin"
import { adjustUserCreditsAction } from "@/app/actions/admin"
import { creditAdjustmentSchema } from "@/lib/validations/credit"

// Explicit Next.js Route Segment Config to completely prevent build-time static page collection
export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const revalidate = 0
export const fetchCache = "force-no-store"

export async function GET(_req: NextRequest) {
  try {
    const admin = await requireAdmin().catch(() => null)
    if (!admin) {
      return NextResponse.json({ ok: false, error: "Unauthorized: Admin session required." }, { status: 401 })
    }

    const [users, stats, recentTransactions] = await Promise.all([
      getAdminCreditUsers().catch(() => []),
      getAdminCreditStats().catch(() => ({
        totalCredits: 0,
        usersWithCredits: 0,
        totalUsers: 0,
        highestBalance: 0,
        totalAdjustments: 0,
      })),
      getAdminCreditTransactions(50).catch(() => []),
    ])

    return NextResponse.json({
      ok: true,
      stats,
      users,
      recentTransactions,
    })
  } catch (err) {
    console.error("[API /admin/credits GET] Failed:", err)
    return NextResponse.json(
      { ok: false, error: "Unable to load credit records" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin().catch(() => null)
    if (!admin) {
      return NextResponse.json({ ok: false, error: "Unauthorized: Admin session required." }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const parsed = creditAdjustmentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message || "Invalid input payload" },
        { status: 400 }
      )
    }

    const result = await adjustUserCreditsAction(parsed.data)
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 })
    }

    return NextResponse.json({ ok: true, data: result.data })
  } catch (err) {
    console.error("[API /admin/credits POST] Failed:", err)
    return NextResponse.json(
      { ok: false, error: "Failed to process balance update" },
      { status: 500 }
    )
  }
}
