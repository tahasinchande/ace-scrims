"use client"

import { useState, useMemo } from "react"
import { formatDateTime } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ScrollText,
  Search,
  ShieldCheck,
  User,
  Swords,
  RefreshCw,
  Settings,
  Trophy,
  Trash2,
  Calendar,
  Eye,
  CheckCircle2,
  AlertCircle,
  FileCode,
} from "lucide-react"

type ActivityLogRow = {
  log: {
    id: string
    actorId: string | null
    actorRole: string | null
    action: string
    target: string | null
    meta: unknown
    createdAt: Date | string
  }
  actorName: string | null
}

function getActionBadge(action: string) {
  const act = action.toLowerCase()
  if (act.includes("scrim") || act.includes("match")) {
    return {
      label: action,
      icon: Swords,
      className: "border-blue-500/40 bg-blue-500/10 text-blue-400",
    }
  }
  if (act.includes("refund")) {
    return {
      label: action,
      icon: RefreshCw,
      className: "border-amber-500/40 bg-amber-500/10 text-amber-400",
    }
  }
  if (act.includes("setting") || act.includes("announcement")) {
    return {
      label: action,
      icon: Settings,
      className: "border-purple-500/40 bg-purple-500/10 text-purple-400",
    }
  }
  if (act.includes("prize") || act.includes("result")) {
    return {
      label: action,
      icon: Trophy,
      className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
    }
  }
  if (act.includes("wipe") || act.includes("delete") || act.includes("trash")) {
    return {
      label: action,
      icon: Trash2,
      className: "border-red-500/40 bg-red-500/10 text-red-400",
    }
  }
  if (act.includes("user") || act.includes("ban") || act.includes("role")) {
    return {
      label: action,
      icon: ShieldCheck,
      className: "border-rose-500/40 bg-rose-500/10 text-rose-400",
    }
  }
  return {
    label: action,
    icon: CheckCircle2,
    className: "border-primary/40 bg-primary/10 text-primary",
  }
}

export function AdminLogsView({ logs }: { logs: ActivityLogRow[] }) {
  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [inspectLog, setInspectLog] = useState<ActivityLogRow | null>(null)

  const filteredLogs = useMemo(() => {
    return logs.filter(({ log, actorName }) => {
      // Category filter
      if (selectedCategory !== "all") {
        const act = log.action.toLowerCase()
        if (selectedCategory === "scrims" && !act.includes("scrim") && !act.includes("match")) return false
        if (selectedCategory === "refunds" && !act.includes("refund")) return false
        if (selectedCategory === "settings" && !act.includes("setting") && !act.includes("announcement")) return false
        if (selectedCategory === "results" && !act.includes("result") && !act.includes("prize")) return false
        if (selectedCategory === "users" && !act.includes("user") && !act.includes("ban") && !act.includes("role")) return false
      }

      // Query filter
      if (!search.trim()) return true
      const q = search.toLowerCase()
      const inAction = log.action.toLowerCase().includes(q)
      const inActor = (actorName || "").toLowerCase().includes(q) || (log.actorRole || "").toLowerCase().includes(q)
      const inTarget = (log.target || "").toLowerCase().includes(q)
      const inMeta = JSON.stringify(log.meta || "").toLowerCase().includes(q)

      return inAction || inActor || inTarget || inMeta
    })
  }, [logs, search, selectedCategory])

  const stats = useMemo(() => {
    const total = logs.length
    const refunds = logs.filter((l) => l.log.action.toLowerCase().includes("refund")).length
    const scrimChanges = logs.filter((l) => l.log.action.toLowerCase().includes("scrim")).length
    const prizes = logs.filter((l) => l.log.action.toLowerCase().includes("prize") || l.log.action.toLowerCase().includes("result")).length
    return { total, refunds, scrimChanges, prizes }
  }, [logs])

  return (
    <div className="space-y-6">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="dc-surface dc-metric-cell rounded-xl p-4">
          <p className="text-xs uppercase text-muted-foreground font-semibold">Total Logged Events</p>
          <p className="text-2xl font-bold font-display mt-1 text-foreground">{stats.total}</p>
        </div>
        <div className="dc-surface dc-metric-cell rounded-xl p-4">
          <p className="text-xs uppercase text-muted-foreground font-semibold">Refund Operations</p>
          <p className="text-2xl font-bold font-display mt-1 text-amber-400">{stats.refunds}</p>
        </div>
        <div className="dc-surface dc-metric-cell rounded-xl p-4">
          <p className="text-xs uppercase text-muted-foreground font-semibold">Scrim Updates</p>
          <p className="text-2xl font-bold font-display mt-1 text-blue-400">{stats.scrimChanges}</p>
        </div>
        <div className="dc-surface dc-metric-cell rounded-xl p-4">
          <p className="text-xs uppercase text-muted-foreground font-semibold">Result & Prize Actions</p>
          <p className="text-2xl font-bold font-display mt-1 text-emerald-400">{stats.prizes}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="dc-surface rushx-box-splash rounded-2xl p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search action, actor, target or meta payload..."
            className="pl-9 text-xs sm:text-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: "all", label: "All Logs" },
            { id: "scrims", label: "Scrims" },
            { id: "refunds", label: "Refunds" },
            { id: "results", label: "Results & Prizes" },
            { id: "settings", label: "Settings" },
            { id: "users", label: "Users" },
          ].map((cat) => (
            <Button
              key={cat.id}
              variant={selectedCategory === cat.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(cat.id)}
              className="text-xs h-8"
            >
              {cat.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="dc-surface rushx-box-splash rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-secondary/40 text-xs font-semibold uppercase text-muted-foreground border-b border-border/40">
              <tr>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Target / Reference</th>
                <th className="px-4 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    <ScrollText className="size-8 mx-auto mb-2 opacity-40" />
                    <p className="font-semibold">No audit logs found</p>
                    <p className="text-xs mt-1">Try adjusting your search query or category filter</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map(({ log, actorName }) => {
                  const badge = getActionBadge(log.action)
                  const ActionIcon = badge.icon
                  const formattedTime = formatDateTime(log.createdAt)
                  const hasMeta = Boolean(log.meta && Object.keys(log.meta as object).length > 0)

                  return (
                    <tr key={log.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground font-mono">
                        {formattedTime}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-foreground text-xs font-bold">
                            {(actorName || "S")[0].toUpperCase()}
                          </span>
                          <div className="flex flex-col">
                            <span className="font-medium text-xs text-foreground">
                              {actorName || "Staff Admin"}
                            </span>
                            <span className="text-[10px] text-muted-foreground capitalize">
                              {log.actorRole || "admin"}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge variant="outline" className={`gap-1.5 text-xs font-mono font-medium ${badge.className}`}>
                          <ActionIcon className="size-3" />
                          {log.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs max-w-xs truncate text-muted-foreground">
                        {log.target ? (
                          <span className="font-mono text-foreground">{log.target}</span>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {hasMeta ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setInspectLog({ log, actorName })}
                            className="h-7 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/10"
                          >
                            <FileCode className="size-3.5" />
                            Inspect
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground/40">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Metadata Inspector Dialog */}
      {inspectLog && (
        <Dialog open={Boolean(inspectLog)} onOpenChange={(open) => !open && setInspectLog(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <ScrollText className="size-4 text-primary" />
                Audit Log Details: {inspectLog.log.action}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2 text-xs">
              <div className="grid grid-cols-2 gap-2 glass p-3 rounded-xl">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Actor</span>
                  <span className="font-semibold text-foreground">{inspectLog.actorName || "System Staff"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Timestamp</span>
                  <span className="font-mono text-foreground">{formatDateTime(inspectLog.log.createdAt)}</span>
                </div>
                {inspectLog.log.target && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground block text-[10px] uppercase font-semibold">Target</span>
                    <span className="font-mono text-foreground">{inspectLog.log.target}</span>
                  </div>
                )}
              </div>

              <div>
                <span className="text-muted-foreground block text-[10px] uppercase font-semibold mb-1">
                  JSON Metadata Payload
                </span>
                <pre className="p-3 rounded-xl bg-black/80 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-60 border border-border/50">
                  {JSON.stringify(inspectLog.log.meta, null, 2)}
                </pre>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
