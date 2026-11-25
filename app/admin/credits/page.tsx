import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import { isAdminOrOwner } from "@/lib/roles"
import {
  getAdminCreditUsers,
  getAdminCreditStats,
  getAdminCreditTransactions,
} from "@/lib/queries/admin"
import { AdminCreditManager } from "@/components/admin/admin-credit-manager"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"
export const revalidate = 0
export const fetchCache = "force-no-store"

export const metadata = {
  title: "Credit Management — RushX Organization Admin",
  description: "Manage registered user credits, deposit funds, or disburse tournament prize payouts.",
}

export default async function AdminCreditsPage() {
  const user = await getSessionUser().catch(() => null)
  if (!isAdminOrOwner(user?.role)) redirect("/admin/scrims")

  const [users, stats, recentTransactions] = await Promise.all([
    getAdminCreditUsers().catch(() => []),
    getAdminCreditStats().catch(() => ({
      totalCredits: 0,
      usersWithCredits: 0,
      totalUsers: 0,
      highestBalance: 0,
      totalAdjustments: 0,
    })),
    getAdminCreditTransactions(60).catch(() => []),
  ])

  return (
    <AdminCreditManager
      users={users}
      stats={stats}
      recentTransactions={recentTransactions}
    />
  )
}
