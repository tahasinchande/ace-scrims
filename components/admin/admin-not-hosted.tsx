"use client"

import { useState, useTransition, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { processTeamRefund, markRefundManual, markScrimNotHosted, refundAllTeamsForScrim } from "@/app/actions/not-hosted"
import { bdt } from "@/lib/format"
import {
  ShieldAlert,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  CreditCard,
  Search,
  Users,
  Calendar,
  Clock,
  Sparkles,
  ArrowRight,
} from "lucide-react"
import type { NotHostedTeam } from "@/lib/db/schema"
import type { ScrimWithSlots } from "@/lib/queries/scrims"
import { toast } from "sonner"

export function AdminNotHosted({
  teams,
  scrims = [],
}: {
  teams: NotHostedTeam[]
  scrims?: ScrimWithSlots[]
}) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [bulkLoadingScrimId, setBulkLoadingScrimId] = useState<string | null>(null)
  const [manualRefInput, setManualRefInput] = useState<Record<string, string>>({})
  const [selectedScrimId, setSelectedScrimId] = useState<string>("")
  const [isPending, startTransition] = useTransition()
  const [confirmMarkScrim, setConfirmMarkScrim] = useState(false)
  const [pendingBulkRefund, setPendingBulkRefund] = useState<{
    scrimId: string
    scrimTitle: string
    pendingCount: number
  } | null>(null)

  const activeScrimsToMark = scrims.filter((s) => s.status !== "not_hosted" && s.status !== "deleted")

  const handleMarkScrim = () => {
    if (!selectedScrimId) return
    setConfirmMarkScrim(true)
  }

  const executeMarkScrim = () => {
    if (!selectedScrimId) return
    setConfirmMarkScrim(false)

    startTransition(async () => {
      try {
        const res = await markScrimNotHosted(selectedScrimId)
        if (res.ok) {
          toast.success(res.message || "Scrim marked as Not Hosted")
          setSelectedScrimId("")
          router.refresh()
        } else {
          toast.error(res.error || "Failed to mark scrim as Not Hosted")
        }
      } catch (err: any) {
        toast.error(err?.message || "Failed to mark scrim")
      }
    })
  }

  // Filter teams by search query
  const filteredTeams = useMemo(() => {
    if (!query.trim()) return teams
    const q = query.toLowerCase()
    return teams.filter(
      (t) =>
        t.teamName.toLowerCase().includes(q) ||
        t.scrimTitle.toLowerCase().includes(q) ||
        t.phone.includes(q) ||
        (t.captainName && t.captainName.toLowerCase().includes(q)) ||
        (t.transactionId && t.transactionId.toLowerCase().includes(q)) ||
        (t.invoiceId && t.invoiceId.toLowerCase().includes(q))
    )
  }, [teams, query])

  // Group teams by scrimId
  const groupedScrims = useMemo(() => {
    const map = new Map<
      string,
      {
        scrimId: string
        scrimTitle: string
        scrimDate: string
        scrimTime: string
        teams: NotHostedTeam[]
        totalAmount: number
        pendingCount: number
        refundedCount: number
      }
    >()

    for (const t of filteredTeams) {
      if (!map.has(t.scrimId)) {
        map.set(t.scrimId, {
          scrimId: t.scrimId,
          scrimTitle: t.scrimTitle,
          scrimDate: t.scrimDate,
          scrimTime: t.scrimTime,
          teams: [],
          totalAmount: 0,
          pendingCount: 0,
          refundedCount: 0,
        })
      }
      const group = map.get(t.scrimId)!
      group.teams.push(t)
      group.totalAmount += t.amountBdt || 35
      if (t.refundStatus === "refunded") {
        group.refundedCount++
      } else {
        group.pendingCount++
      }
    }

    return Array.from(map.values())
  }, [filteredTeams])

  const handleBulkRefund = (scrimId: string, scrimTitle: string, pendingCount: number) => {
    if (pendingCount === 0) {
      toast.info("All teams for this scrim have already been refunded.")
      return
    }
    setPendingBulkRefund({ scrimId, scrimTitle, pendingCount })
  }

  const executeBulkRefund = async () => {
    if (!pendingBulkRefund) return
    const { scrimId, scrimTitle } = pendingBulkRefund
    setPendingBulkRefund(null)

    setBulkLoadingScrimId(scrimId)
    try {
      const res = await fetch("/api/admin/refund", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bulk: true,
          scrimId,
        }),
      })

      const data = await res.json().catch(() => null)

      if (res.ok && data?.ok) {
        toast.success(data.message || `Bulk refund processed for ${scrimTitle}`)
        router.refresh()
      } else {
        toast.error(data?.error || data?.message || "Bulk refund failed")
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to process bulk refund")
    } finally {
      setBulkLoadingScrimId(null)
    }
  }

  const handleAutoRefund = async (team: NotHostedTeam) => {
    setLoadingId(team.id)
    try {
      const res = await fetch("/api/admin/refund", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          notHostedId: team.id,
          invoiceId: team.invoiceId,
          transactionId: team.transactionId,
          amount: team.amountBdt,
          paymentMethod: team.paymentMethod,
          teamName: team.teamName,
        }),
      })

      const data = await res.json().catch(() => null)

      if (res.ok && data?.ok) {
        toast.success(data.message || `Refund processed for ${team.teamName}`)
        router.refresh()
      } else {
        const errorMsg =
          data?.error ||
          data?.message ||
          `Refund failed for ${team.teamName} (Status ${res.status})`
        toast.error(errorMsg)
        router.refresh()
      }
    } catch (err: any) {
      toast.error(err?.message || `Refund failed for ${team.teamName}`)
    } finally {
      setLoadingId(null)
    }
  }

  const handleManualRefund = async (id: string, teamName: string) => {
    const ref = manualRefInput[id] || ""
    setLoadingId(id)
    try {
      const res = await markRefundManual(id, ref)
      if (res.ok) {
        toast.success(res.message || `Marked ${teamName} as refunded`)
        router.refresh()
      } else {
        toast.error(res.error || "Failed to update refund status")
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to mark refund")
    } finally {
      setLoadingId(null)
    }
  }

  const totalPendingAll = teams.filter((t) => t.refundStatus !== "refunded").length
  const totalRefundedAll = teams.filter((t) => t.refundStatus === "refunded").length

  return (
    <div className="flex flex-col gap-6">
      {/* Header & Quick Action */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide flex items-center gap-2">
            <ShieldAlert className="size-6 text-amber-500" />
            Not Hosted Scrims &amp; Bulk Refunds
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage squads from cancelled or not-hosted matches and trigger automated bulk refunds to user payment accounts.
          </p>
        </div>

        {activeScrimsToMark.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedScrimId}
              onChange={(e) => setSelectedScrimId(e.target.value)}
              className="h-10 rounded-xl border border-border bg-secondary/80 px-3 text-xs font-semibold max-w-xs"
            >
              <option value="">Select Scrim to Mark Not Hosted...</option>
              {activeScrimsToMark.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} ({s.scrimDate} {s.startTime})
                </option>
              ))}
            </select>
            <Button
              size="sm"
              disabled={!selectedScrimId || isPending}
              onClick={handleMarkScrim}
              className="h-10 font-bold uppercase bg-amber-600 hover:bg-amber-700 text-white gap-1.5 shadow-md shadow-amber-600/20"
            >
              <AlertTriangle className="size-4" />
              Mark Not Hosted
            </Button>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="dc-surface dc-metric-cell">
          <CardContent className="p-4 flex flex-col gap-1">
            <span className="text-xs text-muted-foreground font-medium">Total Not Hosted Squads</span>
            <span className="font-display text-2xl font-bold">{teams.length}</span>
          </CardContent>
        </Card>
        <Card className="dc-surface dc-metric-cell">
          <CardContent className="p-4 flex flex-col gap-1">
            <span className="text-xs text-amber-400 font-medium">Pending Refunds</span>
            <span className="font-display text-2xl font-bold text-amber-400">{totalPendingAll}</span>
          </CardContent>
        </Card>
        <Card className="dc-surface dc-metric-cell">
          <CardContent className="p-4 flex flex-col gap-1">
            <span className="text-xs text-emerald-400 font-medium">Completed Refunds</span>
            <span className="font-display text-2xl font-bold text-emerald-400">{totalRefundedAll}</span>
          </CardContent>
        </Card>
        <Card className="dc-surface dc-metric-cell">
          <CardContent className="p-4 flex flex-col gap-1">
            <span className="text-xs text-primary font-medium">Total Scrim Lobbies</span>
            <span className="font-display text-2xl font-bold text-primary">{groupedScrims.length}</span>
          </CardContent>
        </Card>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search team, leader phone, invoice ID or trx ID..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9 h-10 text-xs"
        />
      </div>

      {/* Main Scrim Groups & Bulk Refund Panels */}
      {groupedScrims.length === 0 ? (
        <Card className="dc-surface rushx-box-splash py-16 text-center">
          <CardContent className="flex flex-col items-center gap-3">
            <CheckCircle2 className="size-12 text-emerald-500" />
            <p className="font-display text-lg font-bold">No Not Hosted teams pending</p>
            <p className="text-sm text-muted-foreground max-w-md">
              When a scrim is marked as Not Hosted by Admin, all registered squads and their payment records will appear here for one-click bulk refunds.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {groupedScrims.map((group) => {
            const isAllRefunded = group.pendingCount === 0
            const isBulkLoading = bulkLoadingScrimId === group.scrimId

            return (
              <Card
                key={group.scrimId}
                className={`dc-surface rushx-box-splash border transition-all ${
                  isAllRefunded ? "border-emerald-500/35" : "border-amber-500/45 shadow-lg shadow-amber-500/5"
                }`}
              >
                <CardHeader className="pb-4 bg-white/[0.02] rounded-t-xl border-b border-white/[0.08]">
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={isAllRefunded ? "default" : "destructive"}
                          className={`uppercase text-[11px] font-bold ${
                            isAllRefunded ? "bg-emerald-600 text-white" : "bg-amber-600 text-white"
                          }`}
                        >
                          {isAllRefunded ? "All Refunded" : `${group.pendingCount} Pending Refund`}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="size-3.5" /> {group.scrimDate}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="size-3.5" /> {group.scrimTime}
                        </span>
                      </div>
                      <CardTitle className="text-xl font-bold mt-1 text-foreground">
                        {group.scrimTitle}
                      </CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        {group.teams.length} Registered Squads • Total Value: {bdt(group.totalAmount)}
                      </CardDescription>
                    </div>

                    {/* Bulk Refund Button for this Scrim */}
                    <div className="flex items-center gap-2">
                      <Button
                        size="default"
                        disabled={isAllRefunded || isBulkLoading}
                        onClick={() => handleBulkRefund(group.scrimId, group.scrimTitle, group.pendingCount)}
                        className={`font-display font-bold uppercase gap-2 shadow-lg transition-all ${
                          isAllRefunded
                            ? "bg-secondary text-muted-foreground cursor-not-allowed opacity-60"
                            : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20"
                        }`}
                      >
                        <RefreshCw className={`size-4 ${isBulkLoading ? "animate-spin" : ""}`} />
                        {isBulkLoading
                          ? "Processing Bulk Refunds..."
                          : isAllRefunded
                          ? "All Teams Refunded"
                          : `Refund All Teams (${group.pendingCount})`}
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-4 sm:p-5 flex flex-col gap-3">
                  <div className="flex flex-col gap-3">
                    {group.teams.map((t) => {
                      const isRefunded = t.refundStatus === "refunded"
                      const isLoading = loadingId === t.id

                      return (
                        <div
                          key={t.id}
                          className={`rounded-xl border p-3.5 transition-all flex flex-col gap-3 ${
                            isRefunded
                              ? "bg-secondary/20 border-border/50 opacity-85"
                              : "bg-secondary/40 border-border hover:border-primary/40"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-base text-foreground">{t.teamName}</span>
                              <Badge
                                variant={isRefunded ? "default" : "outline"}
                                className={`text-[10px] font-bold uppercase ${
                                  isRefunded ? "bg-emerald-600 text-white" : "border-amber-500/50 text-amber-400"
                                }`}
                              >
                                {t.refundStatus}
                              </Badge>
                            </div>
                            <span className="font-bold text-sm text-primary">
                              Fee: {bdt(t.amountBdt)}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 rounded-lg bg-background/60 p-2.5 text-xs sm:grid-cols-4 border border-border/50">
                            <div>
                              <span className="text-muted-foreground block text-[11px]">Leader / Phone</span>
                              <span className="font-semibold">{t.captainName} ({t.phone})</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[11px]">Payment Method</span>
                              <span className="font-semibold">{t.paymentMethod || "bKash/Nagad"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[11px]">Invoice ID</span>
                              <span className="font-mono">{t.invoiceId || "N/A"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[11px]">Transaction ID</span>
                              <span className="font-mono">{t.transactionId || t.senderNumber || "N/A"}</span>
                            </div>
                          </div>

                          {!isRefunded ? (
                            <div className="space-y-2 pt-3 border-t border-border/40">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleAutoRefund(t)}
                                    disabled={isLoading}
                                    className="h-8 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 shadow-sm"
                                    title="Trigger instant gateway refund using Invoice ID and Transaction ID"
                                  >
                                    <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
                                    1-Click Auto Refund (৳{t.amountBdt || 35})
                                  </Button>
                                  {t.transactionId && (
                                    <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 hidden sm:inline">
                                      Trx: {t.transactionId}
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  <Input
                                    placeholder="Manual Ref (Optional)..."
                                    value={manualRefInput[t.id] || ""}
                                    onChange={(e) => setManualRefInput({ ...manualRefInput, [t.id]: e.target.value })}
                                    className="h-8 text-xs w-36 bg-background/50 border-border/60"
                                  />
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleManualRefund(t.id, t.teamName)}
                                    disabled={isLoading}
                                    className="h-8 text-xs border-muted-foreground/30 text-muted-foreground hover:text-foreground hover:bg-muted/40 gap-1"
                                    title="Mark as refunded manually without calling gateway API"
                                  >
                                    <CheckCircle2 className="size-3.5" />
                                    Manual Fallback
                                  </Button>
                                </div>
                              </div>

                              {t.refundError && (
                                <div className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1.5 rounded-md font-mono">
                                  <AlertCircle className="size-3.5 shrink-0" />
                                  <span>Refund Error: {t.refundError}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-xs text-emerald-400 font-semibold pt-1 border-t border-border/40">
                              <CheckCircle2 className="size-4" />
                              Refunded. Ref: <span className="font-mono text-foreground">{t.refundRef || "Completed"}</span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={confirmMarkScrim}
        onOpenChange={setConfirmMarkScrim}
        title="Mark Scrim as Not Hosted?"
        description={`Mark "${scrims.find((s) => s.id === selectedScrimId)?.title || selectedScrimId}" as NOT HOSTED? All registered squads will be moved here for refund processing.`}
        confirmLabel="Mark Not Hosted"
        variant="destructive"
        loading={isPending}
        onConfirm={executeMarkScrim}
      />

      <ConfirmDialog
        open={pendingBulkRefund !== null}
        onOpenChange={(open) => !open && setPendingBulkRefund(null)}
        title="Refund All Pending Teams?"
        description={
          pendingBulkRefund
            ? `Refund all ${pendingBulkRefund.pendingCount} pending team(s) for "${pendingBulkRefund.scrimTitle}"? This will trigger automated gateway refunds and send notifications to users.`
            : ""
        }
        confirmLabel="Process Bulk Refund"
        variant="destructive"
        loading={bulkLoadingScrimId !== null}
        onConfirm={executeBulkRefund}
      />
    </div>
  )
}
