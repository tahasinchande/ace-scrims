import { requireUser } from "@/lib/session"
import { SettingsForm } from "@/components/dashboard/settings-form"

export const metadata = { title: "Settings — Ace Scrims" }

export default async function SettingsPage() {
  const user = await requireUser()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your profile and account security.</p>
      </div>
      <SettingsForm user={{ name: user.name, email: user.email, emailVerified: user.emailVerified }} />
    </div>
  )
}
