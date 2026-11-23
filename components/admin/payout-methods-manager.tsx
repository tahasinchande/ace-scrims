"use client"

import { useState, useTransition } from "react"
import type { PayoutMethod } from "@/lib/db/schema"
import {
  createPayoutMethodAction,
  updatePayoutMethodAction,
  togglePayoutMethodActiveAction,
  deletePayoutMethodAction,
} from "@/app/actions/payout-methods"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { Wallet, Plus, Pencil, Trash2, Check, X, Loader2, Power } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type DraftMethod = {
  name: string
  code: string
  label: string
  description: string
  accentColor: string
  requiresAccountNumber: boolean
  isActive: boolean
  sortOrder: number
}

const emptyDraft: DraftMethod = {
  name: "",
  code: "",
  label: "",
  description: "",
  accentColor: "#7c3aed",
  requiresAccountNumber: true,
  isActive: true,
  sortOrder: 10,
}

export function PayoutMethodsManager({ initialMethods }: { initialMethods: PayoutMethod[] }) {
  const [methods, setMethods] = useState<PayoutMethod[]>(initialMethods)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [draft, setDraft] = useState<DraftMethod>(emptyDraft)
  const [deleteTarget, setDeleteTarget] = useState<PayoutMethod | null>(null)
  const [isPending, startTransition] = useTransition()

  function startEdit(method: PayoutMethod) {
    setShowCreateForm(false)
    setEditingId(method.id)
    setDraft({
      name: method.name,
      code: method.code,
      label: method.label,
      description: method.description || "",
      accentColor: method.accentColor || "#7c3aed",
      requiresAccountNumber: method.requiresAccountNumber,
      isActive: method.isActive,
      sortOrder: method.sortOrder,
    })
  }

  function startCreate() {
    setEditingId(null)
    setDraft({
      ...emptyDraft,
      sortOrder: methods.length + 1,
    })
    setShowCreateForm(true)
  }

  function cancelForm() {
    setEditingId(null)
    setShowCreateForm(false)
    setDraft(emptyDraft)
  }

  function handleSaveCreate(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await createPayoutMethodAction(draft)
      if (!res.ok || !res.method) {
        toast.error(res.error || "Could not create payout method.")
        return
      }
      setMethods((prev) => [...prev, res.method!].sort((a, b) => a.sortOrder - b.sortOrder))
      toast.success(`Added payout method "${res.method.name}".`)
      cancelForm()
    })
  }

  function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editingId) return
    startTransition(async () => {
      const res = await updatePayoutMethodAction(editingId, draft)
      if (!res.ok || !res.method) {
        toast.error(res.error || "Could not update payout method.")
        return
      }
      setMethods((prev) =>
        prev
          .map((m) => (m.id === editingId ? res.method! : m))
          .sort((a, b) => a.sortOrder - b.sortOrder)
      )
      toast.success(`Updated payout method "${res.method.name}".`)
      cancelForm()
    })
  }

  function handleToggleActive(method: PayoutMethod) {
    startTransition(async () => {
      const res = await togglePayoutMethodActiveAction(method.id, !method.isActive)
      if (!res.ok || !res.method) {
        toast.error(res.error || "Failed to toggle method status.")
        return
      }
      setMethods((prev) => prev.map((m) => (m.id === method.id ? res.method! : m)))
      toast.success(`${res.method.name} is now ${res.method.isActive ? "Active" : "Disabled"}.`)
    })
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)
    startTransition(async () => {
      const res = await deletePayoutMethodAction(target.id)
      if (!res.ok) {
        toast.error(res.error || "Could not delete payout method.")
        return
      }
      setMethods((prev) => prev.filter((m) => m.id !== target.id))
      toast.success(`Removed "${target.name}" from payout methods.`)
    })
  }

  return (
    <section className="glass rounded-2xl border border-border/80 p-6 flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary border border-primary/30">
            <Wallet className="size-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold uppercase tracking-wide">
              Prize Pool Payout Methods
            </h2>
            <p className="text-xs text-muted-foreground">
              Manage payment providers shown in Info Setup and Scrim Registration forms ({methods.filter((m) => m.isActive).length} active).
            </p>
          </div>
        </div>

        {!showCreateForm && (
          <Button
            type="button"
            size="sm"
            onClick={startCreate}
            className="whitespace-nowrap gap-1.5 font-display font-bold uppercase tracking-wide"
          >
            <Plus className="size-4" />
            Add Payout Method
          </Button>
        )}
      </div>

      {/* Create or Edit Form */}
      {(showCreateForm || editingId) && (
        <form
          onSubmit={editingId ? handleSaveEdit : handleSaveCreate}
          className="rounded-xl border border-primary/40 bg-primary/[0.04] p-4 flex flex-col gap-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-bold uppercase tracking-wider text-primary">
              {editingId ? "Edit Payout Method" : "Add New Payout Method"}
            </h3>
            <Button type="button" variant="ghost" size="sm" onClick={cancelForm} className="h-7 px-2">
              <X className="size-4" />
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pm-name" className="text-xs font-semibold">
                Method Name *
              </Label>
              <Input
                id="pm-name"
                value={draft.name}
                onChange={(e) => {
                  const val = e.target.value
                  setDraft((prev) => ({
                    ...prev,
                    name: val,
                    code: editingId ? prev.code : val.replace(/[^a-zA-Z0-9_-]/g, ""),
                    label: prev.label || `${val} Personal`,
                  }))
                }}
                placeholder="e.g. Rocket"
                required
                className="bg-background/70"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pm-code" className="text-xs font-semibold">
                System Code *
              </Label>
              <Input
                id="pm-code"
                value={draft.code}
                onChange={(e) => setDraft((prev) => ({ ...prev, code: e.target.value }))}
                placeholder="e.g. Rocket"
                required
                className="bg-background/70 font-mono"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pm-label" className="text-xs font-semibold">
                Display Label *
              </Label>
              <Input
                id="pm-label"
                value={draft.label}
                onChange={(e) => setDraft((prev) => ({ ...prev, label: e.target.value }))}
                placeholder="e.g. Rocket Personal"
                required
                className="bg-background/70"
              />
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="pm-desc" className="text-xs font-semibold">
                Description
              </Label>
              <Input
                id="pm-desc"
                value={draft.description}
                onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Short helper text for players"
                className="bg-background/70"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pm-color" className="text-xs font-semibold">
                  Accent Color
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    id="pm-color"
                    type="color"
                    value={draft.accentColor}
                    onChange={(e) => setDraft((prev) => ({ ...prev, accentColor: e.target.value }))}
                    className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent p-0.5"
                  />
                  <Input
                    value={draft.accentColor}
                    onChange={(e) => setDraft((prev) => ({ ...prev, accentColor: e.target.value }))}
                    className="bg-background/70 font-mono text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pm-order" className="text-xs font-semibold">
                  Sort Order
                </Label>
                <Input
                  id="pm-order"
                  type="number"
                  min={0}
                  max={999}
                  value={draft.sortOrder}
                  onChange={(e) => setDraft((prev) => ({ ...prev, sortOrder: Number(e.target.value) || 0 }))}
                  className="bg-background/70 font-mono"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border/50 pt-3">
            <div className="flex flex-wrap items-center gap-5 text-xs">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={draft.requiresAccountNumber}
                  onChange={(e) =>
                    setDraft((prev) => ({ ...prev, requiresAccountNumber: e.target.checked }))
                  }
                  className="size-4 accent-primary rounded"
                />
                <span>Requires Wallet/Account Number input</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={draft.isActive}
                  onChange={(e) => setDraft((prev) => ({ ...prev, isActive: e.target.checked }))}
                  className="size-4 accent-primary rounded"
                />
                <span>Active (Visible to Players)</span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={cancelForm} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isPending} className="gap-1.5 whitespace-nowrap">
                {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                {editingId ? "Save Changes" : "Create Method"}
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* Existing Methods List */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {methods.map((method) => (
          <div
            key={method.id}
            className={cn(
              "dc-surface rushx-box-splash rounded-xl p-4 flex items-start justify-between gap-3 transition-colors",
              method.isActive
                ? ""
                : "opacity-65"
            )}
          >
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span
                  className="size-3 rounded-full shrink-0 border border-white/20"
                  style={{ backgroundColor: method.accentColor || "#7c3aed" }}
                />
                <span className="font-display text-base font-bold uppercase tracking-wide truncate">
                  {method.name}
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  ({method.code})
                </span>
              </div>
              <p className="text-xs font-medium text-foreground/90">{method.label}</p>
              {method.description && (
                <p className="text-[11px] text-muted-foreground line-clamp-2">{method.description}</p>
              )}
              <p className="text-[11px] text-muted-foreground pt-1">
                <span className={method.isActive ? "text-emerald-400 font-semibold" : "text-rose-400 font-semibold"}>
                  {method.isActive ? "Active" : "Disabled"}
                </span>
                {" · "}
                {method.requiresAccountNumber ? "Requires account number" : "Auto wallet credit"}
                {" · "}
                Order #{method.sortOrder}
              </p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={isPending}
                onClick={() => handleToggleActive(method)}
                title={method.isActive ? "Disable method" : "Enable method"}
                className={cn(
                  "h-8 w-8 p-0",
                  method.isActive ? "text-emerald-400 hover:text-emerald-300" : "text-muted-foreground"
                )}
              >
                <Power className="size-4" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={isPending}
                onClick={() => startEdit(method)}
                title="Edit payout method"
                className="h-8 w-8 p-0"
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={isPending}
                onClick={() => setDeleteTarget(method)}
                title="Delete payout method"
                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Remove Payout Method?"
        description={`Remove "${deleteTarget?.name}" (${deleteTarget?.code}) from the selectable payout methods? Existing historical bookings will retain their stored method name.`}
        confirmLabel="Remove Method"
        variant="destructive"
        loading={isPending}
        onConfirm={handleConfirmDelete}
      />
    </section>
  )
}
