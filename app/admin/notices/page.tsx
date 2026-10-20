import { requireAdmin } from "@/lib/session"
import { getAllNotices } from "@/lib/queries/notices"
import { AdminNoticesManager } from "@/components/admin/admin-notices-manager"

export const dynamic = "force-dynamic"

export const metadata = {
  title: "Notices Management — Ace Scrims Admin",
  description: "Publish and manage official platform announcements, rules, schedules, and media notices.",
}

export default async function AdminNoticesPage() {
  await requireAdmin()
  const notices = await getAllNotices(false)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
          Notice Board Management
        </h1>
        <p className="text-sm text-muted-foreground">
          Publish rich announcements, tournament schedules, rule updates, and media bulletins for users.
        </p>
      </div>

      <AdminNoticesManager initialNotices={notices} />
    </div>
  )
}
