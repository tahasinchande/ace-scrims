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
      title="Ace Scrims Wallet — Click to manage funds & load balance"
      className={cn(
        "group relative inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-500/30 bg-zinc-900/90 px-3 py-1 text-xs transition-all hover:border-emerald-500/60 hover:bg-zinc-850 hover:shadow-sm hover:shadow-emerald-500/10",
        className
      )}
    >
      <div className="flex size-5 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-400 group-hover:bg-emerald-500/25 transition-colors">
        <Wallet className="size-3.5" />
      </div>

      <div className="flex flex-col items-start leading-tight">
        <span className="text-[9px] font-medium uppercase tracking-wider text-zinc-400 group-hover:text-zinc-300">
          Balance
        </span>
        <span className="font-mono text-xs font-bold text-emerald-400 group-hover:text-emerald-300">
          ৳{loaded ? balance : "..."}
        </span>
      </div>

      <div className="ml-1 flex items-center justify-center rounded bg-emerald-500/10 p-0.5 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-black transition-colors">
        <Plus className="size-3" />
      </div>
    </Link>
  )
}
