import { Suspense } from "react"
import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import { isStaffRole } from "@/lib/roles"
import { AdminNav } from "@/components/admin/admin-nav"
import { PageTransition } from "@/components/site/reveal"
import { getPublicSiteSettings } from "@/lib/queries/settings"

export const dynamic = "force-dynamic"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()
  if (!user || user.banned || !isStaffRole(user.role)) {
    redirect("/")
  }

  const settings = await getPublicSiteSettings().catch(() => undefined)

  return (
    <div className="flex min-h-dvh flex-col bg-transparent text-foreground lg:flex-row">
      <Suspense fallback={<aside className="h-14 w-full shrink-0 lg:h-auto lg:w-64" />}>
        <AdminNav
          role={user.role}
          name={user.name || "Staff"}
          logoUrl={settings?.logoUrl || "/images/brand/rushx-symbol.png"}
        />
      </Suspense>
      <main className="min-w-0 w-full flex-1 overflow-x-clip p-3 sm:p-6 lg:p-8">
        <PageTransition className="mx-auto w-full max-w-7xl min-w-0">{children}</PageTransition>
      </main>
    </div>
  )
}
