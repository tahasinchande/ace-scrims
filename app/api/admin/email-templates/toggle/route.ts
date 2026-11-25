import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getSessionUser } from "@/lib/session"
import { isAdminOrOwner } from "@/lib/roles"
import { logActivity } from "@/lib/notify"
import {
  getAllEmailTemplates,
  serializeEmailTemplate,
  toggleEmailTemplateByIdOrKey,
} from "@/lib/queries/email-templates"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const togglePayloadSchema = z.object({
  id: z.string().trim().max(120).optional(),
  purposeKey: z.string().trim().max(80).optional(),
  isEnabled: z.boolean(),
}).refine((v) => Boolean(v.id || v.purposeKey), {
  message: "Either template id or purposeKey is required.",
})

export async function GET() {
  try {
    const user = await getSessionUser().catch(() => null)
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }
    if (user.banned || !isAdminOrOwner(user.role)) {
      return NextResponse.json({ ok: false, error: "Forbidden. Admin access required." }, { status: 403 })
    }

    const templates = await getAllEmailTemplates()
    return NextResponse.json({
      ok: true,
      templates: templates.map(serializeEmailTemplate),
    })
  } catch (err) {
    console.error("[GET /api/admin/email-templates/toggle Error]:", err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed to load email templates" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser().catch(() => null)
    if (!user) {
      return NextResponse.json({ ok: false, error: "Unauthorized. Please sign in as admin." }, { status: 401 })
    }
    if (user.banned || !isAdminOrOwner(user.role)) {
      return NextResponse.json({ ok: false, error: "Forbidden. Admin privileges required." }, { status: 403 })
    }

    let rawBody: unknown
    try {
      rawBody = await req.json()
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON request body." }, { status: 400 })
    }

    const parsed = togglePayloadSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message || "Invalid toggle payload." },
        { status: 400 }
      )
    }

    const { id, purposeKey, isEnabled } = parsed.data
    const updated = await toggleEmailTemplateByIdOrKey({
      id,
      purposeKey,
      isEnabled,
      actorId: user.id,
    })

    if (!updated) {
      return NextResponse.json(
        { ok: false, error: "Email template not found." },
        { status: 404 }
      )
    }

    await logActivity(user.id, user.role, "toggle_email_template", updated.purposeKey, {
      isEnabled: updated.isEnabled,
    })

    try {
      revalidatePath("/admin/email")
    } catch {
      // Ignore revalidation errors outside page render
    }

    return NextResponse.json({
      ok: true,
      isEnabled: updated.isEnabled,
      template: serializeEmailTemplate(updated),
    })
  } catch (err) {
    console.error("[POST /api/admin/email-templates/toggle Error]:", err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed to update email toggle" },
      { status: 500 }
    )
  }
}
