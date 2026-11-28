"use server"

import { randomUUID } from "crypto"
import { revalidatePath } from "next/cache"
import { and, desc, eq, inArray, sql } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/lib/db"
import {
  account,
  creatorApplications,
  creatorWalletTransactions,
  creatorWithdrawals,
  referrals,
  user,
} from "@/lib/db/schema"
import { requireAdmin, requireUser, logActivity } from "@/lib/session"
import { notifyUser } from "@/lib/notify"
import { isSafeHttpOrRelativeUrl } from "@/lib/url-safety"
import { getActivePayoutMethods } from "@/lib/queries/payout-methods"
import {
  REFERRAL_REDEEM_WINDOW_MS,
  ensureUserReferralCode,
  generateUniqueCreatorReferralCode,
  getReferralSettings,
  getUserCreatorApplication,
  isReferralCodeTaken,
  normalizeReferralCode,
  redeemReferralCodeWithinWindow,
  saveReferralSettings,
  toPublicReferralSettings,
  type ReferralProgramSettings,
} from "@/lib/referrals"

const creatorApplicationSchema = z.object({
  creatorName: z.string().trim().min(2, "Creator/channel name is required").max(80),
  platform: z.enum(["YouTube", "Facebook", "TikTok", "Instagram", "Twitch", "Other"]),
  channelUrl: z
    .string()
    .trim()
    .min(6, "Please provide a valid channel or profile URL")
    .max(300)
    .refine((v) => isSafeHttpOrRelativeUrl(v) && /^https?:\/\//i.test(v), {
      message: "Channel URL must start with https:// or http://",
    }),
  secondaryLinks: z
    .array(
      z
        .string()
        .trim()
        .max(300)
        .refine((v) => !v || (isSafeHttpOrRelativeUrl(v) && /^https?:\/\//i.test(v)), {
          message: "Secondary links must be valid http(s) URLs",
        })
    )
    .max(5)
    .optional(),
  followerCount: z.string().trim().min(1, "Follower/subscriber count is required").max(60),
  averageViews: z.string().trim().max(60).optional().or(z.literal("")),
  whatsapp: z.string().trim().min(6, "WhatsApp number is required").max(40),
  requestedReferralCode: z.string().trim().max(24).optional().or(z.literal("")),
  notes: z.string().trim().max(1200).optional().or(z.literal("")),
})

export async function submitCreatorApplicationAction(input: {
  creatorName: string
  platform: string
  channelUrl: string
  secondaryLinks?: string[]
  followerCount: string
  averageViews?: string
  whatsapp: string
  requestedReferralCode?: string
  notes?: string
}) {
  const sessionUser = await requireUser()
  const cleanedLinks = (input.secondaryLinks ?? [])
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 5)

  const parsed = creatorApplicationSchema.safeParse({
    ...input,
    secondaryLinks: cleanedLinks,
  })
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid application data." }
  }

  const rawRequested = (parsed.data.requestedReferralCode || "").trim()
  const normalizedRequested = rawRequested ? normalizeReferralCode(rawRequested) : ""
  if (rawRequested) {
    if (normalizedRequested.length < 3 || normalizedRequested.length > 24) {
      return {
        ok: false as const,
        error: "Custom referral code must be 3–24 characters using only letters, numbers, hyphens (-), or underscores (_).",
      }
    }
    if (await isReferralCodeTaken(normalizedRequested)) {
      return {
        ok: false as const,
        error: `The custom referral code "${normalizedRequested}" is already taken. Please request a different exact code.`,
      }
    }
  }

  const existing = await getUserCreatorApplication(sessionUser.id)
  if (existing && existing.status === "approved") {
    return {
      ok: false as const,
      error: "You are already an approved RushX Organization Content Creator.",
    }
  }
  if (existing && existing.status === "pending") {
    return {
      ok: false as const,
      error: "Your creator application is already under review. We will notify you once reviewed.",
    }
  }

  const id = randomUUID()
  await db.insert(creatorApplications).values({
    id,
    userId: sessionUser.id,
    creatorName: parsed.data.creatorName,
    platform: parsed.data.platform,
    channelUrl: parsed.data.channelUrl,
    secondaryLinks: cleanedLinks,
    followerCount: parsed.data.followerCount,
    averageViews: parsed.data.averageViews || null,
    whatsapp: parsed.data.whatsapp,
    requestedReferralCode: normalizedRequested || null,
    notes: parsed.data.notes || null,
    status: "pending",
    referralCode: null,
  })

  await logActivity(sessionUser.id, sessionUser.role, "creator_application.submit", id, {
    creatorName: parsed.data.creatorName,
    platform: parsed.data.platform,
    requestedReferralCode: normalizedRequested || null,
  })

  revalidatePath("/creators")
  revalidatePath("/partnerships")
  revalidatePath("/dashboard/referrals")
  revalidatePath("/admin/referrals")

  return { ok: true as const, id }
}

/**
 * One-time post-signup referral code redemption within the first 6 hours after sign-up.
 */
export async function redeemReferralCodeAction(rawCode: string) {
  const sessionUser = await requireUser()
  const result = await redeemReferralCodeWithinWindow({
    userId: sessionUser.id,
    rawCode,
  })

  if (!result.ok) {
    return result
  }

  await logActivity(sessionUser.id, sessionUser.role, "referral.redeem_post_signup", result.code, {
    referralType: result.referralType,
  })

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/referrals")
  revalidatePath("/admin/referrals")

  return result
}

const creatorWithdrawalSchema = z.object({
  amountBdt: z.coerce.number().int().min(10, "Enter a valid withdrawal amount."),
  whatsapp: z
    .string()
    .trim()
    .min(6, "Valid WhatsApp number is required.")
    .max(40),
  payoutMethod: z.string().trim().min(1, "Select a payout method.").max(80),
  payoutAccount: z.string().trim().max(120).optional().or(z.literal("")),
})

/**
 * Submits a withdrawal request from an approved Content Creator's separate Creator Wallet.
 * Atomically locks & deducts `creatorBalance` so double-submit race conditions cannot overdraw.
 */
export async function requestCreatorWithdrawalAction(input: {
  amountBdt: number
  whatsapp: string
  payoutMethod: string
  payoutAccount?: string
}) {
  const sessionUser = await requireUser()
  const parsed = creatorWithdrawalSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid withdrawal request." }
  }

  const [creatorApp, config, activeMethods] = await Promise.all([
    getUserCreatorApplication(sessionUser.id),
    getReferralSettings(),
    getActivePayoutMethods(),
  ])

  if (!creatorApp || creatorApp.status !== "approved") {
    return { ok: false as const, error: "Only approved Content Creators can withdraw Creator Wallet funds." }
  }

  const minWithdraw = Math.max(10, Number(config.creatorMinWithdrawalBdt || 100))
  if (parsed.data.amountBdt < minWithdraw) {
    return {
      ok: false as const,
      error: `Minimum creator withdrawal amount is ৳${minWithdraw}.`,
    }
  }

  const selectedMethod = activeMethods.find(
    (m) =>
      m.code.toLowerCase() === parsed.data.payoutMethod.toLowerCase() ||
      m.name.toLowerCase() === parsed.data.payoutMethod.toLowerCase() ||
      m.label.toLowerCase() === parsed.data.payoutMethod.toLowerCase()
  )
  if (!selectedMethod) {
    return {
      ok: false as const,
      error: "Selected payout method is unavailable. Please choose an active payout method.",
    }
  }

  const cleanAccount = (parsed.data.payoutAccount || "").trim()
  if (selectedMethod.requiresAccountNumber && cleanAccount.length < 4) {
    return {
      ok: false as const,
      error: `Please provide your ${selectedMethod.label} account/number.`,
    }
  }

  let createdId: string | null = null
  let txError: string | null = null

  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT "id" FROM "user" WHERE "id" = ${sessionUser.id} FOR UPDATE`)

    const uRows = await tx
      .select({
        id: user.id,
        creatorBalance: user.creatorBalance,
        banned: user.banned,
        isTrashed: user.isTrashed,
      })
      .from(user)
      .where(eq(user.id, sessionUser.id))
      .limit(1)

    const current = uRows[0]
    if (!current || current.banned || current.isTrashed) {
      txError = "Account is not eligible for withdrawal."
      return
    }

    const available = Number(current.creatorBalance ?? 0)
    if (available < parsed.data.amountBdt) {
      txError = `Insufficient Creator Wallet balance. Available: ৳${available}.`
      return
    }

    const balanceAfter = available - parsed.data.amountBdt
    const withdrawalId = randomUUID()
    const walletTxId = randomUUID()
    const now = new Date()

    await tx
      .update(user)
      .set({
        creatorBalance: balanceAfter,
        updatedAt: now,
      })
      .where(eq(user.id, sessionUser.id))

    await tx.insert(creatorWalletTransactions).values({
      id: walletTxId,
      userId: sessionUser.id,
      creatorApplicationId: creatorApp.id,
      type: "withdrawal",
      amountBdt: -parsed.data.amountBdt,
      balanceBefore: available,
      balanceAfter,
      description: `Withdrawal request via ${selectedMethod.label}${cleanAccount ? ` (${cleanAccount})` : ""}`,
      referenceId: withdrawalId,
      status: "pending",
    })

    await tx.insert(creatorWithdrawals).values({
      id: withdrawalId,
      userId: sessionUser.id,
      creatorApplicationId: creatorApp.id,
      amountBdt: parsed.data.amountBdt,
      whatsapp: parsed.data.whatsapp,
      payoutMethod: selectedMethod.label,
      payoutAccount: cleanAccount || null,
      status: "pending",
      walletTxId,
      createdAt: now,
      updatedAt: now,
    })

    createdId = withdrawalId
  })

  if (txError) {
    return { ok: false as const, error: txError }
  }

  await logActivity(sessionUser.id, sessionUser.role, "creator_withdrawal.request", createdId || "", {
    amountBdt: parsed.data.amountBdt,
    payoutMethod: selectedMethod.label,
  })

  revalidatePath("/dashboard/referrals")
  revalidatePath("/admin/referrals")

  return { ok: true as const, id: createdId }
}

const reviewWithdrawalSchema = z.object({
  withdrawalId: z.string().min(1),
  decision: z.enum(["paid", "rejected"]),
  adminNote: z.string().trim().max(500).optional().or(z.literal("")),
})

/**
 * Admin review for Creator Withdrawal Requests.
 * - `paid`: marks withdrawal completed and notifies creator.
 * - `rejected`: marks withdrawal rejected AND atomically refunds `creatorBalance`.
 */
export async function reviewCreatorWithdrawalAction(input: {
  withdrawalId: string
  decision: "paid" | "rejected"
  adminNote?: string
}) {
  const admin = await requireAdmin()
  const parsed = reviewWithdrawalSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid withdrawal review." }
  }

  let txError: string | null = null
  let notifyPayload: {
    userId: string
    amountBdt: number
    method: string
    decision: "paid" | "rejected"
    adminNote: string | null
  } | null = null

  await db.transaction(async (tx) => {
    const wRes = await tx.execute(
      sql`SELECT "id", "userId", "creatorApplicationId", "amountBdt", "payoutMethod", "status", "walletTxId"
          FROM "creator_withdrawals"
          WHERE "id" = ${parsed.data.withdrawalId}
          LIMIT 1
          FOR UPDATE`
    )
    const row = (wRes.rows?.[0] ?? null) as
      | {
          id: string
          userId: string
          creatorApplicationId: string | null
          amountBdt: number
          payoutMethod: string
          status: string
          walletTxId: string | null
        }
      | null

    if (!row) {
      txError = "Withdrawal request not found."
      return
    }
    if (row.status !== "pending") {
      txError = `This withdrawal request is already marked as ${row.status}.`
      return
    }

    const now = new Date()
    const cleanNote = parsed.data.adminNote?.trim() || null

    if (parsed.data.decision === "paid") {
      await tx
        .update(creatorWithdrawals)
        .set({
          status: "paid",
          adminNote: cleanNote,
          processedBy: admin.id,
          processedAt: now,
          updatedAt: now,
        })
        .where(eq(creatorWithdrawals.id, row.id))

      if (row.walletTxId) {
        await tx
          .update(creatorWalletTransactions)
          .set({ status: "completed" })
          .where(eq(creatorWalletTransactions.id, row.walletTxId))
      }

      notifyPayload = {
        userId: row.userId,
        amountBdt: Number(row.amountBdt),
        method: row.payoutMethod,
        decision: "paid",
        adminNote: cleanNote,
      }
      return
    }

    // Reject & refund atomically to Creator Wallet
    await tx.execute(sql`SELECT "id" FROM "user" WHERE "id" = ${row.userId} FOR UPDATE`)
    const uRows = await tx
      .select({ creatorBalance: user.creatorBalance })
      .from(user)
      .where(eq(user.id, row.userId))
      .limit(1)

    const balanceBefore = Number(uRows[0]?.creatorBalance ?? 0)
    const refundAmount = Number(row.amountBdt)
    const balanceAfter = balanceBefore + refundAmount

    await tx
      .update(user)
      .set({
        creatorBalance: balanceAfter,
        updatedAt: now,
      })
      .where(eq(user.id, row.userId))

    if (row.walletTxId) {
      await tx
        .update(creatorWalletTransactions)
        .set({ status: "rejected" })
        .where(eq(creatorWalletTransactions.id, row.walletTxId))
    }

    await tx.insert(creatorWalletTransactions).values({
      id: randomUUID(),
      userId: row.userId,
      creatorApplicationId: row.creatorApplicationId,
      type: "withdrawal_refund",
      amountBdt: refundAmount,
      balanceBefore,
      balanceAfter,
      description: `Refund for rejected withdrawal (${row.payoutMethod})${cleanNote ? ` — ${cleanNote}` : ""}`,
      referenceId: row.id,
      status: "completed",
    })

    await tx
      .update(creatorWithdrawals)
      .set({
        status: "rejected",
        adminNote: cleanNote,
        processedBy: admin.id,
        processedAt: now,
        updatedAt: now,
      })
      .where(eq(creatorWithdrawals.id, row.id))

    notifyPayload = {
      userId: row.userId,
      amountBdt: refundAmount,
      method: row.payoutMethod,
      decision: "rejected",
      adminNote: cleanNote,
    }
  })

  if (txError) {
    return { ok: false as const, error: txError }
  }

  const info = notifyPayload as {
    userId: string
    amountBdt: number
    method: string
    decision: "paid" | "rejected"
    adminNote: string | null
  } | null

  if (info) {
    await notifyUser(
      info.userId,
      "wallet",
      info.decision === "paid"
        ? `Creator Withdrawal Paid: ৳${info.amountBdt}`
        : `Creator Withdrawal Rejected & Refunded: ৳${info.amountBdt}`,
      info.decision === "paid"
        ? `Your Creator Wallet withdrawal of ৳${info.amountBdt} via ${info.method} has been marked as paid.${info.adminNote ? ` Note: ${info.adminNote}` : ""}`
        : `Your withdrawal of ৳${info.amountBdt} via ${info.method} was rejected and refunded back to your Creator Wallet.${info.adminNote ? ` Reason: ${info.adminNote}` : ""}`,
      "/dashboard/referrals"
    )
  }

  await logActivity(admin.id, admin.role, `creator_withdrawal.${parsed.data.decision}`, parsed.data.withdrawalId, {
    adminNote: parsed.data.adminNote || null,
  })

  revalidatePath("/admin/referrals")
  revalidatePath("/dashboard/referrals")

  return { ok: true as const }
}

const reviewCreatorSchema = z.object({
  applicationId: z.string().min(1),
  decision: z.enum(["approve", "reject"]),
  customCode: z.string().trim().max(24).optional().or(z.literal("")),
  adminNote: z.string().trim().max(500).optional().or(z.literal("")),
})

export async function reviewCreatorApplicationAction(input: {
  applicationId: string
  decision: "approve" | "reject"
  customCode?: string
  adminNote?: string
}) {
  const admin = await requireAdmin()
  const parsed = reviewCreatorSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid request." }
  }

  const rows = await db
    .select()
    .from(creatorApplications)
    .where(eq(creatorApplications.id, parsed.data.applicationId))
    .limit(1)
  const app = rows[0]
  if (!app) {
    return { ok: false as const, error: "Creator application not found." }
  }

  const now = new Date()

  if (parsed.data.decision === "approve") {
    const rawCustom = (parsed.data.customCode || "").trim()
    const adminCustomCode = rawCustom ? normalizeReferralCode(rawCustom) : ""
    const applicantRequestedCode = normalizeReferralCode(app.requestedReferralCode)

    let finalCode: string

    if (rawCustom) {
      if (adminCustomCode.length < 3 || adminCustomCode.length > 24) {
        return {
          ok: false as const,
          error: "Custom referral code must be 3–24 characters using only letters, numbers, hyphens (-), or underscores (_).",
        }
      }
      if (await isReferralCodeTaken(adminCustomCode, app.id)) {
        return {
          ok: false as const,
          error: `Exact referral code "${adminCustomCode}" is already assigned to another account. Please choose a different code.`,
        }
      }
      finalCode = adminCustomCode
    } else if (app.referralCode) {
      finalCode = app.referralCode
    } else if (
      applicantRequestedCode.length >= 3 &&
      !(await isReferralCodeTaken(applicantRequestedCode, app.id))
    ) {
      finalCode = applicantRequestedCode
    } else {
      finalCode = await generateUniqueCreatorReferralCode(app.creatorName)
    }

    await db
      .update(creatorApplications)
      .set({
        status: "approved",
        referralCode: finalCode,
        adminNote: parsed.data.adminNote || null,
        reviewedBy: admin.id,
        reviewedAt: now,
        updatedAt: now,
      })
      .where(eq(creatorApplications.id, app.id))

    await notifyUser(
      app.userId,
      "announcement",
      "Content Creator Application Approved!",
      `Welcome to the RushX Organization Creator Program! Your exact exclusive referral code is ${finalCode}. Share your referral link to earn Creator Wallet payouts per signup while giving your community a signup bonus.`,
      "/dashboard/referrals"
    )

    await logActivity(admin.id, admin.role, "creator_application.approve", app.id, {
      creatorName: app.creatorName,
      referralCode: finalCode,
      requestedReferralCode: app.requestedReferralCode || null,
    })

    revalidatePath("/admin/referrals")
    revalidatePath("/creators")
    revalidatePath("/partnerships")
    revalidatePath("/dashboard/referrals")

    return { ok: true as const, referralCode: finalCode }
  }

  await db
    .update(creatorApplications)
    .set({
      status: "rejected",
      referralCode: null,
      adminNote: parsed.data.adminNote || null,
      reviewedBy: admin.id,
      reviewedAt: now,
      updatedAt: now,
    })
    .where(eq(creatorApplications.id, app.id))

  await notifyUser(
    app.userId,
    "announcement",
    "Content Creator Application Update",
    parsed.data.adminNote
      ? `Your creator application was not approved at this time. Admin note: ${parsed.data.adminNote}`
      : "Your creator application was not approved at this time. You may reapply once you meet the channel activity requirements.",
    "/creators"
  )

  await logActivity(admin.id, admin.role, "creator_application.reject", app.id, {
    creatorName: app.creatorName,
    adminNote: parsed.data.adminNote || null,
  })

  revalidatePath("/admin/referrals")
  revalidatePath("/creators")
  revalidatePath("/dashboard/referrals")

  return { ok: true as const }
}

const referralSettingsSchema = z
  .object({
    creatorEnabled: z.boolean(),
    creatorRewardMode: z.enum(["fixed", "random"]),
    creatorFixedBdt: z.coerce.number().int().min(1).max(10000),
    creatorMinBdt: z.coerce.number().int().min(1).max(10000),
    creatorMaxBdt: z.coerce.number().int().min(1).max(10000),
    creatorQualifyingScrims: z.coerce.number().int().min(1).max(50),
    creatorMinEntryFeeBdt: z.coerce.number().int().min(1).max(5000),
    creatorDeclaredMode: z.enum(["fixed", "random"]),
    creatorDeclaredFixedBdt: z.coerce.number().int().min(1).max(10000),
    creatorDeclaredMinBdt: z.coerce.number().int().min(1).max(10000),
    creatorDeclaredMaxBdt: z.coerce.number().int().min(1).max(10000),
    creatorPerSignupPayoutBdt: z.coerce.number().int().min(0).max(5000),
    creatorMinWithdrawalBdt: z.coerce.number().int().min(10).max(50000),
    userEnabled: z.boolean(),
    userRewardMode: z.enum(["fixed", "random"]),
    userFixedBdt: z.coerce.number().int().min(1).max(10000),
    userMinBdt: z.coerce.number().int().min(1).max(10000),
    userMaxBdt: z.coerce.number().int().min(1).max(10000),
    userQualifyingScrims: z.coerce.number().int().min(1).max(50),
    userMinEntryFeeBdt: z.coerce.number().int().min(1).max(5000),
    userMinTotalSpendBdt: z.coerce.number().int().min(0).max(50000),
  })
  .refine((v) => v.creatorMinBdt <= v.creatorMaxBdt, {
    message: "Actual Creator User-Bonus Min must be less than or equal to Max.",
  })
  .refine((v) => v.creatorDeclaredMinBdt <= v.creatorDeclaredMaxBdt, {
    message: "Declared User Bonus Min must be less than or equal to Max.",
  })
  .refine((v) => v.userMinBdt <= v.userMaxBdt, {
    message: "User Min reward must be less than or equal to User Max reward.",
  })

export async function updateReferralSettingsAction(input: ReferralProgramSettings) {
  const admin = await requireAdmin()
  const parsed = referralSettingsSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid referral settings." }
  }

  const saved = await saveReferralSettings(parsed.data)
  await logActivity(admin.id, admin.role, "referrals.settings.update", "referral_program_config", {
    creatorRewardMode: saved.creatorRewardMode,
    creatorDeclaredMode: saved.creatorDeclaredMode,
    creatorPerSignupPayoutBdt: saved.creatorPerSignupPayoutBdt,
    userRewardMode: saved.userRewardMode,
    userQualifyingScrims: saved.userQualifyingScrims,
    userMinTotalSpendBdt: saved.userMinTotalSpendBdt,
  })

  revalidatePath("/admin/referrals")
  revalidatePath("/dashboard/referrals")
  revalidatePath("/dashboard")
  revalidatePath("/creators")

  return { ok: true as const, settings: saved }
}

export async function getUserReferralRedemptionStatus(userId: string) {
  const [uRows, googleRows, config] = await Promise.all([
    db
      .select({
        createdAt: user.createdAt,
        referredByCode: user.referredByCode,
        referredByUserId: user.referredByUserId,
        referralType: user.referralType,
        referralLockedAt: user.referralLockedAt,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1),
    db
      .select({ id: account.id })
      .from(account)
      .where(and(eq(account.userId, userId), eq(account.providerId, "google")))
      .limit(1),
    getReferralSettings(),
  ])

  const row = uRows[0]
  if (!row) {
    return {
      isGoogleUser: false,
      alreadyRedeemed: false,
      referredByCode: null as string | null,
      referredByType: null as string | null,
      canRedeem: false,
      windowExpired: true,
      windowEndsAt: null as string | null,
      publicSettings: toPublicReferralSettings(config),
    }
  }

  const createdMs = new Date(row.createdAt).getTime()
  const windowEndsMs = createdMs + REFERRAL_REDEEM_WINDOW_MS
  const nowMs = Date.now()
  const alreadyRedeemed = Boolean(row.referredByUserId || row.referredByCode || row.referralLockedAt)
  const windowExpired = nowMs > windowEndsMs
  const canRedeem = !alreadyRedeemed && !windowExpired

  return {
    isGoogleUser: googleRows.length > 0,
    alreadyRedeemed,
    referredByCode: row.referredByCode ?? null,
    referredByType: row.referralType ?? null,
    canRedeem,
    windowExpired,
    windowEndsAt: new Date(windowEndsMs).toISOString(),
    publicSettings: toPublicReferralSettings(config),
  }
}

export async function getUserReferralDashboardData() {
  const sessionUser = await requireUser()
  const [
    userCode,
    creatorApp,
    config,
    uRow,
    googleRows,
    refRows,
    creatorTxRows,
    creatorWithdrawalRows,
    activePayoutMethods,
  ] = await Promise.all([
    ensureUserReferralCode(sessionUser.id, sessionUser.name),
    getUserCreatorApplication(sessionUser.id),
    getReferralSettings(),
    db
      .select({
        createdAt: user.createdAt,
        creatorBalance: user.creatorBalance,
        referredByCode: user.referredByCode,
        referredByUserId: user.referredByUserId,
        referralType: user.referralType,
        referralLockedAt: user.referralLockedAt,
      })
      .from(user)
      .where(eq(user.id, sessionUser.id))
      .limit(1),
    db
      .select({ id: account.id })
      .from(account)
      .where(and(eq(account.userId, sessionUser.id), eq(account.providerId, "google")))
      .limit(1),
    db
      .select({
        id: referrals.id,
        referredUserId: referrals.referredUserId,
        referralCode: referrals.referralCode,
        referralType: referrals.referralType,
        qualifyingScrimsCount: referrals.qualifyingScrimsCount,
        requiredScrimsCount: referrals.requiredScrimsCount,
        qualifyingSpendBdt: referrals.qualifyingSpendBdt,
        requiredSpendBdt: referrals.requiredSpendBdt,
        rewardRecipient: referrals.rewardRecipient,
        creatorSignupPaidBdt: referrals.creatorSignupPaidBdt,
        status: referrals.status,
        rewardAmountBdt: referrals.rewardAmountBdt,
        rewardModeUsed: referrals.rewardModeUsed,
        rewardedAt: referrals.rewardedAt,
        createdAt: referrals.createdAt,
      })
      .from(referrals)
      .where(eq(referrals.referrerUserId, sessionUser.id))
      .orderBy(desc(referrals.createdAt))
      .limit(150),
    db
      .select()
      .from(creatorWalletTransactions)
      .where(eq(creatorWalletTransactions.userId, sessionUser.id))
      .orderBy(desc(creatorWalletTransactions.createdAt))
      .limit(50),
    db
      .select()
      .from(creatorWithdrawals)
      .where(eq(creatorWithdrawals.userId, sessionUser.id))
      .orderBy(desc(creatorWithdrawals.createdAt))
      .limit(50),
    getActivePayoutMethods(),
  ])

  const referredIds = [...new Set(refRows.map((r) => r.referredUserId))]
  const referredUsers =
    referredIds.length > 0
      ? await db
          .select({ id: user.id, name: user.name, createdAt: user.createdAt })
          .from(user)
          .where(inArray(user.id, referredIds))
      : []
  const userNameMap = new Map(referredUsers.map((u) => [u.id, u.name]))

  const enrichedReferrals = refRows.map((r) => ({
    ...r,
    // Never reveal real internal creator-referral user reward to non-admins; show creator's own signup earning for creator rows
    displayRewardBdt:
      r.referralType === "creator"
        ? Number(r.creatorSignupPaidBdt || 0)
        : r.status === "rewarded"
          ? Number(r.rewardAmountBdt || 0)
          : 0,
    referredUserName: userNameMap.get(r.referredUserId) ?? "Registered Player",
  }))

  const userRefs = enrichedReferrals.filter((r) => r.referralType === "user")
  const creatorRefs = enrichedReferrals.filter((r) => r.referralType === "creator")

  const userEarnedBdt = userRefs
    .filter((r) => r.status === "rewarded")
    .reduce((sum, r) => sum + Number(r.rewardAmountBdt || 0), 0)
  const creatorSignupEarnedBdt = creatorRefs.reduce(
    (sum, r) => sum + Number(r.creatorSignupPaidBdt || 0),
    0
  )
  const totalEarnedBdt = userEarnedBdt + creatorSignupEarnedBdt

  const currentRow = uRow[0]
  const createdMs = currentRow ? new Date(currentRow.createdAt).getTime() : Date.now()
  const windowEndsMs = createdMs + REFERRAL_REDEEM_WINDOW_MS
  const alreadyRedeemed = Boolean(
    currentRow?.referredByUserId || currentRow?.referredByCode || currentRow?.referralLockedAt
  )
  const windowExpired = Date.now() > windowEndsMs

  return {
    userCode,
    creatorApplication: creatorApp,
    settings: toPublicReferralSettings(config),
    referredByCode: currentRow?.referredByCode ?? null,
    referredByType: currentRow?.referralType ?? null,
    redemption: {
      isGoogleUser: googleRows.length > 0,
      alreadyRedeemed,
      canRedeem: !alreadyRedeemed && !windowExpired,
      windowExpired,
      windowEndsAt: new Date(windowEndsMs).toISOString(),
    },
    creatorWallet: {
      balanceBdt: Number(currentRow?.creatorBalance ?? 0),
      signupCount: creatorRefs.length,
      totalSignupEarnedBdt: creatorSignupEarnedBdt,
      transactions: creatorTxRows,
      withdrawals: creatorWithdrawalRows,
      payoutMethods: activePayoutMethods,
    },
    referrals: enrichedReferrals,
    stats: {
      totalReferrals: enrichedReferrals.length,
      creatorSignupCount: creatorRefs.length,
      userReferralCount: userRefs.length,
      rewardedCount: userRefs.filter((r) => r.status === "rewarded").length,
      pendingCount: userRefs.filter((r) => r.status !== "rewarded").length,
      totalEarnedBdt,
      creatorEarnedBdt: creatorSignupEarnedBdt,
      userEarnedBdt,
    },
  }
}

export async function getAdminReferralOverviewData() {
  await requireAdmin()
  const [config, applications, recentReferrals, withdrawalRows, aggregateRows, creatorSignupCounts] =
    await Promise.all([
      getReferralSettings(),
      db.select().from(creatorApplications).orderBy(desc(creatorApplications.createdAt)).limit(200),
      db.select().from(referrals).orderBy(desc(referrals.createdAt)).limit(200),
      db.select().from(creatorWithdrawals).orderBy(desc(creatorWithdrawals.createdAt)).limit(200),
      db
        .select({
          totalReferrals: sql<number>`count(*)::int`,
          rewardedReferrals: sql<number>`count(*) filter (where ${referrals.status} = 'rewarded')::int`,
          creatorSignups: sql<number>`count(*) filter (where ${referrals.referralType} = 'creator')::int`,
          totalPaidBdt: sql<number>`coalesce(sum(${referrals.rewardAmountBdt}) filter (where ${referrals.status} = 'rewarded'), 0)::int`,
          creatorUserBonusPaidBdt: sql<number>`coalesce(sum(${referrals.rewardAmountBdt}) filter (where ${referrals.status} = 'rewarded' and ${referrals.referralType} = 'creator'), 0)::int`,
          creatorWalletPaidBdt: sql<number>`coalesce(sum(${referrals.creatorSignupPaidBdt}) filter (where ${referrals.referralType} = 'creator'), 0)::int`,
          userPaidBdt: sql<number>`coalesce(sum(${referrals.rewardAmountBdt}) filter (where ${referrals.status} = 'rewarded' and ${referrals.referralType} = 'user'), 0)::int`,
        })
        .from(referrals),
      db
        .select({
          referrerUserId: referrals.referrerUserId,
          signupCount: sql<number>`count(*)::int`,
          totalSignupPayoutBdt: sql<number>`coalesce(sum(${referrals.creatorSignupPaidBdt}), 0)::int`,
        })
        .from(referrals)
        .where(eq(referrals.referralType, "creator"))
        .groupBy(referrals.referrerUserId),
    ])

  const userIds = [
    ...new Set([
      ...applications.map((a) => a.userId),
      ...recentReferrals.map((r) => r.referrerUserId),
      ...recentReferrals.map((r) => r.referredUserId),
      ...withdrawalRows.map((w) => w.userId),
    ]),
  ]

  const userRows =
    userIds.length > 0
      ? await db
          .select({
            id: user.id,
            name: user.name,
            email: user.email,
            balance: user.balance,
            creatorBalance: user.creatorBalance,
          })
          .from(user)
          .where(inArray(user.id, userIds))
      : []
  const userMap = new Map(userRows.map((u) => [u.id, u]))
  const creatorCountMap = new Map(
    creatorSignupCounts.map((c) => [
      c.referrerUserId,
      {
        signupCount: Number(c.signupCount || 0),
        totalSignupPayoutBdt: Number(c.totalSignupPayoutBdt || 0),
      },
    ])
  )

  const appByUserMap = new Map(applications.map((a) => [a.userId, a]))

  const enrichedApps = applications.map((app) => {
    const counts = creatorCountMap.get(app.userId)
    return {
      ...app,
      applicantName: userMap.get(app.userId)?.name ?? "Unknown User",
      applicantEmail: userMap.get(app.userId)?.email ?? "",
      creatorBalance: Number(userMap.get(app.userId)?.creatorBalance ?? 0),
      signupCount: counts?.signupCount ?? 0,
      totalSignupPayoutBdt: counts?.totalSignupPayoutBdt ?? 0,
    }
  })

  const enrichedReferrals = recentReferrals.map((ref) => ({
    ...ref,
    referrerName: userMap.get(ref.referrerUserId)?.name ?? "Unknown",
    referrerEmail: userMap.get(ref.referrerUserId)?.email ?? "",
    referredName: userMap.get(ref.referredUserId)?.name ?? "Unknown",
    referredEmail: userMap.get(ref.referredUserId)?.email ?? "",
  }))

  const enrichedWithdrawals = withdrawalRows.map((w) => ({
    ...w,
    creatorName:
      appByUserMap.get(w.userId)?.creatorName ?? userMap.get(w.userId)?.name ?? "Creator",
    creatorEmail: userMap.get(w.userId)?.email ?? "",
    creatorCode: appByUserMap.get(w.userId)?.referralCode ?? null,
    currentCreatorBalance: Number(userMap.get(w.userId)?.creatorBalance ?? 0),
  }))

  const agg = aggregateRows[0] ?? {
    totalReferrals: 0,
    rewardedReferrals: 0,
    creatorSignups: 0,
    totalPaidBdt: 0,
    creatorUserBonusPaidBdt: 0,
    creatorWalletPaidBdt: 0,
    userPaidBdt: 0,
  }

  return {
    settings: config,
    applications: enrichedApps,
    referrals: enrichedReferrals,
    withdrawals: enrichedWithdrawals,
    summary: {
      totalReferrals: Number(agg.totalReferrals || 0),
      rewardedReferrals: Number(agg.rewardedReferrals || 0),
      creatorSignups: Number(agg.creatorSignups || 0),
      totalPaidBdt: Number(agg.totalPaidBdt || 0),
      creatorPaidBdt: Number(agg.creatorWalletPaidBdt || 0),
      creatorUserBonusPaidBdt: Number(agg.creatorUserBonusPaidBdt || 0),
      userPaidBdt: Number(agg.userPaidBdt || 0),
      pendingCreatorApps: enrichedApps.filter((a) => a.status === "pending").length,
      approvedCreators: enrichedApps.filter((a) => a.status === "approved").length,
      pendingWithdrawals: enrichedWithdrawals.filter((w) => w.status === "pending").length,
    },
  }
}
