import type { Metadata } from "next"
import { requireUser } from "@/lib/session"
import { getUserWalletData } from "@/app/actions/wallet"
import { WalletView } from "@/components/dashboard/wallet-view"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Wallet & Balance — RushX Organization",
  description: "Manage your RushX Organization account balance, deposit funds, and view transaction history.",
}

export default async function DashboardWalletPage() {
  const user = await requireUser()
  const { balance, transactions } = await getUserWalletData()

  return (
    <WalletView
      balance={balance}
      transactions={transactions}
      userEmail={user.email}
    />
  )
}
