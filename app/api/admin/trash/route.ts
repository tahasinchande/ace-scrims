import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/session"
import { getTrashScrims, getTrashResults } from "@/lib/queries/admin"
import {
  restoreScrim,
  permanentlyDeleteScrim,
  bulkRestoreScrims,
  bulkPermanentlyDeleteScrims,
  restoreResult,
  permanentlyDeleteResult,
  bulkRestoreResults,
  bulkPermanentlyDeleteResults,
} from "@/app/actions/admin"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized: Valid session token required." }, { status: 401 })
    }
    if (user.banned || user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Admin privileges required." }, { status: 403 })
    }

    const [scrims, results] = await Promise.all([getTrashScrims(), getTrashResults()])
    return NextResponse.json({ scrims, results })
  } catch (e) {
    console.error("[API /admin/trash GET] Error:", e)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized: Valid session token required." }, { status: 401 })
    }
    if (user.banned || user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden: Admin privileges required." }, { status: 403 })
    }

    const body = await req.json()
    const { action, type, id, ids } = body

    if (!action || !type) {
      return NextResponse.json({ error: "Missing action or type" }, { status: 400 })
    }

    if (action === "restore") {
      if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
      const res = type === "scrim" ? await restoreScrim(id) : await restoreResult(id)
      return NextResponse.json(res)
    }

    if (action === "delete_permanently") {
      if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
      const res = type === "scrim" ? await permanentlyDeleteScrim(id) : await permanentlyDeleteResult(id)
      return NextResponse.json(res)
    }

    if (action === "bulk_restore") {
      if (!Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json({ error: "Missing ids array" }, { status: 400 })
      }
      const res = type === "scrim" ? await bulkRestoreScrims(ids) : await bulkRestoreResults(ids)
      return NextResponse.json(res)
    }

    if (action === "bulk_delete_permanently") {
      if (!Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json({ error: "Missing ids array" }, { status: 400 })
      }
      const res =
        type === "scrim"
          ? await bulkPermanentlyDeleteScrims(ids)
          : await bulkPermanentlyDeleteResults(ids)
      return NextResponse.json(res)
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (e) {
    console.error("[API /admin/trash POST] Error:", e)
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal Server Error" },
      { status: 500 }
    )
  }
}
