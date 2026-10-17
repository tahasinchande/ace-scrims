"use client"

import { useState, useTransition, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import {
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { bdt } from "@/lib/format"
import { createWalletDeposit } from "@/app/actions/wallet"
import { toast } from "sonner"
import type { WalletTransaction } from "@/lib/db/schema"

const PRESETS = [35, 50, 80, 100, 200, 500]

export function WalletView({
  balance: initialBalance,
  transactions,
  userEmail,
}: {
  balance: number
  transactions: WalletTransaction[]
  userEmail: string
}) {
  const searchParams = useSearchParams()
  const statusParam = searchParams.get("status")

  const [balance, setBalance] = useState(initialBalance)
  const [amount, setAmount] = useState<number | string>(100)
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Dispatch wallet balance update event to keep header widget in sync
  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("wallet-balance-updated", { detail: { balance } })
    )
  }, [balance])

  // Show status toasts on redirect back from UddoktaPay
  useEffect(() => {
    if (statusParam === "success") {
      toast.success("Wallet deposit successful! Your balance has been updated.")
      // Re-fetch balance
      fetch("/api/user/balance")
        .then((r) => r.json())
        .then((d) => {
          if (d.ok && typeof d.balance === "number") setBalance(d.balance)
        })
        .catch(() => {})
    } else if (statusParam === "cancelled") {
      toast.info("Wallet deposit was cancelled.")
    } else if (statusParam === "failed") {
      toast.error("Payment failed or was rejected by gateway.")
    }
  }, [statusParam])

  async function handleLoadFunds(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    const num = typeof amount === "string" ? Number.parseInt(amount, 10) : amount

    if (isNaN(num) || num < 10) {
      setErrorMsg("Minimum deposit amount is ৳10.")
      return
    }
    if (num > 25000) {
      setErrorMsg("Maximum single deposit is ৳25,000.")
      return
    }

    startTransition(async () => {
      try {
        const res = await createWalletDeposit(num)
        if (!res.ok || !res.paymentUrl) {
          setErrorMsg(res.error || "Failed to initialize payment gateway.")
          toast.error(res.error || "Failed to initialize payment")
          return
        }
        // Redirect to UddoktaPay
        window.location.href = res.paymentUrl
      } catch (err: any) {
        setErrorMsg(err?.message || "An unexpected error occurred.")
        toast.error("Payment initialization error")
      }
    })
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Page Title */}
      <div>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight">
          Wallet &amp; Account Balance
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Deposit funds securely via UddoktaPay to register for scrims instantly with 1-click booking.
        </p>
      </div>

      {/* Status Alerts */}
      {statusParam === "success" && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-emerald-400">
          <CheckCircle2 className="size-5 shrink-0" />
          <div className="text-sm">
            <p className="font-bold">Funds Successfully Added!</p>
            <p className="text-emerald-300/90 text-xs">
              Your deposit has been verified and added to your balance. You can now use your balance for instant scrim entry.
            </p>
          </div>
        </div>
      )}

      {statusParam === "cancelled" && (
        <div className="flex items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-900/50 p-4 text-zinc-300">
          <AlertCircle className="size-5 shrink-0 text-zinc-400" />
          <p className="text-sm">Payment was cancelled. No funds were deducted from your account.</p>
        </div>
      )}

      {statusParam === "failed" && (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="size-5 shrink-0" />
          <p className="text-sm">Deposit could not be completed. Please try again or reach out to WhatsApp Support.</p>
        </div>
      )}

      {/* Main Grid: Balance Card + Deposit Form */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Live Balance Overview */}
        <div className="glass flex flex-col justify-between rounded-2xl p-6 lg:col-span-5 relative overflow-hidden border border-emerald-500/20">
          <div className="absolute -right-8 -top-8 size-40 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Current Balance
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Active Wallet
              </span>
            </div>

            <div className="mt-4 flex items-baseline gap-2">
              <span className="font-mono text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
                {bdt(balance)}
              </span>
            </div>

            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              When registering for scrims, your entry fee will automatically be deducted from this balance for instantaneous slot confirmation.
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-2 rounded-xl border border-border/60 bg-secondary/30 p-3.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-2 text-foreground font-semibold">
              <Zap className="size-3.5 text-emerald-400" />
              <span>Instant Scrim Registration</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Skip external payment gateway redirects. Having sufficient balance lets you claim hot slots before they fill up.
            </p>
          </div>
        </div>

        {/* Right Column: Top-Up / Add Funds via UddoktaPay */}
        <div className="glass rounded-2xl p-6 lg:col-span-7 border border-border/80">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-lg font-bold uppercase">Load Account Balance</h2>
              <p className="text-xs text-muted-foreground">
                Instant checkout via UddoktaPay (bKash, Nagad, Tap)
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
              <ShieldCheck className="size-4" />
              <span>Official Gateway</span>
            </div>
          </div>

          <form onSubmit={handleLoadFunds} className="flex flex-col gap-5">
            {/* Presets */}
            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground font-semibold">Select Quick Amount</Label>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                {PRESETS.map((p) => {
                  const isSelected = Number(amount) === p
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setAmount(p)}
                      className={`flex h-10 items-center justify-center rounded-lg border font-mono text-xs font-bold transition-all ${
                        isSelected
                          ? "border-primary bg-primary/20 text-primary shadow-sm"
                          : "border-border bg-secondary/40 text-muted-foreground hover:border-zinc-700 hover:text-foreground"
                      }`}
                    >
                      ৳{p}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Custom Amount */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="deposit-amount" className="text-xs text-muted-foreground font-semibold">
                Or Enter Custom Amount (BDT)
              </Label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm font-bold text-muted-foreground">
                  ৳
                </span>
                <Input
                  id="deposit-amount"
                  type="number"
                  min="10"
                  max="25000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 100"
                  className="pl-8 font-mono text-base font-bold bg-background/50"
                  disabled={isPending}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Min deposit: ৳10 · Max single deposit: ৳25,000
              </p>
            </div>

            {errorMsg && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                {errorMsg}
              </div>
            )}

            {/* Supported Payment Providers */}
            <div className="flex items-center justify-between rounded-xl border border-border/40 bg-background/40 px-3.5 py-2.5 text-xs text-muted-foreground">
              <span>Accepted Providers:</span>
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <span className="rounded bg-[#E2136E]/20 px-2 py-0.5 text-[#E2136E] text-[10px] font-bold">bKash</span>
                <span className="rounded bg-[#F7941D]/20 px-2 py-0.5 text-[#F7941D] text-[10px] font-bold">Nagad</span>
                <span className="rounded bg-[#00A19D]/20 px-2 py-0.5 text-[#00A19D] text-[10px] font-bold">Tap</span>
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={isPending}
              className="glow-primary w-full font-display text-sm font-bold uppercase tracking-wider h-11"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Connecting to UddoktaPay...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 size-4" />
                  Load {bdt(Number(amount) || 0)} Now
                </>
              )}
            </Button>
          </form>
        </div>
      </div>

      {/* Transaction History Section */}
      <section aria-labelledby="history-heading" className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 id="history-heading" className="font-display text-xl font-bold uppercase tracking-wide">
            Wallet Transaction History
          </h2>
          <span className="text-xs text-muted-foreground">
            {transactions.length} record{transactions.length === 1 ? "" : "s"}
          </span>
        </div>

        {transactions.length === 0 ? (
          <div className="glass flex flex-col items-center gap-3 rounded-2xl py-12 text-center border border-border/60">
            <Clock className="size-8 text-muted-foreground/60" aria-hidden />
            <p className="font-display font-bold uppercase text-foreground">No Transactions Yet</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Once you load funds or register for scrims using your balance, your wallet transaction statements will appear here.
            </p>
          </div>
        ) : (
          <div className="glass overflow-hidden rounded-2xl border border-border/80 shadow-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border/60 bg-secondary/40 font-display uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Description</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Balance After</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {transactions.map((tx) => {
                    const isDeposit = tx.type === "deposit"
                    return (
                      <tr key={tx.id} className="hover:bg-secondary/20 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              isDeposit
                                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                : "bg-orange-500/15 text-orange-400 border border-orange-500/30"
                            }`}
                          >
                            {isDeposit ? (
                              <ArrowDownLeft className="size-3" />
                            ) : (
                              <ArrowUpRight className="size-3" />
                            )}
                            {isDeposit ? "Deposit" : "Registration"}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-sans font-medium text-foreground max-w-xs truncate">
                          {tx.description || (isDeposit ? "Wallet Deposit" : "Scrim Slot Fee")}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-bold">
                          <span className={isDeposit ? "text-emerald-400" : "text-orange-400"}>
                            {isDeposit ? "+" : "-"}৳{tx.amountBdt}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                          ৳{tx.balanceAfter}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-sans text-muted-foreground">
                          {new Date(tx.createdAt).toLocaleString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-400">
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
