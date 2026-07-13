import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import { getAdminUsers } from "@/lib/queries/admin"
import { AdminUserList } from "@/components/admin/admin-user-list"

export const metadata = { title: "Manage Users — Ace Scrims" }

export default async function AdminUsersPage() {
  const user = await getSessionUser()
  if (user?.role !== "admin") redirect("/admin/scrims")

  const users = await getAdminUsers()

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Users</h1>
        <p className="text-sm text-muted-foreground">
          Manage roles and account status. Moderators can publish rooms and results only.
        </p>
      </header>
      <AdminUserList users={users} currentUserId={user.id} />
    </div>
  )
}
