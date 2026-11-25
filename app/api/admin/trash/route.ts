import { NextRequest, NextResponse } from "next/server"
import { getSessionUser } from "@/lib/session"
import { isAdminOrOwner } from "@/lib/roles"
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
    if (user.banned || !isAdminOrOwner(user.role)) {
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
    if (user.banned || !isAdminOrOwner(user.role)) {
      return NextResponse.json({ error: "Forbidden: Admin privileges required." }, { status: 403 })
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 })
    }

    const { action, type, id, ids } = body as {
      action?: unknown
      type?: unknown
      id?: unknown
      ids?: unknown
    }

    if (typeof action !== "string" || (type !== "scrim" && type !== "result")) {
      return NextResponse.json({ error: "Invalid action or type" }, { status: 400 })
    }

    if (action === "restore") {
      if (typeof id !== "string" || !id.trim()) return NextResponse.json({ error: "Missing id" }, { status: 400 })
      const res = type === "scrim" ? await restoreScrim(id.trim()) : await restoreResult(id.trim())
      return NextResponse.json(res)
    }

    if (action === "delete_permanently") {
      if (typeof id !== "string" || !id.trim()) return NextResponse.json({ error: "Missing id" }, { status: 400 })
      const res = type === "scrim" ? await permanentlyDeleteScrim(id.trim()) : await permanentlyDeleteResult(id.trim())
      return NextResponse.json(res)
    }

    if (action === "bulk_restore") {
      const cleanIds = Array.isArray(ids)
        ? ids.filter((v): v is string => typeof v === "string" && v.trim().length > 0).map((v) => v.trim())
        : []
      if (cleanIds.length === 0) {
        return NextResponse.json({ error: "Missing valid ids array" }, { status: 400 })
      }
      const res = type === "scrim" ? await bulkRestoreScrims(cleanIds) : await bulkRestoreResults(cleanIds)
      return NextResponse.json(res)
    }

    if (action === "bulk_delete_permanently") {
      const cleanIds = Array.isArray(ids)
        ? ids.filter((v): v is string => typeof v === "string" && v.trim().length > 0).map((v) => v.trim())
        : []
      if (cleanIds.length === 0) {
        return NextResponse.json({ error: "Missing valid ids array" }, { status: 400 })
      }
      const res =
        type === "scrim"
          ? await bulkPermanentlyDeleteScrims(cleanIds)
          : await bulkPermanentlyDeleteResults(cleanIds)
      return NextResponse.json(res)
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 })
  } catch (e) {
    console.error("[API /admin/trash POST] Error:", e)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
