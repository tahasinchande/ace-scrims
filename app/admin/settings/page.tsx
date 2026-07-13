import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import { db } from "@/lib/db"
import { settings } from "@/lib/db/schema"
import { SiteSettingsForm } from "@/components/admin/site-settings-form"

export const metadata = { title: "Settings — Ace Scrims Admin" }

export default async function AdminSettingsPage() {
  const user = await getSessionUser()
  if (user?.role !== "admin") redirect("/admin/scrims")

  const rows = await db.select().from(settings)
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Site Settings</h1>
        <p className="text-sm text-muted-foreground">Community links and contact info.</p>
      </header>
      <SiteSettingsForm
        discordUrl={map.discord_url ?? ""}
        facebookUrl={map.facebook_url ?? ""}
        supportPhone={map.support_phone ?? ""}
      />
    </div>
  )
}
