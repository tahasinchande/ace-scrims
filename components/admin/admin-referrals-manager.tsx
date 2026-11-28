"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Sparkles,
  Users,
  Wallet,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Save,
  Loader2,
  Clock,
  SlidersHorizontal,
  Gift,
  Banknote,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  reviewCreatorApplicationAction,
  reviewCreatorWithdrawalAction,
  updateReferralSettingsAction,
} from "@/app/actions/referrals"
import type { CreatorApplication, CreatorWithdrawal } from "@/lib/db/schema"
import type { ReferralProgramSettings } from "@/lib/referrals"

type EnrichedApplication = CreatorApplication & {
  applicantName: string
  applicantEmail: string
  creatorBalance: number
  signupCount: number
  totalSignupPayoutBdt: number
}

type EnrichedReferral = {
  id: string
  referrerUserId: string
  referredUserId: string
  referrerName: string
  referrerEmail: string
  referredName: string
  referredEmail: string
  referralCode: string
  referralType: string
  qualifyingScrimsCount: number
  requiredScrimsCount: number
  qualifyingSpendBdt: number
  requiredSpendBdt: number
  rewardRecipient: string
  creatorSignupPaidBdt: number
  status: string
  rewardAmountBdt: number
  rewardModeUsed: string | null
  rewardedAt: Date | string | null
  createdAt: Date | string
}

type EnrichedWithdrawal = CreatorWithdrawal & {
  creatorName: string
  creatorEmail: string
  creatorCode: string | null
  currentCreatorBalance: number
}

export function AdminReferralsManager({
  initialSettings,
  applications,
  referrals,
  withdrawals,
  summary,
}: {
  initialSettings: ReferralProgramSettings
  applications: EnrichedApplication[]
  referrals: EnrichedReferral[]
  withdrawals: EnrichedWithdrawal[]
  summary: {
    totalReferrals: number
    rewardedReferrals: number
    creatorSignups: number
    totalPaidBdt: number
    creatorPaidBdt: number
    creatorUserBonusPaidBdt: number
    userPaidBdt: number
    pendingCreatorApps: number
    approvedCreators: number
    pendingWithdrawals: number
  }
}) {
  const router = useRouter()
  const [savingSettings, startSaveSettings] = useTransition()
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [processingWithdrawalId, setProcessingWithdrawalId] = useState<string | null>(null)
  const [settings, setSettings] = useState<ReferralProgramSettings>(initialSettings)
  const [customCodes, setCustomCodes] = useState<Record<string, string>>({})
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({})
  const [withdrawalNotes, setWithdrawalNotes] = useState<Record<string, string>>({})
  const [appFilter, setAppFilter] = useState<"all" | "pending" | "approved" | "rejected">("all")
  const [withdrawalFilter, setWithdrawalFilter] = useState<"all" | "pending" | "paid" | "rejected">("all")

  function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault()
    startSaveSettings(async () => {
      const res = await updateReferralSettingsAction(settings)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setSettings(res.settings)
      toast.success("Referral program settings saved!")
      router.refresh()
    })
  }

  async function handleReview(app: EnrichedApplication, decision: "approve" | "reject") {
    setReviewingId(app.id)
    try {
      const effectiveCustomCode =
        customCodes[app.id] !== undefined
          ? customCodes[app.id]
          : app.referralCode ?? app.requestedReferralCode ?? ""
      const res = await reviewCreatorApplicationAction({
        applicationId: app.id,
        decision,
        customCode: effectiveCustomCode,
        adminNote: adminNotes[app.id] ?? app.adminNote ?? "",
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      if (decision === "approve") {
        const assignedCode = res.referralCode ?? ""
        if (assignedCode) {
          setCustomCodes((prev) => ({ ...prev, [app.id]: assignedCode }))
        }
        toast.success(`Partner approved! Exact Referral Code: ${assignedCode}`)
      } else {
        toast.success("Creator application rejected.")
      }
      router.refresh()
    } finally {
      setReviewingId(null)
    }
  }

  async function handleWithdrawalReview(withdrawalId: string, decision: "paid" | "rejected") {
    setProcessingWithdrawalId(withdrawalId)
    try {
      const res = await reviewCreatorWithdrawalAction({
        withdrawalId,
        decision,
        adminNote: withdrawalNotes[withdrawalId] || "",
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(
        decision === "paid"
          ? "Creator withdrawal marked as Paid."
          : "Creator withdrawal rejected and refunded to Creator Wallet."
      )
      router.refresh()
    } finally {
      setProcessingWithdrawalId(null)
    }
  }

  const filteredApps = applications.filter((a) => (appFilter === "all" ? true : a.status === appFilter))
  const filteredWithdrawals = withdrawals.filter((w) =>
    withdrawalFilter === "all" ? true : w.status === withdrawalFilter
  )

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">
          Referrals, Creators &amp; Creator Withdrawals
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure Declared vs. Actual Creator user bonuses, Creator per-signup wallet payouts,
          Normal User qualifying rules, and review creator applications &amp; withdrawals.
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Creator Apps &amp; Withdrawals</span>
              <Clock className="size-4 text-amber-400" />
            </div>
            <p className="mt-1 font-heading text-3xl font-bold text-amber-400 tabular-nums">
              {summary.pendingCreatorApps} / {summary.pendingWithdrawals}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {summary.approvedCreators} approved creators active
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Creator Code Signups</span>
              <Users className="size-4 text-primary" />
            </div>
            <p className="mt-1 font-heading text-3xl font-bold tabular-nums">
              {summary.creatorSignups}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {summary.totalReferrals} total referrals tracked
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Creator Wallet Credited</span>
              <Sparkles className="size-4 text-emerald-400" />
            </div>
            <p className="mt-1 font-heading text-3xl font-bold text-emerald-400 tabular-nums">
              ৳{summary.creatorPaidBdt}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              User welcome bonuses: ৳{summary.creatorUserBonusPaidBdt}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>User Referral Payouts</span>
              <Wallet className="size-4 text-sky-400" />
            </div>
            <p className="mt-1 font-heading text-3xl font-bold text-sky-400 tabular-nums">
              ৳{summary.userPaidBdt}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {summary.rewardedReferrals} total bonuses unlocked
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Reward Configuration Form */}
      <form onSubmit={handleSaveSettings} className="grid gap-5 lg:grid-cols-2">
        {/* Creator Referral Settings */}
        <Card className="border-emerald-500/25">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="size-5 text-emerald-400" />
                Content Creator Referral Config
              </CardTitle>
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={settings.creatorEnabled}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, creatorEnabled: e.target.checked }))
                  }
                  className="size-4 accent-emerald-500"
                />
                {settings.creatorEnabled ? "Enabled" : "Paused"}
              </label>
            </div>
            <CardDescription>
              Referred users receive the Actual User Bonus after qualifying paid scrims; creators earn
              per-signup payouts into their separate Creator Wallet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Creator Own Per-Signup Wallet Payout */}
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3.5 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                1. Creator Separate Wallet Payout (Per Valid Signup)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="creatorPerSignupPayoutBdt">Per-Signup Payout (BDT)</Label>
                  <Input
                    id="creatorPerSignupPayoutBdt"
                    type="number"
                    min={0}
                    max={5000}
                    value={settings.creatorPerSignupPayoutBdt}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        creatorPerSignupPayoutBdt: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="creatorMinWithdrawalBdt">Min Withdrawal (BDT)</Label>
                  <Input
                    id="creatorMinWithdrawalBdt"
                    type="number"
                    min={10}
                    max={50000}
                    value={settings.creatorMinWithdrawalBdt}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        creatorMinWithdrawalBdt: Math.max(10, Number(e.target.value) || 100),
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            {/* Declared User Bonus (Publicly Shown to Users) */}
            <div className="rounded-xl border border-primary/25 bg-primary/5 p-3.5 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-primary">
                2. Declared User Bonus (Shown Publicly — Hides Real Payout)
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(["fixed", "random"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSettings((s) => ({ ...s, creatorDeclaredMode: mode }))}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                      settings.creatorDeclaredMode === mode
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border/70 bg-background/40 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {mode === "fixed" ? "Declared Fixed" : "Declared Min–Max Range"}
                  </button>
                ))}
              </div>
              {settings.creatorDeclaredMode === "fixed" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="creatorDeclaredFixedBdt">Declared Fixed Amount (BDT)</Label>
                  <Input
                    id="creatorDeclaredFixedBdt"
                    type="number"
                    min={1}
                    max={10000}
                    value={settings.creatorDeclaredFixedBdt}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        creatorDeclaredFixedBdt: Number(e.target.value) || 1,
                      }))
                    }
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="creatorDeclaredMinBdt">Declared Min (BDT)</Label>
                    <Input
                      id="creatorDeclaredMinBdt"
                      type="number"
                      min={1}
                      max={10000}
                      value={settings.creatorDeclaredMinBdt}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          creatorDeclaredMinBdt: Number(e.target.value) || 1,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="creatorDeclaredMaxBdt">Declared Max (BDT)</Label>
                    <Input
                      id="creatorDeclaredMaxBdt"
                      type="number"
                      min={1}
                      max={10000}
                      value={settings.creatorDeclaredMaxBdt}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          creatorDeclaredMaxBdt: Number(e.target.value) || 1,
                        }))
                      }
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Actual Internal Reward Credited to Referred User */}
            <div className="rounded-xl border border-border/70 bg-background/40 p-3.5 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-foreground">
                3. Actual Referred-User Bonus (Private Admin Payout Rule)
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(["fixed", "random"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSettings((s) => ({ ...s, creatorRewardMode: mode }))}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                      settings.creatorRewardMode === mode
                        ? "border-emerald-500 bg-emerald-500/15 text-emerald-300"
                        : "border-border/70 bg-background/40 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {mode === "fixed" ? "Actual Fixed BDT" : "Actual Random Min–Max"}
                  </button>
                ))}
              </div>

              {settings.creatorRewardMode === "fixed" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="creatorFixedBdt">Actual Fixed Bonus to Referred User (BDT)</Label>
                  <Input
                    id="creatorFixedBdt"
                    type="number"
                    min={1}
                    max={10000}
                    value={settings.creatorFixedBdt}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, creatorFixedBdt: Number(e.target.value) || 1 }))
                    }
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="creatorMinBdt">Actual Min (BDT)</Label>
                    <Input
                      id="creatorMinBdt"
                      type="number"
                      min={1}
                      max={10000}
                      value={settings.creatorMinBdt}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, creatorMinBdt: Number(e.target.value) || 1 }))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="creatorMaxBdt">Actual Max (BDT)</Label>
                    <Input
                      id="creatorMaxBdt"
                      type="number"
                      min={1}
                      max={10000}
                      value={settings.creatorMaxBdt}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, creatorMaxBdt: Number(e.target.value) || 1 }))
                      }
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="creatorQualifyingScrims">Required Paid Scrims</Label>
                  <Input
                    id="creatorQualifyingScrims"
                    type="number"
                    min={1}
                    max={50}
                    value={settings.creatorQualifyingScrims}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        creatorQualifyingScrims: Number(e.target.value) || 1,
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="creatorMinEntryFeeBdt">Min Entry Fee (BDT)</Label>
                  <Input
                    id="creatorMinEntryFeeBdt"
                    type="number"
                    min={1}
                    max={5000}
                    value={settings.creatorMinEntryFeeBdt}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        creatorMinEntryFeeBdt: Number(e.target.value) || 1,
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Normal User Referral Settings */}
        <Card className="border-primary/25">
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Gift className="size-5 text-primary" />
                Normal User-to-User Referral Config
              </CardTitle>
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold">
                <input
                  type="checkbox"
                  checked={settings.userEnabled}
                  onChange={(e) => setSettings((s) => ({ ...s, userEnabled: e.target.checked }))}
                  className="size-4 accent-primary"
                />
                {settings.userEnabled ? "Enabled" : "Paused"}
              </label>
            </div>
            <CardDescription>
              Configure exact qualifying requirements (shown transparently in User Dashboard) and
              Fixed or Randomized BDT rewards for normal player referrals.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Reward Mode</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["fixed", "random"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSettings((s) => ({ ...s, userRewardMode: mode }))}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                      settings.userRewardMode === mode
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border/70 bg-background/40 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {mode === "fixed" ? "Fixed BDT Amount" : "Randomized Min–Max Range"}
                  </button>
                ))}
              </div>
            </div>

            {settings.userRewardMode === "fixed" ? (
              <div className="space-y-2">
                <Label htmlFor="userFixedBdt">Fixed User Reward (BDT)</Label>
                <Input
                  id="userFixedBdt"
                  type="number"
                  min={1}
                  max={10000}
                  value={settings.userFixedBdt}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, userFixedBdt: Number(e.target.value) || 1 }))
                  }
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="userMinBdt">Min Reward (BDT)</Label>
                  <Input
                    id="userMinBdt"
                    type="number"
                    min={1}
                    max={10000}
                    value={settings.userMinBdt}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, userMinBdt: Number(e.target.value) || 1 }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="userMaxBdt">Max Reward (BDT)</Label>
                  <Input
                    id="userMaxBdt"
                    type="number"
                    min={1}
                    max={10000}
                    value={settings.userMaxBdt}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, userMaxBdt: Number(e.target.value) || 1 }))
                    }
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="userQualifyingScrims">Required Paid Scrims</Label>
                <Input
                  id="userQualifyingScrims"
                  type="number"
                  min={1}
                  max={50}
                  value={settings.userQualifyingScrims}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      userQualifyingScrims: Number(e.target.value) || 1,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="userMinEntryFeeBdt">Min Entry Fee (BDT)</Label>
                <Input
                  id="userMinEntryFeeBdt"
                  type="number"
                  min={1}
                  max={5000}
                  value={settings.userMinEntryFeeBdt}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      userMinEntryFeeBdt: Number(e.target.value) || 1,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="userMinTotalSpendBdt">Min Total Spend (BDT)</Label>
                <Input
                  id="userMinTotalSpendBdt"
                  type="number"
                  min={0}
                  max={50000}
                  value={settings.userMinTotalSpendBdt}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      userMinTotalSpendBdt: Math.max(0, Number(e.target.value) || 0),
                    }))
                  }
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Set Min Total Spend to 0 to only enforce scrim count &amp; minimum entry fee. Free (৳0)
              giveaway scrims are always excluded.
            </p>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 flex justify-end">
          <Button type="submit" disabled={savingSettings} className="glow-primary font-semibold">
            {savingSettings ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Save className="mr-2 size-4" />
            )}
            Save Referral Reward Settings
          </Button>
        </div>
      </form>

      {/* Creator Withdrawal Requests Queue */}
      <Card className="border-primary/25">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Banknote className="size-5 text-primary" />
                Creator Wallet Withdrawal Requests ({withdrawals.length})
              </CardTitle>
              <CardDescription>
                Review creator payout requests. Rejecting automatically refunds the requested amount
                back to the creator&apos;s Creator Wallet.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(["all", "pending", "paid", "rejected"] as const).map((status) => (
                <Button
                  key={status}
                  type="button"
                  size="sm"
                  variant={withdrawalFilter === status ? "default" : "outline"}
                  onClick={() => setWithdrawalFilter(status)}
                  className="capitalize"
                >
                  {status}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {filteredWithdrawals.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 py-8 text-center text-sm text-muted-foreground">
              No creator withdrawal requests match this filter.
            </div>
          ) : (
            filteredWithdrawals.map((w) => {
              const isBusy = processingWithdrawalId === w.id
              return (
                <div
                  key={w.id}
                  className="rounded-xl border border-border/80 bg-secondary/15 p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-heading text-lg font-bold">{w.creatorName}</h3>
                        {w.creatorCode && (
                          <code className="rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-xs font-bold text-emerald-400">
                            {w.creatorCode}
                          </code>
                        )}
                        <Badge
                          variant={
                            w.status === "paid"
                              ? "default"
                              : w.status === "pending"
                                ? "secondary"
                                : "destructive"
                          }
                          className="uppercase"
                        >
                          {w.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {w.creatorEmail} · WhatsApp:{" "}
                        <strong className="font-mono text-foreground">{w.whatsapp}</strong> · Method:{" "}
                        <strong className="text-foreground">{w.payoutMethod}</strong>
                        {w.payoutAccount ? (
                          <>
                            {" "}
                            · Account:{" "}
                            <strong className="font-mono text-foreground">{w.payoutAccount}</strong>
                          </>
                        ) : null}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-2xl font-bold text-primary tabular-nums">
                        ৳{w.amountBdt}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Remaining wallet: ৳{w.currentCreatorBalance}
                      </p>
                    </div>
                  </div>

                  {w.status === "pending" ? (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                      <Input
                        placeholder="Optional transaction ref or rejection reason..."
                        value={withdrawalNotes[w.id] ?? ""}
                        onChange={(e) =>
                          setWithdrawalNotes((prev) => ({ ...prev, [w.id]: e.target.value }))
                        }
                        className="h-9 text-xs flex-1"
                      />
                      <div className="flex items-center gap-2 justify-end">
                        <Button
                          type="button"
                          size="sm"
                          disabled={isBusy}
                          onClick={() => handleWithdrawalReview(w.id, "paid")}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white"
                        >
                          {isBusy ? (
                            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="mr-1.5 size-3.5" />
                          )}
                          Mark Paid
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          disabled={isBusy}
                          onClick={() => handleWithdrawalReview(w.id, "rejected")}
                        >
                          <XCircle className="mr-1.5 size-3.5" />
                          Reject &amp; Refund
                        </Button>
                      </div>
                    </div>
                  ) : (
                    w.adminNote && (
                      <p className="rounded-lg border border-border/50 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
                        <strong className="text-foreground">Admin Note:</strong> {w.adminNote}
                      </p>
                    )
                  )}
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* Creator Applications Review Queue */}
      <Card id="creator-applications">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <SlidersHorizontal className="size-5 text-primary" />
                Content Creator &amp; Partnership Applications
              </CardTitle>
              <CardDescription>
                Review applicants&apos; requested exact referral codes, assign or update exact
                custom codes, and track signups &amp; Creator Wallet balances.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(["all", "pending", "approved", "rejected"] as const).map((status) => (
                <Button
                  key={status}
                  type="button"
                  size="sm"
                  variant={appFilter === status ? "default" : "outline"}
                  onClick={() => setAppFilter(status)}
                  className="capitalize"
                >
                  {status}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {filteredApps.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 py-10 text-center text-sm text-muted-foreground">
              No creator applications match this filter.
            </div>
          ) : (
            filteredApps.map((app) => {
              const isBusy = reviewingId === app.id
              const currentCodeInput =
                customCodes[app.id] !== undefined
                  ? customCodes[app.id]
                  : app.referralCode ?? app.requestedReferralCode ?? ""
              return (
                <div
                  key={app.id}
                  className="rounded-xl border border-border/80 bg-secondary/15 p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-heading text-lg font-bold">{app.creatorName}</h3>
                        <Badge variant="outline">{app.platform}</Badge>
                        <Badge
                          variant={
                            app.status === "approved"
                              ? "default"
                              : app.status === "pending"
                                ? "secondary"
                                : "destructive"
                          }
                          className="uppercase"
                        >
                          {app.status}
                        </Badge>
                        {app.referralCode && (
                          <code className="rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-xs font-bold text-emerald-400">
                            Assigned: {app.referralCode}
                          </code>
                        )}
                        {app.requestedReferralCode && (
                          <code className="rounded border border-amber-500/35 bg-amber-500/15 px-2 py-0.5 font-mono text-xs font-bold text-amber-300">
                            Requested: {app.requestedReferralCode}
                          </code>
                        )}
                        <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-bold text-primary">
                          {app.signupCount} Signups
                        </span>
                        <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-400">
                          Wallet: ৳{app.creatorBalance}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Account: {app.applicantName} ({app.applicantEmail}) · WhatsApp: {app.whatsapp} ·
                        Followers: <strong className="text-foreground">{app.followerCount}</strong>
                        {app.averageViews ? ` · Avg Views: ${app.averageViews}` : ""}
                      </p>
                    </div>
                    <a
                      href={app.channelUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      Open Channel <ExternalLink className="size-3.5" />
                    </a>
                  </div>

                  {Array.isArray(app.secondaryLinks) && app.secondaryLinks.length > 0 && (
                    <div className="flex flex-wrap gap-2 text-xs">
                      {app.secondaryLinks.map((lnk, idx) => (
                        <a
                          key={idx}
                          href={lnk}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/50 px-2 py-1 text-muted-foreground hover:text-foreground"
                        >
                          Proof #{idx + 1} <ExternalLink className="size-3" />
                        </a>
                      ))}
                    </div>
                  )}

                  {app.notes && (
                    <p className="rounded-lg border border-border/50 bg-background/40 p-2.5 text-xs text-muted-foreground">
                      {app.notes}
                    </p>
                  )}

                  <div className="grid gap-2.5 sm:grid-cols-3 pt-1">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Input
                          placeholder="Exact custom code (e.g. RUSHX_PRO)"
                          value={currentCodeInput}
                          maxLength={24}
                          onChange={(e) =>
                            setCustomCodes((prev) => ({
                              ...prev,
                              [app.id]: e.target.value
                                .toUpperCase()
                                .replace(/[^A-Z0-9_-]/g, "")
                                .slice(0, 24),
                            }))
                          }
                          className="h-9 font-mono text-xs uppercase"
                        />
                        {app.requestedReferralCode &&
                          currentCodeInput !== app.requestedReferralCode && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-9 shrink-0 px-2 text-[11px]"
                              onClick={() =>
                                setCustomCodes((prev) => ({
                                  ...prev,
                                  [app.id]: app.requestedReferralCode || "",
                                }))
                              }
                            >
                              Use Requested
                            </Button>
                          )}
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Assigned verbatim if available (3–24 chars). Leave empty to auto-generate.
                      </p>
                    </div>
                    <Input
                      placeholder="Optional admin note to applicant"
                      value={adminNotes[app.id] ?? app.adminNote ?? ""}
                      onChange={(e) =>
                        setAdminNotes((prev) => ({ ...prev, [app.id]: e.target.value }))
                      }
                      className="h-9 text-xs"
                    />
                    <div className="flex items-start gap-2 justify-end">
                      <Button
                        type="button"
                        size="sm"
                        disabled={isBusy}
                        onClick={() => handleReview(app, "approve")}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white"
                      >
                        {isBusy ? (
                          <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="mr-1.5 size-3.5" />
                        )}
                        {app.status === "approved" ? "Save Exact Code" : "Approve"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={isBusy}
                        onClick={() => handleReview(app, "reject")}
                      >
                        <XCircle className="mr-1.5 size-3.5" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* Recent Referrals & Payouts Ledger */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Live Referrals &amp; Payout Ledger</CardTitle>
          <CardDescription>
            Full audit log of attributed sign-ups, Creator Wallet signup payouts, and qualifying scrim
            bonuses.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {referrals.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 py-10 text-center text-sm text-muted-foreground">
              No referrals recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="py-2.5 pr-4">Referrer</th>
                    <th className="py-2.5 pr-4">Referred Player</th>
                    <th className="py-2.5 pr-4">Type / Code</th>
                    <th className="py-2.5 pr-4">Progress</th>
                    <th className="py-2.5 pr-4">Creator Payout</th>
                    <th className="py-2.5 text-right">Scrim Bonus</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {referrals.map((ref) => (
                    <tr key={ref.id}>
                      <td className="py-3 pr-4">
                        <p className="font-medium">{ref.referrerName}</p>
                        <p className="text-[11px] text-muted-foreground">{ref.referrerEmail}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <p className="font-medium">{ref.referredName}</p>
                        <p className="text-[11px] text-muted-foreground">{ref.referredEmail}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-1.5">
                          <Badge variant={ref.referralType === "creator" ? "default" : "secondary"}>
                            {ref.referralType}
                          </Badge>
                          <code className="font-mono text-xs">{ref.referralCode}</code>
                        </div>
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs">
                        {ref.qualifyingScrimsCount} / {ref.requiredScrimsCount}
                        {ref.requiredSpendBdt > 0
                          ? ` · ৳${ref.qualifyingSpendBdt}/৳${ref.requiredSpendBdt}`
                          : ""}
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs font-bold text-primary">
                        {ref.creatorSignupPaidBdt > 0 ? `৳${ref.creatorSignupPaidBdt}` : "—"}
                      </td>
                      <td className="py-3 text-right font-mono font-bold text-emerald-400">
                        {ref.status === "rewarded"
                          ? `৳${ref.rewardAmountBdt} → ${ref.rewardRecipient === "referred_user" ? "User" : "Referrer"}`
                          : "Pending"}
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
