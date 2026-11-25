import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/session"
import { isAdminOrOwner } from "@/lib/roles"
import { wipeDeploymentData } from "@/app/actions/admin"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized: Valid session token required." }, { status: 401 })
    }
    if (user.banned || !isAdminOrOwner(user.role)) {
      return NextResponse.json({ ok: false, error: "Forbidden: Admin privileges required." }, { status: 403 })
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
