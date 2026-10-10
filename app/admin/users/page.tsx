import { requireAdmin } from "@/lib/session"
import { getAdminUsers } from "@/lib/queries/admin"
import { AdminUserList } from "@/components/admin/admin-user-list"

export const dynamic = "force-dynamic"

export default async function AdminUsersPage() {
  const admin = await requireAdmin()
  const users = await getAdminUsers().catch(() => [])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">User Directory</h1>
        <p className="text-sm text-muted-foreground">
          Manage registered user accounts, ban states, permissions, and administrative roles.
        </p>
      </div>
      <AdminUserList users={users} currentUserId={admin.id} />
    </div>
  )
}
