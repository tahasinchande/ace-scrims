"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Sparkles,
  CheckCircle2,
  Clock,
  XCircle,
  Copy,
  Check,
  ExternalLink,
  Plus,
  Trash2,
  ShieldCheck,
  Wallet,
  Users,
  Video,
  ArrowRight,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { submitCreatorApplicationAction } from "@/app/actions/referrals"
import type { CreatorApplication } from "@/lib/db/schema"
import type { ReferralProgramSettings } from "@/lib/referrals"

const PLATFORMS = ["YouTube", "Facebook", "TikTok", "Instagram", "Twitch", "Other"] as const

export function CreatorApplicationView({
  signedIn,
  userName,
  existingApplication,
  settings,
}: {
  signedIn: boolean
  userName?: string | null
  existingApplication: CreatorApplication | null
  settings: ReferralProgramSettings
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [creatorName, setCreatorName] = useState(existingApplication?.creatorName ?? userName ?? "")
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]>(
    (existingApplication?.platform as (typeof PLATFORMS)[number]) || "YouTube"
  )
  const [channelUrl, setChannelUrl] = useState(existingApplication?.channelUrl ?? "")
  const [secondaryLinks, setSecondaryLinks] = useState<string[]>(
    Array.isArray(existingApplication?.secondaryLinks) && existingApplication.secondaryLinks.length > 0
      ? existingApplication.secondaryLinks
      : [""]
  )
  const [followerCount, setFollowerCount] = useState(existingApplication?.followerCount ?? "")
  const [averageViews, setAverageViews] = useState(existingApplication?.averageViews ?? "")
  const [whatsapp, setWhatsapp] = useState(existingApplication?.whatsapp ?? "")
  const [notes, setNotes] = useState(existingApplication?.notes ?? "")
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const rewardLabel =
    settings.creatorRewardMode === "random"
      ? `৳${settings.creatorMinBdt} – ৳${settings.creatorMaxBdt}`
      : `৳${settings.creatorFixedBdt}`

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://www.acescrims.online"
  const creatorCode = existingApplication?.status === "approved" ? existingApplication.referralCode : null
  const creatorLink = creatorCode ? `${origin}/sign-up?ref=${encodeURIComponent(creatorCode)}` : ""

  function copyValue(key: string, value: string) {
    if (!value) return
    navigator.clipboard.writeText(value).then(() => {
      setCopiedKey(key)
      toast.success("Copied to clipboard")
      setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 2000)
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await submitCreatorApplicationAction({
        creatorName,
        platform,
        channelUrl,
        secondaryLinks: secondaryLinks.map((l) => l.trim()).filter(Boolean),
        followerCount,
        averageViews,
        whatsapp,
        notes,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success("Creator application submitted! Our team will review it shortly.")
      router.refresh()
    })
  }

  const canApply = !existingApplication || existingApplication.status === "rejected"

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      {/* Hero Banner */}
      <section className="glass-strong relative overflow-hidden rounded-2xl border border-primary/25 p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3 max-w-2xl">
            <Badge className="bg-primary/15 text-primary border-primary/30 uppercase tracking-wider text-[11px] font-bold">
              <Sparkles className="mr-1.5 size-3.5" />
              Ace Scrims Content Creator Program
            </Badge>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Partner With Ace Scrims &amp; Earn Per Referred Player
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed sm:text-base">
              Streamers, YouTubers, TikTokers, and Free Fire esports creators can apply for an official
              creator referral code. Once approved by our admin team, every new player who signs up using
              your code and plays a paid scrim earns instant BDT credit directly into your Ace Scrims wallet.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-[260px]">
            <div className="rounded-xl border border-border/70 bg-background/60 p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Creator Reward
              </p>
              <p className="mt-1 font-heading text-2xl font-bold text-primary">{rewardLabel}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {settings.creatorRewardMode === "random" ? "Randomized per player" : "Fixed per player"}
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/60 p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Qualifying Trigger
              </p>
              <p className="mt-1 font-heading text-2xl font-bold text-emerald-400">1st Paid</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Min ৳{settings.creatorMinEntryFeeBdt} paid scrim
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Program Highlights */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5 space-y-2">
            <Video className="size-5 text-primary" />
            <h3 className="font-heading text-lg font-bold">Verified Creator Code</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Approved creators unlock a unique custom code &amp; shareable link tracked across both Email
              and Google sign-ups.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 space-y-2">
            <Wallet className="size-5 text-emerald-400" />
            <h3 className="font-heading text-lg font-bold">Automatic BDT Payouts</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Rewards are credited automatically to your Ace Scrims wallet balance as soon as your referred
              player confirms their first paid scrim slot.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 space-y-2">
            <ShieldCheck className="size-5 text-sky-400" />
            <h3 className="font-heading text-lg font-bold">Strict Fair-Play Tracking</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Codes lock permanently at sign-up with self-referral and duplicate-payout blocks so creator
              stats stay accurate and trustworthy.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Status Card for Existing Approved / Pending / Rejected Application */}
      {existingApplication && (
        <Card
          className={
            existingApplication.status === "approved"
              ? "border-emerald-500/40 bg-emerald-500/5"
              : existingApplication.status === "pending"
                ? "border-amber-500/40 bg-amber-500/5"
                : "border-destructive/40 bg-destructive/5"
          }
        >
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {existingApplication.status === "approved" ? (
                  <CheckCircle2 className="size-5 text-emerald-400" />
                ) : existingApplication.status === "pending" ? (
                  <Clock className="size-5 text-amber-400" />
                ) : (
                  <XCircle className="size-5 text-destructive" />
                )}
                <div>
                  <CardTitle className="text-lg">
                    {existingApplication.status === "approved"
                      ? "Official Ace Scrims Creator — Approved"
                      : existingApplication.status === "pending"
                        ? "Creator Application Under Review"
                        : "Previous Application Not Approved"}
                  </CardTitle>
                  <CardDescription>
                    Channel: {existingApplication.creatorName} ({existingApplication.platform})
                  </CardDescription>
                </div>
              </div>
              <Badge
                variant={
                  existingApplication.status === "approved"
                    ? "default"
                    : existingApplication.status === "pending"
                      ? "secondary"
                      : "destructive"
                }
                className="uppercase tracking-wider"
              >
                {existingApplication.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {existingApplication.adminNote && (
              <div className="rounded-lg border border-border/60 bg-background/60 p-3 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Admin Note: </span>
                {existingApplication.adminNote}
              </div>
            )}

            {creatorCode && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-emerald-500/30 bg-background/80 p-4 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Your Exclusive Creator Code
                  </p>
                  <div className="flex items-center justify-between gap-2">
                    <code className="font-mono text-xl font-bold tracking-wider text-emerald-400">
                      {creatorCode}
                    </code>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => copyValue("code", creatorCode)}
                    >
                      {copiedKey === "code" ? <Check className="size-4" /> : <Copy className="size-4" />}
                      <span className="ml-1.5">Copy</span>
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border border-primary/30 bg-background/80 p-4 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Creator Invite Link
                  </p>
                  <div className="flex items-center gap-2">
                    <Input value={creatorLink} readOnly className="h-9 font-mono text-xs" />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => copyValue("link", creatorLink)}
                    >
                      {copiedKey === "link" ? <Check className="size-4" /> : <Copy className="size-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {existingApplication.status === "approved" && (
              <div className="flex flex-wrap gap-3 pt-1">
                <Button asChild size="sm">
                  <Link href="/dashboard/referrals">
                    <Users className="mr-1.5 size-4" />
                    Open Referral Dashboard
                    <ArrowRight className="ml-1.5 size-4" />
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Application Form */}
      {canApply && (
        <Card className="glass-strong border-border/80">
          <CardHeader>
            <CardTitle className="font-heading text-2xl">
              {existingApplication?.status === "rejected"
                ? "Re-Apply for Content Creator Program"
                : "Apply as a Content Creator"}
            </CardTitle>
            <CardDescription>
              Submit your primary channel/profile link and proof of active gaming or esports content. Only
              admin-approved creators receive an official Creator Referral Code.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!signedIn ? (
              <div className="rounded-xl border border-primary/25 bg-primary/5 p-6 text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  Sign in or create an Ace Scrims account first so we can link your creator referral code
                  and wallet payouts directly to your profile.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Button asChild>
                    <Link href="/sign-in?next=/creators">Sign In to Apply</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/sign-up">Create Account</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="creatorName">Creator / Channel Name *</Label>
                    <Input
                      id="creatorName"
                      value={creatorName}
                      onChange={(e) => setCreatorName(e.target.value)}
                      placeholder="e.g. AceFF Gaming"
                      required
                      maxLength={80}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="platform">Primary Platform *</Label>
                    <select
                      id="platform"
                      value={platform}
                      onChange={(e) => setPlatform(e.target.value as (typeof PLATFORMS)[number])}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {PLATFORMS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="channelUrl">Primary Channel / Profile Link (Proof) *</Label>
                  <Input
                    id="channelUrl"
                    type="url"
                    value={channelUrl}
                    onChange={(e) => setChannelUrl(e.target.value)}
                    placeholder="https://youtube.com/@yourchannel"
                    required
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="followerCount">Followers / Subscribers *</Label>
                    <Input
                      id="followerCount"
                      value={followerCount}
                      onChange={(e) => setFollowerCount(e.target.value)}
                      placeholder="e.g. 12.5K"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="averageViews">Average Views / Live Viewers</Label>
                    <Input
                      id="averageViews"
                      value={averageViews}
                      onChange={(e) => setAverageViews(e.target.value)}
                      placeholder="e.g. 2,500 per video"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="whatsapp">WhatsApp Number *</Label>
                    <Input
                      id="whatsapp"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="01XXXXXXXXX"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Additional Proof Links (Optional — TikTok, Facebook, Recent Video)</Label>
                    {secondaryLinks.length < 5 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSecondaryLinks((prev) => [...prev, ""])}
                      >
                        <Plus className="mr-1 size-3.5" /> Add Link
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    {secondaryLinks.map((linkVal, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Input
                          type="url"
                          value={linkVal}
                          onChange={(e) =>
                            setSecondaryLinks((prev) =>
                              prev.map((item, i) => (i === idx ? e.target.value : item))
                            )
                          }
                          placeholder="https://facebook.com/yourpage or video proof link"
                        />
                        {secondaryLinks.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              setSecondaryLinks((prev) => prev.filter((_, i) => i !== idx))
                            }
                            aria-label="Remove link"
                          >
                            <Trash2 className="size-4 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Content Details &amp; Promotion Plan</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Tell us about your Free Fire content, upload/live schedule, and how you plan to promote Ace Scrims..."
                    rows={4}
                    maxLength={1200}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <p className="text-xs text-muted-foreground">
                    Applications are manually reviewed by Ace Scrims administrators.
                  </p>
                  <Button type="submit" disabled={pending} className="glow-primary font-semibold">
                    {pending ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        Submit Creator Application
                        <ExternalLink className="ml-2 size-4" />
                      </>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
