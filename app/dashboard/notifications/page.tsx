import { requireUser } from "@/lib/session"
import { getUserNotifications } from "@/lib/queries/dashboard"
import { NotificationsList } from "@/components/dashboard/notifications-list"

export const metadata = { title: "Notifications — Ace Scrims" }

export default async function NotificationsPage() {
  const user = await requireUser()
  const items = await getUserNotifications(user.id)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight">Notifications</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Payment confirmations, room publishes, results and announcements.
        </p>
      </div>
      <NotificationsList
        items={items.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          body: n.body,
          href: n.href,
          read: n.read,
          createdAt: n.createdAt.toISOString(),
        }))}
      />
    </div>
  )
}
