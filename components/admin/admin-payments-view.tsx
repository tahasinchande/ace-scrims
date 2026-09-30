"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { trashPayments } from "@/app/actions/admin"
import { formatTaka, timeAgo } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ExternalLink, Trash2, CheckSquare, Square, Search } from "lucide-react"
import { toast } from "sonner"
import type { Payment } from "@/lib/db/schema"

type PaymentItem = {
  payment: Payment
  teamName: string | null
  scrimTitle: string | null
  userEmail: string | null
}

const statusVariant = (s: string) =>
  s === "completed" ? ("default" as const) : s === "pending" ? ("secondary" as const) : ("destructive" as const)

export function AdminPaymentsView({ payments }: { payments: PaymentItem[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [search, setSearch] = useState("")
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const filtered = payments.filter((p) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (p.teamName && p.teamName.toLowerCase().includes(q)) ||
      (p.userEmail && p.userEmail.toLowerCase().includes(q)) ||
      (p.scrimTitle && p.scrimTitle.toLowerCase().includes(q)) ||
      (p.payment.transactionId && p.payment.transactionId.toLowerCase().includes(q)) ||
      (p.payment.method && p.payment.method.toLowerCase().includes(q))
    )
  })

  const allSelected = filtered.length > 0 && selectedIds.length === filtered.length

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([])
    } else {
      setSelectedIds(filtered.map((p) => p.payment.id))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
  }

  const handleDeleteToTrash = (ids: string[]) => {
    if (ids.length === 0) return
    if (!window.confirm(`Move ${ids.length} payment transaction(s) to Trash?`)) return
    startTransition(async () => {
      const res = await trashPayments(ids)
      if (res.ok) {
        toast.success(`Moved ${res.count} payment(s) to Trash`)
        setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)))
        router.refresh()
      } else {
        toast.error(res.error || "Failed to move payments to trash")
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search team, user, TRX..."
            className="pl-9 text-xs"
          />
        </div>

        {selectedIds.length > 0 && (
          <Button
            size="sm"
            variant="destructive"
            disabled={isPending}
            onClick={() => handleDeleteToTrash(selectedIds)}
            className="h-8 gap-1.5 text-xs"
          >
            <Trash2 className="size-3.5" /> Move Selected to Trash ({selectedIds.length})
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center text-sm text-muted-foreground">
          {payments.length === 0 ? "No payments yet." : "No payments match your search."}
        </div>
      ) : (
        <div className="glass overflow-x-auto rounded-2xl border border-border/60">
          <table className="w-full min-w-[700px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="w-10 px-4 py-3">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="p-1 text-muted-foreground hover:text-foreground"
                    title={allSelected ? "Deselect all" : "Select all"}
                  >
                    {allSelected ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4" />}
                  </button>
                </th>
                <th className="px-4 py-3 font-medium">Team / Scrim</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium">Transaction ID</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ payment, teamName, scrimTitle, userEmail }) => {
                const isSelected = selectedIds.includes(payment.id)
                return (
                  <tr
                    key={payment.id}
                    className={`border-b border-border/50 last:border-0 transition-colors ${
                      isSelected ? "bg-primary/5" : "hover:bg-card/50"
                    }`}
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggleSelect(payment.id)}
                        className="p-1 text-muted-foreground hover:text-foreground"
                      >
                        {isSelected ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4" />}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{teamName ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{scrimTitle ?? "Deleted scrim"}</p>
                    </td>
                    <td className="max-w-40 truncate px-4 py-3 text-muted-foreground">{userEmail}</td>
                    <td className="px-4 py-3 font-display font-bold text-foreground">
                      {formatTaka(payment.amountBdt)}
                    </td>
                    <td className="px-4 py-3 capitalize text-muted-foreground">{payment.method ?? "—"}</td>
                    <td className="max-w-36 truncate px-4 py-3 font-mono text-xs text-muted-foreground">
                      {payment.transactionId ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant(payment.status)} className="capitalize">
                        {payment.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{timeAgo(payment.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isPending}
                        onClick={() => handleDeleteToTrash([payment.id])}
                        title="Move to Trash"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
