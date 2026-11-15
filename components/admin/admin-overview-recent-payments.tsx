"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { trashPayments } from "@/app/actions/admin"
import { formatTaka, timeAgo } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Trash2, CheckSquare, Square, ArrowRight } from "lucide-react"
import { toast } from "sonner"
import type { Payment } from "@/lib/db/schema"

type RecentPaymentItem = {
  payment: Payment
  teamName: string | null
  scrimTitle: string | null
  userEmail: string | null
}

export function AdminOverviewRecentPayments({ payments }: { payments: RecentPaymentItem[] }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null)

  const allSelected = payments.length > 0 && selectedIds.length === payments.length

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([])
    } else {
      setSelectedIds(payments.map((p) => p.payment.id))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
  }

  const handleDeleteToTrash = (ids: string[]) => {
    if (ids.length === 0) return
    setPendingDeleteIds(ids)
  }

  const executeDeleteToTrash = () => {
    if (!pendingDeleteIds || pendingDeleteIds.length === 0) return
    const ids = pendingDeleteIds
    setPendingDeleteIds(null)
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
    <section className="glass rounded-2xl p-5 border border-border/60">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-lg font-bold uppercase tracking-wide">Recent Payments</h2>
          {payments.length > 0 && (
            <button
              type="button"
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {allSelected ? <CheckSquare className="size-3.5 text-primary" /> : <Square className="size-3.5" />}
              <span>{selectedIds.length > 0 ? `${selectedIds.length} selected` : "Select all"}</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <Button
              size="sm"
              variant="destructive"
              disabled={isPending}
              onClick={() => handleDeleteToTrash(selectedIds)}
              className="h-8 gap-1.5 text-xs"
            >
              <Trash2 className="size-3.5" /> Move to Trash ({selectedIds.length})
            </Button>
          )}
          <Button asChild variant="ghost" size="sm" className="h-8 gap-1 text-xs text-muted-foreground hover:text-foreground">
            <Link href="/admin/payments">
              View All <ArrowRight className="size-3" />
            </Link>
          </Button>
        </div>
      </div>

      {payments.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No payments yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border/50">
          {payments.map(({ payment, teamName, scrimTitle, userEmail }) => {
            const isSelected = selectedIds.includes(payment.id)
            return (
              <li
                key={payment.id}
                className={`flex flex-wrap items-center gap-3 py-3 text-sm transition-colors rounded-lg px-2 ${
                  isSelected ? "bg-primary/5" : "hover:bg-card/40"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleSelect(payment.id)}
                  className="p-1 text-muted-foreground hover:text-foreground"
                >
                  {isSelected ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4" />}
                </button>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {teamName ?? "—"}{" "}
                    <span className="text-muted-foreground">· {scrimTitle ?? "Deleted scrim"}</span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
                </div>

                <span className="font-display font-bold text-foreground">{formatTaka(payment.amountBdt)}</span>
                <Badge
                  variant={payment.status === "completed" ? "default" : "secondary"}
                  className="capitalize text-xs"
                >
                  {payment.status}
                </Badge>
                <span className="text-xs text-muted-foreground">{timeAgo(payment.createdAt)}</span>

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
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDeleteIds !== null}
        onOpenChange={(open) => !open && setPendingDeleteIds(null)}
        title="Move Payment Records to Trash?"
        description={`Move ${pendingDeleteIds?.length ?? 0} payment transaction(s) to Trash?`}
        confirmLabel="Move to Trash"
        variant="destructive"
        loading={isPending}
        onConfirm={executeDeleteToTrash}
      />
    </section>
  )
}
