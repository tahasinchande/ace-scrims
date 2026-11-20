import type { Metadata } from "next"
import { getUserReferralDashboardData } from "@/app/actions/referrals"
import { DashboardReferralsView } from "@/components/dashboard/referrals-view"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Referrals — Dashboard",
  description: "Share your referral code and track Ace Scrims referral rewards.",
}

export default async function DashboardReferralsPage() {
  const data = await getUserReferralDashboardData()

  return (
    <DashboardReferralsView
      userCode={data.userCode}
      creatorApplication={data.creatorApplication}
      settings={data.settings}
      referredByCode={data.referredByCode}
      referredByType={data.referredByType}
      referrals={data.referrals}
      stats={data.stats}
    />
  )
}
