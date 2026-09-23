import type { ReactNode } from "react"
import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import { AdminNav } from "@/components/admin/admin-nav"
import { db } from "@/lib/db"
import { settings } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export const dynamic = "force-dynamic"

export const metadata = { title: "Admin — Ace Scrims" }

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser()
  if (!user) redirect("/sign-in")
  if (user.role !== "admin" && user.role !== "moderator") redirect("/dashboard")

  const logoRows = await db.select().from(settings).where(eq(settings.key, "site_logo_url")).limit(1).catch(() => [])
  const logoUrl = logoRows[0]?.value || "/icon.svg"

  return (
    <div className="min-h-svh bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:flex-row md:px-6">
        <AdminNav role={user.role} name={user.name} logoUrl={logoUrl} />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
