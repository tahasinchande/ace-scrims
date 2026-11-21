import "server-only"

import { randomBytes, randomInt, randomUUID } from "crypto"
import { and, desc, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  creatorApplications,
  creatorWalletTransactions,
  referralQualifyingBookings,
  referrals,
  settings,
  user,
  walletTransactions,
} from "@/lib/db/schema"
import { notifyUser } from "@/lib/notify"

export type ReferralRewardMode = "fixed" | "random"

export const REFERRAL_REDEEM_WINDOW_HOURS = 6
export const REFERRAL_REDEEM_WINDOW_MS = REFERRAL_REDEEM_WINDOW_HOURS * 60 * 60 * 1000

export type ReferralProgramSettings = {
  creatorEnabled: boolean
  // Internal actual reward credited to the REFERRED USER after qualifying paid scrim(s)
  creatorRewardMode: ReferralRewardMode
  creatorFixedBdt: number
  creatorMinBdt: number
  creatorMaxBdt: number
  creatorQualifyingScrims: number
  creatorMinEntryFeeBdt: number
  // Publicly declared / estimated bonus shown to users (never reveals actual internal payout)
  creatorDeclaredMode: ReferralRewardMode
  creatorDeclaredFixedBdt: number
  creatorDeclaredMinBdt: number
  creatorDeclaredMaxBdt: number
  // Creator's own separate wallet payout per valid signup using their code
  creatorPerSignupPayoutBdt: number
  creatorMinWithdrawalBdt: number
  // Normal user-to-user referral config
  userEnabled: boolean
  userRewardMode: ReferralRewardMode
  userFixedBdt: number
  userMinBdt: number
  userMaxBdt: number
  userQualifyingScrims: number
  userMinEntryFeeBdt: number
  userMinTotalSpendBdt: number
}

export type PublicReferralSettings = Omit<
  ReferralProgramSettings,
  "creatorRewardMode" | "creatorFixedBdt" | "creatorMinBdt" | "creatorMaxBdt"
>

export const REFERRAL_SETTINGS_KEY = "referral_program_config"
export const REFERRAL_COOKIE_NAME = "ace_ref_code"

export const DEFAULT_REFERRAL_SETTINGS: ReferralProgramSettings = {
  creatorEnabled: true,
  creatorRewardMode: "fixed",
  creatorFixedBdt: 15,
  creatorMinBdt: 10,
  creatorMaxBdt: 25,
  creatorQualifyingScrims: 1,
  creatorMinEntryFeeBdt: 1,
  creatorDeclaredMode: "random",
  creatorDeclaredFixedBdt: 25,
  creatorDeclaredMinBdt: 10,
  creatorDeclaredMaxBdt: 50,
  creatorPerSignupPayoutBdt: 5,
  creatorMinWithdrawalBdt: 100,
  userEnabled: true,
  userRewardMode: "fixed",
  userFixedBdt: 10,
  userMinBdt: 5,
  userMaxBdt: 20,
  userQualifyingScrims: 2,
  userMinEntryFeeBdt: 1,
  userMinTotalSpendBdt: 0,
}

export function toPublicReferralSettings(
  cfg: ReferralProgramSettings
): PublicReferralSettings {
  const {
    creatorRewardMode: _m,
    creatorFixedBdt: _f,
    creatorMinBdt: _min,
    creatorMaxBdt: _max,
    ...publicFields
  } = cfg
  void _m
  void _f
  void _min
  void _max
  return publicFields
}

export function normalizeReferralCode(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string") return ""
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 24)
}

export function sanitizeReferralSettings(
  partial?: Partial<ReferralProgramSettings> | null
): ReferralProgramSettings {
  const merged = { ...DEFAULT_REFERRAL_SETTINGS, ...(partial ?? {}) }
  const clampInt = (n: unknown, min: number, max: number, fallback: number) => {
    const parsed = Number(n)
    if (!Number.isFinite(parsed)) return fallback
    return Math.min(max, Math.max(min, Math.round(parsed)))
  }

  const creatorMinBdt = clampInt(merged.creatorMinBdt, 1, 10000, DEFAULT_REFERRAL_SETTINGS.creatorMinBdt)
  const creatorMaxBdt = Math.max(
    creatorMinBdt,
    clampInt(merged.creatorMaxBdt, 1, 10000, DEFAULT_REFERRAL_SETTINGS.creatorMaxBdt)
  )
  const creatorDeclaredMinBdt = clampInt(
    merged.creatorDeclaredMinBdt,
    1,
    10000,
    DEFAULT_REFERRAL_SETTINGS.creatorDeclaredMinBdt
  )
  const creatorDeclaredMaxBdt = Math.max(
    creatorDeclaredMinBdt,
    clampInt(merged.creatorDeclaredMaxBdt, 1, 10000, DEFAULT_REFERRAL_SETTINGS.creatorDeclaredMaxBdt)
  )
  const userMinBdt = clampInt(merged.userMinBdt, 1, 10000, DEFAULT_REFERRAL_SETTINGS.userMinBdt)
  const userMaxBdt = Math.max(
    userMinBdt,
    clampInt(merged.userMaxBdt, 1, 10000, DEFAULT_REFERRAL_SETTINGS.userMaxBdt)
  )

  return {
    creatorEnabled: Boolean(merged.creatorEnabled),
    creatorRewardMode: merged.creatorRewardMode === "random" ? "random" : "fixed",
    creatorFixedBdt: clampInt(merged.creatorFixedBdt, 1, 10000, DEFAULT_REFERRAL_SETTINGS.creatorFixedBdt),
    creatorMinBdt,
    creatorMaxBdt,
    creatorQualifyingScrims: clampInt(
      merged.creatorQualifyingScrims,
      1,
      50,
      DEFAULT_REFERRAL_SETTINGS.creatorQualifyingScrims
    ),
    creatorMinEntryFeeBdt: clampInt(
      merged.creatorMinEntryFeeBdt,
      1,
      5000,
      DEFAULT_REFERRAL_SETTINGS.creatorMinEntryFeeBdt
    ),
    creatorDeclaredMode: merged.creatorDeclaredMode === "fixed" ? "fixed" : "random",
    creatorDeclaredFixedBdt: clampInt(
      merged.creatorDeclaredFixedBdt,
      1,
      10000,
      DEFAULT_REFERRAL_SETTINGS.creatorDeclaredFixedBdt
    ),
    creatorDeclaredMinBdt,
    creatorDeclaredMaxBdt,
    creatorPerSignupPayoutBdt: clampInt(
      merged.creatorPerSignupPayoutBdt,
      0,
      5000,
      DEFAULT_REFERRAL_SETTINGS.creatorPerSignupPayoutBdt
    ),
    creatorMinWithdrawalBdt: clampInt(
      merged.creatorMinWithdrawalBdt,
      10,
      50000,
      DEFAULT_REFERRAL_SETTINGS.creatorMinWithdrawalBdt
    ),
    userEnabled: Boolean(merged.userEnabled),
    userRewardMode: merged.userRewardMode === "random" ? "random" : "fixed",
    userFixedBdt: clampInt(merged.userFixedBdt, 1, 10000, DEFAULT_REFERRAL_SETTINGS.userFixedBdt),
    userMinBdt,
    userMaxBdt,
    userQualifyingScrims: clampInt(
      merged.userQualifyingScrims,
      1,
      50,
      DEFAULT_REFERRAL_SETTINGS.userQualifyingScrims
    ),
    userMinEntryFeeBdt: clampInt(
      merged.userMinEntryFeeBdt,
      1,
      5000,
      DEFAULT_REFERRAL_SETTINGS.userMinEntryFeeBdt
    ),
    userMinTotalSpendBdt: clampInt(
      merged.userMinTotalSpendBdt,
      0,
      50000,
      DEFAULT_REFERRAL_SETTINGS.userMinTotalSpendBdt
    ),
  }
}

export async function getReferralSettings(): Promise<ReferralProgramSettings> {
  try {
    const rows = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, REFERRAL_SETTINGS_KEY))
      .limit(1)
    if (!rows[0]?.value) return { ...DEFAULT_REFERRAL_SETTINGS }
    const parsed = JSON.parse(rows[0].value) as Partial<ReferralProgramSettings>
    return sanitizeReferralSettings(parsed)
  } catch {
    return { ...DEFAULT_REFERRAL_SETTINGS }
  }
}

export async function saveReferralSettings(
  next: Partial<ReferralProgramSettings>
): Promise<ReferralProgramSettings> {
  const sanitized = sanitizeReferralSettings(next)
  const serialized = JSON.stringify(sanitized)
  await db
    .insert(settings)
    .values({
      key: REFERRAL_SETTINGS_KEY,
      value: serialized,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: settings.key,
      set: {
        value: serialized,
        updatedAt: new Date(),
      },
    })
  return sanitized
}

function makeCodeSuffix(length = 4): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const bytes = randomBytes(length)
  let out = ""
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length]
  }
  return out
}

function makeSlugPrefix(name: string | null | undefined, fallback: string, maxLen = 5): string {
  const clean = (name || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, maxLen)
  return clean.length >= 2 ? clean : fallback
}

async function isCodeTaken(code: string): Promise<boolean> {
  const [uRows, cRows] = await Promise.all([
    db.select({ id: user.id }).from(user).where(eq(user.referralCode, code)).limit(1),
    db
      .select({ id: creatorApplications.id })
      .from(creatorApplications)
      .where(eq(creatorApplications.referralCode, code))
      .limit(1),
  ])
  return uRows.length > 0 || cRows.length > 0
}

/**
 * Ensures an eligible registered user has a unique normal user referral code.
 * Persisted once on `user.referralCode` and reused thereafter.
 */
export async function ensureUserReferralCode(
  userId: string,
  userName?: string | null
): Promise<string | null> {
  try {
    const existing = await db
      .select({
        referralCode: user.referralCode,
        name: user.name,
        banned: user.banned,
        isTrashed: user.isTrashed,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)

    const row = existing[0]
    if (!row || row.banned || row.isTrashed) return null
    if (row.referralCode) return row.referralCode

    const prefix = makeSlugPrefix(userName || row.name, "ACE", 4)
    for (let attempt = 0; attempt < 8; attempt++) {
      const candidate = `ACE${prefix}${makeCodeSuffix(4)}`.slice(0, 14)
      if (await isCodeTaken(candidate)) continue
      try {
        const updated = await db
          .update(user)
          .set({ referralCode: candidate, updatedAt: new Date() })
          .where(and(eq(user.id, userId), sql`${user.referralCode} IS NULL`))
          .returning({ referralCode: user.referralCode })
        if (updated[0]?.referralCode) return updated[0].referralCode

        const reread = await db
          .select({ referralCode: user.referralCode })
          .from(user)
          .where(eq(user.id, userId))
          .limit(1)
        if (reread[0]?.referralCode) return reread[0].referralCode
      } catch {
        // retry on unique collision
      }
    }
    return null
  } catch (err) {
    console.warn("[Referrals] ensureUserReferralCode error:", err)
    return null
  }
}

/**
 * Generates a unique creator referral code ONLY upon admin approval.
 */
export async function generateUniqueCreatorReferralCode(
  creatorName: string,
  preferredCustomCode?: string | null
): Promise<string> {
  const custom = normalizeReferralCode(preferredCustomCode)
  if (custom.length >= 4 && custom.length <= 20) {
    if (!(await isCodeTaken(custom))) {
      return custom
    }
  }

  const prefix = makeSlugPrefix(creatorName, "CREATOR", 6)
  for (let attempt = 0; attempt < 12; attempt++) {
    const candidate = `CR-${prefix}${makeCodeSuffix(3)}`.slice(0, 16)
    if (!(await isCodeTaken(candidate))) {
      return candidate
    }
  }

  return `CR-${makeCodeSuffix(8)}`
}

export type ReferralCodeValidationResult =
  | {
      valid: true
      type: "creator" | "user"
      code: string
      referrerUserId: string
      referrerName: string
      creatorApplicationId: string | null
    }
  | {
      valid: false
      reason: string
    }

/**
 * Validates a referral code against approved Content Creators first, then eligible Users.
 * Enforces program enabled toggles and blocks self-referral.
 */
export async function validateReferralCode(
  rawCode: string | null | undefined,
  excludeUserId?: string | null
): Promise<ReferralCodeValidationResult> {
  const code = normalizeReferralCode(rawCode)
  if (!code || code.length < 4) {
    return { valid: false, reason: "Referral code must be at least 4 characters." }
  }

  const config = await getReferralSettings()

  // 1. Check approved content creators first
  const creatorRows = await db
    .select({
      id: creatorApplications.id,
      userId: creatorApplications.userId,
      creatorName: creatorApplications.creatorName,
      referralCode: creatorApplications.referralCode,
      status: creatorApplications.status,
    })
    .from(creatorApplications)
    .where(
      and(
        eq(creatorApplications.referralCode, code),
        eq(creatorApplications.status, "approved")
      )
    )
    .limit(1)

  if (creatorRows[0]) {
    const creator = creatorRows[0]
    if (!config.creatorEnabled) {
      return { valid: false, reason: "Creator referral program is currently paused." }
    }
    if (excludeUserId && creator.userId === excludeUserId) {
      return { valid: false, reason: "Self-referrals are not allowed." }
    }
    const creatorAccount = await db
      .select({ banned: user.banned, isTrashed: user.isTrashed })
      .from(user)
      .where(eq(user.id, creator.userId))
      .limit(1)
    if (!creatorAccount[0] || creatorAccount[0].banned || creatorAccount[0].isTrashed) {
      return { valid: false, reason: "This creator referral code is inactive." }
    }
    return {
      valid: true,
      type: "creator",
      code,
      referrerUserId: creator.userId,
      referrerName: creator.creatorName,
      creatorApplicationId: creator.id,
    }
  }

  // 2. Check normal registered users
  const userRows = await db
    .select({
      id: user.id,
      name: user.name,
      referralCode: user.referralCode,
      banned: user.banned,
      isTrashed: user.isTrashed,
    })
    .from(user)
    .where(eq(user.referralCode, code))
    .limit(1)

  if (userRows[0]) {
    const refUser = userRows[0]
    if (!config.userEnabled) {
      return { valid: false, reason: "User referral program is currently paused." }
    }
    if (refUser.banned || refUser.isTrashed) {
      return { valid: false, reason: "This referral code is no longer active." }
    }
    if (excludeUserId && refUser.id === excludeUserId) {
      return { valid: false, reason: "Self-referrals are not allowed." }
    }
    return {
      valid: true,
      type: "user",
      code,
      referrerUserId: refUser.id,
      referrerName: refUser.name,
      creatorApplicationId: null,
    }
  }

  return { valid: false, reason: "Referral code not found. Double-check spelling or leave blank." }
}

/**
 * Atomically credits a Content Creator's separate `creatorBalance` wallet for a valid signup
 * attributed to their creator referral code. Idempotent per `referralId`.
 */
export async function creditCreatorSignupPayout(
  referralId: string
): Promise<{ paid: boolean; amountBdt?: number }> {
  try {
    const config = await getReferralSettings()
    const perSignupBdt = Math.max(0, Number(config.creatorPerSignupPayoutBdt || 0))
    if (perSignupBdt <= 0) return { paid: false }

    let paidInfo: { creatorUserId: string; code: string; amount: number } | null = null

    await db.transaction(async (tx) => {
      const refRes = await tx.execute(
        sql`SELECT "id", "referrerUserId", "referredUserId", "referralCode", "referralType", "creatorApplicationId", "creatorSignupPaidAt"
            FROM "referrals"
            WHERE "id" = ${referralId}
            LIMIT 1
            FOR UPDATE`
      )
      const refRow = (refRes.rows?.[0] ?? null) as
        | {
            id: string
            referrerUserId: string
            referredUserId: string
            referralCode: string
            referralType: string
            creatorApplicationId: string | null
            creatorSignupPaidAt: Date | null
          }
        | null

      if (!refRow) return
      if (refRow.referralType !== "creator") return
      if (refRow.creatorSignupPaidAt) return // Already paid once (idempotent)
      if (refRow.referrerUserId === refRow.referredUserId) return

      await tx.execute(sql`SELECT "id" FROM "user" WHERE "id" = ${refRow.referrerUserId} FOR UPDATE`)
      const creatorRows = await tx
        .select({
          id: user.id,
          creatorBalance: user.creatorBalance,
          banned: user.banned,
          isTrashed: user.isTrashed,
        })
        .from(user)
        .where(eq(user.id, refRow.referrerUserId))
        .limit(1)

      const creator = creatorRows[0]
      if (!creator || creator.banned || creator.isTrashed) return

      const balanceBefore = Number(creator.creatorBalance ?? 0)
      const balanceAfter = balanceBefore + perSignupBdt
      const txId = randomUUID()
      const now = new Date()

      await tx
        .update(user)
        .set({
          creatorBalance: balanceAfter,
          updatedAt: now,
        })
        .where(eq(user.id, creator.id))

      await tx.insert(creatorWalletTransactions).values({
        id: txId,
        userId: creator.id,
        creatorApplicationId: refRow.creatorApplicationId,
        type: "signup_payout",
        amountBdt: perSignupBdt,
        balanceBefore,
        balanceAfter,
        description: `Creator Signup Payout (${refRow.referralCode})`,
        referenceId: refRow.id,
        status: "completed",
      })

      await tx
        .update(referrals)
        .set({
          creatorSignupPaidBdt: perSignupBdt,
          creatorSignupPaidAt: now,
          creatorWalletTxId: txId,
          updatedAt: now,
        })
        .where(eq(referrals.id, refRow.id))

      paidInfo = {
        creatorUserId: creator.id,
        code: refRow.referralCode,
        amount: perSignupBdt,
      }
    })

    const paid = paidInfo as { creatorUserId: string; code: string; amount: number } | null
    if (paid) {
      await notifyUser(
        paid.creatorUserId,
        "wallet",
        `Creator Signup Earning: +৳${paid.amount}`,
        `A new player signed up using your creator code (${paid.code}). ৳${paid.amount} has been added to your Creator Wallet.`,
        "/dashboard/referrals"
      )
      return { paid: true, amountBdt: paid.amount }
    }

    return { paid: false }
  } catch (err) {
    console.warn("[Referrals] creditCreatorSignupPayout error:", err)
    return { paid: false }
  }
}

/**
 * Attributes a referral during brand-new user creation.
 * - If a valid code is supplied during sign-up, attributes immediately & locks `referralLockedAt` permanently.
 * - If NO code is supplied during sign-up (e.g., Google/Gmail OAuth), leaves `referralLockedAt` NULL
 *   so the user may redeem a referral code ONCE within the first 6 hours after sign-up.
 */
export async function attributeReferralOnSignup(params: {
  newUserId: string
  rawCode?: string | null
}): Promise<{ attributed: boolean; referralType?: "creator" | "user"; code?: string }> {
  const { newUserId, rawCode } = params
  const normalized = normalizeReferralCode(rawCode)

  // If no code was provided at signup, keep the 6-hour post-signup redemption window open
  if (!normalized) {
    return { attributed: false }
  }

  try {
    const config = await getReferralSettings()
    const validation = await validateReferralCode(normalized, newUserId)
    if (!validation.valid || validation.referrerUserId === newUserId) {
      return { attributed: false }
    }

    let attributed = false
    let referralType: "creator" | "user" | undefined
    let appliedCode: string | undefined
    let createdReferralId: string | null = null

    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT "id" FROM "user" WHERE "id" = ${newUserId} FOR UPDATE`)

      const uRows = await tx
        .select({
          id: user.id,
          referralLockedAt: user.referralLockedAt,
          referredByUserId: user.referredByUserId,
        })
        .from(user)
        .where(eq(user.id, newUserId))
        .limit(1)

      const current = uRows[0]
      if (!current) return
      if (current.referralLockedAt || current.referredByUserId) return

      const existingRef = await tx
        .select({ id: referrals.id })
        .from(referrals)
        .where(eq(referrals.referredUserId, newUserId))
        .limit(1)

      if (existingRef.length > 0) {
        await tx
          .update(user)
          .set({ referralLockedAt: new Date(), updatedAt: new Date() })
          .where(eq(user.id, newUserId))
        return
      }

      const now = new Date()
      const requiredScrimsCount =
        validation.type === "creator"
          ? Math.max(1, config.creatorQualifyingScrims)
          : Math.max(1, config.userQualifyingScrims)
      const requiredSpendBdt =
        validation.type === "creator" ? 0 : Math.max(0, config.userMinTotalSpendBdt)
      const rewardRecipient = validation.type === "creator" ? "referred_user" : "referrer"

      const refId = randomUUID()
      await tx.insert(referrals).values({
        id: refId,
        referrerUserId: validation.referrerUserId,
        referredUserId: newUserId,
        referralCode: validation.code,
        referralType: validation.type,
        creatorApplicationId: validation.creatorApplicationId,
        qualifyingScrimsCount: 0,
        requiredScrimsCount,
        qualifyingSpendBdt: 0,
        requiredSpendBdt,
        rewardRecipient,
        status: "pending",
        rewardAmountBdt: 0,
      })

      await tx
        .update(user)
        .set({
          referredByCode: validation.code,
          referredByUserId: validation.referrerUserId,
          referralType: validation.type,
          referralLockedAt: now,
          updatedAt: now,
        })
        .where(eq(user.id, newUserId))

      attributed = true
      referralType = validation.type
      appliedCode = validation.code
      createdReferralId = refId
    })

    if (attributed && referralType === "creator" && createdReferralId) {
      await creditCreatorSignupPayout(createdReferralId)
    }

    return { attributed, referralType, code: appliedCode }
  } catch (err) {
    console.warn("[Referrals] attributeReferralOnSignup error:", err)
    return { attributed: false }
  }
}

/**
 * Post-signup one-time referral redemption for users who have not yet redeemed a code.
 * Strictly enforces:
 * - Lifetime limit: ONCE EVER per account (never again after redeeming).
 * - Time window: ONLY within the first 6 hours after account creation (`user.createdAt`).
 * - Blocks self-referrals, banned accounts, and race conditions via `SELECT ... FOR UPDATE`.
 */
export async function redeemReferralCodeWithinWindow(params: {
  userId: string
  rawCode: string
}): Promise<
  | {
      ok: true
      code: string
      referralType: "creator" | "user"
      referrerName: string
    }
  | {
      ok: false
      error: string
    }
> {
  const { userId, rawCode } = params
  const normalized = normalizeReferralCode(rawCode)
  if (!normalized || normalized.length < 4) {
    return { ok: false, error: "Please enter a valid referral code (at least 4 characters)." }
  }

  const config = await getReferralSettings()
  const validation = await validateReferralCode(normalized, userId)
  if (!validation.valid) {
    return { ok: false, error: validation.reason }
  }
  if (validation.referrerUserId === userId) {
    return { ok: false, error: "You cannot redeem your own referral code." }
  }

  let createdReferralId: string | null = null
  let txError: string | null = null

  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT "id" FROM "user" WHERE "id" = ${userId} FOR UPDATE`)

    const uRows = await tx
      .select({
        id: user.id,
        createdAt: user.createdAt,
        referredByUserId: user.referredByUserId,
        referredByCode: user.referredByCode,
        referralLockedAt: user.referralLockedAt,
        banned: user.banned,
        isTrashed: user.isTrashed,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)

    const current = uRows[0]
    if (!current || current.banned || current.isTrashed) {
      txError = "Your account is not eligible to redeem a referral code."
      return
    }

    if (current.referredByUserId || current.referredByCode || current.referralLockedAt) {
      txError = "You have already used your one-time referral code redemption."
      return
    }

    const existingRef = await tx
      .select({ id: referrals.id })
      .from(referrals)
      .where(eq(referrals.referredUserId, userId))
      .limit(1)

    if (existingRef.length > 0) {
      await tx
        .update(user)
        .set({ referralLockedAt: new Date(), updatedAt: new Date() })
        .where(eq(user.id, userId))
      txError = "You have already redeemed a referral code on this account."
      return
    }

    const createdMs = new Date(current.createdAt).getTime()
    const elapsedMs = Date.now() - createdMs
    if (!Number.isFinite(createdMs) || elapsedMs > REFERRAL_REDEEM_WINDOW_MS) {
      txError = `Referral code redemption is only available within the first ${REFERRAL_REDEEM_WINDOW_HOURS} hours after sign-up.`
      return
    }

    const now = new Date()
    const requiredScrimsCount =
      validation.type === "creator"
        ? Math.max(1, config.creatorQualifyingScrims)
        : Math.max(1, config.userQualifyingScrims)
    const requiredSpendBdt =
      validation.type === "creator" ? 0 : Math.max(0, config.userMinTotalSpendBdt)
    const rewardRecipient = validation.type === "creator" ? "referred_user" : "referrer"

    const refId = randomUUID()
    await tx.insert(referrals).values({
      id: refId,
      referrerUserId: validation.referrerUserId,
      referredUserId: userId,
      referralCode: validation.code,
      referralType: validation.type,
      creatorApplicationId: validation.creatorApplicationId,
      qualifyingScrimsCount: 0,
      requiredScrimsCount,
      qualifyingSpendBdt: 0,
      requiredSpendBdt,
      rewardRecipient,
      status: "pending",
      rewardAmountBdt: 0,
    })

    await tx
      .update(user)
      .set({
        referredByCode: validation.code,
        referredByUserId: validation.referrerUserId,
        referralType: validation.type,
        referralLockedAt: now,
        updatedAt: now,
      })
      .where(eq(user.id, userId))

    createdReferralId = refId
  })

  if (txError) {
    return { ok: false, error: txError }
  }

  if (validation.type === "creator" && createdReferralId) {
    await creditCreatorSignupPayout(createdReferralId)
  }

  return {
    ok: true,
    code: validation.code,
    referralType: validation.type,
    referrerName: validation.referrerName,
  }
}

function computeRewardAmount(
  mode: ReferralRewardMode,
  fixedBdt: number,
  minBdt: number,
  maxBdt: number
): number {
  if (mode === "random") {
    const low = Math.max(1, Math.min(minBdt, maxBdt))
    const high = Math.max(low, maxBdt)
    if (low === high) return low
    return randomInt(low, high + 1)
  }
  return Math.max(1, fixedBdt)
}

/**
 * Evaluates and atomically credits a referral reward when a referred player completes a
 * confirmed PAID scrim booking (`amountBdt > 0`).
 *
 * - For CONTENT CREATOR codes (`referralType === "creator"`):
 *   The REFERRED USER receives the referral bonus directly in their player wallet once
 *   qualifying paid scrims are completed. (The creator earns per-signup payouts into their
 *   separate Creator Wallet upon signup/redemption.)
 * - For NORMAL USER codes (`referralType === "user"`):
 *   The REFERRER receives the referral reward once the referred player meets BOTH the
 *   required paid scrims count AND minimum total spend (if configured).
 * - Idempotent per `bookingId` via unique constraint on `referral_qualifying_bookings`.
 * - Locked via `SELECT ... FOR UPDATE` to eliminate duplicate payouts.
 */
export async function evaluateReferralRewardForPaidBooking(params: {
  userId: string
  bookingId: string
  scrimId: string
  amountBdt: number
}): Promise<{ credited: boolean; rewardAmountBdt?: number; recipientUserId?: string }> {
  const { userId, bookingId, scrimId, amountBdt } = params

  // Free/giveaway scrims (0 BDT) NEVER qualify for referral rewards
  if (!Number.isFinite(amountBdt) || amountBdt <= 0) {
    return { credited: false }
  }

  try {
    const config = await getReferralSettings()

    let payoutResult: {
      recipientUserId: string
      amount: number
      type: "creator" | "user"
      code: string
    } | null = null

    await db.transaction(async (tx) => {
      const refRows = await tx.execute(
        sql`SELECT "id", "referrerUserId", "referredUserId", "referralCode", "referralType", "qualifyingScrimsCount", "requiredScrimsCount", "qualifyingSpendBdt", "requiredSpendBdt", "status"
            FROM "referrals"
            WHERE "referredUserId" = ${userId}
            LIMIT 1
            FOR UPDATE`
      )

      const refRow = (refRows.rows?.[0] ?? null) as
        | {
            id: string
            referrerUserId: string
            referredUserId: string
            referralCode: string
            referralType: string
            qualifyingScrimsCount: number
            requiredScrimsCount: number
            qualifyingSpendBdt: number
            requiredSpendBdt: number
            status: string
          }
        | null

      if (!refRow) return
      if (refRow.status === "rewarded") return
      if (refRow.referrerUserId === userId) return // Double guard against self-referral

      const isCreator = refRow.referralType === "creator"
      if (isCreator && !config.creatorEnabled) return
      if (!isCreator && !config.userEnabled) return

      const minFee = isCreator ? config.creatorMinEntryFeeBdt : config.userMinEntryFeeBdt
      if (amountBdt < minFee) return

      // Creator code reward goes to the REFERRED USER; normal user code reward goes to the REFERRER
      const recipientUserId = isCreator ? refRow.referredUserId : refRow.referrerUserId

      // Ensure recipient account is active
      const recipientAccount = await tx
        .select({ id: user.id, balance: user.balance, banned: user.banned, isTrashed: user.isTrashed })
        .from(user)
        .where(eq(user.id, recipientUserId))
        .limit(1)
      if (!recipientAccount[0] || recipientAccount[0].banned || recipientAccount[0].isTrashed) {
        return
      }

      // Idempotency guard: each paid booking can only be counted once
      const insertedQual = await tx
        .insert(referralQualifyingBookings)
        .values({
          id: randomUUID(),
          referralId: refRow.id,
          bookingId,
          scrimId,
          amountBdt,
        })
        .onConflictDoNothing({ target: referralQualifyingBookings.bookingId })
        .returning({ id: referralQualifyingBookings.id })

      if (insertedQual.length === 0) {
        return
      }

      const nextCount = Number(refRow.qualifyingScrimsCount || 0) + 1
      const nextSpend = Number(refRow.qualifyingSpendBdt || 0) + Math.round(amountBdt)
      const requiredCount = isCreator
        ? Math.max(1, Number(refRow.requiredScrimsCount || config.creatorQualifyingScrims || 1))
        : Math.max(1, Number(refRow.requiredScrimsCount || config.userQualifyingScrims || 1))
      const requiredSpend = isCreator
        ? 0
        : Math.max(0, Number(refRow.requiredSpendBdt || config.userMinTotalSpendBdt || 0))

      if (nextCount < requiredCount || nextSpend < requiredSpend) {
        await tx
          .update(referrals)
          .set({
            qualifyingScrimsCount: nextCount,
            qualifyingSpendBdt: nextSpend,
            updatedAt: new Date(),
          })
          .where(eq(referrals.id, refRow.id))
        return
      }

      // Threshold reached -> compute reward & atomically credit recipient's player wallet
      const modeUsed = isCreator ? config.creatorRewardMode : config.userRewardMode
      const rewardBdt = isCreator
        ? computeRewardAmount(
            config.creatorRewardMode,
            config.creatorFixedBdt,
            config.creatorMinBdt,
            config.creatorMaxBdt
          )
        : computeRewardAmount(
            config.userRewardMode,
            config.userFixedBdt,
            config.userMinBdt,
            config.userMaxBdt
          )

      await tx.execute(sql`SELECT "id" FROM "user" WHERE "id" = ${recipientUserId} FOR UPDATE`)
      const freshBalRows = await tx
        .select({ balance: user.balance })
        .from(user)
        .where(eq(user.id, recipientUserId))
        .limit(1)
      const balanceBefore = Number(freshBalRows[0]?.balance ?? 0)
      const balanceAfter = balanceBefore + rewardBdt
      const walletTxId = randomUUID()

      await tx
        .update(user)
        .set({
          balance: balanceAfter,
          updatedAt: new Date(),
        })
        .where(eq(user.id, recipientUserId))

      await tx.insert(walletTransactions).values({
        id: walletTxId,
        userId: recipientUserId,
        type: isCreator ? "creator_referral_bonus" : "referral_reward",
        amountBdt: rewardBdt,
        balanceBefore,
        balanceAfter,
        description: isCreator
          ? `Creator Code Welcome Bonus (${refRow.referralCode}) — Qualifying paid scrim completed`
          : `User Referral Reward (Code ${refRow.referralCode}) — ${requiredCount} qualifying paid scrim${requiredCount > 1 ? "s" : ""} completed`,
        referenceId: refRow.id,
        status: "completed",
      })

      await tx
        .update(referrals)
        .set({
          qualifyingScrimsCount: nextCount,
          qualifyingSpendBdt: nextSpend,
          rewardRecipient: isCreator ? "referred_user" : "referrer",
          status: "rewarded",
          rewardAmountBdt: rewardBdt,
          rewardModeUsed: modeUsed,
          rewardedAt: new Date(),
          walletTxId,
          updatedAt: new Date(),
        })
        .where(eq(referrals.id, refRow.id))

      payoutResult = {
        recipientUserId,
        amount: rewardBdt,
        type: isCreator ? "creator" : "user",
        code: refRow.referralCode,
      }
    })

    const credited = payoutResult as {
      recipientUserId: string
      amount: number
      type: "creator" | "user"
      code: string
    } | null

    if (credited && credited.amount > 0) {
      if (credited.type === "creator") {
        await notifyUser(
          credited.recipientUserId,
          "wallet",
          `Creator Referral Bonus Unlocked: +৳${credited.amount}`,
          `You unlocked a ৳${credited.amount} welcome bonus for joining with creator code ${credited.code} and completing your qualifying paid scrim! Credited to your wallet.`,
          "/dashboard/wallet"
        )
      } else {
        await notifyUser(
          credited.recipientUserId,
          "wallet",
          `Referral Reward Earned: +৳${credited.amount}`,
          `A player registered with your code (${credited.code}) completed their qualifying paid scrims. ৳${credited.amount} has been credited to your wallet balance.`,
          "/dashboard/referrals"
        )
      }

      return {
        credited: true,
        rewardAmountBdt: credited.amount,
        recipientUserId: credited.recipientUserId,
      }
    }

    return { credited: false }
  } catch (err) {
    console.warn("[Referrals] evaluateReferralRewardForPaidBooking error:", err)
    return { credited: false }
  }
}

export async function getUserCreatorApplication(userId: string) {
  const rows = await db
    .select()
    .from(creatorApplications)
    .where(eq(creatorApplications.userId, userId))
    .orderBy(desc(creatorApplications.createdAt))
    .limit(1)
  return rows[0] ?? null
}
