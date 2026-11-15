import { betterAuth } from "better-auth"
import { pool } from "@/lib/db"
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
  resolveCleanUrl,
} from "@/lib/email"

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
      await sendVerificationEmail(user.email, cleanUrl, user.name)
    },
    afterEmailVerification: async (verifiedUser) => {
      try {
        if (verifiedUser?.email) {
          await sendWelcomeEmail({
            to: verifiedUser.email,
            userName: verifiedUser.name,
            authMethod: "email",
          })
        }
      } catch (err) {
        console.error("[Better Auth] afterEmailVerification welcome email error:", err)
      }
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          try {
            // Send welcome email immediately for pre-verified OAuth signups (e.g. Google)
            if (user?.email && user?.emailVerified) {
              await sendWelcomeEmail({
                to: user.email,
                userName: user.name,
                authMethod: "google",
              })
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
      balance: {
        type: "number",
        defaultValue: 0,
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
  balance?: number
}
