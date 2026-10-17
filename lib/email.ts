import { Resend } from "resend"
import nodemailer from "nodemailer"

export type EmailSendResult = {
  success: boolean
  provider?: "resend" | "smtp" | "console"
  messageId?: string
  error?: string
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
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === "production",
      },
    })
  }

  return null
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

/**
 * Universal email sender with automatic fallback chain:
 * 1. Resend SDK / API
 * 2. Nodemailer SMTP (Gmail, Brevo, SendGrid, Amazon SES, Custom SMTP)
 * 3. Log link to Vercel runtime logs if no provider configured
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
  from,
}: {
  to: string
  subject: string
  html: string
  text?: string
  from?: string
}): Promise<EmailSendResult> {
  const sender = from || getFromAddress()
  const resend = getResendClient()
  const smtp = getSmtpTransporter()

  // 1. Try Resend if configured
  if (resend) {
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
        return { success: true, provider: "resend", messageId: response.data?.id }
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
          return { success: true, provider: "resend", messageId: fallbackRes.data?.id }
        }
        console.error(`[Email Service] Resend fallback also failed:`, fallbackRes.error)
      }
    } catch (resendErr: any) {
      console.error(`[Email Service] Resend exception:`, resendErr?.message || resendErr)
    }
  }

  // 2. Try SMTP / Nodemailer if configured
  if (smtp) {
    try {
      console.log(`[Email Service] Attempting delivery to ${to} via SMTP Transporter...`)
      const info = await smtp.sendMail({
        from: sender,
        to,
        subject,
        html,
        text,
      })
      console.log(`[Email Service] Successfully sent email to ${to} via SMTP. Message ID: ${info.messageId}`)
      return { success: true, provider: "smtp", messageId: info.messageId }
    } catch (smtpErr: any) {
      console.error(`[Email Service] SMTP delivery exception:`, smtpErr?.message || smtpErr)
    }
  }

  // 3. Fallback when no working provider is configured
  const errorMsg = !resend && !smtp
    ? "No email provider configured. Please set RESEND_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASS in Vercel Environment Variables."
    : "Email delivery failed across all configured providers."

  console.error(`[Email Service Warning] ${errorMsg}`)
  return { success: false, error: errorMsg }
}

/**
 * Sends the Email Verification message.
 */
export async function sendVerificationEmail(to: string, url: string, userName?: string): Promise<boolean> {
  const cleanUrl = resolveCleanUrl(url)
  const name = userName || "Player"

  console.log("====================================================================")
  console.log(`[EMAIL VERIFICATION LINK FOR ${to}]`)
  console.log(`URL: ${cleanUrl}`)
  console.log("====================================================================")

  const contentHtml = `
    <h2 style="margin:0 0 12px 0;font-size:16px;font-weight:700;color:#ffffff;">
      Hey ${name},
    </h2>
    <p style="margin:0 0 24px 0;font-size:14px;line-height:1.65;color:#94a3b8;">
      Welcome aboard! Please click the button below to verify your email address and activate your account. You'll be fully geared up to explore our platform.
    </p>

    <!-- Features Section: WHAT'S WAITING FOR YOU -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#121524;border:1px solid #1f2438;border-radius:10px;margin:24px 0 12px 0;">
      <tr>
        <td style="padding:18px 20px;">
          <p style="margin:0 0 12px 0;font-size:11px;font-weight:800;letter-spacing:1px;color:#f97316;text-transform:uppercase;">
            WHAT'S WAITING FOR YOU:
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:6px 0;font-size:13px;line-height:1.55;color:#94a3b8;">
                <span style="color:#f97316;font-weight:bold;margin-right:8px;">•</span>
                <strong style="color:#ffffff;">Daily Evening Scrims:</strong> High-tier regular squad showdowns.
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:13px;line-height:1.55;color:#94a3b8;">
                <span style="color:#f97316;font-weight:bold;margin-right:8px;">•</span>
                <strong style="color:#ffffff;">Friday Special Blast &amp; 10 PM Champion Rush:</strong> Weekend peak events with bigger prize pools.
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;font-size:13px;line-height:1.55;color:#94a3b8;">
                <span style="color:#f97316;font-weight:bold;margin-right:8px;">•</span>
                <strong style="color:#ffffff;">Post-Match Rewards:</strong> Get recognized with custom MVP Face Banners, Top 3 Podium Cards, and real-time Standings.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
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
    text: `Hey ${name}, welcome aboard! Please verify your email by opening this link: ${cleanUrl}`,
  })

  if (!result.success) {
    console.error(`[Email Verification Failed] Could not deliver email to ${to}. Error: ${result.error}`)
  }

  return result.success
}

/**
 * Sends the Password Reset message.
 */
export async function sendPasswordResetEmail(to: string, url: string): Promise<boolean> {
  const cleanUrl = resolveCleanUrl(url)

  console.log("====================================================================")
  console.log(`[PASSWORD RESET LINK FOR ${to}]`)
  console.log(`URL: ${cleanUrl}`)
  console.log("====================================================================")

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
  })

  if (!result.success) {
    console.error(`[Password Reset Failed] Could not deliver email to ${to}. Error: ${result.error}`)
  }

  return result.success
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
  const appUrl = getProductionAppUrl()
  const dashboardUrl = `${appUrl}/dashboard/scrims`

  const contentHtml = `
    <p style="margin:0 0 18px 0;color:#ffffff;font-size:16px;">
      Hello ${recipientName || "Captain"},
    </p>
    <p style="margin:0 0 20px 0;">
      Your squad booking has been confirmed for <strong>${scrimTitle}</strong>. Your payment of <strong>BDT ${amountBdt}</strong> was verified automatically.
    </p>

    <!-- Booking Summary Card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#121524;border:1px solid #23273e;border-radius:10px;margin-bottom:24px;">
      <tr>
        <td style="padding:16px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:4px 0;color:#64748b;font-size:13px;width:120px;">Squad Name:</td>
              <td style="padding:4px 0;color:#ffffff;font-size:14px;font-weight:700;">${teamName}</td>
            </tr>
            <tr>
              <td style="padding:4px 0;color:#64748b;font-size:13px;">Assigned Slot:</td>
              <td style="padding:4px 0;color:#f97316;font-size:14px;font-weight:800;">Slot #${slotNumber}</td>
            </tr>
            <tr>
              <td style="padding:4px 0;color:#64748b;font-size:13px;">Tournament:</td>
              <td style="padding:4px 0;color:#ffffff;font-size:14px;font-weight:600;">${scrimTitle}</td>
            </tr>
            <tr>
              <td style="padding:4px 0;color:#64748b;font-size:13px;">Match Start:</td>
              <td style="padding:4px 0;color:#ffffff;font-size:14px;font-weight:700;">${startTime}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Explicit Timeline & Match Guidelines -->
    <div style="margin-bottom:24px;">
      <h3 style="margin:0 0 12px 0;color:#ffffff;font-size:14px;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;">
        Match Timeline &amp; Regulations
      </h3>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0e111d;border:1px solid #1e2337;border-radius:8px;padding:12px;margin-bottom:14px;">
        <tr>
          <td style="padding:6px 10px;color:#f97316;font-size:13px;font-weight:700;width:140px;">Scrim Time:</td>
          <td style="padding:6px 10px;color:#ffffff;font-size:13px;">Scheduled match begins at <strong>${startTime}</strong>.</td>
        </tr>
        <tr>
          <td style="padding:6px 10px;color:#f97316;font-size:13px;font-weight:700;">ID &amp; Password Arrival:</td>
          <td style="padding:6px 10px;color:#ffffff;font-size:13px;">Credentials will arrive <strong>10 to 15 minutes</strong> before match time directly in your Player Dashboard and via Email.</td>
        </tr>
        <tr>
          <td style="padding:6px 10px;color:#f97316;font-size:13px;font-weight:700;">Joining Window:</td>
          <td style="padding:6px 10px;color:#ffffff;font-size:13px;">You have exactly <strong>5 minutes</strong> to enter the custom room and sit strictly in your assigned <strong>Slot #${slotNumber}</strong>.</td>
        </tr>
        <tr>
          <td style="padding:6px 10px;color:#f97316;font-size:13px;font-weight:700;">Match Kickoff:</td>
          <td style="padding:6px 10px;color:#ffffff;font-size:13px;">The match starts promptly <strong>10 minutes</strong> after room creation.</td>
        </tr>
      </table>

      <ul style="margin:0;padding-left:18px;color:#94a3b8;font-size:13px;line-height:1.7;">
        <li>Sit strictly in your assigned <strong style="color:#f97316;">Slot #${slotNumber}</strong> inside the custom room. Taking other slots will cause moderators to kick your players.</li>
        <li>Mobile devices only. Emulators, iPads with modified aspect ratios, and third-party tools are strictly banned and result in immediate disqualification.</li>
      </ul>
    </div>
  `

  const html = emailShell({
    title: `Booking Confirmed — Slot #${slotNumber}`,
    preheader: `Your slot #${slotNumber} for ${scrimTitle} (${startTime}) is confirmed.`,
    contentHtml,
    ctaText: "Open Player Dashboard",
    ctaUrl: dashboardUrl,
  })

  const result = await sendEmail({
    to,
    subject: `Booking Confirmed: ${scrimTitle} (Slot #${slotNumber}) — ACE SCRIMS`,
    html,
    text: `Your squad ${teamName} is confirmed for ${scrimTitle} in Slot #${slotNumber}. Match start: ${startTime}. View details in your dashboard: ${dashboardUrl}`,
  })

  return result.success
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
  const appUrl = getProductionAppUrl()
  const dashboardUrl = `${appUrl}/dashboard/scrims`

  const statusHeadline = isUpdated
    ? `ATTENTION: The Room ID or Password has been updated for <strong>${scrimTitle}</strong>. Please join using the new credentials below:`
    : `Room details for <strong>${scrimTitle}</strong> are now live. Enter the credentials below in Free Fire immediately.`

  const contentHtml = `
    <p style="margin:0 0 18px 0;color:#ffffff;font-size:16px;">
      Hello ${recipientName || "Captain"},
    </p>
    ${
      isUpdated
        ? `
    <div style="margin-bottom:20px;padding:14px 18px;background:rgba(234,88,12,0.18);border:1px solid #ea580c;border-radius:10px;color:#f97316;font-size:13px;font-weight:700;line-height:1.5;">
      UPDATE NOTICE: Room credentials for this scrim were updated by the match admin. Make sure your squad enters using these updated details!
    </div>`
        : ""
    }
    <p style="margin:0 0 20px 0;">
      ${statusHeadline}
    </p>

    <!-- Room Credentials Box -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#13182b;border:2px solid #ea580c;border-radius:12px;margin-bottom:24px;">
      <tr>
        <td style="padding:22px 24px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:6px 0;color:#94a3b8;font-size:13px;width:130px;font-weight:600;">ROOM ID:</td>
              <td style="padding:6px 0;">
                <span style="font-family:Consolas, Monaco, monospace;font-size:22px;font-weight:900;color:#f97316;letter-spacing:1.5px;">
                  ${roomId}
                </span>
              </td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#94a3b8;font-size:13px;font-weight:600;">PASSWORD:</td>
              <td style="padding:6px 0;">
                <span style="font-family:Consolas, Monaco, monospace;font-size:22px;font-weight:900;color:#ffffff;letter-spacing:1.5px;">
                  ${roomPassword}
                </span>
              </td>
            </tr>
            ${
              slotNumber
                ? `
            <tr>
              <td style="padding:6px 0;color:#94a3b8;font-size:13px;font-weight:600;">YOUR SLOT:</td>
              <td style="padding:6px 0;color:#38bdf8;font-size:15px;font-weight:800;">
                Slot #${slotNumber} (${teamName})
              </td>
            </tr>`
                : ""
            }
            <tr>
              <td style="padding:6px 0;color:#94a3b8;font-size:13px;font-weight:600;">SCHEDULE:</td>
              <td style="padding:6px 0;color:#cbd5e1;font-size:14px;font-weight:700;">
                ${startTime}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <div style="margin-bottom:20px;">
      <h3 style="margin:0 0 10px 0;color:#ffffff;font-size:13px;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;">
        Important Joining Rules
      </h3>
      <ul style="margin:0;padding-left:18px;color:#94a3b8;font-size:13px;line-height:1.7;">
        <li>Sit strictly in your assigned slot${slotNumber ? ` (Slot #${slotNumber})` : ""}.</li>
        <li>Do NOT leak or share room credentials outside of your squad members. Doing so results in permanent ban.</li>
        <li>Emulators and third-party tools are banned. Mobile devices only.</li>
      </ul>
    </div>
  `

  const title = isUpdated ? `Room Credentials Updated: ${scrimTitle}` : `Room Credentials Released: ${scrimTitle}`
  const preheader = isUpdated
    ? `UPDATED Room ID: ${roomId} | Password: ${roomPassword} for ${scrimTitle}`
    : `Room ID: ${roomId} | Password: ${roomPassword} for ${scrimTitle}`

  const html = emailShell({
    title,
    preheader,
    contentHtml,
    ctaText: "Go to Dashboard",
    ctaUrl: dashboardUrl,
  })

  const subject = isUpdated
    ? `UPDATED Room ID & Password: ${scrimTitle} — ACE SCRIMS`
    : `Room ID & Password: ${scrimTitle} — ACE SCRIMS`

  const result = await sendEmail({
    to,
    subject,
    html,
    text: `${title}. Room ID: ${roomId} | Password: ${roomPassword}. Start time: ${startTime}. View in dashboard: ${dashboardUrl}`,
  })

  return result.success
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
  const appUrl = getProductionAppUrl()
  const dashboardUrl = `${appUrl}/dashboard`

  const contentHtml = `
    <p style="margin:0 0 16px 0;font-size:15px;color:#ffffff;line-height:1.6;">
      Hello <strong>${recipientName}</strong>,
    </p>
    <p style="margin:0 0 20px 0;line-height:1.65;color:#94a3b8;">
      We regret to inform you that <strong>${scrimTitle}</strong> (${scrimDate} at ${startTime}) did not meet the required minimum team slots and has been marked as <strong>Not Hosted</strong>.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f111c;border:1px solid #1e2235;border-radius:10px;margin-bottom:24px;">
      <tr>
        <td style="padding:18px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:6px 0;color:#94a3b8;font-size:13px;font-weight:600;">SQUAD NAME:</td>
              <td style="padding:6px 0;color:#ffffff;font-size:14px;font-weight:700;">${teamName}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#94a3b8;font-size:13px;font-weight:600;">STATUS:</td>
              <td style="padding:6px 0;color:#ef4444;font-size:14px;font-weight:800;text-transform:uppercase;">Not Hosted</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#94a3b8;font-size:13px;font-weight:600;">REFUND AMOUNT:</td>
              <td style="padding:6px 0;color:#10b981;font-size:15px;font-weight:800;">৳${amountBdt} BDT (Full Refund)</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <div style="margin-bottom:20px;">
      <h3 style="margin:0 0 10px 0;color:#ffffff;font-size:13px;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;">
        Refund Processing Notice
      </h3>
      <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.65;">
        Your squad's entry fee has been transferred to our refund queue. It will be credited back via bKash/Nagad. You can track this and other matches from your player dashboard.
      </p>
    </div>
  `

  const html = emailShell({
    title: `Scrim Not Hosted: ${scrimTitle}`,
    preheader: `${scrimTitle} has been marked as Not Hosted. Your entry fee will be refunded.`,
    contentHtml,
    ctaText: "Go to Dashboard",
    ctaUrl: dashboardUrl,
  })

  const result = await sendEmail({
    to,
    subject: `Scrim Match Not Hosted: ${scrimTitle} — ACE SCRIMS`,
    html,
    text: `Hello ${recipientName}, ${scrimTitle} (${scrimDate} at ${startTime}) was not hosted. Your squad ${teamName} will be refunded ৳${amountBdt}. View status: ${dashboardUrl}`,
  })

  return result.success
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
  const appUrl = getProductionAppUrl()
  const resultsUrl = `${appUrl}/results`

  const isWinner = teamName.toLowerCase().trim() === winningTeam.toLowerCase().trim()

  const contentHtml = `
    <p style="margin:0 0 16px 0;font-size:15px;color:#ffffff;line-height:1.6;">
      Hello <strong>${recipientName}</strong>,
    </p>
    <p style="margin:0 0 20px 0;line-height:1.65;color:#94a3b8;">
      The official match results for <strong>${scrimTitle}</strong> have just been verified and published by the tournament administration.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f111c;border:1px solid #1e2235;border-radius:10px;margin-bottom:24px;">
      <tr>
        <td style="padding:18px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:6px 0;color:#94a3b8;font-size:13px;font-weight:600;">YOUR SQUAD:</td>
              <td style="padding:6px 0;color:#ffffff;font-size:14px;font-weight:700;">${teamName}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#94a3b8;font-size:13px;font-weight:600;">CHAMPION / WINNER:</td>
              <td style="padding:6px 0;color:#f97316;font-size:15px;font-weight:800;">${winningTeam} ${isWinner ? "(Your Team 🎉)" : ""}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#94a3b8;font-size:13px;font-weight:600;">CATEGORY:</td>
              <td style="padding:6px 0;color:#cbd5e1;font-size:13px;font-weight:700;">${category}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#94a3b8;font-size:13px;font-weight:600;">WINNER KILLS:</td>
              <td style="padding:6px 0;color:#ffffff;font-size:14px;font-weight:700;">${kills} Kills</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#94a3b8;font-size:13px;font-weight:600;">PRIZE POOL AWARDED:</td>
              <td style="padding:6px 0;color:#10b981;font-size:15px;font-weight:800;">৳${prizeBdt} BDT</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <div style="margin-bottom:20px;">
      <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.65;">
        You can inspect the full leaderboard, screenshot proofs, and match statistics directly on the official results page.
      </p>
    </div>
  `

  const html = emailShell({
    title: `Match Results Published: ${scrimTitle}`,
    preheader: `Official results published for ${scrimTitle}. Winner: ${winningTeam} with ${kills} kills.`,
    contentHtml,
    ctaText: "View Full Match Results",
    ctaUrl: resultsUrl,
  })

  try {
    const result = await sendEmail({
      to,
      subject: `Match Results Published: ${scrimTitle} — ACE SCRIMS`,
      html,
      text: `Hello ${recipientName}, the official match results for ${scrimTitle} have been published. Winner: ${winningTeam} with ${kills} kills. Prize: ৳${prizeBdt} BDT. View results at ${resultsUrl}`,
    })
    if (!result.success) {
      console.error(`[Match Result Email] Delivery failed to ${to}:`, result.error || "Unknown delivery error")
    }
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
  const appUrl = getProductionAppUrl()
  const dashboardUrl = `${appUrl}/dashboard/image-requests`

  const targetPlayerStr = mvpPlayerName ? `player <strong>${mvpPlayerName}</strong> from squad <strong>${teamName}</strong>` : `your squad <strong>${teamName}</strong>`

  const contentHtml = `
    <p style="margin:0 0 16px 0;font-size:15px;color:#ffffff;line-height:1.6;">
      Hello <strong>${recipientName}</strong>,
    </p>
    <p style="margin:0 0 20px 0;line-height:1.65;color:#94a3b8;">
      Congratulations! Ace Scrims management has officially requested an image asset for ${targetPlayerStr} from <em>${scrimTitle}</em>${scrimDate ? ` (${scrimDate})` : ""} to be featured in the official Ace Scrims Face Banners showcase.
    </p>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f111c;border:1px solid #1e2235;border-radius:10px;margin-bottom:24px;">
      <tr>
        <td style="padding:18px 20px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:6px 0;color:#94a3b8;font-size:13px;font-weight:600;">SQUAD:</td>
              <td style="padding:6px 0;color:#ffffff;font-size:14px;font-weight:700;">${teamName}</td>
            </tr>
            ${mvpPlayerName ? `
            <tr>
              <td style="padding:6px 0;color:#94a3b8;font-size:13px;font-weight:600;">MVP PLAYER:</td>
              <td style="padding:6px 0;color:#10b981;font-size:14px;font-weight:700;">${mvpPlayerName}</td>
            </tr>
            ` : ""}
            <tr>
              <td style="padding:6px 0;color:#94a3b8;font-size:13px;font-weight:600;">EVENT:</td>
              <td style="padding:6px 0;color:#f97316;font-size:14px;font-weight:700;">${scrimTitle}${scrimDate ? ` · ${scrimDate}` : ""}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#94a3b8;font-size:13px;font-weight:600;">REQUEST TYPE:</td>
              <td style="padding:6px 0;color:#10b981;font-size:14px;font-weight:800;">${requestType || "MVP Face Banner Image"}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#94a3b8;font-size:13px;font-weight:600;">PHOTO GUIDELINES:</td>
              <td style="padding:6px 0;color:#cbd5e1;font-size:13px;">Waist-up photo (কোমর পর্যন্ত ছবি), preferably with background removed</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <div style="margin-bottom:20px;">
      <p style="margin:0;color:#94a3b8;font-size:13px;line-height:1.65;">
        Please upload your photo now directly from your User Dashboard to ensure your feature in our next production banner.
      </p>
    </div>
  `

  const html = emailShell({
    title: `MVP Image Requested: ${teamName}`,
    preheader: `Ace Scrims management has requested an MVP photo for ${teamName} (${scrimTitle}).`,
    contentHtml,
    ctaText: "Upload MVP Image Now",
    ctaUrl: dashboardUrl,
  })

  try {
    const result = await sendEmail({
      to,
      subject: `Action Required: Upload MVP Image for ${teamName} — ACE SCRIMS`,
      html,
      text: `Hello ${recipientName}, congratulations! Ace Scrims management has requested an MVP photo for ${teamName} (${scrimTitle}). Please upload it on your dashboard at: ${dashboardUrl}`,
    })
    return result.success
  } catch (err) {
    console.error(`[MVP Image Request Email] Exception sending to ${to}:`, err)
    return false
  }
}


