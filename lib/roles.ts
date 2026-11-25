export const USER_ROLES = ["user", "moderator", "admin", "owner"] as const

export type UserRole = (typeof USER_ROLES)[number]

export const RUSHX_SUPPORT_NAME = "RushX Support"
export const RUSHX_SUPPORT_AVATAR = "/images/brand/rushx-symbol.png"

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
