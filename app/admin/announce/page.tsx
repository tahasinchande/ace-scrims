import { requireAdmin } from "@/lib/session"
import { getPublicSiteSettings } from "@/lib/queries/settings"
import { AnnouncementManager } from "@/components/admin/announcement-manager"

export const dynamic = "force-dynamic"

export default async function AdminAnnouncePage() {
  await requireAdmin()
  const settings = await getPublicSiteSettings().catch(() => undefined)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Announcements & Broadcasts</h1>
        <p className="text-sm text-muted-foreground">
          Update the global site announcement bar and broadcast notifications directly to all registered users.
        </p>
      </div>
      <AnnouncementManager currentBanner={settings?.announcement || ""} />
    </div>
  )
}
