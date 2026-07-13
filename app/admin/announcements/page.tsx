import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import { db } from "@/lib/db"
import { settings } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { AnnouncementManager } from "@/components/admin/announcement-manager"

export const metadata = { title: "Announcements — Ace Scrims Admin" }

export default async function AdminAnnouncementsPage() {
  const user = await getSessionUser()
  if (user?.role !== "admin") redirect("/admin/scrims")

  const rows = await db
    .select()
    .from(settings)
    .where(eq(settings.key, "announcement"))
    .limit(1)

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Announcements</h1>
        <p className="text-sm text-muted-foreground">
          Site-wide banner and broadcast notifications to all users.
        </p>
      </header>
      <AnnouncementManager currentBanner={rows[0]?.value ?? ""} />
    </div>
  )
}
