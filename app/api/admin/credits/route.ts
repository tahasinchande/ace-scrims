import { type NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/session"
import { getAdminCreditUsers, getAdminCreditStats, getAdminCreditTransactions } from "@/lib/queries/admin"
import { adjustUserCreditsAction, creditAdjustmentSchema } from "@/app/actions/admin"

export const dynamic = "force-dynamic"

export async function GET(_req: NextRequest) {
  try {
    await requireAdmin()
    const [users, stats, recentTransactions] = await Promise.all([
      getAdminCreditUsers(),
      getAdminCreditStats(),
      getAdminCreditTransactions(50),
    ])

    return NextResponse.json({
      ok: true,
      stats,
      users,
      recentTransactions,
    })
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Unauthorized or internal error" },
      { status: err?.message?.toLowerCase().includes("unauthorized") ? 401 : 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const body = await req.json()
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
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to process balance update" },
      { status: err?.message?.toLowerCase().includes("unauthorized") ? 401 : 500 }
    )
  }
}
