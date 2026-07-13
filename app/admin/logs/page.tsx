import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import { getActivityLogs } from "@/lib/queries/admin"
import { timeAgo } from "@/lib/format"
import { Badge } from "@/components/ui/badge"

export const metadata = { title: "Activity Logs — Ace Scrims Admin" }

export default async function AdminLogsPage() {
  const user = await getSessionUser()
  if (user?.role !== "admin") redirect("/admin/scrims")

  const logs = await getActivityLogs()

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Activity Logs</h1>
        <p className="text-sm text-muted-foreground">
          Audit trail of every admin and moderator action.
        </p>
      </header>

      {logs.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center text-sm text-muted-foreground">
          No activity recorded yet.
        </div>
      ) : (
        <ul className="glass flex flex-col divide-y divide-border rounded-2xl px-4">
          {logs.map(({ log, actorName }) => (
            <li key={log.id} className="flex flex-wrap items-center gap-2 py-3 text-sm">
              <Badge variant="secondary" className="font-mono text-xs">
                {log.action}
              </Badge>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {actorName ?? "System"}
                {log.actorRole ? ` (${log.actorRole})` : ""}
                {log.target ? ` → ${log.target}` : ""}
              </span>
              <span className="text-xs text-muted-foreground">{timeAgo(log.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
