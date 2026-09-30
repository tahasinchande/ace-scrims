import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/session"
import { wipeDeploymentData } from "@/app/actions/admin"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin().catch(() => null)
    if (!admin) {
      return NextResponse.json({ ok: false, error: "Unauthorized: Admin access required." }, { status: 401 })
    }

    let deleteNonAdminUsers = false
    try {
      const body = await req.json()
      deleteNonAdminUsers = Boolean(body?.deleteNonAdminUsers)
    } catch {
      // JSON body is optional
    }

    const res = await wipeDeploymentData({ deleteNonAdminUsers })
    return NextResponse.json(res, { status: res.ok ? 200 : 500 })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Internal server error" }, { status: 500 })
  }
}
