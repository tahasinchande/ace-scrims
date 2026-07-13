import "server-only"

import { headers } from "next/headers"
import { auth, type SessionUser } from "@/lib/auth"

/** Returns the current session user, or null when unauthenticated. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  return session.user as unknown as SessionUser
}

/** Throws when unauthenticated or banned. */
export async function requireUser(): Promise<SessionUser> {
  const u = await getSessionUser()
  if (!u) throw new Error("Unauthorized")
  if (u.banned) throw new Error("Account suspended")
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
