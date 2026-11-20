import "server-only"

import { randomBytes, randomInt, randomUUID } from "crypto"
import { and, desc, eq, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  creatorApplications,
  referralQualifyingBookings,
  referrals,
  settings,
  user,
  walletTransactions,
} from "@/lib/db/schema"
import { notifyUser } from "@/lib/notify"

export type ReferralRewardMode = "fixed" | "random"

export type ReferralProgramSettings = {
  creatorEnabled: boolean
  creatorRewardMode: ReferralRewardMode
  creatorFixedBdt: number
  creatorMinBdt: number
  creatorMaxBdt: number
  creatorMinEntryFeeBdt: number
  userEnabled: boolean
  userRewardMode: ReferralRewardMode
  userFixedBdt: number
  userMinBdt: number
  userMaxBdt: number
  userQualifyingScrims: number
  userMinEntryFeeBdt: number
}

export const REFERRAL_SETTINGS_KEY = "referral_program_config"
export const REFERRAL_COOKIE_NAME = "ace_ref_code"

export const DEFAULT_REFERRAL_SETTINGS: ReferralProgramSettings = {
  creatorEnabled: true,
  creatorRewardMode: "fixed",
  creatorFixedBdt: 15,
  creatorMinBdt: 10,
  creatorMaxBdt: 25,
  creatorMinEntryFeeBdt: 1,
  userEnabled: true,
  userRewardMode: "fixed",
  userFixedBdt: 10,
  userMinBdt: 5,
  userMaxBdt: 20,
  userQualifyingScrims: 2,
  userMinEntryFeeBdt: 1,
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
    creatorMinEntryFeeBdt: clampInt(
      merged.creatorMinEntryFeeBdt,
      1,
      5000,
      DEFAULT_REFERRAL_SETTINGS.creatorMinEntryFeeBdt
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

        // Race: another request already assigned it
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
 * Attributes a referral ONLY during brand-new user creation.
 * Always permanently locks `referralLockedAt` after registration completes so a referral
 * code can NEVER be added or edited retroactively.
 */
export async function attributeReferralOnSignup(params: {
  newUserId: string
  rawCode?: string | null
}): Promise<{ attributed: boolean; referralType?: "creator" | "user"; code?: string }> {
  const { newUserId, rawCode } = params
  const normalized = normalizeReferralCode(rawCode)

  try {
    const config = await getReferralSettings()
    const validation = normalized
      ? await validateReferralCode(normalized, newUserId)
      : { valid: false as const, reason: "No code provided" }

    let attributed = false
    let referralType: "creator" | "user" | undefined
    let appliedCode: string | undefined

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

      // Strict anti-abuse: never allow attributing after lock or if already attributed
      if (current.referralLockedAt || current.referredByUserId) {
        return
      }

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

      if (validation.valid && validation.referrerUserId !== newUserId) {
        const requiredScrimsCount =
          validation.type === "creator" ? 1 : Math.max(1, config.userQualifyingScrims)

        await tx.insert(referrals).values({
          id: randomUUID(),
          referrerUserId: validation.referrerUserId,
          referredUserId: newUserId,
          referralCode: validation.code,
          referralType: validation.type,
          creatorApplicationId: validation.creatorApplicationId,
          qualifyingScrimsCount: 0,
          requiredScrimsCount,
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
      } else {
        // Lock referral eligibility immediately upon signup even when no code was used
        await tx
          .update(user)
          .set({
            referralLockedAt: now,
            updatedAt: now,
          })
          .where(eq(user.id, newUserId))
      }
    })

    return { attributed, referralType, code: appliedCode }
  } catch (err) {
    console.warn("[Referrals] attributeReferralOnSignup error:", err)
    return { attributed: false }
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
 * - Idempotent per `bookingId` via unique constraint on `referral_qualifying_bookings`.
 * - Locked via `SELECT ... FOR UPDATE` on the `referrals` row to eliminate duplicate payouts.
 */
export async function evaluateReferralRewardForPaidBooking(params: {
  userId: string
  bookingId: string
  scrimId: string
  amountBdt: number
}): Promise<{ credited: boolean; rewardAmountBdt?: number; referrerUserId?: string }> {
  const { userId, bookingId, scrimId, amountBdt } = params

  // Free/giveaway scrims (0 BDT) NEVER qualify for referral rewards
  if (!Number.isFinite(amountBdt) || amountBdt <= 0) {
    return { credited: false }
  }

  try {
    const config = await getReferralSettings()

    let payoutResult: {
      referrerId: string
      amount: number
      type: "creator" | "user"
      code: string
    } | null = null

    await db.transaction(async (tx) => {
      const refRows = await tx.execute(
        sql`SELECT "id", "referrerUserId", "referredUserId", "referralCode", "referralType", "qualifyingScrimsCount", "requiredScrimsCount", "status"
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

      // Ensure referrer account is active
      const referrerAccount = await tx
        .select({ id: user.id, balance: user.balance, banned: user.banned, isTrashed: user.isTrashed })
        .from(user)
        .where(eq(user.id, refRow.referrerUserId))
        .limit(1)
      if (!referrerAccount[0] || referrerAccount[0].banned || referrerAccount[0].isTrashed) {
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
      const requiredCount = isCreator
        ? 1
        : Math.max(1, Number(refRow.requiredScrimsCount || config.userQualifyingScrims || 1))

      if (nextCount < requiredCount) {
        await tx
          .update(referrals)
          .set({
            qualifyingScrimsCount: nextCount,
            updatedAt: new Date(),
          })
          .where(eq(referrals.id, refRow.id))
        return
      }

      // Threshold reached -> compute reward & atomically credit referrer wallet
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

      await tx.execute(sql`SELECT "id" FROM "user" WHERE "id" = ${refRow.referrerUserId} FOR UPDATE`)
      const freshBalRows = await tx
        .select({ balance: user.balance })
        .from(user)
        .where(eq(user.id, refRow.referrerUserId))
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
        .where(eq(user.id, refRow.referrerUserId))

      await tx.insert(walletTransactions).values({
        id: walletTxId,
        userId: refRow.referrerUserId,
        type: "referral_reward",
        amountBdt: rewardBdt,
        balanceBefore,
        balanceAfter,
        description: isCreator
          ? `Creator Referral Reward (Code ${refRow.referralCode}) — Paid scrim completed`
          : `User Referral Reward (Code ${refRow.referralCode}) — ${requiredCount} qualifying paid scrim${requiredCount > 1 ? "s" : ""} completed`,
        referenceId: refRow.id,
        status: "completed",
      })

      await tx
        .update(referrals)
        .set({
          qualifyingScrimsCount: nextCount,
          status: "rewarded",
          rewardAmountBdt: rewardBdt,
          rewardModeUsed: modeUsed,
          rewardedAt: new Date(),
          walletTxId,
          updatedAt: new Date(),
        })
        .where(eq(referrals.id, refRow.id))

      payoutResult = {
        referrerId: refRow.referrerUserId,
        amount: rewardBdt,
        type: isCreator ? "creator" : "user",
        code: refRow.referralCode,
      }
    })

    const credited = payoutResult as {
      referrerId: string
      amount: number
      type: "creator" | "user"
      code: string
    } | null

    if (credited && credited.amount > 0) {
      await notifyUser(
        credited.referrerId,
        "wallet",
        credited.type === "creator"
          ? `Creator Referral Reward: +৳${credited.amount}`
          : `Referral Reward Earned: +৳${credited.amount}`,
        `A player registered with your code (${credited.code}) completed their qualifying paid scrim. ৳${credited.amount} has been credited to your wallet balance.`,
        "/dashboard/referrals"
      )

      return {
        credited: true,
        rewardAmountBdt: credited.amount,
        referrerUserId: credited.referrerId,
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
