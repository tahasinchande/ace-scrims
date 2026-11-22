import { Resend } from "resend"
import nodemailer from "nodemailer"
import { escapeHtml, isSafeHttpOrRelativeUrl } from "@/lib/url-safety"
import {
  getCoreEmailDefaultEnabled,
  getEmailTemplateByPurpose,
  type NormalizedEmailTemplate,
} from "@/lib/queries/email-templates"
import type { EmailTemplateMediaItem } from "@/lib/db/schema"

export type EmailSendResult = {
  success: boolean
  provider?: "resend" | "sendgrid" | "smtp" | "console" | "blocked_by_toggle"
  messageId?: string
  error?: string
}

async function recordEmailLog(entry: {
  to: string
  purposeKey?: string | null
  subject: string
  status: "sent" | "failed" | "blocked_by_toggle"
  provider?: string | null
  error?: string | null
}): Promise<void> {
  try {
    const [{ randomUUID }, { db }, { emailLogs }] = await Promise.all([
      import("crypto"),
      import("@/lib/db"),
      import("@/lib/db/schema"),
    ])
    await db.insert(emailLogs).values({
      id: randomUUID(),
      recipientEmail: entry.to,
      purposeKey: entry.purposeKey ?? null,
      subject: entry.subject.slice(0, 240),
      status: entry.status,
      provider: entry.provider ?? null,
      error: entry.error ? entry.error.slice(0, 500) : null,
    })
  } catch {
    // Non-blocking audit log insert
  }
}

const DEFAULT_SENDER = "ACE SCRIMS <noreply@mail.acescrims.online>"

/**
 * Resolves the primary Sender / "From" address.
 */
function getFromAddress(fallback = DEFAULT_SENDER): string {
  const from =
    process.env.EMAIL_FROM ||
    process.env.RESEND_FROM ||
    process.env.SMTP_FROM ||
    process.env.MAIL_FROM ||
    fallback

  // If set to an unconfigured placeholder or old test domain, use the verified subdomain address
  if (
    !from ||
    from.includes("onboarding@resend.dev") ||
    from.includes("yourdomain.com") ||
    from === "Ace Scrims <onboarding@resend.dev>"
  ) {
    return DEFAULT_SENDER
  }

  return from.trim()
}

/**
 * Returns Resend client instance if RESEND_API_KEY is configured.
 */
function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim()
  if (!key || key.length === 0) return null
  return new Resend(key)
}

/**
 * Returns Nodemailer SMTP transporter if SMTP environment variables are configured.
 */
function getSmtpTransporter(): nodemailer.Transporter | null {
  const host = process.env.SMTP_HOST?.trim()
  const portStr = process.env.SMTP_PORT?.trim()
  const user = (process.env.SMTP_USER || process.env.SMTP_USERNAME)?.trim()
  const pass = (process.env.SMTP_PASS || process.env.SMTP_PASSWORD)?.trim()
  const secure = process.env.SMTP_SECURE === "true" || portStr === "465"

  // Check for Gmail App Password shortcut
  const gmailUser = process.env.GMAIL_USER?.trim()
  const gmailPass = (process.env.GMAIL_APP_PASSWORD || process.env.GMAIL_PASS)?.trim()

  if (gmailUser && gmailPass) {
    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    })
  }

  if (host && user && pass) {
    const port = portStr ? parseInt(portStr, 10) : secure ? 465 : 587
    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === "production",
      },
    })
  }

  return null
}

function parseEmailAddress(raw: string): { email: string; name?: string } {
  const match = raw.match(/^\s*(?:"?([^"]*?)"?\s*)?<([^<>]+)>\s*$/)
  if (match) {
    return {
      name: match[1]?.trim() || undefined,
      email: match[2].trim(),
    }
  }
  return { email: raw.trim() }
}

function getSendGridApiKey(): string | null {
  const key = process.env.SENDGRID_API_KEY?.trim()
  return key && key.length > 0 ? key : null
}

function getSmtpFromAddress(fallbackSender: string): string {
  const explicitSmtpFrom = process.env.SMTP_FROM?.trim()
  if (explicitSmtpFrom) return explicitSmtpFrom
  const gmailUser = process.env.GMAIL_USER?.trim()
  if (gmailUser) return `ACE SCRIMS <${gmailUser}>`
  const smtpUser = (process.env.SMTP_USER || process.env.SMTP_USERNAME)?.trim()
  if (smtpUser && smtpUser.includes("@") && !process.env.EMAIL_FROM?.trim()) {
    return `ACE SCRIMS <${smtpUser}>`
  }
  return fallbackSender
}

export function isEmailProviderConfigured(): boolean {
  return Boolean(getResendClient() || getSendGridApiKey() || getSmtpTransporter())
}

/**
 * Resolves the live canonical base URL for the application.
 * Filters out preview/ephemeral Vercel domains (including acer-brown.vercel.app)
 * and localhost to always guarantee links point to the official live domain.
 */
export function getProductionAppUrl(): string {
  // Check explicit environment variables, but ignore any localhost or vercel.app URLs
  const candidateEnvVars = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.BETTER_AUTH_URL,
    process.env.NEXTAUTH_URL,
    process.env.SITE_URL,
  ]

  for (const envVal of candidateEnvVars) {
    if (envVal) {
      const trimmed = envVal.trim().replace(/\/$/, "")
      if (
        trimmed &&
        !trimmed.includes("localhost") &&
        !trimmed.includes("127.0.0.1") &&
        !trimmed.includes("vercel.app")
      ) {
        return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`
      }
    }
  }

  // Canonical production domain for Ace Scrims
  return "https://www.acescrims.online"
}

/**
 * Normalizes email verification and notification URLs, replacing any localhost, 127.0.0.1,
 * or *.vercel.app domain (such as acer-brown.vercel.app) with the official live domain.
 */
export function resolveCleanUrl(url: string): string {
  if (!url) return url
  const liveOrigin = getProductionAppUrl()

  try {
    // Also perform immediate literal cleanup of any known outdated preview links
    let sanitized = url.replace(/https?:\/\/[a-zA-Z0-9_-]+\.vercel\.app/gi, liveOrigin)

    if (sanitized.startsWith("/")) {
      return `${liveOrigin}${sanitized}`
    }

    const u = new URL(sanitized)
    if (
      u.hostname === "localhost" ||
      u.hostname === "127.0.0.1" ||
      u.hostname.startsWith("0.0.0.0") ||
      u.hostname.endsWith(".vercel.app") ||
      u.hostname.includes("vercel.app") ||
      u.hostname.includes("run.app")
    ) {
      const base = new URL(liveOrigin)
      u.protocol = base.protocol
      u.host = base.host
      u.port = base.port
      return u.toString()
    }
    return sanitized
  } catch {
    return url.replace(/https?:\/\/[a-zA-Z0-9_-]+\.vercel\.app/gi, liveOrigin)
  }
}

/**
 * Clean, original HTML email shell for Auth & Verification emails.
 * Uses exact original styling: solid #05060a background (no 3D image), #0c0e17 card,
 * #1e2235 border, orange accent stripe, and strictly NO EMOJIS.
 */
function authEmailShell({
  title,
  preheader,
  contentHtml,
  ctaText,
  ctaUrl,
}: {
  title: string
  preheader?: string
  contentHtml: string
  ctaText?: string
  ctaUrl?: string
}) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="dark">
    <title>${title}</title>
    ${preheader ? `<div style="display:none;font-size:1px;color:#05060a;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${preheader}</div>` : ""}
  </head>
  <body style="margin:0;padding:0;background-color:#05060a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#ffffff;-webkit-font-smoothing:antialiased;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#05060a;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#0c0e17;border:1px solid #1e2235;border-radius:12px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.7);">
            <!-- Apex Accent Line -->
            <tr>
              <td style="background:linear-gradient(90deg, #ea580c 0%, #f97316 50%, #ea580c 100%);height:4px;font-size:0;line-height:4px;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:36px 36px 32px 36px;">
                <!-- Brand Header -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                  <tr>
                    <td>
                      <span style="display:inline-block;background:rgba(234,88,12,0.14);color:#f97316;font-size:11px;font-weight:800;letter-spacing:1.8px;text-transform:uppercase;padding:5px 12px;border-radius:6px;border:1px solid rgba(249,115,22,0.35);">
                        ACE SCRIMS
                      </span>
                    </td>
                    <td align="right">
                      <span style="color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">
                        Esports Tournament Platform
                      </span>
                    </td>
                  </tr>
                </table>

                <h1 style="margin:0 0 16px 0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.4px;line-height:1.3;">
                  ${title}
                </h1>

                <div style="color:#94a3b8;font-size:14px;line-height:1.65;">
                  ${contentHtml}
                </div>

                ${
                  ctaText && ctaUrl
                    ? `
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:30px 0 16px 0;width:100%;">
                  <tr>
                    <td align="center">
                      <table role="presentation" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="border-radius:8px;background:#ea580c;">
                            <a href="${ctaUrl}" target="_blank" style="display:inline-block;background:#ea580c;color:#ffffff;font-weight:800;font-size:14px;padding:14px 34px;border-radius:8px;text-decoration:none;text-transform:uppercase;letter-spacing:0.8px;">
                              ${ctaText}
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>`
                    : ""
                }

                ${
                  ctaUrl
                    ? `
                <div style="margin-top:26px;padding-top:18px;border-top:1px solid #1e2235;">
                  <p style="margin:0 0 6px 0;color:#64748b;font-size:11px;line-height:1.5;">
                    If the button does not open directly, copy and paste this link into your browser:
                  </p>
                  <p style="margin:0;word-break:break-all;">
                    <a href="${ctaUrl}" style="color:#f97316;font-size:11px;text-decoration:underline;">
                      ${ctaUrl}
                    </a>
                  </p>
                </div>`
                    : ""
                }
              </td>
            </tr>
          </table>

          <!-- Footer -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin-top:20px;">
            <tr>
              <td align="center" style="color:#475569;font-size:11px;line-height:1.6;">
                <p style="margin:0;font-weight:600;letter-spacing:0.5px;color:#64748b;">ACE SCRIMS BANGLADESH</p>
                <p style="margin:4px 0 0 0;">Automated Free Fire esports platform. Mobile devices only.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

/**
 * High-contrast, responsive HTML email shell for ACE SCRIMS.
 * Uses a static 3D theme background snapshot, dark esports palette (#05060a, #0c0e17),
 * no emojis, and strict typography hierarchy.
 */
function emailShell({
  title,
  preheader,
  contentHtml,
  ctaText,
  ctaUrl,
}: {
  title: string
  preheader?: string
  contentHtml: string
  ctaText?: string
  ctaUrl?: string
}) {
  const appUrl = getProductionAppUrl()
  const bgImage = `${appUrl}/images/hero-bg.jpg`
  const logoImage = `${appUrl}/icon.svg`

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="dark">
    <meta name="supported-color-schemes" content="dark">
    <title>${title}</title>
    ${preheader ? `<div style="display:none;font-size:1px;color:#05060a;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${preheader}</div>` : ""}
  </head>
  <body style="margin:0;padding:0;background-color:#05060a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#ffffff;-webkit-font-smoothing:antialiased;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#05060a;background-image:linear-gradient(rgba(5, 6, 10, 0.92), rgba(5, 6, 10, 0.96)), url('${bgImage}');background-size:cover;background-position:center top;background-repeat:no-repeat;padding:48px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#0c0e17;border:1px solid #1e2235;border-radius:16px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.7);">
            <!-- Apex Accent Line -->
            <tr>
              <td style="background:linear-gradient(90deg, #ea580c 0%, #f97316 50%, #ea580c 100%);height:4px;font-size:0;line-height:4px;">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:40px 36px;">
                <!-- Brand Header -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                  <tr>
                    <td>
                      <div style="display:flex;align-items:center;">
                        <span style="display:inline-block;background:rgba(234,88,12,0.14);color:#f97316;font-size:11px;font-weight:800;letter-spacing:1.8px;text-transform:uppercase;padding:5px 12px;border-radius:6px;border:1px solid rgba(249,115,22,0.35);">
                          ACE SCRIMS
                        </span>
                      </div>
                    </td>
                    <td align="right">
                      <span style="color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">
                        Esports Tournament Platform
                      </span>
                    </td>
                  </tr>
                </table>

                <h1 style="margin:0 0 16px 0;color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.4px;line-height:1.3;">
                  ${title}
                </h1>

                <div style="color:#94a3b8;font-size:15px;line-height:1.65;">
                  ${contentHtml}
                </div>

                ${
                  ctaText && ctaUrl
                    ? `
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:32px 0 16px 0;width:100%;">
                  <tr>
                    <td align="center">
                      <table role="presentation" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="border-radius:8px;background:#ea580c;">
                            <a href="${ctaUrl}" target="_blank" style="display:inline-block;background:#ea580c;color:#ffffff;font-weight:800;font-size:14px;padding:14px 34px;border-radius:8px;text-decoration:none;text-transform:uppercase;letter-spacing:0.8px;">
                              ${ctaText}
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>`
                    : ""
                }

                ${
                  ctaUrl
                    ? `
                <div style="margin-top:28px;padding-top:20px;border-top:1px solid #1e2235;">
                  <p style="margin:0 0 6px 0;color:#64748b;font-size:11px;line-height:1.5;">
                    If the button does not open directly, copy and paste this link into your browser:
                  </p>
                  <p style="margin:0;word-break:break-all;">
                    <a href="${ctaUrl}" style="color:#f97316;font-size:11px;text-decoration:underline;">
                      ${ctaUrl}
                    </a>
                  </p>
                </div>`
                    : ""
                }
              </td>
            </tr>
          </table>

          <!-- Footer -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin-top:24px;">
            <tr>
              <td align="center" style="color:#475569;font-size:11px;line-height:1.6;">
                <p style="margin:0;font-weight:600;letter-spacing:0.5px;color:#64748b;">ACE SCRIMS BANGLADESH</p>
                <p style="margin:4px 0 0 0;">Automated Free Fire esports platform. Mobile devices only.</p>
                <p style="margin:6px 0 0 0;">This is an automated operational notification. You received this because you have an account or active booking on Ace Scrims.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRateLimitError(err: unknown): boolean {
  if (!err) return false
  const msg =
    typeof err === "string"
      ? err.toLowerCase()
      : `${(err as any)?.message ?? ""} ${(err as any)?.name ?? ""} ${(err as any)?.statusCode ?? ""}`.toLowerCase()
  return msg.includes("429") || msg.includes("rate_limit") || msg.includes("rate limit") || msg.includes("too many requests")
}

function interpolateTemplateText(
  template: string,
  vars: Record<string, string | number | boolean | null | undefined>,
  htmlMode: boolean
): string {
  if (!template) return ""
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const raw = vars[key]
    if (raw === null || raw === undefined) return ""
    const str = String(raw)
    if (!htmlMode) return str
    const escaped = escapeHtml(str)
    if (key === "content") {
      return escaped.replace(/\r?\n/g, "<br />")
    }
    return escaped
  })
}

function renderMediaItemsHtml(mediaItems: EmailTemplateMediaItem[]): string {
  if (!Array.isArray(mediaItems) || mediaItems.length === 0) return ""
  const blocks: string[] = []
  for (const item of mediaItems) {
    if (!item?.url || !isSafeHttpOrRelativeUrl(item.url, { allowImageDataUri: true })) continue
    const finalUrl = item.url.startsWith("data:") ? item.url : resolveCleanUrl(item.url)
    const safeUrl = escapeHtml(finalUrl)
    const safeName = escapeHtml(item.name || "Attached Media")
    if (item.type === "image") {
      blocks.push(`
        <div style="margin:16px 0;border-radius:10px;overflow:hidden;border:1px solid #1e2235;background:#080a12;">
          <img src="${safeUrl}" alt="${safeName}" style="display:block;width:100%;max-height:360px;object-fit:cover;" />
        </div>
      `)
    } else if (item.type === "video") {
      blocks.push(`
        <div style="margin:16px 0;padding:14px 16px;border-radius:10px;border:1px solid #1e2235;background:#121524;">
          <p style="margin:0 0 6px 0;color:#cbd5e1;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;">
            Video Attachment: ${safeName}
          </p>
          <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color:#f97316;font-size:13px;font-weight:600;text-decoration:underline;word-break:break-all;">
            Watch Attached Video
          </a>
        </div>
      `)
    } else {
      blocks.push(`
        <div style="margin:12px 0;padding:12px 14px;border-radius:8px;border:1px solid #1e2235;background:#121524;">
          <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color:#f97316;font-size:13px;font-weight:600;text-decoration:underline;word-break:break-all;">
            ${safeName} (${safeUrl})
          </a>
        </div>
      `)
    }
  }
  return blocks.join("")
}

function renderMediaItemsText(mediaItems: EmailTemplateMediaItem[]): string {
  if (!Array.isArray(mediaItems) || mediaItems.length === 0) return ""
  const lines = mediaItems
    .filter((item) => item?.url && isSafeHttpOrRelativeUrl(item.url, { allowImageDataUri: true }))
    .map((item) => {
      const finalUrl = item.url.startsWith("data:") ? "[Embedded Image]" : resolveCleanUrl(item.url)
      return `- ${item.name || item.type.toUpperCase()}: ${finalUrl}`
    })
  return lines.length > 0 ? `\n\nAttachments:\n${lines.join("\n")}` : ""
}

export async function isEmailTemplateEnabled(purposeKey: string): Promise<boolean> {
  try {
    const tpl = await getEmailTemplateByPurpose(purposeKey)
    if (!tpl) return getCoreEmailDefaultEnabled(purposeKey)
    return tpl.isEnabled
  } catch {
    return getCoreEmailDefaultEnabled(purposeKey)
  }
}

export function renderEmailFromTemplate(
  tpl: NormalizedEmailTemplate,
  vars: Record<string, string | number | boolean | null | undefined>,
  options?: {
    useAuthShell?: boolean
    defaultTitle?: string
    defaultCtaUrl?: string
    extraMediaItems?: EmailTemplateMediaItem[]
  }
): {
  subject: string
  html: string
  text: string
} {
  const subject = interpolateTemplateText(tpl.subject, vars, false)
  const preheader = tpl.preheader ? interpolateTemplateText(tpl.preheader, vars, true) : undefined
  const ctaText = tpl.ctaText ? interpolateTemplateText(tpl.ctaText, vars, true) : undefined
  const rawCtaUrl = tpl.ctaUrl ? interpolateTemplateText(tpl.ctaUrl, vars, false).trim() : ""
  const resolvedCtaUrl =
    rawCtaUrl && isSafeHttpOrRelativeUrl(rawCtaUrl)
      ? resolveCleanUrl(rawCtaUrl)
      : options?.defaultCtaUrl

  const combinedMedia = [...(tpl.mediaItems || []), ...(options?.extraMediaItems || [])]
  const mediaHtml = renderMediaItemsHtml(combinedMedia)
  const mediaText = renderMediaItemsText(combinedMedia)

  const bodyText = `${interpolateTemplateText(tpl.bodyText || "", vars, false)}${
    resolvedCtaUrl ? `\n\nLink: ${resolvedCtaUrl}` : ""
  }${mediaText}`

  let contentHtml: string
  if (tpl.format === "text") {
    const escapedPlain = escapeHtml(interpolateTemplateText(tpl.bodyText || tpl.bodyHtml || "", vars, false)).replace(
      /\r?\n/g,
      "<br />"
    )
    contentHtml = `<div style="color:#cbd5e1;font-size:14px;line-height:1.7;">${escapedPlain}</div>${mediaHtml}`
  } else {
    const interpolatedHtml = interpolateTemplateText(tpl.bodyHtml || "", vars, true)
    contentHtml = `${interpolatedHtml}${mediaHtml}`
  }

  const shellFn = options?.useAuthShell ? authEmailShell : emailShell
  const html = shellFn({
    title: escapeHtml(options?.defaultTitle || subject.replace(/\s+—\s+ACE SCRIMS$/i, "")),
    preheader,
    contentHtml,
    ctaText: ctaText || undefined,
    ctaUrl: resolvedCtaUrl || undefined,
  })

  return {
    subject,
    html,
    text: bodyText,
  }
}

/**
 * Universal email sender with automatic fallback chain + rate-limit backoff:
 * 1. Resend SDK / API (with automatic retry on HTTP 429 rate limits)
 * 2. Nodemailer SMTP (Gmail, Brevo, SendGrid, Amazon SES, Custom SMTP)
 * 3. Error reporting if no provider configured
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
  from,
  purposeKey,
}: {
  to: string
  subject: string
  html: string
  text?: string
  from?: string
  purposeKey?: string
}): Promise<EmailSendResult> {
  const sender = from || getFromAddress()
  const resend = getResendClient()
  const sendGridKey = getSendGridApiKey()
  const smtp = getSmtpTransporter()

  // Defensive guard: if a non-test purposeKey is explicitly disabled in Admin Email Management, never dispatch
  if (purposeKey && !purposeKey.startsWith("test:")) {
    const allowed = await isEmailTemplateEnabled(purposeKey)
    if (!allowed) {
      await recordEmailLog({
        to,
        purposeKey,
        subject,
        status: "blocked_by_toggle",
      })
      return { success: true, provider: "blocked_by_toggle" }
    }
  }

  const finish = async (res: EmailSendResult): Promise<EmailSendResult> => {
    await recordEmailLog({
      to,
      purposeKey: purposeKey ?? null,
      subject,
      status: res.success ? "sent" : "failed",
      provider: res.provider ?? null,
      error: res.error ?? null,
    })
    return res
  }

  // 1. Try Resend if configured (retry up to 2 times on 429 rate-limit)
  if (resend) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        console.log(`[Email Service] Attempting delivery to ${to} via Resend (${sender})...`)
        const response = await resend.emails.send({
          from: sender,
          to,
          subject,
          html,
          text,
        })

        if (!response.error) {
          console.log(`[Email Service] Successfully sent email to ${to} via Resend. Message ID: ${response.data?.id}`)
          return finish({ success: true, provider: "resend", messageId: response.data?.id })
        }

        if (isRateLimitError(response.error) && attempt < 2) {
          const waitMs = 900 * (attempt + 1)
          console.warn(`[Email Service] Resend rate-limit (429) for ${to}. Waiting ${waitMs}ms before retry #${attempt + 1}...`)
          await sleep(waitMs)
          continue
        }

        console.warn(`[Email Service] Resend error with sender "${sender}":`, response.error)

        // Fallback: If custom sender failed on Resend (e.g. unverified domain), try onboarding@resend.dev
        if (sender !== "ACE SCRIMS <onboarding@resend.dev>" && sender !== "onboarding@resend.dev") {
          console.log(`[Email Service] Retrying Resend with fallback onboarding@resend.dev...`)
          const fallbackRes = await resend.emails.send({
            from: "ACE SCRIMS <onboarding@resend.dev>",
            to,
            subject,
            html,
            text,
          })
          if (!fallbackRes.error) {
            console.log(`[Email Service] Successfully sent email via Resend fallback onboarding@resend.dev.`)
            return finish({ success: true, provider: "resend", messageId: fallbackRes.data?.id })
          }
          console.error(`[Email Service] Resend fallback also failed:`, fallbackRes.error)
        }
        break
      } catch (resendErr: any) {
        if (isRateLimitError(resendErr) && attempt < 2) {
          const waitMs = 900 * (attempt + 1)
          console.warn(`[Email Service] Resend 429 exception for ${to}. Waiting ${waitMs}ms before retry...`)
          await sleep(waitMs)
          continue
        }
        console.error(`[Email Service] Resend exception:`, resendErr?.message || resendErr)
        break
      }
    }
  }

  // 2. Try SendGrid HTTP v3 API if configured
  if (sendGridKey) {
    try {
      const parsedFrom = parseEmailAddress(sender)
      console.log(`[Email Service] Attempting delivery to ${to} via SendGrid (${parsedFrom.email})...`)
      const sgRes = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sendGridKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: {
            email: parsedFrom.email,
            ...(parsedFrom.name ? { name: parsedFrom.name } : {}),
          },
          subject,
          content: [
            ...(text ? [{ type: "text/plain", value: text }] : []),
            { type: "text/html", value: html },
          ],
        }),
        signal: AbortSignal.timeout(15000),
      })

      if (sgRes.ok) {
        const messageId = sgRes.headers.get("x-message-id") || undefined
        console.log(`[Email Service] Successfully sent email to ${to} via SendGrid.`)
        return finish({ success: true, provider: "sendgrid", messageId })
      }
      const errBody = await sgRes.text().catch(() => "")
      console.error(`[Email Service] SendGrid error (${sgRes.status}):`, errBody)
    } catch (sgErr: any) {
      console.error(`[Email Service] SendGrid exception:`, sgErr?.message || sgErr)
    }
  }

  // 3. Try SMTP / Nodemailer if configured
  if (smtp) {
    try {
      const smtpSender = from || getSmtpFromAddress(sender)
      console.log(`[Email Service] Attempting delivery to ${to} via SMTP Transporter (${smtpSender})...`)
      const info = await smtp.sendMail({
        from: smtpSender,
        to,
        subject,
        html,
        text,
      })
      console.log(`[Email Service] Successfully sent email to ${to} via SMTP. Message ID: ${info.messageId}`)
      return finish({ success: true, provider: "smtp", messageId: info.messageId })
    } catch (smtpErr: any) {
      console.error(`[Email Service] SMTP delivery exception:`, smtpErr?.message || smtpErr)
    }
  }

  // 4. Fallback when no working provider is configured
  const errorMsg = !resend && !sendGridKey && !smtp
    ? "No email provider configured. Please set RESEND_API_KEY, SENDGRID_API_KEY, or SMTP credentials in environment variables."
    : "Email delivery failed across all configured providers."

  console.error(`[Email Service Warning] ${errorMsg}`)
  return finish({ success: false, error: errorMsg })
}

/**
 * Sends the Email Verification message.
 */
export async function sendVerificationEmail(to: string, url: string, userName?: string): Promise<boolean> {
  try {
    const cleanUrl = resolveCleanUrl(url)
    const rawName = userName?.trim() || "Player"
    const name = escapeHtml(rawName)

    const tpl = await getEmailTemplateByPurpose("verify")
    const enabled = tpl ? tpl.isEnabled : getCoreEmailDefaultEnabled("verify")
    if (!enabled) {
      console.log(`[Email Template] "verify" template is disabled by admin. Skipping email to ${to}.`)
      await recordEmailLog({
        to,
        purposeKey: "verify",
        subject: tpl?.subject || "Verify your email — ACE SCRIMS",
        status: "blocked_by_toggle",
      })
      return true
    }

    if (tpl) {
      const rendered = renderEmailFromTemplate(
        tpl,
        { userName: rawName, verifyUrl: cleanUrl },
        { useAuthShell: true, defaultTitle: "Verify your email address", defaultCtaUrl: cleanUrl }
      )
      const result = await sendEmail({ to, ...rendered, purposeKey: "verify" })
      if (!result.success) {
        console.error(`[Email Verification Failed] Could not deliver email to ${to}. Error: ${result.error}`)
      }
      return result.success
    }

    const contentHtml = `
      <h2 style="margin:0 0 12px 0;font-size:16px;font-weight:700;color:#ffffff;">
        Hey ${name},
      </h2>
      <p style="margin:0 0 24px 0;font-size:14px;line-height:1.65;color:#94a3b8;">
        Welcome aboard! Please click the button below to verify your email address and activate your account. You'll be fully geared up to explore our platform.
      </p>
    `

    const html = authEmailShell({
      title: "Verify your email address",
      preheader: "Confirm your email address for ACE SCRIMS account access.",
      contentHtml,
      ctaText: "VERIFY EMAIL & EXPLORE SCRIMS",
      ctaUrl: cleanUrl,
    })

    const result = await sendEmail({
      to,
      subject: "Verify your email — ACE SCRIMS",
      html,
      text: `Hey ${rawName}, welcome aboard! Please verify your email by opening this link: ${cleanUrl}`,
      purposeKey: "verify",
    })

    if (!result.success) {
      console.error(`[Email Verification Failed] Could not deliver email to ${to}. Error: ${result.error}`)
    }

    return result.success
  } catch (err) {
    console.error(`[Email Verification Exception] Failed to process verification email for ${to}:`, err)
    return false
  }
}

/**
 * Sends the Password Reset message.
 */
export async function sendPasswordResetEmail(to: string, url: string): Promise<boolean> {
  try {
    const cleanUrl = resolveCleanUrl(url)

    const tpl = await getEmailTemplateByPurpose("password_reset")
    const enabled = tpl ? tpl.isEnabled : getCoreEmailDefaultEnabled("password_reset")
    if (!enabled) {
      console.log(`[Email Template] "password_reset" template is disabled by admin. Skipping email to ${to}.`)
      await recordEmailLog({
        to,
        purposeKey: "password_reset",
        subject: tpl?.subject || "Reset your password — ACE SCRIMS",
        status: "blocked_by_toggle",
      })
      return true
    }

    if (tpl) {
      const rendered = renderEmailFromTemplate(
        tpl,
        { resetUrl: cleanUrl },
        { useAuthShell: true, defaultTitle: "Reset your password", defaultCtaUrl: cleanUrl }
      )
      const result = await sendEmail({ to, ...rendered, purposeKey: "password_reset" })
      if (!result.success) {
        console.error(`[Password Reset Failed] Could not deliver email to ${to}. Error: ${result.error}`)
      }
      return result.success
    }

    const title = "Reset your password"
    const body = "We received a request to reset the password for your ACE SCRIMS account. Click the button below to choose a new password."
    const html = authEmailShell({
      title,
      preheader: "Instructions to reset your ACE SCRIMS password.",
      contentHtml: `<p style="margin:0 0 16px 0;">${body}</p>`,
      ctaText: "Reset Password",
      ctaUrl: cleanUrl,
    })

    const result = await sendEmail({
      to,
      subject: "Reset your password — ACE SCRIMS",
      html,
      text: `Reset your ACE SCRIMS password by opening this link: ${cleanUrl}`,
      purposeKey: "password_reset",
    })

    if (!result.success) {
      console.error(`[Password Reset Failed] Could not deliver email to ${to}. Error: ${result.error}`)
    }

    return result.success
  } catch (err) {
    console.error(`[Password Reset Exception] Failed to process password reset email for ${to}:`, err)
    return false
  }
}

/**
 * Sends Transactional Booking Confirmation email with timeline instructions.
 */
export async function sendBookingConfirmationEmail({
  to,
  recipientName,
  teamName,
  scrimTitle,
  startTime,
  slotNumber,
  amountBdt,
}: {
  to: string
  recipientName?: string
  teamName: string
  scrimTitle: string
  startTime: string
  slotNumber: number
  amountBdt: number
}): Promise<boolean> {
  try {
    const tpl = await getEmailTemplateByPurpose("register")
    const enabled = tpl ? tpl.isEnabled : getCoreEmailDefaultEnabled("register")
    if (!enabled) {
      console.log(`[Email Template] "register" template is disabled by admin. Skipping email to ${to}.`)
      await recordEmailLog({
        to,
        purposeKey: "register",
        subject: tpl?.subject || `Booking Confirmed: ${scrimTitle} — ACE SCRIMS`,
        status: "blocked_by_toggle",
      })
      return true
    }

    const appUrl = getProductionAppUrl()
    const dashboardUrl = `${appUrl}/dashboard/scrims`

    if (tpl) {
      const rendered = renderEmailFromTemplate(
        tpl,
        {
          recipientName: recipientName || "Captain",
          teamName,
          scrimTitle,
          startTime,
          slotNumber,
          amountBdt,
          dashboardUrl,
        },
        { defaultTitle: `Booking Confirmed — Slot #${slotNumber}`, defaultCtaUrl: dashboardUrl }
      )
      const result = await sendEmail({ to, ...rendered, purposeKey: "register" })
      return result.success
    }

    const safeRecipient = escapeHtml(recipientName || "Captain")
    const safeTeamName = escapeHtml(teamName)
    const safeScrimTitle = escapeHtml(scrimTitle)
    const safeStartTime = escapeHtml(startTime)

    const contentHtml = `
      <p style="margin:0 0 18px 0;color:#ffffff;font-size:16px;">
        Hello ${safeRecipient},
      </p>
      <p style="margin:0 0 20px 0;">
        Your squad booking has been confirmed for <strong>${safeScrimTitle}</strong>. Your payment of <strong>BDT ${amountBdt}</strong> was verified automatically.
      </p>
      <p style="margin:0;color:#94a3b8;font-size:13px;">Squad: <strong>${safeTeamName}</strong> · Slot: <strong>#${slotNumber}</strong> · Kickoff: <strong>${safeStartTime}</strong></p>
    `

    const html = emailShell({
      title: `Booking Confirmed — Slot #${slotNumber}`,
      preheader: `Your slot #${slotNumber} for ${safeScrimTitle} (${safeStartTime}) is confirmed.`,
      contentHtml,
      ctaText: "Open Player Dashboard",
      ctaUrl: dashboardUrl,
    })

    const result = await sendEmail({
      to,
      subject: `Booking Confirmed: ${scrimTitle} (Slot #${slotNumber}) — ACE SCRIMS`,
      html,
      text: `Your squad ${teamName} is confirmed for ${scrimTitle} in Slot #${slotNumber}. Match start: ${startTime}. View details in your dashboard: ${dashboardUrl}`,
      purposeKey: "register",
    })

    return result.success
  } catch (err) {
    console.error(`[Booking Confirmation Email Exception] Failed for ${to}:`, err)
    return false
  }
}

/**
 * Sends Transactional Room ID & Password release or update notification email.
 */
export async function sendRoomCredentialsEmail({
  to,
  recipientName,
  teamName,
  scrimTitle,
  startTime,
  slotNumber,
  roomId,
  roomPassword,
  isUpdated = false,
}: {
  to: string
  recipientName?: string
  teamName: string
  scrimTitle: string
  startTime: string
  slotNumber?: number | null
  roomId: string
  roomPassword: string
  isUpdated?: boolean
}): Promise<boolean> {
  try {
    const tpl = await getEmailTemplateByPurpose("id_pass")
    const enabled = tpl ? tpl.isEnabled : getCoreEmailDefaultEnabled("id_pass")
    if (!enabled) {
      console.log(`[Email Template] "id_pass" template is disabled by admin. Skipping email to ${to}.`)
      await recordEmailLog({
        to,
        purposeKey: "id_pass",
        subject: tpl?.subject || `Room ID & Password: ${scrimTitle} — ACE SCRIMS`,
        status: "blocked_by_toggle",
      })
      return true
    }

    const appUrl = getProductionAppUrl()
    const dashboardUrl = `${appUrl}/dashboard/scrims`
    const slotText = slotNumber ? `Slot #${slotNumber} (${teamName})` : `Squad: ${teamName}`
    const updateNotice = isUpdated
      ? "UPDATE NOTICE: Room credentials were updated by the match admin."
      : "Room credentials are now live."

    if (tpl) {
      const rendered = renderEmailFromTemplate(
        tpl,
        {
          recipientName: recipientName || "Captain",
          teamName,
          scrimTitle,
          startTime,
          slotNumber: slotNumber ?? "-",
          slotText,
          roomId,
          roomPassword,
          updateNotice,
          dashboardUrl,
        },
        {
          defaultTitle: isUpdated ? `Room Credentials Updated: ${scrimTitle}` : `Room Credentials Released: ${scrimTitle}`,
          defaultCtaUrl: dashboardUrl,
        }
      )
      const subject = isUpdated && !rendered.subject.toUpperCase().includes("UPDATE")
        ? `UPDATED ${rendered.subject}`
        : rendered.subject
      const result = await sendEmail({ to, ...rendered, subject, purposeKey: "id_pass" })
      return result.success
    }

    const safeRoomId = escapeHtml(roomId)
    const safeRoomPass = escapeHtml(roomPassword)
    const safeScrimTitle = escapeHtml(scrimTitle)
    const safeRecipient = escapeHtml(recipientName || "Captain")
    const safeStartTime = escapeHtml(startTime)

    const title = isUpdated ? `Room Credentials Updated: ${safeScrimTitle}` : `Room Credentials Released: ${safeScrimTitle}`
    const contentHtml = `<p style="margin:0 0 16px 0;">Hello ${safeRecipient}, Room ID: <strong>${safeRoomId}</strong> | Password: <strong>${safeRoomPass}</strong> (${safeStartTime})</p>`
    const html = emailShell({
      title,
      preheader: `Room ID: ${safeRoomId} | Password: ${safeRoomPass}`,
      contentHtml,
      ctaText: "Go to Dashboard",
      ctaUrl: dashboardUrl,
    })

    const result = await sendEmail({
      to,
      subject: `${isUpdated ? "UPDATED " : ""}Room ID & Password: ${scrimTitle} — ACE SCRIMS`,
      html,
      text: `${title}. Room ID: ${roomId} | Password: ${roomPassword}. Start time: ${startTime}. View in dashboard: ${dashboardUrl}`,
      purposeKey: "id_pass",
    })

    return result.success
  } catch (err) {
    console.error(`[Room Credentials Email Exception] Failed for ${to}:`, err)
    return false
  }
}

/**
 * Sends Scrim Not Hosted / Cancellation and Refund Notification Email.
 */
export async function sendScrimNotHostedEmail({
  to,
  recipientName,
  teamName,
  scrimTitle,
  scrimDate,
  startTime,
  amountBdt,
}: {
  to: string
  recipientName: string
  teamName: string
  scrimTitle: string
  scrimDate: string
  startTime: string
  amountBdt: number
}): Promise<boolean> {
  try {
    const tpl = await getEmailTemplateByPurpose("not_hosted")
    const enabled = tpl ? tpl.isEnabled : getCoreEmailDefaultEnabled("not_hosted")
    if (!enabled) {
      console.log(`[Email Template] "not_hosted" template is disabled by admin. Skipping email to ${to}.`)
      await recordEmailLog({
        to,
        purposeKey: "not_hosted",
        subject: tpl?.subject || `Scrim Match Not Hosted: ${scrimTitle} — ACE SCRIMS`,
        status: "blocked_by_toggle",
      })
      return true
    }

    const appUrl = getProductionAppUrl()
    const dashboardUrl = `${appUrl}/dashboard`

    if (tpl) {
      const rendered = renderEmailFromTemplate(
        tpl,
        {
          recipientName: recipientName || "Captain",
          teamName,
          scrimTitle,
          scrimDate,
          startTime,
          amountBdt,
          dashboardUrl,
        },
        { defaultTitle: `Scrim Not Hosted: ${scrimTitle}`, defaultCtaUrl: dashboardUrl }
      )
      const result = await sendEmail({ to, ...rendered, purposeKey: "not_hosted" })
      return result.success
    }

    const safeRecipient = escapeHtml(recipientName || "Captain")
    const safeTeamName = escapeHtml(teamName)
    const safeScrimTitle = escapeHtml(scrimTitle)
    const safeScrimDate = escapeHtml(scrimDate)
    const safeStartTime = escapeHtml(startTime)

    const contentHtml = `
      <p style="margin:0 0 16px 0;font-size:15px;color:#ffffff;line-height:1.6;">
        Hello <strong>${safeRecipient}</strong>,
      </p>
      <p style="margin:0 0 20px 0;line-height:1.65;color:#94a3b8;">
        We regret to inform you that <strong>${safeScrimTitle}</strong> (${safeScrimDate} at ${safeStartTime}) did not meet the required minimum team slots and has been marked as <strong>Not Hosted</strong>.
      </p>
      <p style="margin:0;color:#10b981;font-size:14px;font-weight:700;">Squad: ${safeTeamName} · Full Refund: ৳${amountBdt} BDT</p>
    `

    const html = emailShell({
      title: `Scrim Not Hosted: ${safeScrimTitle}`,
      preheader: `${safeScrimTitle} has been marked as Not Hosted. Your entry fee will be refunded.`,
      contentHtml,
      ctaText: "Go to Dashboard",
      ctaUrl: dashboardUrl,
    })

    const result = await sendEmail({
      to,
      subject: `Scrim Match Not Hosted: ${scrimTitle} — ACE SCRIMS`,
      html,
      text: `Hello ${recipientName}, ${scrimTitle} (${scrimDate} at ${startTime}) was not hosted. Your squad ${teamName} will be refunded ৳${amountBdt}. View status: ${dashboardUrl}`,
      purposeKey: "not_hosted",
    })

    return result.success
  } catch (err) {
    console.error(`[Scrim Not Hosted Email Exception] Failed for ${to}:`, err)
    return false
  }
}

/**
 * Sends Match Result Published notification email to registered players.
 */
export async function sendMatchResultPublishedEmail({
  to,
  recipientName,
  teamName,
  scrimTitle,
  winningTeam,
  kills,
  prizeBdt,
  placement,
  category,
}: {
  to: string
  recipientName: string
  teamName: string
  scrimTitle: string
  winningTeam: string
  kills: number
  prizeBdt: number
  placement: number
  category: string
}): Promise<boolean> {
  const tpl = await getEmailTemplateByPurpose("result")
  const enabled = tpl ? tpl.isEnabled : getCoreEmailDefaultEnabled("result")
  if (!enabled) {
    console.log(`[Email Template] "result" template is disabled by admin. Skipping email to ${to}.`)
    await recordEmailLog({
      to,
      purposeKey: "result",
      subject: tpl?.subject || `Match Results Published: ${scrimTitle} — ACE SCRIMS`,
      status: "blocked_by_toggle",
    })
    return true
  }

  const appUrl = getProductionAppUrl()
  const resultsUrl = `${appUrl}/results`
  const isWinner = teamName.toLowerCase().trim() === winningTeam.toLowerCase().trim()

  if (tpl) {
    const rendered = renderEmailFromTemplate(
      tpl,
      {
        recipientName: recipientName || "Captain",
        teamName,
        scrimTitle,
        winningTeam,
        winnerStatus: isWinner ? "(Your Team)" : "",
        category,
        kills,
        prizeBdt,
        placement,
        resultsUrl,
      },
      { defaultTitle: `Match Results Published: ${scrimTitle}`, defaultCtaUrl: resultsUrl }
    )
    try {
      const result = await sendEmail({ to, ...rendered, purposeKey: "result" })
      if (!result.success) {
        console.error(`[Match Result Email] Delivery failed to ${to}:`, result.error || "Unknown delivery error")
      }
      return result.success
    } catch (emailErr) {
      console.error(`[Match Result Email] Exception sending to ${to}:`, emailErr)
      return false
    }
  }

  const safeRecipient = escapeHtml(recipientName || "Captain")
  const safeScrimTitle = escapeHtml(scrimTitle)
  const safeWinningTeam = escapeHtml(winningTeam)

  const html = emailShell({
    title: `Match Results Published: ${safeScrimTitle}`,
    preheader: `Official results published for ${safeScrimTitle}. Winner: ${safeWinningTeam}.`,
    contentHtml: `<p>Hello <strong>${safeRecipient}</strong>, Winner: <strong>${safeWinningTeam}</strong> (${kills} Kills) · Prize: ৳${prizeBdt} BDT.</p>`,
    ctaText: "View Full Match Results",
    ctaUrl: resultsUrl,
  })

  try {
    const result = await sendEmail({
      to,
      subject: `Match Results Published: ${scrimTitle} — ACE SCRIMS`,
      html,
      text: `Hello ${recipientName}, official match results for ${scrimTitle} are published. Winner: ${winningTeam} (${kills} kills). Prize: ৳${prizeBdt} BDT. View results: ${resultsUrl}`,
      purposeKey: "result",
    })
    return result.success
  } catch (emailErr) {
    console.error(`[Match Result Email] Exception sending to ${to}:`, emailErr)
    return false
  }
}

/**
 * Sends automated email notification when Admin requests an MVP Image.
 */
export async function sendMvpImageRequestEmail({
  to,
  recipientName,
  teamName,
  scrimTitle,
  mvpPlayerName,
  requestType = "MVP Face Banner Image",
  scrimDate,
}: {
  to: string
  recipientName: string
  teamName: string
  scrimTitle: string
  mvpPlayerName?: string | null
  requestType?: string | null
  scrimDate?: string | null
}): Promise<boolean> {
  const tpl = await getEmailTemplateByPurpose("mvp_image")
  const enabled = tpl ? tpl.isEnabled : getCoreEmailDefaultEnabled("mvp_image")
  if (!enabled) {
    console.log(`[Email Template] "mvp_image" template is disabled by admin. Skipping email to ${to}.`)
    await recordEmailLog({
      to,
      purposeKey: "mvp_image",
      subject: tpl?.subject || `Action Required: Upload MVP Image for ${teamName} — ACE SCRIMS`,
      status: "blocked_by_toggle",
    })
    return true
  }

  const appUrl = getProductionAppUrl()
  const dashboardUrl = `${appUrl}/dashboard/image-requests`
  const targetPlayerLabel = mvpPlayerName ? `${mvpPlayerName} (${teamName})` : teamName

  if (tpl) {
    const rendered = renderEmailFromTemplate(
      tpl,
      {
        recipientName: recipientName || "Captain",
        teamName,
        mvpPlayerName: mvpPlayerName || "Squad Captain",
        targetPlayerLabel,
        scrimTitle,
        scrimDate: scrimDate || "Latest Match",
        requestType: requestType || "MVP Face Banner Image",
        dashboardUrl,
      },
      { defaultTitle: `MVP Image Requested: ${teamName}`, defaultCtaUrl: dashboardUrl }
    )
    try {
      const result = await sendEmail({ to, ...rendered, purposeKey: "mvp_image" })
      return result.success
    } catch (err) {
      console.error(`[MVP Image Request Email] Exception sending to ${to}:`, err)
      return false
    }
  }

  const safeRecipient = escapeHtml(recipientName || "Captain")
  const safeTeamName = escapeHtml(teamName)
  const safeScrimTitle = escapeHtml(scrimTitle)

  const html = emailShell({
    title: `MVP Image Requested: ${safeTeamName}`,
    preheader: `Ace Scrims management has requested an MVP photo for ${safeTeamName}.`,
    contentHtml: `<p>Hello <strong>${safeRecipient}</strong>, please upload your waist-up MVP image for <strong>${safeTeamName}</strong> (${safeScrimTitle}).</p>`,
    ctaText: "Upload MVP Image Now",
    ctaUrl: dashboardUrl,
  })

  try {
    const result = await sendEmail({
      to,
      subject: `Action Required: Upload MVP Image for ${teamName} — ACE SCRIMS`,
      html,
      text: `Hello ${recipientName}, Ace Scrims management has requested an MVP photo for ${teamName} (${scrimTitle}). Upload at: ${dashboardUrl}`,
      purposeKey: "mvp_image",
    })
    return result.success
  } catch (err) {
    console.error(`[MVP Image Request Email] Exception sending to ${to}:`, err)
    return false
  }
}

/**
 * Throttled batch email dispatcher that stays comfortably under Resend's
 * 2 requests/second rate limit, preventing HTTP 429 drops when emailing lobbies or broadcasts.
 */
export async function sendEmailBatch<T>(
  items: T[],
  sendFn: (item: T) => Promise<boolean>,
  batchSize = 2,
  delayMs = 750
): Promise<{ sent: number; failed: number }> {
  let sent = 0
  let failed = 0

  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize)
    const results = await Promise.all(
      chunk.map(async (item) => {
        try {
          return await sendFn(item)
        } catch {
          return false
        }
      })
    )

    for (const ok of results) {
      if (ok) sent++
      else failed++
    }

    if (i + batchSize < items.length) {
      await sleep(delayMs)
    }
  }

  return { sent, failed }
}

/**
 * Sends an Official Notice broadcast email to active verified users.
 */
export async function sendNoticeBroadcastEmail({
  to,
  recipientName,
  title,
  content,
  category = "General",
  priority = "normal",
  mediaUrl,
  mediaType = "none",
  isPinned = false,
}: {
  to: string
  recipientName?: string
  title: string
  content: string
  category?: string
  priority?: "normal" | "important" | "urgent" | string
  mediaUrl?: string | null
  mediaType?: "none" | "image" | "video" | string
  isPinned?: boolean
}): Promise<boolean> {
  const tpl = await getEmailTemplateByPurpose("notice")
  const enabled = tpl ? tpl.isEnabled : getCoreEmailDefaultEnabled("notice")
  if (!enabled) {
    console.log(`[Email Template] "notice" template is disabled by admin. Skipping email to ${to}.`)
    await recordEmailLog({
      to,
      purposeKey: "notice",
      subject: tpl?.subject || `[NOTICE] ${title} — ACE SCRIMS`,
      status: "blocked_by_toggle",
    })
    return true
  }

  const appUrl = getProductionAppUrl()
  const noticesUrl = `${appUrl}/dashboard/notices`

  const priorityLabel =
    priority === "urgent"
      ? "URGENT NOTICE"
      : priority === "important"
      ? "IMPORTANT NOTICE"
      : isPinned
      ? "PINNED NOTICE"
      : "OFFICIAL NOTICE"

  const validMediaUrl =
    mediaUrl && isSafeHttpOrRelativeUrl(mediaUrl.trim(), { allowImageDataUri: true })
      ? mediaUrl.trim()
      : null

  const extraMediaItems: EmailTemplateMediaItem[] = validMediaUrl
    ? [
        {
          url: validMediaUrl,
          type: mediaType === "video" ? "video" : "image",
          name: title,
        },
      ]
    : []

  if (tpl) {
    const rendered = renderEmailFromTemplate(
      tpl,
      {
        recipientName: recipientName || "Player",
        title,
        content,
        category: category || "General",
        priority,
        priorityLabel,
        noticesUrl,
      },
      {
        defaultTitle: `${priorityLabel}: ${title}`,
        defaultCtaUrl: noticesUrl,
        extraMediaItems,
      }
    )
    try {
      const result = await sendEmail({ to, ...rendered, purposeKey: "notice" })
      return result.success
    } catch (err) {
      console.error(`[Notice Broadcast Email] Exception sending to ${to}:`, err)
      return false
    }
  }

  const safeName = escapeHtml(recipientName || "Player")
  const safeTitle = escapeHtml(title)
  const formattedContent = escapeHtml(content).replace(/\r?\n/g, "<br />")

  const html = emailShell({
    title: `${priorityLabel}: ${safeTitle}`,
    preheader: `${category} — ${safeTitle}`,
    contentHtml: `<p>Hello <strong>${safeName}</strong>,</p><div>${formattedContent}</div>${renderMediaItemsHtml(extraMediaItems)}`,
    ctaText: "View Official Notice",
    ctaUrl: noticesUrl,
  })

  try {
    const result = await sendEmail({
      to,
      subject: `[${priorityLabel}] ${title} — ACE SCRIMS`,
      html,
      text: `${priorityLabel} (${category}): ${title}\n\n${content}\n\nView notice in your dashboard: ${noticesUrl}`,
      purposeKey: "notice",
    })
    return result.success
  } catch (err) {
    console.error(`[Notice Broadcast Email] Exception sending to ${to}:`, err)
    return false
  }
}

/**
 * Sends a Welcome Email to newly verified users (both OAuth signups & email-verified signups).
 */
export async function sendWelcomeEmail({
  to,
  userName,
  authMethod = "email",
}: {
  to: string
  userName?: string | null
  authMethod?: "google" | "email"
}): Promise<boolean> {
  if (!to || !to.includes("@")) return false

  const tpl = await getEmailTemplateByPurpose("welcome")
  const enabled = tpl ? tpl.isEnabled : getCoreEmailDefaultEnabled("welcome")
  if (!enabled) {
    console.log(`[Email Template] "welcome" template is disabled by admin. Skipping email to ${to}.`)
    await recordEmailLog({
      to,
      purposeKey: "welcome",
      subject: tpl?.subject || "Welcome aboard — ACE SCRIMS",
      status: "blocked_by_toggle",
    })
    return true
  }

  const appUrl = getProductionAppUrl()
  const scrimsUrl = `${appUrl}/scrims`
  const rawName = userName?.trim() || "Player"
  const safeName = escapeHtml(rawName)
  const methodLabel =
    authMethod === "google"
      ? "Your account is active and verified via Google."
      : "Your email has been verified and your account is now active."

  if (tpl) {
    const rendered = renderEmailFromTemplate(
      tpl,
      {
        userName: rawName,
        authMethod,
        methodLabel,
        scrimsUrl,
      },
      { defaultTitle: "Welcome to ACE SCRIMS", defaultCtaUrl: scrimsUrl }
    )
    try {
      const result = await sendEmail({ to, ...rendered, purposeKey: "welcome" })
      if (!result.success) {
        console.error(`[Welcome Email] Delivery failed for ${to}: ${result.error}`)
      }
      return result.success
    } catch (err) {
      console.error(`[Welcome Email] Exception sending to ${to}:`, err)
      return false
    }
  }

  const contentHtml = `
    <h2 style="margin:0 0 12px 0;font-size:16px;font-weight:700;color:#ffffff;">
      Hey ${safeName},
    </h2>
    <p style="margin:0 0 24px 0;font-size:14px;line-height:1.65;color:#94a3b8;">
      Welcome aboard! ${methodLabel} You're fully geared up to register your squad and compete on ACE SCRIMS.
    </p>
  `

  const html = emailShell({
    title: "Welcome to ACE SCRIMS",
    preheader: `Welcome aboard ${safeName}! Your ACE SCRIMS account is active.`,
    contentHtml,
    ctaText: "Explore Scrims & Lobbies",
    ctaUrl: scrimsUrl,
  })

  try {
    const result = await sendEmail({
      to,
      subject: `Welcome aboard, ${rawName} — ACE SCRIMS`,
      html,
      text: `Hey ${rawName}, welcome to ACE SCRIMS! ${methodLabel} Explore upcoming lobbies at ${scrimsUrl}`,
      purposeKey: "welcome",
    })
    if (!result.success) {
      console.error(`[Welcome Email] Delivery failed for ${to}: ${result.error}`)
    }
    return result.success
  } catch (err) {
    console.error(`[Welcome Email] Exception sending to ${to}:`, err)
    return false
  }
}

/**
 * Dispatches any custom admin-defined email purpose dynamically while honoring ON/OFF state.
 */
export async function sendCustomPurposeEmail({
  purposeKey,
  to,
  vars = {},
}: {
  purposeKey: string
  to: string
  vars?: Record<string, string | number | boolean | null | undefined>
}): Promise<boolean> {
  if (!to || !to.includes("@")) return false
  const tpl = await getEmailTemplateByPurpose(purposeKey)
  if (!tpl) {
    console.warn(`[Email Template] Custom purpose "${purposeKey}" not found. Skipping email to ${to}.`)
    return false
  }
  if (!tpl.isEnabled) {
    console.log(`[Email Template] Custom purpose "${purposeKey}" is disabled by admin. Skipping email to ${to}.`)
    await recordEmailLog({
      to,
      purposeKey,
      subject: tpl.subject || purposeKey,
      status: "blocked_by_toggle",
    })
    return true
  }
  const rendered = renderEmailFromTemplate(tpl, vars)
  try {
    const res = await sendEmail({ to, ...rendered, purposeKey })
    return res.success
  } catch (err) {
    console.error(`[Custom Email "${purposeKey}"] Exception sending to ${to}:`, err)
    return false
  }
}



