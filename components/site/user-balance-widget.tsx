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

    function onBalanceUpdate(e: Event) {
      const detail = (e as CustomEvent<{ balance?: number }>).detail
      if (typeof detail?.balance === "number") {
        setBalance(detail.balance)
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
          "rushx-btn-splash inline-flex h-8 items-center gap-1.5 rounded-xl border border-white/[0.1] bg-white/[0.04] px-2.5 text-xs font-semibold text-white backdrop-blur-md transition-all hover:border-[rgba(var(--rushx-soft-rgb),0.38)] hover:bg-[rgba(var(--rushx-primary-rgb),0.14)] tabular-nums",
          className
        )}
      >
        <Wallet className="size-3.5 text-accent shrink-0" />
        <span className="font-mono font-bold tracking-tight">৳{loaded ? balance : "0"}</span>
      </Link>
    )
  }

  return (
    <Link
      href={targetHref}
      title="RushX Wallet — Click to manage funds & load balance"
      className={cn(
        "rushx-btn-splash group inline-flex h-9 items-center gap-2 rounded-xl border border-white/[0.1] bg-white/[0.04] px-3 text-xs font-semibold text-slate-200 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-all hover:border-[rgba(var(--rushx-soft-rgb),0.4)] hover:bg-[rgba(var(--rushx-primary-rgb),0.14)] hover:text-white",
        className
      )}
    >
      <Wallet className="size-3.5 text-accent shrink-0 transition-transform duration-200 group-hover:scale-105" />
      <span className="font-mono text-xs font-bold tracking-tight text-white tabular-nums">
        ৳{loaded ? balance : "..."}
      </span>
      <span className="h-3.5 w-px bg-white/[0.12]" aria-hidden="true" />
      <Plus className="size-3.5 text-slate-300 transition-transform duration-200 group-hover:rotate-90 group-hover:text-accent" />
    </Link>
  )
}
