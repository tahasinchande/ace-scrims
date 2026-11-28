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
  AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { submitCreatorApplicationAction } from "@/app/actions/referrals"
import type { CreatorApplication } from "@/lib/db/schema"
import type { PublicReferralSettings } from "@/lib/referrals"

const PLATFORMS = ["YouTube", "Facebook", "TikTok", "Instagram", "Twitch", "Other"] as const

export function CreatorApplicationView({
  signedIn,
  userName,
  existingApplication,
  settings,
  creatorBalance = 0,
  creatorSignupCount = 0,
}: {
  signedIn: boolean
  userName?: string | null
  existingApplication: CreatorApplication | null
  settings: PublicReferralSettings
  creatorBalance?: number
  creatorSignupCount?: number
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
  const [requestedReferralCode, setRequestedReferralCode] = useState(
    existingApplication?.requestedReferralCode ?? ""
  )
  const [notes, setNotes] = useState(existingApplication?.notes ?? "")
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const declaredUserBonusLabel =
    settings.creatorDeclaredMode === "random"
      ? `৳${settings.creatorDeclaredMinBdt} – ৳${settings.creatorDeclaredMaxBdt}`
      : `৳${settings.creatorDeclaredFixedBdt}`

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
        requestedReferralCode: requestedReferralCode.trim(),
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
      <section className="dc-surface relative overflow-hidden rounded-2xl border border-primary/25 p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3 max-w-2xl">
            <Badge className="bg-primary/15 text-primary border-primary/30 uppercase tracking-wider text-[11px] font-bold">
              <Sparkles className="mr-1.5 size-3.5" />
              RushX Organization Content Creator Program
            </Badge>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Partner With RushX Organization &amp; Grow Your Creator Wallet
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed sm:text-base">
              Streamers, YouTubers, TikTokers, and Free Fire esports creators can apply for an official
              creator referral code. Once approved, you earn{" "}
              <strong className="text-foreground">৳{settings.creatorPerSignupPayoutBdt} per valid signup</strong>{" "}
              directly into your separate withdrawable Creator Wallet, while players joining with your
              code unlock an estimated <strong className="text-foreground">{declaredUserBonusLabel}</strong>{" "}
              welcome bonus on their qualifying paid scrim.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-[280px]">
            <div className="rounded-xl border border-border/70 bg-background/60 p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Creator Earning
              </p>
              <p className="mt-1 font-heading text-2xl font-bold text-primary tabular-nums">
                ৳{settings.creatorPerSignupPayoutBdt}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Per valid signup (Creator Wallet)
              </p>
            </div>
            <div className="rounded-xl border border-border/70 bg-background/60 p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Audience Bonus
              </p>
              <p className="mt-1 font-heading text-2xl font-bold text-emerald-400 tabular-nums">
                {declaredUserBonusLabel}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Est. user bonus · min ৳{settings.creatorMinEntryFeeBdt} scrim
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
              Approved creators unlock a unique custom code &amp; shareable link tracked across Email,
              Google sign-up, and the 6-hour post-signup redemption window.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 space-y-2">
            <Wallet className="size-5 text-emerald-400" />
            <h3 className="font-heading text-lg font-bold">Separate Creator Wallet</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Earn per valid signup into a dedicated Creator Wallet and submit withdrawal requests via
              admin-approved payout methods starting at ৳{settings.creatorMinWithdrawalBdt}.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 space-y-2">
            <ShieldCheck className="size-5 text-sky-400" />
            <h3 className="font-heading text-lg font-bold">Community Welcome Bonus</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              New players who register or redeem your creator code receive an estimated{" "}
              {declaredUserBonusLabel} bonus after completing {settings.creatorQualifyingScrims}{" "}
              qualifying paid scrim{settings.creatorQualifyingScrims > 1 ? "s" : ""}.
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
                      ? "Official RushX Organization Creator — Approved"
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

            {existingApplication.status === "pending" && existingApplication.requestedReferralCode && (
              <div className="rounded-lg border border-amber-500/30 bg-background/60 p-3 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
                <span>
                  <span className="font-semibold text-foreground">Requested Custom Referral Code: </span>
                  <code className="rounded bg-amber-500/15 px-2 py-0.5 font-mono font-bold text-amber-300">
                    {existingApplication.requestedReferralCode}
                  </code>
                </span>
                <span className="text-[11px]">Pending admin review &amp; assignment</span>
              </div>
            )}

            {creatorCode && (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-emerald-500/30 bg-background/80 p-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Total Code Signups
                    </p>
                    <p className="mt-1 font-mono text-2xl font-bold text-emerald-400 tabular-nums">
                      {creatorSignupCount}
                    </p>
                  </div>
                  <div className="rounded-xl border border-primary/30 bg-background/80 p-3.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Creator Wallet Balance
                    </p>
                    <p className="mt-1 font-mono text-2xl font-bold text-primary tabular-nums">
                      ৳{creatorBalance}
                    </p>
                  </div>
                </div>

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
              </>
            )}

            {existingApplication.status === "approved" && (
              <div className="flex flex-wrap gap-3 pt-1">
                <Button asChild size="sm">
                  <Link href="/dashboard/referrals">
                    <Users className="mr-1.5 size-4" />
                    Open Creator Wallet &amp; Withdrawals
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
        <Card className="dc-surface border-border/80">
          <CardHeader>
            <CardTitle className="font-heading text-2xl">
              {existingApplication?.status === "rejected"
                ? "Re-Apply for Content Creator Program"
                : "Apply as a Content Creator"}
            </CardTitle>
            <CardDescription>
              Submit your primary channel/profile link and genuine proof of active gaming or esports
              content. Only admin-approved creators receive an official Creator Referral Code.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* PERMANENT BAN WARNING FOR FRAUDULENT APPLICATIONS */}
            <div
              role="alert"
              className="flex items-start gap-3 rounded-xl border border-red-500/50 bg-red-500/10 p-4 text-sm"
            >
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-red-400" />
              <div className="space-y-1">
                <p className="font-display text-sm font-bold uppercase tracking-wider text-red-300">
                  Zero-Tolerance Warning: Permanent Ban Policy
                </p>
                <p className="text-xs leading-relaxed text-red-200/90">
                  Submitting fake, impersonated, stolen, or fraudulent creator channels, follower
                  counts, or proof links will result in an immediate{" "}
                  <strong className="font-bold text-white underline decoration-red-400">
                    PERMANENT BAN
                  </strong>{" "}
                  of your RushX Organization account and forfeiture of all pending balances. Only apply with
                  authentic channels you personally own and manage.
                </p>
              </div>
            </div>

            {!signedIn ? (
              <div className="rounded-xl border border-primary/25 bg-primary/5 p-6 text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  Sign in or create a RushX Organization account first so we can link your creator referral code
                  and Creator Wallet payouts directly to your profile.
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
                      placeholder="e.g. RushX FF Gaming"
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

                {/* Exact Custom Referral Code Request */}
                <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Label htmlFor="requestedReferralCode" className="font-semibold text-foreground">
                      Requested Exact Custom Referral Code (Optional)
                    </Label>
                    <span className="text-[11px] font-mono text-muted-foreground">
                      3–24 chars · A–Z, 0–9, _ or -
                    </span>
                  </div>
                  <Input
                    id="requestedReferralCode"
                    value={requestedReferralCode}
                    onChange={(e) =>
                      setRequestedReferralCode(
                        e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 24)
                      )
                    }
                    placeholder="e.g. RUSHX_PRO or YOURNAME"
                    maxLength={24}
                    className="font-mono uppercase tracking-wider"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Request the exact referral code you want our admin team to assign upon approval.
                    {requestedReferralCode.trim().length >= 3 ? (
                      <>
                        {" "}
                        Preview:{" "}
                        <code className="rounded bg-background/80 px-1.5 py-0.5 font-mono text-primary">
                          {origin}/sign-up?ref={requestedReferralCode.trim()}
                        </code>
                      </>
                    ) : null}
                  </p>
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
                    placeholder="Tell us about your Free Fire content, upload/live schedule, and how you plan to promote RushX Organization..."
                    rows={4}
                    maxLength={1200}
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <p className="text-xs text-muted-foreground">
                    Applications are manually verified. Fraudulent submissions result in a permanent ban.
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
