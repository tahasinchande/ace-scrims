import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { SiteHeader } from "@/components/site/site-header"
import { getSessionUser } from "@/lib/session"
import { getUnreadCount } from "@/lib/queries/dashboard"
import { getPublicSiteSettings } from "@/lib/queries/settings"
import { getUserPendingImageRequests } from "@/app/actions/image-requests"
import { DashboardNav } from "@/components/dashboard/dashboard-nav"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Dashboard — RushX Organization",
  description: "Manage your scrim bookings, results and notifications.",
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [user, settings] = await Promise.all([
    getSessionUser(),
    getPublicSiteSettings().catch(() => undefined),
  ])
  if (!user) redirect("/sign-in?next=/dashboard")
  if (!user.emailVerified) redirect("/verify-email?next=/dashboard")
  const [unread, pendingRequests] = await Promise.all([
    getUnreadCount(user.id),
    getUserPendingImageRequests(user.id).catch(() => []),
  ])

  return (
    <>
      <SiteHeader user={{ name: user.name, role: user.role }} settings={settings} />
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 pb-20 pt-28 sm:px-6 lg:flex-row">
        <DashboardNav
          unread={unread}
          pendingImageRequestsCount={pendingRequests.length}
          user={{ name: user.name, email: user.email, role: user.role, image: user.image }}
        />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </>
  )
}
