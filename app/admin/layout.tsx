import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import { AdminNav } from "@/components/admin/admin-nav"
import { getPublicSiteSettings } from "@/lib/queries/settings"

export const dynamic = "force-dynamic"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()
  if (!user || (user.role !== "admin" && user.role !== "moderator")) {
    redirect("/")
  }

  const settings = await getPublicSiteSettings().catch(() => undefined)

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground lg:flex-row">
      <AdminNav
        role={user.role}
        name={user.name || "Staff"}
        logoUrl={settings?.logoUrl || "/icon.svg"}
      />
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  )
}
