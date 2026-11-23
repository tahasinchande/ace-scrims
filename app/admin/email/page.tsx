import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import { getAllEmailTemplates } from "@/lib/queries/email-templates"
import { AdminEmailManager } from "@/components/admin/admin-email-manager"

export const dynamic = "force-dynamic"
export const metadata = { title: "Email Management — RushX Organization Admin" }

export default async function AdminEmailPage() {
  const user = await getSessionUser()
  if (!user || user.banned || user.role !== "admin") {
    redirect("/admin/scrims")
  }

  const templates = await getAllEmailTemplates()

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
          Email Management &amp; Templates
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure automated transactional emails, manage media attachments, create custom purposes, and toggle triggers ON or OFF.
        </p>
      </header>

      <AdminEmailManager
        initialTemplates={templates}
        adminEmail={user.email || ""}
      />
    </div>
  )
}
