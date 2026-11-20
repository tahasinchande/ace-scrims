import type { Metadata } from "next"
import { SiteHeader } from "@/components/site/site-header"
import { SiteFooter } from "@/components/site/site-footer"
import { getSessionUser } from "@/lib/session"
import { getPublicSiteSettings } from "@/lib/queries/settings"
import { getReferralSettings, getUserCreatorApplication } from "@/lib/referrals"
import { CreatorApplicationView } from "@/components/creators/creator-application-view"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Content Creator Program",
  description:
    "Apply to the Ace Scrims Content Creator Referral Program, get an approved creator code, and earn BDT wallet rewards per referred player.",
}

export default async function CreatorsPage() {
  const [user, siteSettings, referralSettings] = await Promise.all([
    getSessionUser().catch(() => null),
    getPublicSiteSettings().catch(() => undefined),
    getReferralSettings(),
  ])

  const existingApplication = user
    ? await getUserCreatorApplication(user.id).catch(() => null)
    : null

  return (
    <>
      <SiteHeader user={user ? { name: user.name, role: user.role } : null} settings={siteSettings} />
      <main className="mx-auto flex-1 w-full px-4 pb-20 pt-28 sm:px-6">
        <CreatorApplicationView
          signedIn={Boolean(user)}
          userName={user?.name}
          existingApplication={existingApplication}
          settings={referralSettings}
        />
      </main>
      <SiteFooter settings={siteSettings} />
    </>
  )
}
