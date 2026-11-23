import { NextRequest, NextResponse } from "next/server"
import { sendEmail, getProductionAppUrl } from "@/lib/email"
import { getSessionUser } from "@/lib/session"
import { escapeHtml } from "@/lib/url-safety"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser().catch(() => null)

    const searchParams = req.nextUrl.searchParams
    if (!user || user.banned || user.role !== "admin") {
      return NextResponse.json(
        { ok: false, error: "Unauthorized. Admin privileges required." },
        { status: 401 }
      )
    }

    const targetEmail = (searchParams.get("to") || user.email || "").trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
      return NextResponse.json(
        { ok: false, error: "Invalid recipient email address." },
        { status: 400 }
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
          from: process.env.EMAIL_FROM || process.env.RESEND_FROM || "RushX Organization <noreply@mail.acescrims.online>",
        },
        sendgrid: {
          configured: hasSendGrid,
          from: process.env.EMAIL_FROM || process.env.SENDGRID_FROM || "RushX Organization <noreply@mail.acescrims.online>",
        },
        smtp: {
          configured: hasSmtp,
          port: process.env.SMTP_PORT || (process.env.SMTP_SECURE === "true" ? "465" : "587"),
        },
      },
    }

    // If query ?send=true and authorized, attempt sending a test email
    if (searchParams.get("send") === "true") {
      const safeEmail = escapeHtml(targetEmail)
      const safeUrl = escapeHtml(getProductionAppUrl())
      const testResult = await sendEmail({
        to: targetEmail,
        subject: "Test Email from RushX Organization",
        html: `<h1>Email Configuration Test</h1><p>Your email service on RushX Organization is working successfully!</p><p>Sent to: <strong>${safeEmail}</strong></p><p>Base URL: ${safeUrl}</p>`,
        text: `Your email service on RushX Organization is working successfully! Base URL: ${getProductionAppUrl()}`,
      })

      return NextResponse.json({
        ok: testResult.success,
        targetEmail,
        result: testResult,
        diagnostics,
      })
    }

    return NextResponse.json({
      ok: true,
      status: hasResend || hasSendGrid || hasSmtp ? "Email provider is configured" : "No email provider configured in environment variables",
      diagnostics,
      instructions: "To trigger a real test email, request GET /api/email/test?send=true&to=your@email.com",
    })
  } catch (err: any) {
    console.error("[Email Test API Error]", err)
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to run email diagnostics" },
      { status: 500 }
    )
  }
}
