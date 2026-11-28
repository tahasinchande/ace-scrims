export const USER_ROLES = ["user", "moderator", "admin", "owner"] as const

export type UserRole = (typeof USER_ROLES)[number]

/** Primary Owner account — strictly protected and always holds the Owner role. */
export const PRIMARY_OWNER_EMAIL = "tahasinchande@gmail.com"

export const RUSHX_SUPPORT_NAME = "RushX Support"
export const RUSHX_SUPPORT_AVATAR = "/images/brand/rushx-symbol.png"

export function normalizeEmail(email: string | null | undefined): string {
  return (email || "").trim().toLowerCase()
}

export function isPrimaryOwnerEmail(email: string | null | undefined): boolean {
  return normalizeEmail(email) === PRIMARY_OWNER_EMAIL
}

export function isValidUserRole(role: unknown): role is UserRole {
  return typeof role === "string" && (USER_ROLES as readonly string[]).includes(role)
}

export function isOwnerRole(role: string | null | undefined): boolean {
  return role === "owner"
}

export function isAdminOrOwner(role: string | null | undefined): boolean {
  return role === "admin" || role === "owner"
}

export function isStaffRole(role: string | null | undefined): boolean {
  return role === "owner" || role === "admin" || role === "moderator"
}

export function isNonOwnerStaffRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "moderator"
}

/**
 * Strict Owner hierarchy check:
 * - Only an Owner can assign the "owner" role.
 * - Only an Owner can modify, demote, ban, verify-toggle, or delete an Owner account.
 * - Primary Owner (tahasinchande@gmail.com) cannot be demoted, banned, unverified, or deleted.
 */
export function canModifyTargetRole(params: {
  actorRole: string | null | undefined
  targetRole: string | null | undefined
  targetEmail?: string | null
  nextRole: UserRole
}): { allowed: boolean; reason?: string } {
  const actorIsOwner = isOwnerRole(params.actorRole)
  const targetIsPrimaryOwner = isPrimaryOwnerEmail(params.targetEmail)
  const targetIsOwner = isOwnerRole(params.targetRole) || targetIsPrimaryOwner

  if (targetIsPrimaryOwner && params.nextRole !== "owner") {
    return {
      allowed: false,
      reason: "The primary Owner account cannot be demoted from the Owner role.",
    }
  }

  if (!actorIsOwner && (params.nextRole === "owner" || targetIsOwner)) {
    return {
      allowed: false,
      reason: "Only an Owner can assign or modify the Owner role.",
    }
  }

  return { allowed: true }
}

export function canModifyTargetAccount(params: {
  actorRole: string | null | undefined
  targetRole: string | null | undefined
  targetEmail?: string | null
}): { allowed: boolean; reason?: string } {
  const actorIsOwner = isOwnerRole(params.actorRole)
  const targetIsPrimaryOwner = isPrimaryOwnerEmail(params.targetEmail)
  const targetIsOwner = isOwnerRole(params.targetRole) || targetIsPrimaryOwner

  if (targetIsPrimaryOwner) {
    return {
      allowed: false,
      reason: "The primary Owner account is permanently protected.",
    }
  }

  if (targetIsOwner && !actorIsOwner) {
    return {
      allowed: false,
      reason: "Only an Owner can modify an Owner account.",
    }
  }

  return { allowed: true }
}

export function getRoleLabel(role: string | null | undefined): string {
  switch (role) {
    case "owner":
      return "Owner"
    case "admin":
      return "Admin"
    case "moderator":
      return "Moderator"
    default:
      return "User"
  }
}

/**
 * Resolves how a Live Support message sender should be presented:
 * - Owner role: displays ONLY the replier's exact name (no "(Staff)" badge, no masking).
 * - Other staff roles (admin/moderator): displays "RushX Support" with the RushX 'R' logo.
 */
export function resolveLiveSupportSender({
  senderName,
  senderRole,
  senderImage,
}: {
  senderName: string
  senderRole: string
  senderImage?: string | null
}): {
  displayName: string
  avatarUrl: string | null
  useBrandLogo: boolean
  isOwner: boolean
  isNonOwnerStaff: boolean
} {
  if (isOwnerRole(senderRole)) {
    return {
      displayName: senderName?.trim() || "Owner",
      avatarUrl: senderImage || null,
      useBrandLogo: false,
      isOwner: true,
      isNonOwnerStaff: false,
    }
  }

  if (isNonOwnerStaffRole(senderRole)) {
    return {
      displayName: RUSHX_SUPPORT_NAME,
      avatarUrl: RUSHX_SUPPORT_AVATAR,
      useBrandLogo: true,
      isOwner: false,
      isNonOwnerStaff: true,
    }
  }

  return {
    displayName: senderName || "Player",
    avatarUrl: senderImage || null,
    useBrandLogo: false,
    isOwner: false,
    isNonOwnerStaff: false,
  }
}
