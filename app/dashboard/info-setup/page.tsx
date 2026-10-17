import type { Metadata } from "next"
import { requireUser } from "@/lib/session"
import { getUserDefaultInfo } from "@/lib/queries/user-info"
import { InfoSetupForm } from "@/components/dashboard/info-setup-form"

export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  title: "Info Setup — Ace Scrims",
  description: "Set up your permanent squad details and prize payout account to auto-fill every scrim booking.",
}

export default async function InfoSetupPage() {
  const user = await requireUser()
  const defaultInfo = await getUserDefaultInfo(user.id)

  return <InfoSetupForm initialData={defaultInfo} />
}
