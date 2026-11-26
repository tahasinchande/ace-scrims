import { NextRequest, NextResponse } from "next/server"
import { sendEmail, getProductionAppUrl } from "@/lib/email"
import { getSessionUser } from "@/lib/session"
import { isAdminOrOwner } from "@/lib/roles"
import { escapeHtml, isValidEmailAddress } from "@/lib/url-safety"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const PRIVATE_HEADERS = {
  "Cache-Control": "no-store, private",
}

async function handleEmailDiagnostics(
  req: NextRequest,
  bodyOverride?: { send?: boolean; to?: string } | null
) {
  try {
    const user = await getSessionUser().catch(() => null)

    if (!user || user.banned || !isAdminOrOwner(user.role)) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized. Admin privileges required." },
        { status: 401, headers: PRIVATE_HEADERS }
      )
    }

    const searchParams = req.nextUrl.searchParams
    const rawTo =
      (typeof bodyOverride?.to === "string" ? bodyOverride.to : "") ||
      searchParams.get("to") ||
      user.email ||
      ""
    const targetEmail = rawTo.trim()

    if (!isValidEmailAddress(targetEmail)) {
      return NextResponse.json(
        { ok: false, error: "Invalid recipient email address." },
        { status: 400, headers: PRIVATE_HEADERS }
      )
    }

    const hasResend = Boolean(process.env.RESEND_API_KEY?.trim())
    const hasSendGrid = Boolean(process.env.SENDGRID_API_KEY?.trim())
    const hasSmtp = Boolean(
      process.env.SMTP_HOST?.trim() ||
        (process.env.GMAIL_USER?.trim() && process.env.GMAIL_APP_PASSWORD?.trim())
    )

    const diagnostics = {
      productionAppUrl: getProductionAppUrl(),
      providers: {
        resend: {
          configured: hasResend,
          from:
            process.env.EMAIL_FROM ||
            process.env.RESEND_FROM ||
            "RushX Organization <noreply@mail.acescrims.online>",
        },
        sendgrid: {
          configured: hasSendGrid,
          from:
            process.env.EMAIL_FROM ||
            process.env.SENDGRID_FROM ||
            "RushX Organization <noreply@mail.acescrims.online>",
        },
        smtp: {
          configured: hasSmtp,
          port: process.env.SMTP_PORT || (process.env.SMTP_SECURE === "true" ? "465" : "587"),
        },
      },
    }

    const shouldSend =
      bodyOverride?.send === true || searchParams.get("send") === "true"

    if (shouldSend) {
      const safeEmail = escapeHtml(targetEmail)
      const safeUrl = escapeHtml(getProductionAppUrl())
      const testResult = await sendEmail({
        to: targetEmail,
        subject: "Test Email from RushX Organization",
        html: `<h1>Email Configuration Test</h1><p>Your email service on RushX Organization is working successfully!</p><p>Sent to: <strong>${safeEmail}</strong></p><p>Base URL: ${safeUrl}</p>`,
        text: `Your email service on RushX Organization is working successfully! Base URL: ${getProductionAppUrl()}`,
      })

      return NextResponse.json(
        {
          ok: testResult.success,
          targetEmail,
          result: testResult,
          diagnostics,
        },
        { headers: PRIVATE_HEADERS }
      )
    }

    return NextResponse.json(
      {
        ok: true,
        status:
          hasResend || hasSendGrid || hasSmtp
            ? "Email provider is configured"
            : "No email provider configured in environment variables",
        diagnostics,
        instructions:
          "To trigger a real test email, send POST /api/email/test with { send: true, to: 'your@email.com' } or GET /api/email/test?send=true&to=your@email.com",
      },
      { headers: PRIVATE_HEADERS }
    )
  } catch (err) {
    console.error("[Email Test API Error]", err)
    return NextResponse.json(
      { ok: false, error: "Failed to run email diagnostics." },
      { status: 500, headers: PRIVATE_HEADERS }
    )
  }
}

export async function GET(req: NextRequest) {
  return handleEmailDiagnostics(req, null)
}

export async function POST(req: NextRequest) {
  let body: { send?: boolean; to?: string } | null = null
  try {
    const parsed = await req.json()
    if (parsed && typeof parsed === "object") {
      body = {
        send: Boolean((parsed as Record<string, unknown>).send),
        to:
          typeof (parsed as Record<string, unknown>).to === "string"
            ? ((parsed as Record<string, unknown>).to as string)
            : undefined,
      }
    }
  } catch {
    // Allow empty POST body with query params
  }
  return handleEmailDiagnostics(req, body)
}
