import { requireAdmin } from "@/lib/session"
import { getPublicSiteSettings } from "@/lib/queries/settings"
import { AdminBackgroundManager } from "@/components/admin/admin-background-manager"

export const dynamic = "force-dynamic"

export default async function AdminBackgroundPage() {
  await requireAdmin()
  const settings = await getPublicSiteSettings()

  return <AdminBackgroundManager initialConfig={settings.backgroundConfig} />
}
