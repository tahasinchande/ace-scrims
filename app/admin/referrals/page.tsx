import { getAdminReferralOverviewData } from "@/app/actions/referrals"
import { AdminReferralsManager } from "@/components/admin/admin-referrals-manager"

export const dynamic = "force-dynamic"

export default async function AdminReferralsPage() {
  const data = await getAdminReferralOverviewData()

  return (
    <AdminReferralsManager
      initialSettings={data.settings}
      applications={data.applications}
      referrals={data.referrals}
      withdrawals={data.withdrawals}
      summary={data.summary}
    />
  )
}
