"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Wallet, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSession } from "@/lib/auth-client"

export function UserBalanceWidget({
  initialBalance,
  isGuest = false,
  className,
  compact = false,
}: {
  initialBalance?: number
  isGuest?: boolean
  className?: string
  compact?: boolean
}) {
  const { data: session } = useSession()
  const [balance, setBalance] = useState<number>(initialBalance ?? 0)
  const [loaded, setLoaded] = useState<boolean>(initialBalance !== undefined)

  useEffect(() => {
    let active = true

    async function fetchBalance() {
      try {
        const res = await fetch("/api/user/balance", { cache: "no-store" })
        if (res.ok) {
          const data = await res.json()
          if (active && data.ok && typeof data.balance === "number") {
            setBalance(data.balance)
            setLoaded(true)
          }
        }
      } catch {
        // Silently fail if not authenticated
      }
    }

    if (session?.user || !isGuest) {
      fetchBalance()
    }

    function onBalanceUpdate(e: any) {
      if (typeof e.detail?.balance === "number") {
        setBalance(e.detail.balance)
      } else {
        fetchBalance()
      }
    }

    window.addEventListener("wallet-balance-updated", onBalanceUpdate)
    window.addEventListener("focus", fetchBalance)

    return () => {
      active = false
      window.removeEventListener("wallet-balance-updated", onBalanceUpdate)
      window.removeEventListener("focus", fetchBalance)
    }
  }, [session?.user, isGuest])

  const targetHref = session?.user ? "/dashboard/wallet" : "/sign-in?next=/dashboard/wallet"

  if (compact) {
    return (
      <Link
        href={targetHref}
        title="Account Balance — Click to load or view wallet"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-2.5 py-1 text-xs font-semibold text-emerald-400 hover:border-emerald-500/60 hover:bg-emerald-900/30 transition-all",
          className
        )}
      >
        <Wallet className="size-3.5 text-emerald-400 shrink-0" />
        <span className="font-mono font-bold">৳{balance}</span>
      </Link>
    )
  }

  return (
    <Link
      href={targetHref}
      title="RushX Wallet — Click to manage funds & load balance"
      className={cn(
        "rushx-btn-splash group relative inline-flex h-9 items-center gap-2 rounded-xl border border-emerald-400/30 bg-[#0d1428]/85 px-3 py-1 text-xs backdrop-blur-md transition-all hover:border-emerald-400/60 hover:bg-emerald-500/12 hover:shadow-sm hover:shadow-emerald-500/15",
        className
      )}
    >
      <Wallet className="size-3.5 text-emerald-400 shrink-0" />

      <div className="flex flex-col items-start leading-tight">
        <span className="text-[9px] font-medium uppercase tracking-wider text-slate-400 group-hover:text-slate-300">
          Balance
        </span>
        <span className="font-mono text-xs font-bold text-emerald-400 group-hover:text-emerald-300 tabular-nums">
          ৳{loaded ? balance : "..."}
        </span>
      </div>

      <Plus className="ml-0.5 size-3.5 text-emerald-400/80 transition-transform group-hover:scale-110 group-hover:text-emerald-300" />
    </Link>
  )
}
