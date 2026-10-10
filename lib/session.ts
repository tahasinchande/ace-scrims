import "server-only"

import { headers } from "next/headers"
import { auth, type SessionUser } from "@/lib/auth"

/** Returns the current session user, or null when unauthenticated. */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const h = await headers().catch(() => null)
    if (!h) return null
    const session = await auth.api.getSession({ headers: h })
    if (!session?.user) return null
    return session.user as unknown as SessionUser
  } catch {
    return null
  }
}

/** Throws when unauthenticated or banned. */
export async function requireUser(): Promise<SessionUser> {
  const u = await getSessionUser()
  if (!u) throw new Error("Unauthorized")
  if (u.banned) throw new Error("Account suspended")
  return u
}

/** Requires signed in user with verified email. Redirects unverified users to /verify-email. */
export async function requireVerifiedUser(): Promise<SessionUser> {
  const u = await requireUser()
  if (!u.emailVerified) {
    const { redirect } = await import("next/navigation")
    redirect("/verify-email")
  }
  return u
}

/** Throws unless the user is a moderator or admin. */
export async function requireStaff(): Promise<SessionUser> {
  const u = await requireUser()
  if (u.role !== "admin" && u.role !== "moderator") throw new Error("Forbidden")
  return u
}

/** Throws unless the user is an admin. */
export async function requireAdmin(): Promise<SessionUser> {
  const u = await requireUser()
  if (u.role !== "admin") throw new Error("Forbidden")
  return u
}

/** Logs an administrative or staff action to the activity_logs table. */
export async function logActivity(
  actorId: string | null,
  actorRole: string | null,
  action: string,
  target?: string | null,
  meta?: Record<string, unknown> | null
) {
  try {
    const { db } = await import("@/lib/db")
    const { activityLogs } = await import("@/lib/db/schema")
    const { randomUUID } = await import("crypto")
    await db.insert(activityLogs).values({
      id: randomUUID(),
      actorId: actorId ?? null,
      actorRole: actorRole ?? "admin",
      action,
      target: target ?? null,
      meta: meta ?? null,
    })
  } catch (err) {
    console.warn("[Session] logActivity error:", err)
  }
}

/** Redirects non-staff to /maintenance if maintenance_mode setting is enabled, and redirects /maintenance to / when disabled. */
export async function checkMaintenanceMode() {
  let shouldRedirectToMaintenance = false
  let shouldRedirectToHome = false

  try {
    const { headers } = await import("next/headers")
    const h = await headers().catch(() => null)
    if (!h) return
    const pathname = h.get("x-invoke-path") || h.get("x-pathname") || h.get("next-url") || ""

    // Allow static assets, staff/admin portal, staff login, and API routes to bypass maintenance redirect
    if (
      pathname.startsWith("/admin") ||
      pathname.startsWith("/staff-login") ||
      pathname.startsWith("/api/") ||
      pathname.startsWith("/_next/") ||
      pathname.includes(".")
    ) {
      return
    }

    const { db } = await import("@/lib/db")
    const { settings } = await import("@/lib/db/schema")
    const { eq } = await import("drizzle-orm")
    const rows = await db.select().from(settings).where(eq(settings.key, "maintenance_mode")).limit(1)
    const isMaintenanceOn = rows[0]?.value === "true"

    const u = await getSessionUser().catch(() => null)
    const isStaff = u?.role === "admin" || u?.role === "moderator"

    if (isMaintenanceOn) {
      if (!isStaff && pathname !== "/maintenance") {
        shouldRedirectToMaintenance = true
      }
    } else {
      if (pathname === "/maintenance") {
        shouldRedirectToHome = true
      }
    }
  } catch (e) {
    // Gracefully handle dynamic server usage during static generation or build checks
    return
  }

  if (shouldRedirectToMaintenance) {
    const { redirect } = await import("next/navigation")
    redirect("/maintenance")
  }

  if (shouldRedirectToHome) {
    const { redirect } = await import("next/navigation")
    redirect("/")
  }
}
