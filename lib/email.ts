import { Resend } from "resend"

const FROM = process.env.EMAIL_FROM ?? "Ace Scrims <onboarding@resend.dev>"

function getResend() {
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  return new Resend(key)
}

function emailShell(title: string, body: string, ctaText: string, ctaUrl: string) {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#0a0a0f;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0f;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#12121a;border:1px solid #26263a;border-radius:16px;overflow:hidden;">
          <tr><td style="background:#ff6a00;height:4px;font-size:0;">&nbsp;</td></tr>
          <tr><td style="padding:32px;">
            <p style="margin:0 0 8px;color:#ff6a00;font-size:13px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">Ace Scrims</p>
            <h1 style="margin:0 0 16px;color:#ffffff;font-size:22px;">${title}</h1>
            <p style="margin:0 0 24px;color:#a0a0b8;font-size:14px;line-height:1.6;">${body}</p>
            <a href="${ctaUrl}" style="display:inline-block;background:#ff6a00;color:#0a0a0f;font-weight:bold;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;">${ctaText}</a>
            <p style="margin:24px 0 0;color:#55556a;font-size:12px;line-height:1.5;">If the button does not work, copy this link:<br/><span style="color:#7a7a95;word-break:break-all;">${ctaUrl}</span></p>
          </td></tr>
        </table>
        <p style="margin:16px 0 0;color:#44445a;font-size:11px;">Ace Scrims — Free Fire Esports Platform</p>
      </td></tr>
    </table>
  </body>
</html>`
}

export async function sendVerificationEmail(to: string, url: string) {
  const resend = getResend()
  if (!resend) {
    console.log("[v0] RESEND_API_KEY not set — verification link:", url)
    return
  }
  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: "Verify your email — Ace Scrims",
      html: emailShell(
        "Verify your email",
        "Welcome to Ace Scrims! Confirm your email address to secure your account and start booking scrims.",
        "Verify Email",
        url,
      ),
    })
  } catch (err) {
    console.error("[email] Failed to send verification email:", err)
  }
}

export async function sendPasswordResetEmail(to: string, url: string) {
  const resend = getResend()
  if (!resend) {
    console.log("[v0] RESEND_API_KEY not set — password reset link:", url)
    return
  }
  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: "Reset your password — Ace Scrims",
      html: emailShell(
        "Reset your password",
        "We received a request to reset your Ace Scrims password. Click the button below to choose a new one. This link expires in 1 hour.",
        "Reset Password",
        url,
      ),
    })
  } catch (err) {
    console.error("[email] Failed to send password reset email:", err)
  }
}
