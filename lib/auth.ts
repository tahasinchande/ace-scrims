import { randomBytes } from "crypto"
import { betterAuth } from "better-auth"
import { pool } from "@/lib/db"
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
  resolveCleanUrl,
} from "@/lib/email"

let cachedDevSecret: string | null = null

function getAuthSecret(): string {
  const envSecret = process.env.BETTER_AUTH_SECRET?.trim()
  if (envSecret) return envSecret

  const isBuildPhase =
    process.env.NEXT_PHASE === "phase-production-build" ||
    process.env.npm_lifecycle_event === "build"

  if (process.env.NODE_ENV !== "production" || isBuildPhase) {
    if (!cachedDevSecret) {
      cachedDevSecret = randomBytes(32).toString("base64")
    }
    return cachedDevSecret
  }

  console.error("[Better Auth] BETTER_AUTH_SECRET environment variable is missing in production.")
  if (!cachedDevSecret) {
    cachedDevSecret = randomBytes(32).toString("base64")
  }
  return cachedDevSecret
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
  return "https://rushxorg.online"
}

const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim()
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()

export const auth = betterAuth({
  secret: getAuthSecret(),
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
  ...(googleClientId && googleClientSecret
    ? {
        socialProviders: {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          },
        },
      }
    : {}),
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
        after: async (createdUser) => {
          try {
            // Auto-assign Owner role to the primary Owner email on account creation
            try {
              const { isPrimaryOwnerEmail } = await import("@/lib/roles")
              if (isPrimaryOwnerEmail(createdUser.email)) {
                const { db } = await import("@/lib/db")
                const { user: userTable } = await import("@/lib/db/schema")
                const { eq } = await import("drizzle-orm")
                await db
                  .update(userTable)
                  .set({ role: "owner", banned: false, updatedAt: new Date() })
                  .where(eq(userTable.id, createdUser.id))
              }
            } catch (ownerErr) {
              console.error("[Better Auth Hook] Primary owner assignment error:", ownerErr)
            }

            // Read staged referral cookie (works seamlessly for both Email/Password & Google OAuth sign-ups)
            let stagedRefCode: string | null = null
            try {
              const { cookies } = await import("next/headers")
              const cookieStore = await cookies()
              stagedRefCode = cookieStore.get("ace_ref_code")?.value ?? null
              if (stagedRefCode) {
                try {
                  cookieStore.delete("ace_ref_code")
                } catch {
                  // Deleting cookies is ignored in read-only contexts
                }
              }
            } catch {
              // Ignore when invoked outside a request scope
            }

            try {
              const { attributeReferralOnSignup, ensureUserReferralCode } = await import("@/lib/referrals")
              await attributeReferralOnSignup({
                newUserId: createdUser.id,
                rawCode: stagedRefCode,
              })
              await ensureUserReferralCode(createdUser.id, createdUser.name)
            } catch (refErr) {
              console.error("[Better Auth Hook] Referral attribution error:", refErr)
            }

            // Send welcome email immediately for pre-verified OAuth signups (e.g. Google)
            if (createdUser?.email && createdUser?.emailVerified) {
              await sendWelcomeEmail({
                to: createdUser.email,
                userName: createdUser.name,
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
    "https://rushxorg.online",
    "https://www.rushxorg.online",
    "https://pay.rushxorg.online",
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
