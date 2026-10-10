import { requireAdmin } from "@/lib/session"
import { getActivityLogs } from "@/lib/queries/admin"
import { AdminLogsView } from "@/components/admin/admin-logs-view"

export const dynamic = "force-dynamic"

export default async function AdminLogsPage() {
  await requireAdmin()
  const logs = await getActivityLogs().catch(() => [])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Activity & Audit Logs</h1>
        <p className="text-sm text-muted-foreground">
          Real-time security and administrative audit trail covering scrim modifications, status transitions, manual refunds, and system events.
        </p>
      </div>
      <AdminLogsView logs={logs} />
    </div>
  )
}
