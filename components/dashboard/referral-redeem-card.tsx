"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Gift, Clock, Lock, CheckCircle2, Loader2, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { redeemReferralCodeAction } from "@/app/actions/referrals"

type Props = {
  isGoogleUser?: boolean
  alreadyRedeemed: boolean
  referredByCode: string | null
  referredByType: string | null
  canRedeem: boolean
  windowExpired: boolean
  windowEndsAt: string | null
  compact?: boolean
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return "0m 0s"
  const totalSec = Math.floor(ms / 1000)
  const hrs = Math.floor(totalSec / 3600)
  const mins = Math.floor((totalSec % 3600) / 60)
  const secs = totalSec % 60
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`
  return `${mins}m ${secs}s`
}

export function ReferralRedeemCard({
  isGoogleUser,
  alreadyRedeemed: initialAlreadyRedeemed,
  referredByCode: initialCode,
  referredByType: initialType,
  canRedeem: initialCanRedeem,
  windowExpired: initialWindowExpired,
  windowEndsAt,
  compact = false,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [code, setCode] = useState("")
  const [redeemedCode, setRedeemedCode] = useState<string | null>(initialCode)
  const [redeemedType, setRedeemedType] = useState<string | null>(initialType)
  const [alreadyRedeemed, setAlreadyRedeemed] = useState(initialAlreadyRedeemed)
  const [remainingMs, setRemainingMs] = useState<number>(() => {
    if (!windowEndsAt) return 0
    return Math.max(0, new Date(windowEndsAt).getTime() - Date.now())
  })

  useEffect(() => {
    if (!windowEndsAt || alreadyRedeemed || !initialCanRedeem) return
    const endMs = new Date(windowEndsAt).getTime()
    const tick = () => {
      const diff = Math.max(0, endMs - Date.now())
      setRemainingMs(diff)
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [windowEndsAt, alreadyRedeemed, initialCanRedeem])

  const expiredNow = initialWindowExpired || (Boolean(windowEndsAt) && remainingMs <= 0)
  const showForm = !alreadyRedeemed && !expiredNow && initialCanRedeem

  function handleRedeem(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = code.trim()
    if (!trimmed) {
      toast.error("Please enter a referral code.")
      return
    }
    startTransition(async () => {
      const res = await redeemReferralCodeAction(trimmed)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setAlreadyRedeemed(true)
      setRedeemedCode(res.code)
      setRedeemedType(res.referralType)
      setCode("")
      toast.success(
        `Referral code ${res.code} redeemed! One-time redemption is now permanently locked.`
      )
      router.refresh()
    })
  }

  if (alreadyRedeemed) {
    return (
      <div className="dc-surface rounded-2xl border border-emerald-500/25 px-4 py-3.5 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 text-emerald-400">
            <CheckCircle2 className="size-4 shrink-0" />
            <span className="font-semibold text-foreground">
              {redeemedCode
                ? `Referral Code Applied: ${redeemedCode} (${redeemedType === "creator" ? "Creator" : "Player"})`
                : "Referral Redemption Used"}
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Lock className="size-3.5" />
            One-time lifetime redemption rule — locked permanently
          </span>
        </div>
      </div>
    )
  }

  if (!showForm) {
    return (
      <div className="dc-surface rounded-2xl border border-border/70 px-4 py-3.5 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="size-4 shrink-0 text-amber-400" />
            <span>
              <strong className="text-foreground">Referral Code Window Closed:</strong> Referral
              codes can only be redeemed <strong className="text-foreground">once in a lifetime</strong>{" "}
              and strictly within the <strong className="text-foreground">first 6 hours</strong> after
              account sign-up.
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground">
            <Lock className="size-3" /> 6h limit elapsed
          </span>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`dc-surface rounded-2xl border border-primary/35 ${
        compact ? "p-4" : "p-5"
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Gift className="size-4 text-primary shrink-0" />
            <h3 className="font-display text-sm font-bold uppercase tracking-wide text-foreground">
              {isGoogleUser ? "Signed Up with Gmail? Redeem Referral Code" : "Redeem a Referral Code"}
            </h3>
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-300 tabular-nums">
              <Clock className="size-3" />
              {formatRemaining(remainingMs)} left
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Have a Content Creator or Player referral code? Redeem it{" "}
            <strong className="text-foreground">once ever</strong> within your first{" "}
            <strong className="text-foreground">6 hours</strong> after sign-up. After 6 hours or once
            redeemed, this option disappears permanently.
          </p>
        </div>

        <form onSubmit={handleRedeem} className="flex w-full sm:w-auto items-center gap-2 shrink-0">
          <Input
            value={code}
            onChange={(e) =>
              setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))
            }
            placeholder="Enter code (e.g. CR-ACE)"
            maxLength={24}
            className="h-9 font-mono text-xs uppercase sm:w-48"
            disabled={pending}
          />
          <Button
            type="submit"
            size="sm"
            disabled={pending || !code.trim()}
            className="h-9 font-semibold whitespace-nowrap"
          >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : "Redeem"}
          </Button>
        </form>
      </div>
    </div>
  )
}
