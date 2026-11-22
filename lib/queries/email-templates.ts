import "server-only"

import { db, ensureSchemaReady, ensureEmailTemplatesSchema } from "@/lib/db"
import { emailTemplates, settings, type EmailTemplate, type EmailTemplateMediaItem } from "@/lib/db/schema"
import { and, asc, eq, isNull } from "drizzle-orm"
import { isSafeHttpOrRelativeUrl } from "@/lib/url-safety"

export type CoreEmailPurposeSeed = {
  purposeKey: string
  label: string
  description: string
  defaultEnabled: boolean
  isCore: boolean
  category: "system" | "custom"
  format: "html" | "text"
  subject: string
  preheader: string
  bodyHtml: string
  bodyText: string
  ctaText: string
  ctaUrl: string
  variablesHint: string[]
}

export const CORE_EMAIL_PURPOSE_ORDER = [
  "verify",
  "password_reset",
  "welcome",
  "register",
  "id_pass",
  "not_hosted",
  "result",
  "mvp_image",
  "notice",
] as const

export const CORE_EMAIL_TEMPLATES: CoreEmailPurposeSeed[] = [
  {
    purposeKey: "verify",
    label: "Email Verification",
    description: "Email verification link dispatched when a user registers or requests a verification resend.",
    defaultEnabled: true,
    isCore: true,
    category: "system",
    format: "html",
    subject: "Verify your email — ACE SCRIMS",
    preheader: "Confirm your email address for ACE SCRIMS account access.",
    bodyHtml: `<h2 style="margin:0 0 12px 0;font-size:16px;font-weight:700;color:#ffffff;">Hey {{userName}},</h2>
<p style="margin:0 0 20px 0;font-size:14px;line-height:1.65;color:#94a3b8;">
  Welcome aboard! Please click the button below to verify your email address and activate your account on ACE SCRIMS.
</p>
<div style="background:#121524;border:1px solid #1f2438;border-radius:10px;padding:16px 20px;margin:16px 0;">
  <p style="margin:0 0 8px 0;font-size:11px;font-weight:800;letter-spacing:1px;color:#f97316;text-transform:uppercase;">WHAT'S WAITING FOR YOU:</p>
  <p style="margin:4px 0;font-size:13px;color:#94a3b8;"><strong style="color:#ffffff;">Daily Evening Scrims:</strong> High-tier regular squad showdowns.</p>
  <p style="margin:4px 0;font-size:13px;color:#94a3b8;"><strong style="color:#ffffff;">Friday Special Blast &amp; Champion Rush:</strong> Weekend peak events with bigger prize pools.</p>
  <p style="margin:4px 0;font-size:13px;color:#94a3b8;"><strong style="color:#ffffff;">Post-Match Rewards:</strong> MVP Face Banners, Top 3 Podium Cards, and real-time Standings.</p>
</div>`,
    bodyText: `Hey {{userName}}, welcome aboard! Please verify your email address by opening this link: {{verifyUrl}}`,
    ctaText: "VERIFY EMAIL & EXPLORE SCRIMS",
    ctaUrl: "{{verifyUrl}}",
    variablesHint: ["userName", "verifyUrl"],
  },
  {
    purposeKey: "password_reset",
    label: "Password Reset",
    description: "Password reset link emailed when a user submits the Forgot Password form.",
    defaultEnabled: true,
    isCore: true,
    category: "system",
    format: "html",
    subject: "Reset your password — ACE SCRIMS",
    preheader: "Instructions to reset your ACE SCRIMS password.",
    bodyHtml: `<p style="margin:0 0 16px 0;color:#cbd5e1;font-size:14px;line-height:1.65;">We received a request to reset the password for your ACE SCRIMS account. Click the button below to choose a new password.</p>
<p style="margin:0;color:#64748b;font-size:13px;">If you did not request a password reset, you can safely ignore this email.</p>`,
    bodyText: `Reset your ACE SCRIMS password by opening this link: {{resetUrl}}`,
    ctaText: "Reset Password",
    ctaUrl: "{{resetUrl}}",
    variablesHint: ["resetUrl"],
  },
  {
    purposeKey: "welcome",
    label: "Welcome Email After Sign Up",
    description: "Welcome onboarding email triggered after email verification or OAuth account activation. Turned OFF by default.",
    defaultEnabled: false,
    isCore: true,
    category: "system",
    format: "html",
    subject: "Welcome aboard, {{userName}} — ACE SCRIMS",
    preheader: "Welcome aboard {{userName}}! Your ACE SCRIMS account is active.",
    bodyHtml: `<h2 style="margin:0 0 12px 0;font-size:16px;font-weight:700;color:#ffffff;">Hey {{userName}},</h2>
<p style="margin:0 0 20px 0;font-size:14px;line-height:1.65;color:#94a3b8;">
  Welcome aboard! {{methodLabel}} You are fully geared up to register your squad and compete on ACE SCRIMS.
</p>
<div style="background:#121524;border:1px solid #1f2438;border-radius:10px;padding:16px 20px;margin:16px 0;">
  <p style="margin:0 0 8px 0;font-size:11px;font-weight:800;letter-spacing:1px;color:#f97316;text-transform:uppercase;">COMPETITIVE FEATURES:</p>
  <p style="margin:4px 0;font-size:13px;color:#94a3b8;"><strong style="color:#ffffff;">Instant Slot Locking:</strong> Register squads in seconds and get automatic slot assignment.</p>
  <p style="margin:4px 0;font-size:13px;color:#94a3b8;"><strong style="color:#ffffff;">Live Room Delivery:</strong> Room ID &amp; Password delivered directly in your dashboard and inbox.</p>
</div>`,
    bodyText: `Hey {{userName}}, welcome to ACE SCRIMS! {{methodLabel}} Explore upcoming lobbies at {{scrimsUrl}}`,
    ctaText: "Explore Scrims & Lobbies",
    ctaUrl: "{{scrimsUrl}}",
    variablesHint: ["userName", "methodLabel", "scrimsUrl"],
  },
  {
    purposeKey: "register",
    label: "After Booking a Slot",
    description: "Booking confirmation email sent automatically when a squad confirms their scrim registration. Turned OFF by default.",
    defaultEnabled: false,
    isCore: true,
    category: "system",
    format: "html",
    subject: "Booking Confirmed: {{scrimTitle}} (Slot #{{slotNumber}}) — ACE SCRIMS",
    preheader: "Your slot #{{slotNumber}} for {{scrimTitle}} ({{startTime}}) is confirmed.",
    bodyHtml: `<p style="margin:0 0 16px 0;color:#ffffff;font-size:16px;">Hello {{recipientName}},</p>
<p style="margin:0 0 20px 0;">Your squad booking has been confirmed for <strong>{{scrimTitle}}</strong>. Entry fee of <strong>BDT {{amountBdt}}</strong> has been processed.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#121524;border:1px solid #23273e;border-radius:10px;margin-bottom:20px;">
  <tr><td style="padding:16px 20px;">
    <p style="margin:4px 0;color:#cbd5e1;font-size:14px;"><strong style="color:#64748b;">Squad Name:</strong> {{teamName}}</p>
    <p style="margin:4px 0;color:#f97316;font-size:14px;font-weight:800;"><strong style="color:#64748b;font-weight:600;">Assigned Slot:</strong> Slot #{{slotNumber}}</p>
    <p style="margin:4px 0;color:#cbd5e1;font-size:14px;"><strong style="color:#64748b;">Tournament:</strong> {{scrimTitle}}</p>
    <p style="margin:4px 0;color:#cbd5e1;font-size:14px;"><strong style="color:#64748b;">Match Start:</strong> {{startTime}}</p>
  </td></tr>
</table>
<p style="margin:0;color:#94a3b8;font-size:13px;">Room ID &amp; Password arrive 10–15 minutes before kickoff. Mobile devices only — strictly sit in Slot #{{slotNumber}}.</p>`,
    bodyText: `Your squad {{teamName}} is confirmed for {{scrimTitle}} in Slot #{{slotNumber}}. Match start: {{startTime}}. Entry fee: BDT {{amountBdt}}. Dashboard: {{dashboardUrl}}`,
    ctaText: "Open Player Dashboard",
    ctaUrl: "{{dashboardUrl}}",
    variablesHint: ["recipientName", "teamName", "scrimTitle", "startTime", "slotNumber", "amountBdt", "dashboardUrl"],
  },
  {
    purposeKey: "id_pass",
    label: "Room ID & Password",
    description: "Custom room ID and password dispatch sent to confirmed squads before match start.",
    defaultEnabled: true,
    isCore: true,
    category: "system",
    format: "html",
    subject: "Room ID & Password: {{scrimTitle}} — ACE SCRIMS",
    preheader: "Room ID: {{roomId}} | Password: {{roomPassword}} for {{scrimTitle}}",
    bodyHtml: `<p style="margin:0 0 16px 0;color:#ffffff;font-size:16px;">Hello {{recipientName}},</p>
<p style="margin:0 0 16px 0;color:#cbd5e1;">{{updateNotice}} Room details for <strong>{{scrimTitle}}</strong> are now ready.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#13182b;border:2px solid #ea580c;border-radius:12px;margin-bottom:20px;">
  <tr><td style="padding:20px 24px;">
    <p style="margin:6px 0;color:#94a3b8;font-size:13px;">ROOM ID: <strong style="color:#f97316;font-size:20px;font-family:monospace;">{{roomId}}</strong></p>
    <p style="margin:6px 0;color:#94a3b8;font-size:13px;">PASSWORD: <strong style="color:#ffffff;font-size:20px;font-family:monospace;">{{roomPassword}}</strong></p>
    <p style="margin:6px 0;color:#38bdf8;font-size:14px;font-weight:700;">{{slotText}}</p>
    <p style="margin:6px 0;color:#cbd5e1;font-size:13px;">SCHEDULE: <strong>{{startTime}}</strong></p>
  </td></tr>
</table>
<p style="margin:0;color:#94a3b8;font-size:13px;">Do not share room credentials outside your registered squad. Mobile devices only.</p>`,
    bodyText: `Room Credentials for {{scrimTitle}} ({{startTime}}). Room ID: {{roomId}} | Password: {{roomPassword}} | {{slotText}}. Dashboard: {{dashboardUrl}}`,
    ctaText: "Go to Dashboard",
    ctaUrl: "{{dashboardUrl}}",
    variablesHint: [
      "recipientName",
      "teamName",
      "scrimTitle",
      "startTime",
      "slotNumber",
      "slotText",
      "roomId",
      "roomPassword",
      "updateNotice",
      "dashboardUrl",
    ],
  },
  {
    purposeKey: "not_hosted",
    label: "Scrim Not Hosted & Refund",
    description: "Cancellation and automatic refund email sent to registered squads when a scrim is marked Not Hosted.",
    defaultEnabled: true,
    isCore: true,
    category: "system",
    format: "html",
    subject: "Scrim Match Not Hosted: {{scrimTitle}} — ACE SCRIMS",
    preheader: "{{scrimTitle}} has been marked as Not Hosted. Your entry fee will be refunded.",
    bodyHtml: `<p style="margin:0 0 16px 0;font-size:15px;color:#ffffff;line-height:1.6;">Hello <strong>{{recipientName}}</strong>,</p>
<p style="margin:0 0 20px 0;line-height:1.65;color:#94a3b8;">We regret to inform you that <strong>{{scrimTitle}}</strong> ({{scrimDate}} at {{startTime}}) did not meet the required minimum team slots and has been marked as <strong>Not Hosted</strong>.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f111c;border:1px solid #1e2235;border-radius:10px;margin-bottom:20px;">
  <tr><td style="padding:18px 20px;">
    <p style="margin:4px 0;color:#cbd5e1;font-size:14px;"><strong style="color:#94a3b8;">SQUAD:</strong> {{teamName}}</p>
    <p style="margin:4px 0;color:#ef4444;font-size:14px;font-weight:800;"><strong style="color:#94a3b8;font-weight:600;">STATUS:</strong> NOT HOSTED</p>
    <p style="margin:4px 0;color:#10b981;font-size:15px;font-weight:800;"><strong style="color:#94a3b8;font-weight:600;">REFUND AMOUNT:</strong> ৳{{amountBdt}} BDT (Full Refund)</p>
  </td></tr>
</table>
<p style="margin:0;color:#94a3b8;font-size:13px;">Your entry fee has been queued for refund back to your original payment method or wallet.</p>`,
    bodyText: `Hello {{recipientName}}, {{scrimTitle}} ({{scrimDate}} at {{startTime}}) was not hosted. Your squad {{teamName}} will be refunded ৳{{amountBdt}}. View status: {{dashboardUrl}}`,
    ctaText: "Go to Dashboard",
    ctaUrl: "{{dashboardUrl}}",
    variablesHint: ["recipientName", "teamName", "scrimTitle", "scrimDate", "startTime", "amountBdt", "dashboardUrl"],
  },
  {
    purposeKey: "result",
    label: "Result Published",
    description: "Match result announcement emailed to confirmed participants when admin publishes standings.",
    defaultEnabled: true,
    isCore: true,
    category: "system",
    format: "html",
    subject: "Match Results Published: {{scrimTitle}} — ACE SCRIMS",
    preheader: "Official results published for {{scrimTitle}}. Winner: {{winningTeam}} with {{kills}} kills.",
    bodyHtml: `<p style="margin:0 0 16px 0;color:#ffffff;font-size:15px;">Hello <strong>{{recipientName}}</strong>,</p>
<p style="margin:0 0 18px 0;color:#94a3b8;">The official match results for <strong>{{scrimTitle}}</strong> have just been verified and published.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f111c;border:1px solid #1e2235;border-radius:10px;margin-bottom:20px;">
  <tr><td style="padding:18px 20px;">
    <p style="margin:5px 0;color:#cbd5e1;font-size:14px;"><strong style="color:#94a3b8;">YOUR SQUAD:</strong> {{teamName}}</p>
    <p style="margin:5px 0;color:#f97316;font-size:15px;font-weight:800;"><strong style="color:#94a3b8;font-weight:600;">CHAMPION / WINNER:</strong> {{winningTeam}} {{winnerStatus}}</p>
    <p style="margin:5px 0;color:#cbd5e1;font-size:13px;"><strong style="color:#94a3b8;">CATEGORY:</strong> {{category}}</p>
    <p style="margin:5px 0;color:#ffffff;font-size:14px;"><strong style="color:#94a3b8;">WINNER KILLS:</strong> {{kills}} Kills</p>
    <p style="margin:5px 0;color:#10b981;font-size:15px;font-weight:800;"><strong style="color:#94a3b8;font-weight:600;">PRIZE AWARDED:</strong> ৳{{prizeBdt}} BDT</p>
  </td></tr>
</table>`,
    bodyText: `Hello {{recipientName}}, official match results for {{scrimTitle}} are published. Winner: {{winningTeam}} ({{kills}} kills). Prize: ৳{{prizeBdt}} BDT. View results: {{resultsUrl}}`,
    ctaText: "View Full Match Results",
    ctaUrl: "{{resultsUrl}}",
    variablesHint: [
      "recipientName",
      "teamName",
      "scrimTitle",
      "winningTeam",
      "winnerStatus",
      "category",
      "kills",
      "prizeBdt",
      "placement",
      "resultsUrl",
    ],
  },
  {
    purposeKey: "mvp_image",
    label: "MVP Image Request",
    description: "Winner / MVP face banner photo request sent to selected players after match completion.",
    defaultEnabled: true,
    isCore: true,
    category: "system",
    format: "html",
    subject: "Action Required: Upload MVP Image for {{teamName}} — ACE SCRIMS",
    preheader: "Ace Scrims management has requested an MVP photo for {{teamName}} ({{scrimTitle}}).",
    bodyHtml: `<p style="margin:0 0 16px 0;color:#ffffff;font-size:15px;">Hello <strong>{{recipientName}}</strong>,</p>
<p style="margin:0 0 18px 0;color:#94a3b8;">Congratulations! Ace Scrims management has requested an image asset for <strong>{{targetPlayerLabel}}</strong> from <em>{{scrimTitle}}</em> ({{scrimDate}}) for the official Face Banners showcase.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f111c;border:1px solid #1e2235;border-radius:10px;margin-bottom:20px;">
  <tr><td style="padding:18px 20px;">
    <p style="margin:5px 0;color:#ffffff;font-size:14px;"><strong style="color:#94a3b8;">SQUAD:</strong> {{teamName}}</p>
    <p style="margin:5px 0;color:#10b981;font-size:14px;"><strong style="color:#94a3b8;">TARGET PLAYER:</strong> {{mvpPlayerName}}</p>
    <p style="margin:5px 0;color:#f97316;font-size:14px;"><strong style="color:#94a3b8;">EVENT:</strong> {{scrimTitle}} ({{scrimDate}})</p>
    <p style="margin:5px 0;color:#10b981;font-size:14px;"><strong style="color:#94a3b8;">REQUEST TYPE:</strong> {{requestType}}</p>
    <p style="margin:5px 0;color:#cbd5e1;font-size:13px;"><strong style="color:#94a3b8;">GUIDELINES:</strong> Waist-up photo, clean framing, ideally with background removed.</p>
  </td></tr>
</table>`,
    bodyText: `Hello {{recipientName}}, Ace Scrims management requested an MVP photo ({{requestType}}) for {{teamName}} ({{scrimTitle}}). Upload via your dashboard: {{dashboardUrl}}`,
    ctaText: "Upload MVP Image Now",
    ctaUrl: "{{dashboardUrl}}",
    variablesHint: [
      "recipientName",
      "teamName",
      "mvpPlayerName",
      "targetPlayerLabel",
      "scrimTitle",
      "scrimDate",
      "requestType",
      "dashboardUrl",
    ],
  },
  {
    purposeKey: "notice",
    label: "Notice by Admin",
    description: "Official Notice broadcast sent to verified players when an admin publishes a notice with email delivery enabled.",
    defaultEnabled: true,
    isCore: true,
    category: "system",
    format: "html",
    subject: "[{{priorityLabel}}] {{title}} — ACE SCRIMS",
    preheader: "{{category}} — {{title}}",
    bodyHtml: `<p style="margin:0 0 16px 0;color:#ffffff;font-size:15px;">Hello <strong>{{recipientName}}</strong>,</p>
<div style="margin-bottom:14px;">
  <span style="display:inline-block;background:rgba(234,88,12,0.14);color:#f97316;font-size:11px;font-weight:800;letter-spacing:1px;text-transform:uppercase;padding:4px 10px;border-radius:6px;border:1px solid #f97316;margin-right:8px;">{{priorityLabel}}</span>
  <span style="display:inline-block;background:#121524;color:#cbd5e1;font-size:11px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;padding:4px 10px;border-radius:6px;border:1px solid #1e2235;">{{category}}</span>
</div>
<div style="background:#121524;border:1px solid #1e2235;border-radius:10px;padding:20px;margin-bottom:18px;">
  <h2 style="margin:0 0 10px 0;color:#ffffff;font-size:18px;font-weight:800;">{{title}}</h2>
  <div style="color:#cbd5e1;font-size:14px;line-height:1.7;">{{content}}</div>
</div>`,
    bodyText: `[{{priorityLabel}}] ({{category}}) {{title}}\n\n{{content}}\n\nView notice: {{noticesUrl}}`,
    ctaText: "View Official Notice",
    ctaUrl: "{{noticesUrl}}",
    variablesHint: ["recipientName", "title", "content", "category", "priority", "priorityLabel", "noticesUrl"],
  },
]

export type NormalizedEmailTemplate = Omit<EmailTemplate, "mediaItems" | "variablesHint"> & {
  mediaItems: EmailTemplateMediaItem[]
  variablesHint: string[]
}

export function normalizeMediaItems(raw: unknown): EmailTemplateMediaItem[] {
  if (!Array.isArray(raw)) return []
  const cleaned: EmailTemplateMediaItem[] = []
  for (const item of raw) {
    if (!item || typeof item !== "object") continue
    const rec = item as Record<string, unknown>
    const url = typeof rec.url === "string" ? rec.url.trim() : ""
    if (!url || !isSafeHttpOrRelativeUrl(url, { allowImageDataUri: true })) continue
    const typeRaw = typeof rec.type === "string" ? rec.type : "image"
    const type: "image" | "video" | "link" =
      typeRaw === "video" || typeRaw === "link" ? typeRaw : "image"
    cleaned.push({
      id: typeof rec.id === "string" && rec.id.trim() ? rec.id.trim() : undefined,
      url,
      type,
      name: typeof rec.name === "string" ? rec.name.trim() : undefined,
    })
  }
  return cleaned
}

export function normalizeVariablesHint(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((v): v is string => typeof v === "string" && v.trim().length > 0).map((v) => v.trim())
  }
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return []
}

function normalizeEmailTemplate(row: EmailTemplate): NormalizedEmailTemplate {
  return {
    ...row,
    mediaItems: normalizeMediaItems(row.mediaItems),
    variablesHint: normalizeVariablesHint(row.variablesHint),
  }
}

const EMAIL_DEFAULTS_SYNC_KEY = "email_defaults_v2_applied"

export function getCoreEmailDefaultEnabled(purposeKey: string): boolean {
  const found = CORE_EMAIL_TEMPLATES.find((t) => t.purposeKey === purposeKey)
  return found ? found.defaultEnabled : true
}

export async function seedCoreEmailTemplatesIfMissing(): Promise<void> {
  await ensureSchemaReady()
  await ensureEmailTemplatesSchema()
  const existing = await db.select({ purposeKey: emailTemplates.purposeKey }).from(emailTemplates)
  const existingKeys = new Set(existing.map((r) => r.purposeKey))

  const missing = CORE_EMAIL_TEMPLATES.filter((t) => !existingKeys.has(t.purposeKey))
  if (missing.length > 0) {
    await db
      .insert(emailTemplates)
      .values(
        missing.map((t) => ({
          id: `tpl_${t.purposeKey}`,
          purposeKey: t.purposeKey,
          label: t.label,
          description: t.description,
          category: t.category,
          isEnabled: t.defaultEnabled,
          isCore: t.isCore,
          format: t.format,
          subject: t.subject,
          preheader: t.preheader,
          bodyHtml: t.bodyHtml,
          bodyText: t.bodyText,
          ctaText: t.ctaText,
          ctaUrl: t.ctaUrl,
          mediaItems: [],
          variablesHint: t.variablesHint,
          createdAt: new Date(),
          updatedAt: new Date(),
        }))
      )
      .onConflictDoNothing()
  }

  // One-time idempotent sync so untouched pre-seeded welcome/register rows honor default-OFF & crisp labels
  const syncMarker = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, EMAIL_DEFAULTS_SYNC_KEY))
    .limit(1)

  if (syncMarker.length === 0) {
    for (const t of CORE_EMAIL_TEMPLATES) {
      await db
        .update(emailTemplates)
        .set({
          label: t.label,
          description: t.description,
          isEnabled: t.defaultEnabled,
          updatedAt: new Date(),
        })
        .where(and(eq(emailTemplates.purposeKey, t.purposeKey), isNull(emailTemplates.updatedBy)))
    }
    await db
      .insert(settings)
      .values({ key: EMAIL_DEFAULTS_SYNC_KEY, value: "true", updatedAt: new Date() })
      .onConflictDoNothing()
  }
}

export function extractPurposeKeyFromId(id?: string | null): string | null {
  const clean = (id || "").trim()
  if (!clean) return null
  if (clean.startsWith("default_")) {
    return clean.slice("default_".length) || null
  }
  if (clean.startsWith("tpl_")) {
    const rest = clean.slice("tpl_".length)
    // Match known core keys first (handles keys containing underscores like password_reset, id_pass, not_hosted, mvp_image)
    for (const core of CORE_EMAIL_TEMPLATES) {
      if (rest === core.purposeKey || rest.startsWith(`${core.purposeKey}_`)) {
        return core.purposeKey
      }
    }
    // Strip trailing 6-char random suffix if present
    const stripped = rest.replace(/_[a-f0-9]{6}$/i, "")
    return stripped || null
  }
  return null
}

export async function resolveOrEnsureEmailTemplate(
  id: string,
  purposeKey?: string | null
): Promise<EmailTemplate | null> {
  await ensureSchemaReady()
  await ensureEmailTemplatesSchema()

  // 1. Direct lookup by ID
  if (id) {
    const byId = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.id, id))
      .limit(1)
    if (byId[0]) return byId[0]
  }

  // 2. Resolve by explicit or inferred purposeKey
  const candidateKey = (purposeKey || "").trim() || extractPurposeKeyFromId(id)
  if (candidateKey) {
    let byKey = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.purposeKey, candidateKey))
      .limit(1)
    if (byKey[0]) return byKey[0]

    // 3. If it's a core template that hasn't been persisted yet, seed/upsert it deterministically
    const coreSeed = CORE_EMAIL_TEMPLATES.find((t) => t.purposeKey === candidateKey)
    if (coreSeed) {
      await db
        .insert(emailTemplates)
        .values({
          id: `tpl_${coreSeed.purposeKey}`,
          purposeKey: coreSeed.purposeKey,
          label: coreSeed.label,
          description: coreSeed.description,
          category: coreSeed.category,
          isEnabled: coreSeed.defaultEnabled,
          isCore: coreSeed.isCore,
          format: coreSeed.format,
          subject: coreSeed.subject,
          preheader: coreSeed.preheader,
          bodyHtml: coreSeed.bodyHtml,
          bodyText: coreSeed.bodyText,
          ctaText: coreSeed.ctaText,
          ctaUrl: coreSeed.ctaUrl,
          mediaItems: [],
          variablesHint: coreSeed.variablesHint,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoNothing()

      byKey = await db
        .select()
        .from(emailTemplates)
        .where(eq(emailTemplates.purposeKey, candidateKey))
        .limit(1)
      if (byKey[0]) return byKey[0]
    }
  }

  // 4. Last chance: ensure all core templates are seeded and re-check
  await seedCoreEmailTemplatesIfMissing()
  if (candidateKey) {
    const recheck = await db
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.purposeKey, candidateKey))
      .limit(1)
    if (recheck[0]) return recheck[0]
  }
  return null
}

export async function getAllEmailTemplates(): Promise<NormalizedEmailTemplate[]> {
  try {
    await seedCoreEmailTemplatesIfMissing()
    const rows = await db.select().from(emailTemplates).orderBy(asc(emailTemplates.createdAt))
    const orderMap = new Map<string, number>(
      CORE_EMAIL_PURPOSE_ORDER.map((key, idx) => [key, idx])
    )
    return rows
      .map(normalizeEmailTemplate)
      .sort((a, b) => {
        const idxA = orderMap.has(a.purposeKey) ? orderMap.get(a.purposeKey)! : 999
        const idxB = orderMap.has(b.purposeKey) ? orderMap.get(b.purposeKey)! : 999
        if (idxA !== idxB) return idxA - idxB
        return a.label.localeCompare(b.label)
      })
  } catch (err) {
    console.warn("[EmailTemplates] Fallback to default core templates:", err)
    return CORE_EMAIL_TEMPLATES.map((t) => ({
      id: `tpl_${t.purposeKey}`,
      purposeKey: t.purposeKey,
      label: t.label,
      description: t.description,
      category: t.category,
      isEnabled: t.defaultEnabled,
      isCore: t.isCore,
      format: t.format,
      subject: t.subject,
      preheader: t.preheader,
      bodyHtml: t.bodyHtml,
      bodyText: t.bodyText,
      ctaText: t.ctaText,
      ctaUrl: t.ctaUrl,
      mediaItems: [],
      variablesHint: t.variablesHint,
      updatedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }))
  }
}

export async function getEmailTemplateByPurpose(
  purposeKey: string
): Promise<NormalizedEmailTemplate | null> {
  try {
    const resolved = await resolveOrEnsureEmailTemplate("", purposeKey)
    if (!resolved) return null
    return normalizeEmailTemplate(resolved)
  } catch (err) {
    console.warn(`[EmailTemplates] Failed fetching template "${purposeKey}":`, err)
    return null
  }
}

export type SerializedEmailTemplate = Omit<NormalizedEmailTemplate, "createdAt" | "updatedAt"> & {
  createdAt: string
  updatedAt: string
}

export function serializeEmailTemplate(tpl: NormalizedEmailTemplate): SerializedEmailTemplate {
  return {
    ...tpl,
    createdAt: tpl.createdAt instanceof Date ? tpl.createdAt.toISOString() : String(tpl.createdAt ?? new Date().toISOString()),
    updatedAt: tpl.updatedAt instanceof Date ? tpl.updatedAt.toISOString() : String(tpl.updatedAt ?? new Date().toISOString()),
  }
}

export async function toggleEmailTemplateByIdOrKey(params: {
  id?: string | null
  purposeKey?: string | null
  isEnabled: boolean
  actorId: string
}): Promise<NormalizedEmailTemplate | null> {
  await ensureSchemaReady()
  await ensureEmailTemplatesSchema()

  const cleanId = (params.id || "").trim()
  const candidateKey = (params.purposeKey || "").trim() || extractPurposeKeyFromId(cleanId)
  const now = new Date()

  // 1. Try direct update by ID first
  if (cleanId) {
    const updatedById = await db
      .update(emailTemplates)
      .set({
        isEnabled: params.isEnabled,
        updatedBy: params.actorId,
        updatedAt: now,
      })
      .where(eq(emailTemplates.id, cleanId))
      .returning()

    if (updatedById[0]) {
      return normalizeEmailTemplate(updatedById[0])
    }
  }

  // 2. Try direct update by purposeKey
  if (candidateKey) {
    const updatedByKey = await db
      .update(emailTemplates)
      .set({
        isEnabled: params.isEnabled,
        updatedBy: params.actorId,
        updatedAt: now,
      })
      .where(eq(emailTemplates.purposeKey, candidateKey))
      .returning()

    if (updatedByKey[0]) {
      return normalizeEmailTemplate(updatedByKey[0])
    }

    // 3. Deterministic atomic upsert if it's a core template missing from DB
    const coreSeed = CORE_EMAIL_TEMPLATES.find((t) => t.purposeKey === candidateKey)
    if (coreSeed) {
      const upserted = await db
        .insert(emailTemplates)
        .values({
          id: `tpl_${coreSeed.purposeKey}`,
          purposeKey: coreSeed.purposeKey,
          label: coreSeed.label,
          description: coreSeed.description,
          category: coreSeed.category,
          isEnabled: params.isEnabled,
          isCore: coreSeed.isCore,
          format: coreSeed.format,
          subject: coreSeed.subject,
          preheader: coreSeed.preheader,
          bodyHtml: coreSeed.bodyHtml,
          bodyText: coreSeed.bodyText,
          ctaText: coreSeed.ctaText,
          ctaUrl: coreSeed.ctaUrl,
          mediaItems: [],
          variablesHint: coreSeed.variablesHint,
          updatedBy: params.actorId,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: emailTemplates.purposeKey,
          set: {
            isEnabled: params.isEnabled,
            updatedBy: params.actorId,
            updatedAt: now,
          },
        })
        .returning()

      if (upserted[0]) {
        return normalizeEmailTemplate(upserted[0])
      }
    }
  }

  // 4. Final fallback: resolve/seed then update
  const resolved = await resolveOrEnsureEmailTemplate(cleanId, candidateKey)
  if (!resolved) return null

  const finalRows = await db
    .update(emailTemplates)
    .set({
      isEnabled: params.isEnabled,
      updatedBy: params.actorId,
      updatedAt: now,
    })
    .where(eq(emailTemplates.id, resolved.id))
    .returning()

  return finalRows[0] ? normalizeEmailTemplate(finalRows[0]) : null
}


