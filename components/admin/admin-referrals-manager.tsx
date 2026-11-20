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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  reviewCreatorApplicationAction,
  updateReferralSettingsAction,
} from "@/app/actions/referrals"
import type { CreatorApplication } from "@/lib/db/schema"
import type { ReferralProgramSettings } from "@/lib/referrals"

type EnrichedApplication = CreatorApplication & {
  applicantName: string
  applicantEmail: string
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
  status: string
  rewardAmountBdt: number
  rewardModeUsed: string | null
  rewardedAt: Date | string | null
  createdAt: Date | string
}

export function AdminReferralsManager({
  initialSettings,
  applications,
  referrals,
  summary,
}: {
  initialSettings: ReferralProgramSettings
  applications: EnrichedApplication[]
  referrals: EnrichedReferral[]
  summary: {
    totalReferrals: number
    rewardedReferrals: number
    totalPaidBdt: number
    creatorPaidBdt: number
    userPaidBdt: number
    pendingCreatorApps: number
    approvedCreators: number
  }
}) {
  const router = useRouter()
  const [savingSettings, startSaveSettings] = useTransition()
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [settings, setSettings] = useState<ReferralProgramSettings>(initialSettings)
  const [customCodes, setCustomCodes] = useState<Record<string, string>>({})
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({})
  const [appFilter, setAppFilter] = useState<"all" | "pending" | "approved" | "rejected">("all")

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

  async function handleReview(appId: string, decision: "approve" | "reject") {
    setReviewingId(appId)
    try {
      const res = await reviewCreatorApplicationAction({
        applicationId: appId,
        decision,
        customCode: customCodes[appId] || "",
        adminNote: adminNotes[appId] || "",
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      if (decision === "approve") {
        toast.success(`Creator approved! Code: ${res.referralCode}`)
      } else {
        toast.success("Creator application rejected.")
      }
      router.refresh()
    } finally {
      setReviewingId(null)
    }
  }

  const filteredApps = applications.filter((a) => (appFilter === "all" ? true : a.status === appFilter))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">
          Referrals &amp; Content Creator Management
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure Creator &amp; Normal User referral payouts, review creator applications, and audit
          rewarded referrals.
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Pending Creator Apps</span>
              <Clock className="size-4 text-amber-400" />
            </div>
            <p className="mt-1 font-heading text-3xl font-bold text-amber-400">
              {summary.pendingCreatorApps}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {summary.approvedCreators} approved creators active
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Total Referrals</span>
              <Users className="size-4 text-primary" />
            </div>
            <p className="mt-1 font-heading text-3xl font-bold">{summary.totalReferrals}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {summary.rewardedReferrals} rewarded
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Creator Payouts</span>
              <Sparkles className="size-4 text-emerald-400" />
            </div>
            <p className="mt-1 font-heading text-3xl font-bold text-emerald-400">
              ৳{summary.creatorPaidBdt}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Credited to creator wallets</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <span>User Payouts</span>
              <Wallet className="size-4 text-sky-400" />
            </div>
            <p className="mt-1 font-heading text-3xl font-bold text-sky-400">
              ৳{summary.userPaidBdt}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Total paid: ৳{summary.totalPaidBdt}
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
              Rewards credited to approved creators when a referred new user completes a paid scrim.
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
                    onClick={() => setSettings((s) => ({ ...s, creatorRewardMode: mode }))}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                      settings.creatorRewardMode === mode
                        ? "border-emerald-500 bg-emerald-500/15 text-emerald-300"
                        : "border-border/70 bg-background/40 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {mode === "fixed" ? "Fixed BDT Amount" : "Randomized Min–Max Range"}
                  </button>
                ))}
              </div>
            </div>

            {settings.creatorRewardMode === "fixed" ? (
              <div className="space-y-2">
                <Label htmlFor="creatorFixedBdt">Fixed Creator Reward (BDT)</Label>
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
                <div className="space-y-2">
                  <Label htmlFor="creatorMinBdt">Min Reward (BDT)</Label>
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
                <div className="space-y-2">
                  <Label htmlFor="creatorMaxBdt">Max Reward (BDT)</Label>
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

            <div className="space-y-2">
              <Label htmlFor="creatorMinEntryFeeBdt">Min Paid Scrim Entry Fee (BDT)</Label>
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
              <p className="text-[11px] text-muted-foreground">
                Free (৳0) giveaway scrims are always excluded from referral rewards.
              </p>
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
              Configure qualifying paid scrims count and Fixed or Randomized BDT rewards for normal
              players.
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

            <div className="grid grid-cols-2 gap-3">
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
            </div>
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

      {/* Creator Applications Review Queue */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl">
                <SlidersHorizontal className="size-5 text-primary" />
                Content Creator Applications
              </CardTitle>
              <CardDescription>
                Approve verified creators to issue a unique creator referral code, or reject ineligible
                submissions.
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
                            {app.referralCode}
                          </code>
                        )}
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
                    <Input
                      placeholder="Optional custom code (e.g. CR-ACE)"
                      value={customCodes[app.id] ?? app.referralCode ?? ""}
                      onChange={(e) =>
                        setCustomCodes((prev) => ({
                          ...prev,
                          [app.id]: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""),
                        }))
                      }
                      className="h-9 font-mono text-xs uppercase"
                    />
                    <Input
                      placeholder="Optional admin note to applicant"
                      value={adminNotes[app.id] ?? app.adminNote ?? ""}
                      onChange={(e) =>
                        setAdminNotes((prev) => ({ ...prev, [app.id]: e.target.value }))
                      }
                      className="h-9 text-xs"
                    />
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        type="button"
                        size="sm"
                        disabled={isBusy}
                        onClick={() => handleReview(app.id, "approve")}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white"
                      >
                        {isBusy ? (
                          <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="mr-1.5 size-3.5" />
                        )}
                        Approve
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={isBusy}
                        onClick={() => handleReview(app.id, "reject")}
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
            Full audit log of attributed sign-ups, qualifying paid scrims progress, and wallet payouts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {referrals.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 py-10 text-center text-sm text-muted-foreground">
              No referrals recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/70 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="py-2.5 pr-4">Referrer</th>
                    <th className="py-2.5 pr-4">Referred Player</th>
                    <th className="py-2.5 pr-4">Type / Code</th>
                    <th className="py-2.5 pr-4">Progress</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5 text-right">Payout</th>
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
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant={ref.status === "rewarded" ? "default" : "outline"}>
                          {ref.status}
                        </Badge>
                      </td>
                      <td className="py-3 text-right font-mono font-bold text-emerald-400">
                        {ref.status === "rewarded"
                          ? `৳${ref.rewardAmountBdt}${ref.rewardModeUsed === "random" ? " (rand)" : ""}`
                          : "—"}
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
