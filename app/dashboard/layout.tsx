import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { SiteHeader } from "@/components/site/site-header"
import { getSessionUser } from "@/lib/session"
import { getUnreadCount } from "@/lib/queries/dashboard"
import { DashboardNav } from "@/components/dashboard/dashboard-nav"

export const metadata: Metadata = {
  title: "Dashboard — Ace Scrims",
  description: "Manage your scrim bookings, results and notifications.",
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()
  if (!user) redirect("/sign-in?next=/dashboard")
  const unread = await getUnreadCount(user.id)

  return (
    <>
      <SiteHeader />
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 pb-20 pt-28 sm:px-6 lg:flex-row">
        <DashboardNav
          unread={unread}
          user={{ name: user.name, email: user.email, role: user.role }}
        />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </>
  )
}
