import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import {
  getAdminCreditUsers,
  getAdminCreditStats,
  getAdminCreditTransactions,
} from "@/lib/queries/admin"
import { AdminCreditManager } from "@/components/admin/admin-credit-manager"

export const dynamic = "force-dynamic"
export const metadata = {
  title: "Credit Management — Ace Scrims Admin",
  description: "Manage registered user credits, deposit funds, or disburse tournament prize payouts.",
}

export default async function AdminCreditsPage() {
  const user = await getSessionUser()
  if (user?.role !== "admin") redirect("/admin/scrims")

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
