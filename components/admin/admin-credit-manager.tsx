"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { adjustUserCreditsAction } from "@/app/actions/admin"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { formatDate } from "@/lib/format"
import { resolveImageUrl } from "@/lib/image-url"
import {
  Coins,
  Search,
  PlusCircle,
  MinusCircle,
  Sliders,
  Wallet,
  Users,
  TrendingUp,
  History,
  Ban,
  AlertCircle,
  Loader2,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react"
import { toast } from "sonner"

export type CreditUser = {
  id: string
  name: string
  email: string
  image?: string | null
  role: string
  balance: number
  banned: boolean
  emailVerified: boolean
  createdAt: Date
}

export type CreditStats = {
  totalCredits: number
  usersWithCredits: number
  totalUsers: number
  highestBalance: number
  totalAdjustments: number
}

export type CreditTransaction = {
  id: string
  userId: string
  type: string
  amountBdt: number
  balanceBefore: number
  balanceAfter: number
  description: string | null
  referenceId: string | null
  status: string
  createdAt: Date
  userName: string | null
  userEmail: string | null
}

function getUserInitials(name: string): string {
  if (!name || !name.trim()) return "U"
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function AdminCreditManager({
  users: initialUsers = [],
  stats: initialStats = {
    totalCredits: 0,
    usersWithCredits: 0,
    totalUsers: 0,
    highestBalance: 0,
    totalAdjustments: 0,
  },
  recentTransactions: initialTransactions = [],
}: {
  users?: CreditUser[]
  stats?: CreditStats
  recentTransactions?: CreditTransaction[]
}) {
  const router = useRouter()
  const [users, setUsers] = useState<CreditUser[]>(initialUsers)
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "positive" | "zero" | "admin">("all")
  const [activeTab, setActiveTab] = useState<"users" | "transactions">("users")
  
  // Modal state
  const [selectedUser, setSelectedUser] = useState<CreditUser | null>(null)
  const [actionType, setActionType] = useState<"add" | "deduct" | "set">("add")
  const [amountInput, setAmountInput] = useState<string>("")
  const [reasonInput, setReasonInput] = useState<string>("")
  const [modalOpen, setModalOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Filtered users
  const filteredUsers = users.filter((u) => {
    const matchesQuery =
      u.name.toLowerCase().includes(query.toLowerCase()) ||
      u.email.toLowerCase().includes(query.toLowerCase()) ||
      u.id.toLowerCase().includes(query.toLowerCase())

    if (!matchesQuery) return false

    if (statusFilter === "positive") return u.balance > 0
    if (statusFilter === "zero") return u.balance === 0
    if (statusFilter === "admin") return u.role === "owner" || u.role === "admin" || u.role === "moderator"
    return true
  })

  function handleOpenModal(user: CreditUser, type: "add" | "deduct" | "set" = "add") {
    setSelectedUser(user)
    setActionType(type)
    setAmountInput("")
    setReasonInput("")
    setModalOpen(true)
  }

  const parsedAmount = Number.parseInt(amountInput, 10) || 0
  const currentBal = selectedUser?.balance ?? 0

  let projectedBalance = currentBal
  let projectedDiff = 0
  let isDeductExceeded = false

  if (actionType === "add") {
    projectedBalance = currentBal + parsedAmount
    projectedDiff = parsedAmount
  } else if (actionType === "deduct") {
    projectedBalance = currentBal - parsedAmount
    projectedDiff = -parsedAmount
    if (parsedAmount > currentBal) {
      isDeductExceeded = true
    }
  } else if (actionType === "set") {
    projectedBalance = parsedAmount
    projectedDiff = parsedAmount - currentBal
  }

  function handlePreset(val: number) {
    setAmountInput(String(val))
  }

  function handleSubmitAdjustment(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedUser) return

    if ((actionType === "add" || actionType === "deduct") && parsedAmount <= 0) {
      toast.error("Please enter an amount greater than 0.")
      return
    }

    if (actionType === "set" && parsedAmount < 0) {
      toast.error("Balance cannot be set to a negative number.")
      return
    }

    if (actionType === "deduct" && isDeductExceeded) {
      toast.error(`Cannot deduct ৳${parsedAmount}. User only has ৳${currentBal}.`)
      return
    }

    if (!reasonInput.trim()) {
      toast.error("Please provide a reason or note for this balance adjustment.")
      return
    }

    startTransition(async () => {
      const res = await adjustUserCreditsAction({
        userId: selectedUser.id,
        actionType,
        amount: parsedAmount,
        reason: reasonInput.trim(),
      })

      if (res.ok && res.data) {
        toast.success(res.data.message || "Balance updated successfully!")
        setUsers((prev) =>
          prev.map((u) =>
            u.id === selectedUser.id
              ? { ...u, balance: res.data!.newBalance }
              : u
          )
        )
        setModalOpen(false)
        router.refresh()
      } else {
        toast.error(res.error || "Failed to update balance.")
      }
    })
  }

  function handleManualRefresh() {
    setIsRefreshing(true)
    startTransition(() => {
      router.refresh()
      setTimeout(() => setIsRefreshing(false), 600)
    })
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide flex items-center gap-2.5">
            <Coins className="size-6 text-primary" />
            Credit Management
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            View all player credit balances, disburse winnings, deposit funds, or adjust user wallet balances.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
        <div className="dc-surface dc-metric-cell flex flex-col gap-1 rounded-xl p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Circulating Credits</span>
            <Wallet className="size-4 text-emerald-400" />
          </div>
          <p className="font-display text-2xl font-bold text-emerald-400">
            ৳{initialStats.totalCredits.toLocaleString()}
          </p>
          <span className="text-[11px] text-muted-foreground">Across all active player wallets</span>
        </div>

        <div className="dc-surface dc-metric-cell flex flex-col gap-1 rounded-xl p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Credit Holders</span>
            <Users className="size-4 text-primary" />
          </div>
          <p className="font-display text-2xl font-bold text-foreground">
            {initialStats.usersWithCredits}
          </p>
          <span className="text-[11px] text-muted-foreground">Users with balance &gt; ৳0</span>
        </div>

        <div className="dc-surface dc-metric-cell flex flex-col gap-1 rounded-xl p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Highest Balance</span>
            <TrendingUp className="size-4 text-amber-400" />
          </div>
          <p className="font-display text-2xl font-bold text-amber-400">
            ৳{initialStats.highestBalance.toLocaleString()}
          </p>
          <span className="text-[11px] text-muted-foreground">Top individual user credit</span>
        </div>

        <div className="dc-surface dc-metric-cell flex flex-col gap-1 rounded-xl p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Manual Adjustments</span>
            <History className="size-4 text-sky-400" />
          </div>
          <p className="font-display text-2xl font-bold text-sky-400">
            {initialStats.totalAdjustments}
          </p>
          <span className="text-[11px] text-muted-foreground">Admin balance modifications logged</span>
        </div>
      </div>

      {/* View Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("users")}
          className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === "users"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          }`}
        >
          <Users className="size-4" />
          Registered Users ({users.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("transactions")}
          className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-bold transition-all cursor-pointer ${
            activeTab === "transactions"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          }`}
        >
          <History className="size-4" />
          Recent Credit Logs ({initialTransactions.length})
        </button>
      </div>

      {activeTab === "users" ? (
        <div className="space-y-4">
          {/* Search & Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by user name, email, or user ID..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 bg-secondary/50 border-border"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant={statusFilter === "all" ? "default" : "secondary"}
                size="sm"
                onClick={() => setStatusFilter("all")}
                className="text-xs"
              >
                All ({users.length})
              </Button>
              <Button
                variant={statusFilter === "positive" ? "default" : "secondary"}
                size="sm"
                onClick={() => setStatusFilter("positive")}
                className="text-xs"
              >
                Has Balance ({users.filter((u) => u.balance > 0).length})
              </Button>
              <Button
                variant={statusFilter === "zero" ? "default" : "secondary"}
                size="sm"
                onClick={() => setStatusFilter("zero")}
                className="text-xs"
              >
                Zero Balance ({users.filter((u) => u.balance === 0).length})
              </Button>
              <Button
                variant={statusFilter === "admin" ? "default" : "secondary"}
                size="sm"
                onClick={() => setStatusFilter("admin")}
                className="text-xs"
              >
                Staff ({users.filter((u) => u.role !== "user").length})
              </Button>
            </div>
          </div>

          {/* Users Table */}
          <div className="dc-surface rushx-box-splash overflow-hidden rounded-2xl">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-border bg-secondary/40 text-xs font-semibold uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Player Account</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Status / Role</th>
                    <th className="px-4 py-3 text-right">Current Credits</th>
                    <th className="px-4 py-3 text-right">Manage Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-muted-foreground">
                        No users match the search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const imageSrc = resolveImageUrl(u.image)
                      const isPositive = u.balance > 0

                      return (
                        <tr key={u.id} className="transition-colors hover:bg-secondary/30">
                          {/* Player Account */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              {imageSrc ? (
                                <img
                                  src={imageSrc}
                                  alt={u.name}
                                  className="size-9 rounded-full object-cover border border-border/80"
                                />
                              ) : (
                                <div className="flex size-9 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                                  {getUserInitials(u.name)}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="font-semibold text-foreground truncate">{u.name}</p>
                                <p className="text-[11px] font-mono text-muted-foreground truncate">
                                  ID: {u.id}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Email */}
                          <td className="px-4 py-3.5">
                            <div className="flex flex-col">
                              <span className="text-foreground font-medium">{u.email}</span>
                              <span className="text-[11px] text-muted-foreground">
                                Joined {formatDate(u.createdAt)}
                              </span>
                            </div>
                          </td>

                          {/* Status / Role */}
                          <td className="px-4 py-3.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {u.banned ? (
                                <Badge variant="destructive" className="gap-1 text-[11px]">
                                  <Ban className="size-3" /> Banned
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[11px] border-emerald-500/40 text-emerald-400 bg-emerald-950/20">
                                  Active
                                </Badge>
                              )}

                              {u.role === "owner" && (
                                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[11px]">
                                  Owner
                                </Badge>
                              )}
                              {u.role === "admin" && (
                                <Badge className="bg-primary/20 text-primary border-primary/40 text-[11px]">
                                  Admin
                                </Badge>
                              )}
                              {u.role === "moderator" && (
                                <Badge className="bg-sky-500/20 text-sky-400 border-sky-500/40 text-[11px]">
                                  Moderator
                                </Badge>
                              )}
                            </div>
                          </td>

                          {/* Balance */}
                          <td className="px-4 py-3.5 text-right font-mono">
                            <span
                              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-sm font-bold ${
                                isPositive
                                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                  : "text-muted-foreground bg-secondary/50"
                              }`}
                            >
                              ৳{u.balance.toLocaleString()}
                            </span>
                          </td>

                          {/* Action Buttons */}
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenModal(u, "add")}
                                className="h-8 gap-1 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 text-xs font-semibold"
                                title="Add Credits"
                              >
                                <PlusCircle className="size-3.5" />
                                Add
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenModal(u, "deduct")}
                                disabled={u.balance <= 0}
                                className="h-8 gap-1 border-rose-500/40 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 text-xs font-semibold disabled:opacity-40"
                                title="Deduct Credits"
                              >
                                <MinusCircle className="size-3.5" />
                                Deduct
                              </Button>

                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleOpenModal(u, "set")}
                                className="h-8 gap-1 text-xs font-semibold"
                                title="Set Exact Balance"
                              >
                                <Sliders className="size-3.5" />
                                Set
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Recent Credit Audit Logs */
        <div className="space-y-4">
          <div className="dc-surface rushx-box-splash overflow-hidden rounded-2xl">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="border-b border-border bg-secondary/40 text-xs font-semibold uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3 text-right">Adjustment</th>
                    <th className="px-4 py-3 text-right">Balance (Before → After)</th>
                    <th className="px-4 py-3">Reason / Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {initialTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-muted-foreground">
                        No credit transaction records found yet.
                      </td>
                    </tr>
                  ) : (
                    initialTransactions.map((tx) => {
                      const isPositive = tx.balanceAfter >= tx.balanceBefore
                      const diff = tx.balanceAfter - tx.balanceBefore

                      return (
                        <tr key={tx.id} className="transition-colors hover:bg-secondary/30">
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                            {formatDate(tx.createdAt)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="min-w-0">
                              <p className="font-semibold text-foreground text-xs truncate">
                                {tx.userName || "Player"}
                              </p>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {tx.userEmail}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="outline"
                              className={`text-[10px] uppercase font-bold ${
                                tx.type === "adjustment"
                                  ? "border-sky-500/40 text-sky-400 bg-sky-950/20"
                                  : tx.type === "deposit"
                                  ? "border-emerald-500/40 text-emerald-400 bg-emerald-950/20"
                                  : "border-border text-muted-foreground"
                              }`}
                            >
                              {tx.type}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-xs whitespace-nowrap">
                            {isPositive ? (
                              <span className="text-emerald-400 inline-flex items-center gap-0.5">
                                <ArrowUpRight className="size-3" />
                                +৳{Math.abs(diff || tx.amountBdt).toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-rose-400 inline-flex items-center gap-0.5">
                                <ArrowDownLeft className="size-3" />
                                -৳{Math.abs(diff || tx.amountBdt).toLocaleString()}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground whitespace-nowrap">
                            ৳{tx.balanceBefore.toLocaleString()} → <strong className="text-foreground">৳{tx.balanceAfter.toLocaleString()}</strong>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs truncate" title={tx.description || ""}>
                            {tx.description || "N/A"}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Credit Modification Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold font-display uppercase tracking-wide">
              <Coins className="size-5 text-primary" />
              Adjust Player Credits
            </DialogTitle>
            <DialogDescription>
              Modify wallet balance for this registered user with real-time audit logging.
            </DialogDescription>
          </DialogHeader>

          {selectedUser && (
            <form onSubmit={handleSubmitAdjustment} className="space-y-5 pt-2">
              {/* User Profile Card */}
              <div className="flex items-center justify-between rounded-xl border border-border/80 bg-secondary/40 p-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                    {getUserInitials(selectedUser.name)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-foreground truncate">{selectedUser.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{selectedUser.email}</p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">
                    Current Balance
                  </span>
                  <span className="font-mono text-base font-extrabold text-emerald-400">
                    ৳{currentBal.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Action Type Tabs */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Operation Type
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setActionType("add")}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 px-3 text-xs font-bold uppercase transition-all ${
                      actionType === "add"
                        ? "border-emerald-500 bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500"
                        : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                    }`}
                  >
                    <PlusCircle className="size-3.5" />
                    Add Credits
                  </button>

                  <button
                    type="button"
                    onClick={() => setActionType("deduct")}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 px-3 text-xs font-bold uppercase transition-all ${
                      actionType === "deduct"
                        ? "border-rose-500 bg-rose-500/20 text-rose-400 ring-1 ring-rose-500"
                        : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                    }`}
                  >
                    <MinusCircle className="size-3.5" />
                    Deduct
                  </button>

                  <button
                    type="button"
                    onClick={() => setActionType("set")}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 px-3 text-xs font-bold uppercase transition-all ${
                      actionType === "set"
                        ? "border-primary bg-primary/20 text-primary ring-1 ring-primary"
                        : "border-border bg-secondary/40 text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                    }`}
                  >
                    <Sliders className="size-3.5" />
                    Set Exact
                  </button>
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-2">
                <Label htmlFor="credit-amount" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {actionType === "add" && "Amount to Credit (BDT ৳)"}
                  {actionType === "deduct" && "Amount to Deduct (BDT ৳)"}
                  {actionType === "set" && "Target Balance (BDT ৳)"}
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                    ৳
                  </span>
                  <Input
                    id="credit-amount"
                    type="number"
                    min="0"
                    placeholder="e.g. 50"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    className="pl-8 font-mono text-base font-bold bg-background"
                    required
                  />
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] font-semibold text-muted-foreground mr-1">Presets:</span>
                  {actionType === "add" &&
                    [35, 50, 100, 200, 330, 500, 1000].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handlePreset(val)}
                        className="rounded-md border border-border/80 bg-secondary/50 px-2 py-0.5 text-xs font-mono font-medium hover:border-primary hover:text-primary transition-colors"
                      >
                        +৳{val}
                      </button>
                    ))}

                  {actionType === "deduct" &&
                    [35, 50, 100, 200].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handlePreset(val)}
                        className="rounded-md border border-border/80 bg-secondary/50 px-2 py-0.5 text-xs font-mono font-medium hover:border-rose-400 hover:text-rose-400 transition-colors"
                      >
                        -৳{val}
                      </button>
                    ))}

                  {actionType === "set" &&
                    [0, 35, 50, 100, 200, 500].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => handlePreset(val)}
                        className="rounded-md border border-border/80 bg-secondary/50 px-2 py-0.5 text-xs font-mono font-medium hover:border-primary hover:text-primary transition-colors"
                      >
                        ৳{val}
                      </button>
                    ))}
                </div>
              </div>

              {/* Projected Balance Calculation Preview */}
              <div
                className={`rounded-xl border p-3 text-xs ${
                  isDeductExceeded
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : "border-border/80 bg-secondary/30 text-foreground"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-muted-foreground">Projected Balance:</span>
                  <div className="flex items-center gap-1.5 font-mono font-bold text-sm">
                    <span className="text-muted-foreground line-through">৳{currentBal}</span>
                    <span>→</span>
                    <span className={projectedDiff >= 0 ? "text-emerald-400" : "text-rose-400"}>
                      ৳{projectedBalance}
                    </span>
                    <span className="text-xs text-muted-foreground font-normal">
                      ({projectedDiff >= 0 ? `+৳${projectedDiff}` : `-৳${Math.abs(projectedDiff)}`})
                    </span>
                  </div>
                </div>

                {isDeductExceeded && (
                  <p className="mt-2 text-xs font-medium text-destructive flex items-center gap-1">
                    <AlertCircle className="size-3.5 shrink-0" />
                    Cannot deduct more than current balance (৳{currentBal}).
                  </p>
                )}
              </div>

              {/* Reason / Audit Note */}
              <div className="space-y-1.5">
                <Label htmlFor="credit-reason" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Reason / Audit Note <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="credit-reason"
                  placeholder="e.g. Scrim prize payout, Promotional grant, Manual correction..."
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  className="bg-background text-sm"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  This note will be logged in the permanent audit logs and sent to the player&apos;s notification feed.
                </p>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setModalOpen(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isPending || isDeductExceeded || !reasonInput.trim()}
                  className={`font-display font-bold uppercase ${
                    actionType === "deduct"
                      ? "bg-rose-600 hover:bg-rose-500 text-white"
                      : "glow-primary"
                  }`}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Updating Balance...
                    </>
                  ) : (
                    <>
                      Confirm {actionType.toUpperCase()} (৳{parsedAmount})
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
