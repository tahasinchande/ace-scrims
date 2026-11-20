"use server"

import { randomUUID } from "crypto"
import { revalidatePath } from "next/cache"
import { desc, eq, inArray, sql } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/lib/db"
import { creatorApplications, referrals, user } from "@/lib/db/schema"
import { requireAdmin, requireUser, logActivity } from "@/lib/session"
import { notifyUser } from "@/lib/notify"
import { isSafeHttpOrRelativeUrl } from "@/lib/url-safety"
import {
  ensureUserReferralCode,
  generateUniqueCreatorReferralCode,
  getReferralSettings,
  getUserCreatorApplication,
  normalizeReferralCode,
  saveReferralSettings,
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

  const existing = await getUserCreatorApplication(sessionUser.id)
  if (existing && existing.status === "approved") {
    return {
      ok: false as const,
      error: "You are already an approved Ace Scrims Content Creator.",
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
    notes: parsed.data.notes || null,
    status: "pending",
    referralCode: null,
  })

  await logActivity(sessionUser.id, sessionUser.role, "creator_application.submit", id, {
    creatorName: parsed.data.creatorName,
    platform: parsed.data.platform,
  })

  revalidatePath("/creators")
  revalidatePath("/dashboard/referrals")
  revalidatePath("/admin/referrals")

  return { ok: true as const, id }
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
    const preferred = normalizeReferralCode(parsed.data.customCode)
    const finalCode =
      app.referralCode && !preferred
        ? app.referralCode
        : await generateUniqueCreatorReferralCode(app.creatorName, preferred || undefined)

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
      `Welcome to the Ace Scrims Creator Program! Your exclusive creator referral code is ${finalCode}. Share your referral link to earn rewards whenever new players join paid scrims.`,
      "/dashboard/referrals"
    )

    await logActivity(admin.id, admin.role, "creator_application.approve", app.id, {
      creatorName: app.creatorName,
      referralCode: finalCode,
    })

    revalidatePath("/admin/referrals")
    revalidatePath("/creators")
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
    creatorMinEntryFeeBdt: z.coerce.number().int().min(1).max(5000),
    userEnabled: z.boolean(),
    userRewardMode: z.enum(["fixed", "random"]),
    userFixedBdt: z.coerce.number().int().min(1).max(10000),
    userMinBdt: z.coerce.number().int().min(1).max(10000),
    userMaxBdt: z.coerce.number().int().min(1).max(10000),
    userQualifyingScrims: z.coerce.number().int().min(1).max(50),
    userMinEntryFeeBdt: z.coerce.number().int().min(1).max(5000),
  })
  .refine((v) => v.creatorMinBdt <= v.creatorMaxBdt, {
    message: "Creator Min reward must be less than or equal to Creator Max reward.",
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
    userRewardMode: saved.userRewardMode,
    userQualifyingScrims: saved.userQualifyingScrims,
  })

  revalidatePath("/admin/referrals")
  revalidatePath("/dashboard/referrals")
  revalidatePath("/creators")

  return { ok: true as const, settings: saved }
}

export async function getUserReferralDashboardData() {
  const sessionUser = await requireUser()
  const [userCode, creatorApp, config, uRow, refRows] = await Promise.all([
    ensureUserReferralCode(sessionUser.id, sessionUser.name),
    getUserCreatorApplication(sessionUser.id),
    getReferralSettings(),
    db
      .select({
        referredByCode: user.referredByCode,
        referralType: user.referralType,
        referralLockedAt: user.referralLockedAt,
      })
      .from(user)
      .where(eq(user.id, sessionUser.id))
      .limit(1),
    db
      .select({
        id: referrals.id,
        referredUserId: referrals.referredUserId,
        referralCode: referrals.referralCode,
        referralType: referrals.referralType,
        qualifyingScrimsCount: referrals.qualifyingScrimsCount,
        requiredScrimsCount: referrals.requiredScrimsCount,
        status: referrals.status,
        rewardAmountBdt: referrals.rewardAmountBdt,
        rewardModeUsed: referrals.rewardModeUsed,
        rewardedAt: referrals.rewardedAt,
        createdAt: referrals.createdAt,
      })
      .from(referrals)
      .where(eq(referrals.referrerUserId, sessionUser.id))
      .orderBy(desc(referrals.createdAt))
      .limit(100),
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
    referredUserName: userNameMap.get(r.referredUserId) ?? "Registered Player",
  }))

  const totalEarnedBdt = enrichedReferrals
    .filter((r) => r.status === "rewarded")
    .reduce((sum, r) => sum + Number(r.rewardAmountBdt || 0), 0)
  const creatorEarnedBdt = enrichedReferrals
    .filter((r) => r.status === "rewarded" && r.referralType === "creator")
    .reduce((sum, r) => sum + Number(r.rewardAmountBdt || 0), 0)
  const userEarnedBdt = totalEarnedBdt - creatorEarnedBdt

  return {
    userCode,
    creatorApplication: creatorApp,
    settings: config,
    referredByCode: uRow[0]?.referredByCode ?? null,
    referredByType: uRow[0]?.referralType ?? null,
    referrals: enrichedReferrals,
    stats: {
      totalReferrals: enrichedReferrals.length,
      rewardedCount: enrichedReferrals.filter((r) => r.status === "rewarded").length,
      pendingCount: enrichedReferrals.filter((r) => r.status !== "rewarded").length,
      totalEarnedBdt,
      creatorEarnedBdt,
      userEarnedBdt,
    },
  }
}

export async function getAdminReferralOverviewData() {
  await requireAdmin()
  const [config, applications, recentReferrals, aggregateRows] = await Promise.all([
    getReferralSettings(),
    db.select().from(creatorApplications).orderBy(desc(creatorApplications.createdAt)).limit(200),
    db.select().from(referrals).orderBy(desc(referrals.createdAt)).limit(200),
    db
      .select({
        totalReferrals: sql<number>`count(*)::int`,
        rewardedReferrals: sql<number>`count(*) filter (where ${referrals.status} = 'rewarded')::int`,
        totalPaidBdt: sql<number>`coalesce(sum(${referrals.rewardAmountBdt}) filter (where ${referrals.status} = 'rewarded'), 0)::int`,
        creatorPaidBdt: sql<number>`coalesce(sum(${referrals.rewardAmountBdt}) filter (where ${referrals.status} = 'rewarded' and ${referrals.referralType} = 'creator'), 0)::int`,
        userPaidBdt: sql<number>`coalesce(sum(${referrals.rewardAmountBdt}) filter (where ${referrals.status} = 'rewarded' and ${referrals.referralType} = 'user'), 0)::int`,
      })
      .from(referrals),
  ])

  const userIds = [
    ...new Set([
      ...applications.map((a) => a.userId),
      ...recentReferrals.map((r) => r.referrerUserId),
      ...recentReferrals.map((r) => r.referredUserId),
    ]),
  ]

  const userRows =
    userIds.length > 0
      ? await db
          .select({ id: user.id, name: user.name, email: user.email, balance: user.balance })
          .from(user)
          .where(inArray(user.id, userIds))
      : []
  const userMap = new Map(userRows.map((u) => [u.id, u]))

  const enrichedApps = applications.map((app) => ({
    ...app,
    applicantName: userMap.get(app.userId)?.name ?? "Unknown User",
    applicantEmail: userMap.get(app.userId)?.email ?? "",
  }))

  const enrichedReferrals = recentReferrals.map((ref) => ({
    ...ref,
    referrerName: userMap.get(ref.referrerUserId)?.name ?? "Unknown",
    referrerEmail: userMap.get(ref.referrerUserId)?.email ?? "",
    referredName: userMap.get(ref.referredUserId)?.name ?? "Unknown",
    referredEmail: userMap.get(ref.referredUserId)?.email ?? "",
  }))

  const agg = aggregateRows[0] ?? {
    totalReferrals: 0,
    rewardedReferrals: 0,
    totalPaidBdt: 0,
    creatorPaidBdt: 0,
    userPaidBdt: 0,
  }

  return {
    settings: config,
    applications: enrichedApps,
    referrals: enrichedReferrals,
    summary: {
      totalReferrals: Number(agg.totalReferrals || 0),
      rewardedReferrals: Number(agg.rewardedReferrals || 0),
      totalPaidBdt: Number(agg.totalPaidBdt || 0),
      creatorPaidBdt: Number(agg.creatorPaidBdt || 0),
      userPaidBdt: Number(agg.userPaidBdt || 0),
      pendingCreatorApps: enrichedApps.filter((a) => a.status === "pending").length,
      approvedCreators: enrichedApps.filter((a) => a.status === "approved").length,
    },
  }
}
