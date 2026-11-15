import { NextRequest, NextResponse } from "next/server"
import { sendEmail, getProductionAppUrl } from "@/lib/email"
import { getSessionUser } from "@/lib/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser().catch(() => null)
    
    // Allow admins or test secret param
    const authHeader = req.headers.get("authorization")
    const searchParams = req.nextUrl.searchParams
    if (!user || user.role !== "admin") {
      return NextResponse.json(
        { ok: false, error: "Unauthorized. Admin privileges required." },
        { status: 401 }
      )
    }

    const targetEmail = searchParams.get("to") || user.email

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
          from: process.env.EMAIL_FROM || process.env.RESEND_FROM || "ACE SCRIMS <noreply@mail.acescrims.online>",
        },
        sendgrid: {
          configured: hasSendGrid,
          from: process.env.EMAIL_FROM || process.env.SENDGRID_FROM || "ACE SCRIMS <noreply@mail.acescrims.online>",
        },
        smtp: {
          configured: hasSmtp,
          port: process.env.SMTP_PORT || (process.env.SMTP_SECURE === "true" ? "465" : "587"),
        },
      },
    }

    // If query ?send=true and authorized, attempt sending a test email
    if (searchParams.get("send") === "true") {
      const testResult = await sendEmail({
        to: targetEmail,
        subject: "Test Email from ACE SCRIMS",
        html: `<h1>Email Configuration Test</h1><p>Your email service on ACE SCRIMS is working successfully!</p><p>Sent to: <strong>${targetEmail}</strong></p><p>Base URL: ${getProductionAppUrl()}</p>`,
        text: `Your email service on ACE SCRIMS is working successfully! Base URL: ${getProductionAppUrl()}`,
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
