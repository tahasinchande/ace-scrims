"use server"

import { randomUUID } from "crypto"
import { revalidatePath } from "next/cache"
import { db, ensureSchemaReady } from "@/lib/db"
import { emailTemplates, type EmailTemplateMediaItem } from "@/lib/db/schema"
import { requireAdmin } from "@/lib/session"
import { logActivity } from "@/lib/notify"
import { eq } from "drizzle-orm"
import { z } from "zod"
import { escapeHtml, isSafeHttpOrRelativeUrl } from "@/lib/url-safety"
import {
  normalizeMediaItems,
  normalizeVariablesHint,
  resolveCanonicalEmailPurposeKey,
  resolveOrEnsureEmailTemplate,
  toggleEmailTemplateByIdOrKey,
  type NormalizedEmailTemplate,
} from "@/lib/queries/email-templates"
import { sendEmail, renderEmailFromTemplate, getProductionAppUrl } from "@/lib/email"

const mediaItemSchema = z.object({
  id: z.string().optional(),
  url: z.string().trim().min(1),
  type: z.enum(["image", "video", "link"]),
  name: z.string().trim().max(120).optional(),
})

const updateTemplateSchema = z.object({
  id: z.string().min(1),
  purposeKey: z.string().trim().max(80).optional(),
  label: z.string().trim().min(1, "Label is required").max(80),
  description: z.string().trim().max(300).optional().nullable(),
  isEnabled: z.boolean(),
  format: z.enum(["html", "text"]),
  subject: z.string().trim().min(1, "Subject line is required").max(200),
  preheader: z.string().trim().max(240).optional().nullable(),
  bodyHtml: z.string().max(40000),
  bodyText: z.string().max(20000),
  ctaText: z.string().trim().max(80).optional().nullable(),
  ctaUrl: z.string().trim().max(400).optional().nullable(),
  mediaItems: z.array(mediaItemSchema).max(20),
  variablesHint: z.array(z.string().trim().max(60)).max(30).optional(),
})

const createCustomTemplateSchema = z.object({
  label: z.string().trim().min(2, "Purpose name is required").max(80),
  purposeKey: z.string().trim().max(60).optional(),
  description: z.string().trim().max(300).optional().nullable(),
  format: z.enum(["html", "text"]).default("html"),
  subject: z.string().trim().min(1, "Subject is required").max(200),
  preheader: z.string().trim().max(240).optional().nullable(),
  bodyHtml: z.string().max(40000).default(""),
  bodyText: z.string().max(20000).default(""),
  ctaText: z.string().trim().max(80).optional().nullable(),
  ctaUrl: z.string().trim().max(400).optional().nullable(),
})

function slugifyPurposeKey(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50)
}

export async function updateEmailTemplateAction(
  payload: z.infer<typeof updateTemplateSchema>
): Promise<{ ok: boolean; error?: string; template?: NormalizedEmailTemplate }> {
  try {
    const admin = await requireAdmin()
    await ensureSchemaReady()

    const parsed = updateTemplateSchema.safeParse(payload)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message || "Invalid email template payload" }
    }

    const data = parsed.data
    const trimmedCtaUrl = data.ctaUrl?.trim() || null
    if (trimmedCtaUrl && !trimmedCtaUrl.includes("{{") && !isSafeHttpOrRelativeUrl(trimmedCtaUrl)) {
      return { ok: false, error: "CTA URL must use http://, https://, or a relative app path." }
    }

    for (const item of data.mediaItems) {
      if (!isSafeHttpOrRelativeUrl(item.url, { allowImageDataUri: true })) {
        return { ok: false, error: `Unsafe media URL rejected: ${item.url.slice(0, 60)}` }
      }
    }

    const cleanMedia: EmailTemplateMediaItem[] = data.mediaItems.map((m) => ({
      ...(m.id ? { id: m.id } : {}),
      url: m.url.trim(),
      type: m.type,
      ...(m.name?.trim() ? { name: m.name.trim() } : {}),
    }))

    const resolved = await resolveOrEnsureEmailTemplate(data.id, data.purposeKey)
    if (!resolved) {
      return { ok: false, error: "Email template not found." }
    }

    const rows = await db
      .update(emailTemplates)
      .set({
        label: data.label,
        description: data.description?.trim() || null,
        isEnabled: data.isEnabled,
        format: data.format,
        subject: data.subject,
        preheader: data.preheader?.trim() || null,
        bodyHtml: data.bodyHtml,
        bodyText: data.bodyText || "",
        ctaText: data.ctaText?.trim() || null,
        ctaUrl: trimmedCtaUrl,
        mediaItems: cleanMedia,
        ...(data.variablesHint ? { variablesHint: data.variablesHint } : {}),
        updatedBy: admin.id,
        updatedAt: new Date(),
      })
      .where(eq(emailTemplates.id, resolved.id))
      .returning()

    if (rows.length === 0) {
      return { ok: false, error: "Email template not found." }
    }

    const updated = rows[0]
    await logActivity(admin.id, admin.role, "update_email_template", updated.purposeKey, {
      isEnabled: updated.isEnabled,
      format: updated.format,
    })

    revalidatePath("/admin/email")
    return {
      ok: true,
      template: {
        ...updated,
        mediaItems: normalizeMediaItems(updated.mediaItems),
        variablesHint: normalizeVariablesHint(updated.variablesHint),
      },
    }
  } catch (err) {
    console.error("[updateEmailTemplateAction Error]:", err)
    return { ok: false, error: err instanceof Error ? err.message : "Failed to save email template" }
  }
}

export async function toggleEmailTemplateAction(
  id: string,
  nextEnabled: boolean,
  purposeKey?: string
): Promise<{ ok: boolean; isEnabled?: boolean; template?: NormalizedEmailTemplate; error?: string }> {
  try {
    const admin = await requireAdmin()
    const updated = await toggleEmailTemplateByIdOrKey({
      id,
      purposeKey,
      isEnabled: Boolean(nextEnabled),
      actorId: admin.id,
    })

    if (!updated) {
      return { ok: false, error: "Email template not found." }
    }

    await logActivity(admin.id, admin.role, "toggle_email_template", updated.purposeKey, {
      isEnabled: updated.isEnabled,
    })

    revalidatePath("/admin/email")
    return {
      ok: true,
      isEnabled: updated.isEnabled,
      template: updated,
    }
  } catch (err) {
    console.error("[toggleEmailTemplateAction Error]:", err)
    return { ok: false, error: err instanceof Error ? err.message : "Failed to toggle template" }
  }
}

export async function createCustomEmailTemplateAction(
  payload: z.infer<typeof createCustomTemplateSchema>
): Promise<{ ok: boolean; error?: string; template?: NormalizedEmailTemplate }> {
  try {
    const admin = await requireAdmin()
    await ensureSchemaReady()

    const parsed = createCustomTemplateSchema.safeParse(payload)
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message || "Invalid input" }
    }

    const data = parsed.data
    const rawKey = slugifyPurposeKey(data.purposeKey || data.label)
    const key = resolveCanonicalEmailPurposeKey(rawKey, data.label) || rawKey
    if (!key) {
      return { ok: false, error: "Could not derive a valid purpose key from name." }
    }

    const existing = await db
      .select({ id: emailTemplates.id, label: emailTemplates.label })
      .from(emailTemplates)
      .where(eq(emailTemplates.purposeKey, key))
      .limit(1)

    if (existing.length > 0) {
      return {
        ok: false,
        error: `A template for "${existing[0].label}" (${key}) already exists. Edit the existing template instead of creating a duplicate.`,
      }
    }

    const trimmedCtaUrl = data.ctaUrl?.trim() || null
    if (trimmedCtaUrl && !trimmedCtaUrl.includes("{{") && !isSafeHttpOrRelativeUrl(trimmedCtaUrl)) {
      return { ok: false, error: "CTA URL must use http://, https://, or a relative app path." }
    }

    const newId = `tpl_${key}_${randomUUID().slice(0, 6)}`
    const safeDesc = escapeHtml(data.description?.trim() || "This is a custom operational email from RushX Organization.")
    const bodyHtml =
      data.bodyHtml.trim() ||
      `<p style="margin:0 0 16px 0;color:#ffffff;font-size:15px;">Hello <strong>{{recipientName}}</strong>,</p><p style="margin:0;color:#94a3b8;line-height:1.65;">${safeDesc}</p>`
    const bodyText =
      data.bodyText.trim() ||
      `Hello {{recipientName}},\n\n${data.description || "This is a custom operational email from RushX Organization."}`

    const [created] = await db
      .insert(emailTemplates)
      .values({
        id: newId,
        purposeKey: key,
        label: data.label,
        description: data.description?.trim() || "Custom admin-configured email template.",
        category: "custom",
        isEnabled: true,
        isCore: false,
        format: data.format,
        subject: data.subject,
        preheader: data.preheader?.trim() || null,
        bodyHtml,
        bodyText,
        ctaText: data.ctaText?.trim() || null,
        ctaUrl: trimmedCtaUrl,
        mediaItems: [],
        variablesHint: ["recipientName"],
        updatedBy: admin.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    await logActivity(admin.id, admin.role, "create_email_template", key, { label: data.label })
    revalidatePath("/admin/email")

    return {
      ok: true,
      template: {
        ...created,
        mediaItems: normalizeMediaItems(created.mediaItems),
        variablesHint: normalizeVariablesHint(created.variablesHint),
      },
    }
  } catch (err) {
    console.error("[createCustomEmailTemplateAction Error]:", err)
    return { ok: false, error: err instanceof Error ? err.message : "Failed to create custom email purpose" }
  }
}

export async function deleteEmailTemplateAction(
  id: string,
  purposeKey?: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const admin = await requireAdmin()
    await ensureSchemaReady()

    const resolved = await resolveOrEnsureEmailTemplate(id, purposeKey)
    if (!resolved) {
      return { ok: false, error: "Template not found." }
    }
    if (resolved.isCore) {
      return { ok: false, error: "Core system email purposes cannot be deleted. You can toggle them OFF instead." }
    }

    await db.delete(emailTemplates).where(eq(emailTemplates.id, resolved.id))
    await logActivity(admin.id, admin.role, "delete_email_template", resolved.purposeKey)

    revalidatePath("/admin/email")
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to delete email template" }
  }
}

export async function sendTestEmailTemplateAction(
  templateId: string,
  toEmail: string,
  purposeKey?: string
): Promise<{ ok: boolean; error?: string; provider?: string }> {
  try {
    const admin = await requireAdmin()
    await ensureSchemaReady()

    const cleanTo = toEmail.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanTo)) {
      return { ok: false, error: "Please provide a valid recipient email address." }
    }

    const resolved = await resolveOrEnsureEmailTemplate(templateId, purposeKey)
    if (!resolved) {
      return { ok: false, error: "Template not found." }
    }

    const tpl: NormalizedEmailTemplate = {
      ...resolved,
      mediaItems: normalizeMediaItems(resolved.mediaItems),
      variablesHint: normalizeVariablesHint(resolved.variablesHint),
    }

    const appUrl = getProductionAppUrl()
    const sampleVars: Record<string, string | number> = {
      userName: admin.name || "Test Player",
      recipientName: admin.name || "Captain Test",
      verifyUrl: `${appUrl}/verify?token=sample-test-token`,
      resetUrl: `${appUrl}/reset-password?token=sample-reset-token`,
      methodLabel: "Your email has been verified and your account is now active.",
      scrimsUrl: `${appUrl}/scrims`,
      dashboardUrl: `${appUrl}/dashboard/scrims`,
      resultsUrl: `${appUrl}/results`,
      noticesUrl: `${appUrl}/dashboard/notices`,
      teamName: "Team Apex BD",
      scrimTitle: "Evening Trio/Squad Showdown (7:00 PM)",
      startTime: "7:00 PM BST",
      slotNumber: 4,
      slotText: "Slot #4 (Team Apex BD)",
      amountBdt: 35,
      roomId: "4829104",
      roomPassword: "RUSHX77",
      updateNotice: "TEST PREVIEW: Room credentials are live.",
      winningTeam: "Team RushX BD",
      winnerStatus: "(Your Team)",
      category: "Top 3 Prize Pool",
      kills: 14,
      prizeBdt: 200,
      placement: 1,
      mvpPlayerName: "RUSHX_SNIPER",
      targetPlayerLabel: "RUSHX_SNIPER (Team RushX BD)",
      scrimDate: "Today",
      requestType: "MVP Face Banner Image",
      title: "Sample Official Tournament Notice",
      content: "Please check in 15 minutes before kickoff and ensure all squad players join the assigned slot.",
      categoryLabel: "Tournament",
      priority: "important",
      priorityLabel: "IMPORTANT NOTICE",
    }

    const rendered = renderEmailFromTemplate(tpl, sampleVars, {
      useAuthShell: tpl.purposeKey === "verify" || tpl.purposeKey === "password_reset",
    })

    const sendRes = await sendEmail({
      to: cleanTo,
      subject: `[TEST] ${rendered.subject}`,
      html: rendered.html,
      text: rendered.text,
      purposeKey: `test:${tpl.purposeKey}`,
    })

    if (!sendRes.success) {
      return { ok: false, error: sendRes.error || "Email provider failed to send test email." }
    }

    await logActivity(admin.id, admin.role, "test_email_template", tpl.purposeKey, { to: cleanTo })
    return { ok: true, provider: sendRes.provider }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Test dispatch failed" }
  }
}
