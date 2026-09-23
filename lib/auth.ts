import { betterAuth } from "better-auth"
import { pool } from "@/lib/db"
import { sendPasswordResetEmail, sendVerificationEmail, resolveCleanUrl } from "@/lib/email"

async function sendGoogleWelcomeEmail(user: { name?: string | null; email: string }) {
  try {
    const userName = user?.name ? user.name.trim() : "Player"
    const subject = `Welcome aboard, ${userName} — ACE SCRIMS`

    console.log(`[Better Auth] Sending Google OAuth Welcome email to ${user.email}`)
    const { Resend } = await import("resend")
    const resend = new Resend(process.env.RESEND_API_KEY)

    const response = await resend.emails.send({
      from: "ACE SCRIMS <noreply@mail.acescrims.online>",
      to: [user.email],
      subject,
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#05060a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#ffffff;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#05060a;padding:40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#0c0e17;border:1px solid #1e2235;border-radius:16px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.7);">
          
          <!-- Top Accent Stripe -->
          <tr>
            <td height="4" style="background:linear-gradient(90deg, #ea580c, #f97316, #ea580c);font-size:0;line-height:0;">&nbsp;</td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="padding:36px 36px 20px 36px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
                <tr>
                  <td>
                    <span style="display:inline-block;background:rgba(234,88,12,0.14);color:#f97316;font-size:11px;font-weight:800;letter-spacing:1.8px;text-transform:uppercase;padding:5px 12px;border-radius:6px;border:1px solid rgba(249,115,22,0.35);">
                      ACE SCRIMS
                    </span>
                  </td>
                  <td align="right">
                    <span style="color:#64748b;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">
                      Verified Account
                    </span>
                  </td>
                </tr>
              </table>
              <h1 style="margin:0;font-size:22px;font-weight:800;letter-spacing:-0.4px;color:#ffffff;line-height:1.3;">
                Welcome to ACE SCRIMS
              </h1>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 36px;">
              <div style="height:1px;background-color:#1e2235;width:100%;"></div>
            </td>
          </tr>

          <!-- Personalized Body -->
          <tr>
            <td style="padding:28px 36px 20px 36px;">
              <h2 style="margin:0 0 12px 0;font-size:16px;font-weight:700;color:#ffffff;">
                Hey ${userName},
              </h2>
              <p style="margin:0 0 24px 0;font-size:14px;line-height:1.65;color:#94a3b8;">
                Welcome aboard! Your account is active and verified via Google. You're fully geared up to explore our platform.
              </p>

              <!-- CTA Button -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;">
                <tr>
                  <td align="center">
                    <table role="presentation" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="border-radius:8px;background:#ea580c;">
                          <a href="https://www.acescrims.online/scrims" target="_blank" style="display:inline-block;background:#ea580c;color:#ffffff;font-weight:800;font-size:14px;padding:14px 34px;border-radius:8px;text-decoration:none;text-transform:uppercase;letter-spacing:0.8px;">
                            EXPLORE SCRIMS &amp; TOURNAMENTS
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Features Section: WHAT'S WAITING FOR YOU -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#121524;border:1px solid #1f2438;border-radius:10px;margin:0 0 24px 0;">
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
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="background-color:#0a0c13;border-top:1px solid #1e2235;padding:18px 24px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#64748b;font-weight:500;">
                &copy; ACE SCRIMS Esports | Play Hard. Dominate the Leaderboard.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    })

    if (response?.error) {
      console.error("[Better Auth Google Welcome Email Error]:", response.error)
    } else {
      console.log("[Better Auth Google Welcome Email Success]: Sent to", user.email, "ID:", response?.data?.id)
    }
  } catch (err) {
    console.error("[Better Auth Google Welcome Email Exception]:", err)
  }
}

function getAuthBaseUrl(): string {
  if (process.env.BETTER_AUTH_URL) {
    const raw = process.env.BETTER_AUTH_URL.trim().replace(/\/$/, "")
    if (raw && !raw.includes("localhost") && !raw.includes("127.0.0.1") && !raw.includes("vercel.app")) {
      return raw.startsWith("http") ? raw : `https://${raw}`
    }
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    const raw = process.env.NEXT_PUBLIC_APP_URL.trim().replace(/\/$/, "")
    if (raw && !raw.includes("localhost") && !raw.includes("127.0.0.1") && !raw.includes("vercel.app")) {
      return raw.startsWith("http") ? raw : `https://${raw}`
    }
  }
  return "https://www.acescrims.online"
}

export const auth = betterAuth({
  secret:
    process.env.BETTER_AUTH_SECRET ??
    "OQtS09OwRFnGG0rSjncYsakwMwx3WUzDbCuXdztoPIQ=",
  database: pool,
  baseURL: getAuthBaseUrl(),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      const cleanUrl = resolveCleanUrl(url)
      await sendPasswordResetEmail(user.email, cleanUrl)
    },
  },
  socialProviders: {
    google: {
      clientId:
        process.env.GOOGLE_CLIENT_ID ||
        "1059205795454-1co5jbtc6964okogp41t00m39soui3b.apps.googleusercontent.com",
      clientSecret:
        process.env.GOOGLE_CLIENT_SECRET ||
        "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",
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      const cleanUrl = resolveCleanUrl(url)
      await sendVerificationEmail(user.email, cleanUrl)
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user, context) => {
          try {
            // When a new user is created via Google (or pre-verified social sign up)
            if (user?.email && user?.emailVerified) {
              await sendGoogleWelcomeEmail(user)
            }
          } catch (hookError) {
            console.error("[Better Auth Hook Error]:", hookError)
          }
        },
      },
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "user",
        input: false,
      },
      banned: {
        type: "boolean",
        defaultValue: false,
        input: false,
      },
    },
  },
  trustedOrigins: [
    "https://acescrims.online",
    "https://www.acescrims.online",
    "http://localhost:3000",
    "http://localhost:3001",
    "https://*.run.app",
    "https://*.vercel.app",
    "https://*.google.com",
    "https://ai.studio",
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  advanced: {
    defaultCookieAttributes: {
      sameSite: "none" as const,
      secure: true,
    },
  },
})

export type SessionUser = {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image?: string | null
  role: string
  banned: boolean
}
