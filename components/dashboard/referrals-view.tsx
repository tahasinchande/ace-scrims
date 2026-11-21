"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Copy,
  Check,
  Gift,
  Sparkles,
  Users,
  Wallet,
  CheckCircle2,
  Clock,
  ShieldCheck,
  ArrowRight,
  Banknote,
  Loader2,
  ListChecks,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ReferralRedeemCard } from "@/components/dashboard/referral-redeem-card"
import { requestCreatorWithdrawalAction } from "@/app/actions/referrals"
import type {
  CreatorApplication,
  CreatorWalletTransaction,
  CreatorWithdrawal,
  PayoutMethod,
} from "@/lib/db/schema"
import type { PublicReferralSettings } from "@/lib/referrals"

type ReferralRow = {
  id: string
  referredUserId: string
  referredUserName: string
  referralCode: string
  referralType: string
  qualifyingScrimsCount: number
  requiredScrimsCount: number
  qualifyingSpendBdt: number
  requiredSpendBdt: number
  creatorSignupPaidBdt: number
  displayRewardBdt: number
  status: string
  rewardedAt: Date | string | null
  createdAt: Date | string
}

export function DashboardReferralsView({
  userCode,
  creatorApplication,
  settings,
  referredByCode,
  referredByType,
  redemption,
  creatorWallet,
  referrals,
  stats,
}: {
  userCode: string | null
  creatorApplication: CreatorApplication | null
  settings: PublicReferralSettings
  referredByCode: string | null
  referredByType: string | null
  redemption: {
    isGoogleUser: boolean
    alreadyRedeemed: boolean
    canRedeem: boolean
    windowExpired: boolean
    windowEndsAt: string | null
  }
  creatorWallet: {
    balanceBdt: number
    signupCount: number
    totalSignupEarnedBdt: number
    transactions: CreatorWalletTransaction[]
    withdrawals: CreatorWithdrawal[]
    payoutMethods: PayoutMethod[]
  }
  referrals: ReferralRow[]
  stats: {
    totalReferrals: number
    creatorSignupCount: number
    userReferralCount: number
    rewardedCount: number
    pendingCount: number
    totalEarnedBdt: number
    creatorEarnedBdt: number
    userEarnedBdt: number
  }
}) {
  const router = useRouter()
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"player" | "creator">("player")
  const [submittingWithdrawal, startWithdrawal] = useTransition()

  const defaultMethod = creatorWallet.payoutMethods[0]?.code ?? ""
  const [withdrawAmount, setWithdrawAmount] = useState(
    String(Math.max(settings.creatorMinWithdrawalBdt, Math.min(creatorWallet.balanceBdt, 500)) || settings.creatorMinWithdrawalBdt)
  )
  const [withdrawWhatsapp, setWithdrawWhatsapp] = useState(creatorApplication?.whatsapp ?? "")
  const [withdrawMethod, setWithdrawMethod] = useState(defaultMethod)
  const [withdrawAccount, setWithdrawAccount] = useState("")

  const selectedMethodObj = creatorWallet.payoutMethods.find(
    (m) => m.code === withdrawMethod || m.label === withdrawMethod
  )

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://www.acescrims.online"

  const userInviteLink = userCode ? `${origin}/sign-up?ref=${encodeURIComponent(userCode)}` : ""
  const approvedCreatorCode =
    creatorApplication?.status === "approved" ? creatorApplication.referralCode : null
  const creatorInviteLink = approvedCreatorCode
    ? `${origin}/sign-up?ref=${encodeURIComponent(approvedCreatorCode)}`
    : ""

  const userRewardLabel =
    settings.userRewardMode === "random"
      ? `৳${settings.userMinBdt} – ৳${settings.userMaxBdt}`
      : `৳${settings.userFixedBdt}`

  const declaredCreatorUserBonus =
    settings.creatorDeclaredMode === "random"
      ? `৳${settings.creatorDeclaredMinBdt} – ৳${settings.creatorDeclaredMaxBdt}`
      : `৳${settings.creatorDeclaredFixedBdt}`

  function copy(key: string, value: string) {
    if (!value) return
    navigator.clipboard.writeText(value).then(() => {
      setCopiedKey(key)
      toast.success("Copied to clipboard")
      setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 2000)
    })
  }

  function handleWithdrawalSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amountNum = Number(withdrawAmount)
    if (!Number.isFinite(amountNum) || amountNum < settings.creatorMinWithdrawalBdt) {
      toast.error(`Minimum withdrawal amount is ৳${settings.creatorMinWithdrawalBdt}.`)
      return
    }
    if (amountNum > creatorWallet.balanceBdt) {
      toast.error(`Insufficient Creator Wallet balance (available: ৳${creatorWallet.balanceBdt}).`)
      return
    }
    startWithdrawal(async () => {
      const res = await requestCreatorWithdrawalAction({
        amountBdt: Math.floor(amountNum),
        whatsapp: withdrawWhatsapp,
        payoutMethod: withdrawMethod,
        payoutAccount: withdrawAccount,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success("Withdrawal request submitted! Admin will review and process your payout.")
      setWithdrawAccount("")
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">
            Referrals &amp; Creator Hub
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Invite squads to Ace Scrims, track qualifying requirements, and manage your Content Creator Wallet.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {approvedCreatorCode && (
            <div className="inline-flex rounded-xl border border-border/80 bg-secondary/40 p-1">
              <button
                type="button"
                onClick={() => setActiveTab("player")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  activeTab === "player"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Player Referrals
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("creator")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition flex items-center gap-1.5 ${
                  activeTab === "creator"
                    ? "bg-emerald-600 text-white"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Sparkles className="size-3.5" />
                Creator Dashboard
              </button>
            </div>
          )}
          <Button asChild variant="outline" size="sm">
            <Link href="/creators">
              <Sparkles className="mr-1.5 size-4 text-primary" />
              {approvedCreatorCode ? "Creator Program" : "Apply as Content Creator"}
            </Link>
          </Button>
        </div>
      </div>

      {/* 6-Hour One-Time Referral Redemption Card (Gmail / New Users) */}
      <ReferralRedeemCard
        isGoogleUser={redemption.isGoogleUser}
        alreadyRedeemed={redemption.alreadyRedeemed}
        referredByCode={referredByCode}
        referredByType={referredByType}
        canRedeem={redemption.canRedeem}
        windowExpired={redemption.windowExpired}
        windowEndsAt={redemption.windowEndsAt}
      />

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Player Referral Earned
            </p>
            <p className="mt-1 font-heading text-3xl font-bold text-emerald-400 tabular-nums">
              ৳{stats.userEarnedBdt}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">Credited to Player Wallet</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Creator Wallet Balance
            </p>
            <p className="mt-1 font-heading text-3xl font-bold text-primary tabular-nums">
              ৳{creatorWallet.balanceBdt}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {approvedCreatorCode
                ? `${creatorWallet.signupCount} creator code signups`
                : "Unlocks upon creator approval"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Invited
            </p>
            <p className="mt-1 font-heading text-3xl font-bold tabular-nums">
              {stats.totalReferrals}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {stats.userReferralCount} player · {stats.creatorSignupCount} creator
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Qualifying Progress
            </p>
            <p className="mt-1 font-heading text-3xl font-bold text-amber-400 tabular-nums">
              {stats.rewardedCount} / {stats.totalReferrals}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {stats.pendingCount} awaiting paid scrims
            </p>
          </CardContent>
        </Card>
      </div>

      {/* CREATOR DASHBOARD TAB (Separate Wallet + Signups Counter + Withdrawal Flow) */}
      {approvedCreatorCode && activeTab === "creator" ? (
        <div className="space-y-6">
          <div className="grid gap-5 lg:grid-cols-2">
            {/* Creator Code & Signup Stats */}
            <Card className="border-emerald-500/35">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Sparkles className="size-5 text-emerald-400" />
                    Official Creator Referral Code
                  </CardTitle>
                  <Badge variant="default" className="bg-emerald-600 text-white">
                    {creatorWallet.signupCount} Signups
                  </Badge>
                </div>
                <CardDescription>
                  You earn <strong className="text-emerald-400">৳{settings.creatorPerSignupPayoutBdt}</strong>{" "}
                  in your separate Creator Wallet per valid signup on your code. Referred players also
                  unlock an estimated{" "}
                  <strong className="text-foreground">{declaredCreatorUserBonus}</strong> welcome bonus
                  after {settings.creatorQualifyingScrims} qualifying paid scrim
                  {settings.creatorQualifyingScrims > 1 ? "s" : ""}.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Total Code Signups
                    </p>
                    <p className="mt-1 font-mono text-2xl font-bold text-emerald-400 tabular-nums">
                      {creatorWallet.signupCount}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      ৳{settings.creatorPerSignupPayoutBdt} per valid signup
                    </p>
                  </div>
                  <div className="rounded-xl border border-primary/30 bg-primary/5 p-3.5">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Creator Wallet Balance
                    </p>
                    <p className="mt-1 font-mono text-2xl font-bold text-primary tabular-nums">
                      ৳{creatorWallet.balanceBdt}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Lifetime earned: ৳{creatorWallet.totalSignupEarnedBdt}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-background/70 px-4 py-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      Creator Code
                    </p>
                    <code className="font-mono text-xl font-bold tracking-wider text-emerald-400">
                      {approvedCreatorCode}
                    </code>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => copy("creator-code", approvedCreatorCode)}
                  >
                    {copiedKey === "creator-code" ? (
                      <Check className="size-4" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                    <span className="ml-1.5">Copy</span>
                  </Button>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Creator Invite Link
                  </p>
                  <div className="flex gap-2">
                    <Input value={creatorInviteLink} readOnly className="font-mono text-xs" />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => copy("creator-link", creatorInviteLink)}
                    >
                      {copiedKey === "creator-link" ? (
                        <Check className="size-4" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Creator Withdrawal Request Form */}
            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Banknote className="size-5 text-primary" />
                  Request Creator Wallet Withdrawal
                </CardTitle>
                <CardDescription>
                  Withdraw your Creator Wallet earnings directly. Minimum withdrawal:{" "}
                  <strong className="text-foreground">৳{settings.creatorMinWithdrawalBdt}</strong>.
                  Available: <strong className="text-emerald-400">৳{creatorWallet.balanceBdt}</strong>.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleWithdrawalSubmit} className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="withdrawAmount">Withdrawal Amount (BDT) *</Label>
                      <Input
                        id="withdrawAmount"
                        type="number"
                        min={settings.creatorMinWithdrawalBdt}
                        max={Math.max(settings.creatorMinWithdrawalBdt, creatorWallet.balanceBdt)}
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="withdrawWhatsapp">WhatsApp Number *</Label>
                      <Input
                        id="withdrawWhatsapp"
                        value={withdrawWhatsapp}
                        onChange={(e) => setWithdrawWhatsapp(e.target.value)}
                        placeholder="01XXXXXXXXX"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="withdrawMethod">Payout Method *</Label>
                      <select
                        id="withdrawMethod"
                        value={withdrawMethod}
                        onChange={(e) => setWithdrawMethod(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        required
                      >
                        {creatorWallet.payoutMethods.map((m) => (
                          <option key={m.id} value={m.code}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="withdrawAccount">
                        Payout Account / Number {selectedMethodObj?.requiresAccountNumber ? "*" : "(Optional)"}
                      </Label>
                      <Input
                        id="withdrawAccount"
                        value={withdrawAccount}
                        onChange={(e) => setWithdrawAccount(e.target.value)}
                        placeholder={
                          selectedMethodObj?.requiresAccountNumber
                            ? `Your ${selectedMethodObj.label} number`
                            : "Optional note or account ID"
                        }
                        required={Boolean(selectedMethodObj?.requiresAccountNumber)}
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={
                      submittingWithdrawal ||
                      creatorWallet.balanceBdt < settings.creatorMinWithdrawalBdt ||
                      creatorWallet.payoutMethods.length === 0
                    }
                    className="w-full font-semibold"
                  >
                    {submittingWithdrawal ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Submitting Withdrawal...
                      </>
                    ) : (
                      <>
                        <Banknote className="mr-2 size-4" />
                        Submit Withdrawal Request
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Creator Withdrawal History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Creator Withdrawal Requests</CardTitle>
              <CardDescription>
                Track your Creator Wallet withdrawal requests and admin payout confirmations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {creatorWallet.withdrawals.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/70 py-8 text-center text-sm text-muted-foreground">
                  No creator withdrawal requests submitted yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="py-2.5 pr-4">Date</th>
                        <th className="py-2.5 pr-4">Method &amp; Account</th>
                        <th className="py-2.5 pr-4">WhatsApp</th>
                        <th className="py-2.5 pr-4">Status</th>
                        <th className="py-2.5 pr-4">Note</th>
                        <th className="py-2.5 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {creatorWallet.withdrawals.map((w) => (
                        <tr key={w.id}>
                          <td className="py-3 pr-4 text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(w.createdAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 pr-4">
                            <p className="font-medium">{w.payoutMethod}</p>
                            {w.payoutAccount && (
                              <p className="font-mono text-xs text-muted-foreground">
                                {w.payoutAccount}
                              </p>
                            )}
                          </td>
                          <td className="py-3 pr-4 font-mono text-xs">{w.whatsapp}</td>
                          <td className="py-3 pr-4">
                            {w.status === "paid" ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
                                <CheckCircle2 className="size-3.5" /> Paid
                              </span>
                            ) : w.status === "rejected" ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-400">
                                <XCircle className="size-3.5" /> Rejected (Refunded)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400">
                                <Clock className="size-3.5" /> Pending
                              </span>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-xs text-muted-foreground max-w-[200px] truncate">
                            {w.adminNote || "—"}
                          </td>
                          <td className="py-3 text-right font-mono font-bold text-primary">
                            ৳{w.amountBdt}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        /* PLAYER REFERRALS + CREATOR OVERVIEW CARDS */
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="border-primary/25">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Gift className="size-5 text-primary" />
                  Your Player Referral Code
                </CardTitle>
                <Badge variant={settings.userEnabled ? "default" : "secondary"}>
                  {settings.userEnabled ? "Active" : "Paused"}
                </Badge>
              </div>
              <CardDescription>
                Earn <span className="font-semibold text-foreground">{userRewardLabel}</span> into
                your Player Wallet when an invited friend satisfies all qualifying rules below.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Exact Qualifying Conditions Set By Admin */}
              <div className="rounded-xl border border-primary/25 bg-primary/5 p-3.5 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
                  <ListChecks className="size-4" />
                  Qualifying Requirements to Unlock Bonus
                </div>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  <li className="flex items-center justify-between gap-2">
                    <span>Required Paid Scrims Played</span>
                    <strong className="font-mono text-foreground">
                      {settings.userQualifyingScrims} paid scrim
                      {settings.userQualifyingScrims > 1 ? "s" : ""}
                    </strong>
                  </li>
                  <li className="flex items-center justify-between gap-2">
                    <span>Minimum Entry Fee per Scrim</span>
                    <strong className="font-mono text-foreground">
                      ৳{settings.userMinEntryFeeBdt} BDT
                    </strong>
                  </li>
                  {settings.userMinTotalSpendBdt > 0 && (
                    <li className="flex items-center justify-between gap-2">
                      <span>Minimum Total Spend Required</span>
                      <strong className="font-mono text-foreground">
                        ৳{settings.userMinTotalSpendBdt} BDT
                      </strong>
                    </li>
                  )}
                  <li className="flex items-center justify-between gap-2">
                    <span>Your Referral Reward</span>
                    <strong className="font-mono text-emerald-400">
                      {userRewardLabel}{" "}
                      {settings.userRewardMode === "random" ? "(Random Range)" : "(Fixed)"}
                    </strong>
                  </li>
                </ul>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-border/80 bg-background/70 px-4 py-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Referral Code
                  </p>
                  <code className="font-mono text-xl font-bold tracking-wider text-primary">
                    {userCode || "Generating..."}
                  </code>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!userCode}
                  onClick={() => userCode && copy("user-code", userCode)}
                >
                  {copiedKey === "user-code" ? <Check className="size-4" /> : <Copy className="size-4" />}
                  <span className="ml-1.5">Copy</span>
                </Button>
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Direct Sign-Up Link (Works for Email &amp; Google Sign-Up)
                </p>
                <div className="flex gap-2">
                  <Input value={userInviteLink} readOnly className="font-mono text-xs" />
                  <Button
                    type="button"
                    size="sm"
                    disabled={!userInviteLink}
                    onClick={() => copy("user-link", userInviteLink)}
                  >
                    {copiedKey === "user-link" ? <Check className="size-4" /> : <Copy className="size-4" />}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={approvedCreatorCode ? "border-emerald-500/35" : "border-border/80"}>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="size-5 text-emerald-400" />
                  Content Creator Program
                </CardTitle>
                <Badge
                  variant={
                    approvedCreatorCode
                      ? "default"
                      : creatorApplication?.status === "pending"
                        ? "secondary"
                        : "outline"
                  }
                >
                  {approvedCreatorCode
                    ? `${creatorWallet.signupCount} Signups`
                    : creatorApplication?.status === "pending"
                      ? "Pending Review"
                      : "Creator Program"}
                </Badge>
              </div>
              <CardDescription>
                Approved creators earn{" "}
                <strong className="text-emerald-400">৳{settings.creatorPerSignupPayoutBdt}</strong>{" "}
                per valid signup into their separate Creator Wallet, and players joining with their code
                receive an estimated{" "}
                <strong className="text-foreground">{declaredCreatorUserBonus}</strong> welcome bonus.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {approvedCreatorCode ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3.5 py-2.5">
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Creator Signups
                      </p>
                      <p className="font-mono text-xl font-bold text-emerald-400 tabular-nums">
                        {creatorWallet.signupCount}
                      </p>
                    </div>
                    <div className="rounded-xl border border-primary/25 bg-primary/5 px-3.5 py-2.5">
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Creator Wallet
                      </p>
                      <p className="font-mono text-xl font-bold text-primary tabular-nums">
                        ৳{creatorWallet.balanceBdt}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Official Creator Code
                      </p>
                      <code className="font-mono text-xl font-bold tracking-wider text-emerald-400">
                        {approvedCreatorCode}
                      </code>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => copy("creator-code", approvedCreatorCode)}
                    >
                      {copiedKey === "creator-code" ? (
                        <Check className="size-4" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                      <span className="ml-1.5">Copy</span>
                    </Button>
                  </div>

                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setActiveTab("creator")}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
                  >
                    <Banknote className="mr-1.5 size-4" />
                    Open Creator Wallet &amp; Withdrawals
                    <ArrowRight className="ml-1.5 size-4" />
                  </Button>
                </>
              ) : (
                <div className="rounded-xl border border-border/70 bg-background/50 p-4 space-y-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {creatorApplication?.status === "pending"
                      ? `Your creator application for "${creatorApplication.creatorName}" is currently under admin review. Your Creator Code & Creator Wallet will unlock automatically upon approval.`
                      : "Are you a YouTuber, TikToker, Facebook streamer, or Free Fire content creator? Apply with genuine proof of your channel to unlock your Creator Code and withdrawable Creator Wallet."}
                  </p>
                  <Button asChild size="sm">
                    <Link href="/creators">
                      {creatorApplication?.status === "pending"
                        ? "View Application Status"
                        : "Apply for Creator Code"}
                      <ArrowRight className="ml-1.5 size-4" />
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Fair Play Notice */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-secondary/20 px-4 py-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary shrink-0" />
          <span>
            Fair-Play Protection: Referral codes can only be applied at sign-up or once within 6 hours
            of registration. Self-referrals and free (৳0) giveaway scrims never qualify.
          </span>
        </div>
      </div>

      {/* Referred Players History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="size-5 text-primary" />
                Your Referred Players
              </CardTitle>
              <CardDescription>
                Live tracking of invited players, qualifying paid scrims, and credited payouts.
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/wallet">
                <Wallet className="mr-1.5 size-4" />
                Player Wallet
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {referrals.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 py-10 text-center text-sm text-muted-foreground">
              No referred players yet. Share your link above to start earning BDT rewards!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="py-2.5 pr-4">Player</th>
                    <th className="py-2.5 pr-4">Type</th>
                    <th className="py-2.5 pr-4">Code Used</th>
                    <th className="py-2.5 pr-4">Qualifying Progress</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5 text-right">Your Earning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {referrals.map((ref) => (
                    <tr key={ref.id}>
                      <td className="py-3 pr-4 font-medium">{ref.referredUserName}</td>
                      <td className="py-3 pr-4">
                        <Badge variant={ref.referralType === "creator" ? "default" : "secondary"}>
                          {ref.referralType === "creator" ? "Creator" : "Player"}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs">{ref.referralCode}</td>
                      <td className="py-3 pr-4 font-mono text-xs">
                        {ref.qualifyingScrimsCount} / {ref.requiredScrimsCount} scrims
                        {ref.requiredSpendBdt > 0
                          ? ` · ৳${ref.qualifyingSpendBdt}/৳${ref.requiredSpendBdt}`
                          : ""}
                      </td>
                      <td className="py-3 pr-4">
                        {ref.referralType === "creator" ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
                            <CheckCircle2 className="size-3.5" />
                            {ref.status === "rewarded" ? "User Bonus Unlocked" : "Signup Tracked"}
                          </span>
                        ) : ref.status === "rewarded" ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400">
                            <CheckCircle2 className="size-3.5" /> Rewarded
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400">
                            <Clock className="size-3.5" /> In Progress
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right font-mono font-bold text-emerald-400">
                        {ref.displayRewardBdt > 0 ? `+৳${ref.displayRewardBdt}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
