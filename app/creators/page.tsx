import type { Metadata } from "next"
import { and, eq, sql } from "drizzle-orm"
import { SiteHeader } from "@/components/site/site-header"
import { SiteFooter } from "@/components/site/site-footer"
import { getSessionUser } from "@/lib/session"
import { getPublicSiteSettings } from "@/lib/queries/settings"
import {
  getReferralSettings,
  getUserCreatorApplication,
  toPublicReferralSettings,
} from "@/lib/referrals"
import { db } from "@/lib/db"
import { referrals, user as userTable } from "@/lib/db/schema"
import { CreatorApplicationView } from "@/components/creators/creator-application-view"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Content Creator Program",
  description:
    "Apply to the Ace Scrims Content Creator Referral Program, get an approved creator code, earn Creator Wallet payouts per signup, and give your community a welcome bonus.",
}

export default async function CreatorsPage() {
  const [user, siteSettings, referralSettings] = await Promise.all([
    getSessionUser().catch(() => null),
    getPublicSiteSettings().catch(() => undefined),
    getReferralSettings(),
  ])

  const [existingApplication, creatorMetrics] = user
    ? await Promise.all([
        getUserCreatorApplication(user.id).catch(() => null),
        Promise.all([
          db
            .select({ creatorBalance: userTable.creatorBalance })
            .from(userTable)
            .where(eq(userTable.id, user.id))
            .limit(1)
            .catch(() => []),
          db
            .select({ count: sql<number>`count(*)::int` })
            .from(referrals)
            .where(and(eq(referrals.referrerUserId, user.id), eq(referrals.referralType, "creator")))
            .catch(() => []),
        ]),
      ])
    : [null, null]

  const creatorBalance = Number(creatorMetrics?.[0]?.[0]?.creatorBalance ?? 0)
  const creatorSignupCount = Number(creatorMetrics?.[1]?.[0]?.count ?? 0)

  return (
    <>
      <SiteHeader user={user ? { name: user.name, role: user.role } : null} settings={siteSettings} />
      <main className="mx-auto flex-1 w-full px-4 pb-20 pt-28 sm:px-6">
        <CreatorApplicationView
          signedIn={Boolean(user)}
          userName={user?.name}
          existingApplication={existingApplication}
          settings={toPublicReferralSettings(referralSettings)}
          creatorBalance={creatorBalance}
          creatorSignupCount={creatorSignupCount}
        />
      </main>
      <SiteFooter settings={siteSettings} />
    </>
  )
}
