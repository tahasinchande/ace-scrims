"use client"

import { useState } from "react"
import Link from "next/link"
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
  Lock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { CreatorApplication } from "@/lib/db/schema"
import type { ReferralProgramSettings } from "@/lib/referrals"

type ReferralRow = {
  id: string
  referredUserId: string
  referredUserName: string
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

export function DashboardReferralsView({
  userCode,
  creatorApplication,
  settings,
  referredByCode,
  referredByType,
  referrals,
  stats,
}: {
  userCode: string | null
  creatorApplication: CreatorApplication | null
  settings: ReferralProgramSettings
  referredByCode: string | null
  referredByType: string | null
  referrals: ReferralRow[]
  stats: {
    totalReferrals: number
    rewardedCount: number
    pendingCount: number
    totalEarnedBdt: number
    creatorEarnedBdt: number
    userEarnedBdt: number
  }
}) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
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

  const creatorRewardLabel =
    settings.creatorRewardMode === "random"
      ? `৳${settings.creatorMinBdt} – ৳${settings.creatorMaxBdt}`
      : `৳${settings.creatorFixedBdt}`

  function copy(key: string, value: string) {
    if (!value) return
    navigator.clipboard.writeText(value).then(() => {
      setCopiedKey(key)
      toast.success("Copied to clipboard")
      setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 2000)
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold tracking-tight">Referrals &amp; Creator Rewards</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Invite squads to Ace Scrims and earn automatic BDT wallet balance when they play paid scrims.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href="/creators">
            <Sparkles className="mr-1.5 size-4 text-primary" />
            {approvedCreatorCode ? "Creator Program Status" : "Apply as Content Creator"}
          </Link>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Earned
            </p>
            <p className="mt-1 font-heading text-3xl font-bold text-emerald-400">
              ৳{stats.totalEarnedBdt}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">Credited directly to wallet</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Invited
            </p>
            <p className="mt-1 font-heading text-3xl font-bold">{stats.totalReferrals}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Email &amp; Google sign-ups</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Rewarded Players
            </p>
            <p className="mt-1 font-heading text-3xl font-bold text-primary">{stats.rewardedCount}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Completed qualifying scrims</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              In Progress
            </p>
            <p className="mt-1 font-heading text-3xl font-bold text-amber-400">{stats.pendingCount}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Awaiting paid scrims</p>
          </CardContent>
        </Card>
      </div>

      {/* Normal User Referral Code + Content Creator Code */}
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
              Earn <span className="font-semibold text-foreground">{userRewardLabel}</span> when a new
              player signs up with your code and completes{" "}
              <span className="font-semibold text-foreground">
                {settings.userQualifyingScrims} paid scrim{settings.userQualifyingScrims > 1 ? "s" : ""}
              </span>{" "}
              (min ৳{settings.userMinEntryFeeBdt} entry fee).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-border/80 bg-background/70 px-4 py-3">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Referral Code</p>
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
                Direct Sign-Up Link (Auto-fills Email &amp; Google Sign-Up)
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
                Content Creator Referral
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
                  ? "Approved Creator"
                  : creatorApplication?.status === "pending"
                    ? "Pending Review"
                    : "Creator Program"}
              </Badge>
            </div>
            <CardDescription>
              Approved creators earn{" "}
              <span className="font-semibold text-foreground">{creatorRewardLabel}</span> on every
              referred player&apos;s first paid scrim (min ৳{settings.creatorMinEntryFeeBdt}).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {approvedCreatorCode ? (
              <>
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
              </>
            ) : (
              <div className="rounded-xl border border-border/70 bg-background/50 p-4 space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {creatorApplication?.status === "pending"
                    ? `Your creator application for "${creatorApplication.creatorName}" is currently under admin review. Your exclusive creator referral code will unlock automatically upon approval.`
                    : "Are you a YouTuber, TikToker, Facebook streamer, or Free Fire content creator? Apply with proof of your channel to unlock Creator referral rewards."}
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

      {/* Account Referral Lock Status & Fair Play Notice */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-secondary/20 px-4 py-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary shrink-0" />
          <span>
            Anti-abuse protection: Referral codes apply exclusively during new account sign-up (max 1 per
            account), block self-referrals, and never count free (৳0) scrims.
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
          <Lock className="size-3.5 text-muted-foreground" />
          {referredByCode
            ? `Joined with ${referredByType === "creator" ? "Creator" : "Player"} code: ${referredByCode}`
            : "Account referral status locked at registration"}
        </span>
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
                Live tracking of invited players, qualifying paid scrims, and wallet payouts.
              </CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/wallet">
                <Wallet className="mr-1.5 size-4" />
                View Wallet
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
                    <th className="py-2.5 pr-4">Paid Scrims</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5 text-right">Reward</th>
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
                        {ref.qualifyingScrimsCount} / {ref.requiredScrimsCount}
                      </td>
                      <td className="py-3 pr-4">
                        {ref.status === "rewarded" ? (
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
                        {ref.status === "rewarded" ? `+৳${ref.rewardAmountBdt}` : "—"}
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
