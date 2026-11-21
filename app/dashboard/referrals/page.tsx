import type { Metadata } from "next"
import { getUserReferralDashboardData } from "@/app/actions/referrals"
import { DashboardReferralsView } from "@/components/dashboard/referrals-view"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Referrals & Creator Wallet — Dashboard",
  description: "Share your referral code, redeem a welcome code, and manage your Creator Wallet withdrawals.",
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
      redemption={data.redemption}
      creatorWallet={data.creatorWallet}
      referrals={data.referrals}
      stats={data.stats}
    />
  )
}
