"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Countdown } from "@/components/site/countdown"
import { bdt, scrimStatus, scrimStartDate, formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Clock, Users, Trophy, MapPin, Swords, CalendarDays, ScrollText, StickyNote, Award, CheckCircle2, Lock, MessageCircle } from "lucide-react"
import { useLanguage } from "@/lib/language"
import type { ScrimWithSlots } from "@/lib/queries/scrims"
import { getRandomScrimImage } from "@/lib/scrim-images"
import { getScrimPrizeBreakdown } from "@/lib/prizepool"
import { ScrimRules } from "@/components/scrims/scrim-rules"

const toneStyles: Record<string, string> = {
  open: "bg-success/15 text-success border-success/30",
  filling: "bg-warning/15 text-warning border-warning/30",
  full: "bg-destructive/15 text-destructive border-destructive/30",
  closed: "bg-muted text-muted-foreground border-border",
}

export function ScrimDetailView({
  scrim,
  isConfirmed = false,
  championRushWhatsappUrl = "https://whatsapp.com/channel/0029Vb7Bq9w42DcT1O2b0s3V",
  championRush3pmWhatsappUrl = "https://whatsapp.com/channel/0029Vb7Bq9w42DcT1O2b0s3V",
}: {
  scrim: ScrimWithSlots
  isConfirmed?: boolean
  championRushWhatsappUrl?: string
  championRush3pmWhatsappUrl?: string
}) {
  const { lang, t } = useLanguage()
  const isBn = lang === "bn"

  // Dynamic slot counting: poll slots in real-time
  const [confirmedCount, setConfirmedCount] = useState(scrim.confirmedTeams)
  const [maxCount, setMaxCount] = useState(scrim.maxTeams)
  const [regOpen, setRegOpen] = useState(scrim.registrationOpen)
  const [scrimState, setScrimState] = useState(scrim.status)

  useEffect(() => {
    let active = true
    async function poll() {
      try {
        const { getScrimSlots } = await import("@/app/actions/booking")
        const res = await getScrimSlots(scrim.id || scrim.slug)
        if (active && res) {
          setConfirmedCount(res.confirmed)
          if (res.maxTeams) setMaxCount(res.maxTeams)
          if (res.registrationOpen !== undefined) setRegOpen(res.registrationOpen)
          if (res.status) setScrimState(res.status)
        }
      } catch {}
    }

    poll()
    const timer = setInterval(poll, 10000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [scrim.id, scrim.slug])

  const status = scrimStatus(confirmedCount, maxCount, regOpen, scrimState, scrim.scrimDate, scrim.startTime)
  const remaining = Math.max(0, maxCount - confirmedCount)
  const start = scrimStartDate(scrim.scrimDate, scrim.startTime)
  const banner = scrim.bannerUrl && !scrim.bannerUrl.includes("map-")
    ? scrim.bannerUrl
    : getRandomScrimImage(scrim.slug || scrim.id || scrim.title)
  const bookable = status.tone === "open" || status.tone === "filling"

  const timeMatch = scrim.startTime.match(/^(\d{1,2}:\d{2})\s*(AM|PM)?$/i)
  const timeDigits = timeMatch ? timeMatch[1] : scrim.startTime
  const timePeriod = timeMatch && timeMatch[2] ? timeMatch[2] : ""

  const translatedStatus =
    status.tone === "open"
      ? t("status_open", "OPEN")
      : status.tone === "filling"
        ? t("status_filling", "FILLING FAST")
        : status.tone === "full"
          ? t("status_full", "FULL")
          : status.label

  const isChampionRush =
    scrim.title.toLowerCase().includes("champion rush") ||
    scrim.slug.toLowerCase().includes("champion-rush") ||
    scrim.id.includes("-cr")

  const isFridaySpecial =
    scrim.title.toLowerCase().includes("friday special") ||
    scrim.slug.toLowerCase().includes("friday-special")

  const mapValue = isChampionRush
    ? (scrim.map || (isBn ? "চ্যাম্পিয়ন মোড (সর্বোচ্চ ৮ ম্যাচ)" : "Champion Mode (Max 8 Matches)"))
    : isFridaySpecial
      ? (isBn ? "৫টি ম্যাচ (বারমুডা, পারগেটরি, কালাহারি, সোলানা ও নেক্সটেরা)" : "5 Matches (Bermuda, Purgatory, Kalahari, Solana, Nexterra)")
      : (isBn ? "৩টি ম্যাচ (বারমুডা, পারগেটরি ও কালাহারি)" : "3 Matches (BERMUDA, PURGATORY & KALAHARI)")

  const modeValue = isChampionRush
    ? "8 MATCHES BATTLE ROYALE"
    : isFridaySpecial
      ? "5 MATCHES BATTLE ROYALE"
      : scrim.mode

  const prizeBreakdown = getScrimPrizeBreakdown(scrim)

  const stats = [
    {
      icon: Clock,
      label: isBn ? "শুরু হওয়ার সময়" : "Start Time",
      value: (
        <span>
          <span className="font-bold">{timeDigits}</span> {timePeriod} {isBn ? (isChampionRush ? "(২ ঘণ্টা)" : isFridaySpecial ? "(২ ঘণ্টা)" : "(১ ঘণ্টা)") : (isChampionRush ? "(2 hours)" : isFridaySpecial ? "(2 hours)" : "(1 hour)")}
        </span>
      ),
    },
    { icon: CalendarDays, label: isBn ? "তারিখ" : "Date", value: formatDate(scrim.scrimDate) },
    { icon: MapPin, label: isBn ? "ম্যাপ / ফরম্যাট" : "Map / Format", value: mapValue },
    { icon: Swords, label: isBn ? "মোড" : "Mode", value: modeValue },
    { icon: Trophy, label: isBn ? "প্রাইজ পুল" : "Prize Pool", value: bdt(prizeBreakdown.totalPrizeBdt || scrim.prizePoolBdt) },
    { icon: Users, label: isBn ? "স্লট" : "Slots", value: `${confirmedCount}/${maxCount} ${isBn ? "টিম" : "teams"}` },
  ]

  return (
    <main className="min-h-screen pb-20 pt-16">
      {/* Banner */}
      <div className="relative h-64 w-full overflow-hidden sm:h-80">
        <Image
          src={banner || "/placeholder.svg"}
          alt={`${scrim.map} map banner`}
          fill
          priority
          unoptimized
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/20" />
        <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-6xl px-4 pb-6 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={cn("border font-semibold", toneStyles[status.tone])}>
              {translatedStatus}
            </Badge>
            <Badge variant="outline" className="glass border-border/60 font-mono text-xs">
              {isBn ? "শুরু হতে বাকি " : "Starts in "}
              <Countdown targetIso={start.toISOString()} />
            </Badge>
          </div>
          <h1 className="mt-3 font-display text-3xl font-bold uppercase tracking-tight sm:text-5xl text-balance">
            {scrim.title}
          </h1>
        </div>
      </div>

      <div className="mx-auto mt-8 grid w-full max-w-6xl grid-cols-1 gap-8 px-4 sm:px-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="flex flex-col gap-8 lg:col-span-2">
          {scrim.description && (
            <section aria-labelledby="about-heading">
              <h2 id="about-heading" className="font-display text-xl font-bold uppercase tracking-wide">
                {isBn ? "এই স্ক্রিম সম্পর্কে" : "About this scrim"}
              </h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">{scrim.description}</p>
            </section>
          )}

          <section aria-labelledby="details-heading">
            <h2 id="details-heading" className="sr-only">
              Scrim details
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {stats.map((s) => (
                <div key={s.label} className="glass rounded-xl p-4">
                  <s.icon className="size-4 text-primary" aria-hidden />
                  <p className="mt-2 text-xs text-muted-foreground">{s.label}</p>
                  <p className="font-display text-sm font-bold">{s.value}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Prize Distribution Breakdown Section */}
          <section aria-labelledby="prize-breakdown-heading" className="glass rounded-2xl p-6 border border-amber-500/30 bg-gradient-to-b from-amber-950/20 to-card/50">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-4">
              <h2
                id="prize-breakdown-heading"
                className="flex items-center gap-2 font-display text-xl font-bold uppercase tracking-wide text-amber-400"
              >
                <Award className="size-5 text-amber-400" aria-hidden />
                {isBn ? "প্রাইজ ডিস্ট্রিবিউশন লিস্ট" : "Prize Distribution Breakdown"}
              </h2>
              <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-400 font-bold px-3 py-1 text-xs">
                {isBn ? "মোট পুল: " : "Total Pool: "}{bdt(prizeBreakdown.totalPrizeBdt)}
              </Badge>
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {prizeBreakdown.places.map((p) => {
                const isFirst = p.rank === 1
                const isSecond = p.rank === 2
                const isThird = p.rank === 3

                const cardBorder = isFirst
                  ? "border-amber-500/50 bg-amber-950/30 text-amber-300"
                  : isSecond
                  ? "border-zinc-400/50 bg-zinc-900/40 text-zinc-200"
                  : isThird
                  ? "border-amber-700/50 bg-amber-950/20 text-amber-400"
                  : "border-border/60 bg-secondary/40 text-foreground"

                const badgeBg = isFirst
                  ? "bg-amber-500 text-black font-extrabold"
                  : isSecond
                  ? "bg-zinc-300 text-black font-extrabold"
                  : isThird
                  ? "bg-amber-700 text-white font-extrabold"
                  : "bg-secondary text-muted-foreground font-semibold"

                return (
                  <div
                    key={p.rank}
                    className={cn(
                      "flex items-center justify-between rounded-xl border p-3.5 transition-all shadow-sm",
                      cardBorder
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg text-xs", badgeBg)}>
                        #{p.rank}
                      </span>
                      <div>
                        <p className="font-display text-sm font-bold">{p.place}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {isBn
                            ? isFirst ? "চ্যাম্পিয়ন স্কোয়াড" : isSecond ? "রানার্স-আপ" : `র‍্যাংক #${p.rank}`
                            : isFirst ? "Champion Squad" : isSecond ? "Runner-Up" : `Rank #${p.rank}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-base sm:text-lg font-black text-primary">{bdt(p.prizeBdt)}</p>
                      <p className="text-[10px] text-muted-foreground">{isBn ? "ক্যাশ প্রাইজ" : "Cash Prize"}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-xl bg-secondary/50 border border-border/40 p-3 text-xs text-muted-foreground">
              <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
              <span>
                {isBn
                  ? "রেজাল্ট প্রকাশের ৬ ঘণ্টার মধ্যে (সর্বোচ্চ ২৪ ঘণ্টা) ক্যাপ্টেনের বিকাশ/নগদ নাম্বারে প্রাইজ ডিস্ট্রিবিউট করা হবে।"
                  : "Prize money is sent directly to the captain's bKash/Nagad within 6 hours (Max 24 hours) after match verification."}
              </span>
            </div>
          </section>

          <section aria-labelledby="facilities-heading" className="glass rounded-2xl p-6">
            <h2
              id="facilities-heading"
              className="flex items-center gap-2 font-display text-xl font-bold uppercase tracking-wide text-primary"
            >
              <Trophy className="size-5" aria-hidden />
              {t("facilities_heading", "Facilities & Rewards")}
            </h2>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex items-center gap-3 rounded-xl bg-secondary/50 p-3.5 text-sm font-medium">
                <span className="flex size-7 items-center justify-center rounded-lg bg-primary/20 text-primary font-bold">1</span>
                {isChampionRush
                  ? (isBn ? "টপ ৪ প্রাইজ পুল" : "Top 4 Prize Pool")
                  : isFridaySpecial
                  ? (isBn ? "টপ ৫ প্রাইজ পুল" : "Top 5 Prize Pool")
                  : t("facility_1", "Top 3 Prize Pool")}
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-secondary/50 p-3.5 text-sm font-medium">
                <span className="flex size-7 items-center justify-center rounded-lg bg-primary/20 text-primary font-bold">2</span>
                {t("facility_2", "Top 3 Face Banner")}
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-secondary/50 p-3.5 text-sm font-medium">
                <span className="flex size-7 items-center justify-center rounded-lg bg-primary/20 text-primary font-bold">3</span>
                {t("facility_3", "MVP Face Banner")}
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-secondary/50 p-3.5 text-sm font-medium">
                <span className="flex size-7 items-center justify-center rounded-lg bg-primary/20 text-primary font-bold">4</span>
                {t("facility_4", "Overall Standing Banner")}
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-secondary/50 p-3.5 text-sm font-medium sm:col-span-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-accent/20 text-accent font-bold">5</span>
                {t("facility_5", "Complete Payment within 6 hours")}
              </div>
            </div>
          </section>

          {/* Official Champion Rush WhatsApp Channel Link - strictly visible ONLY to users with confirmed registration */}
          {isChampionRush && isConfirmed && (() => {
            const is3pmCR = Boolean(
              scrim.id?.includes("3pm-cr") ||
              scrim.slug?.includes("3-pm-champion-rush") ||
              scrim.title?.toLowerCase().includes("3 pm champion rush") ||
              (scrim.title?.toLowerCase().includes("champion rush") && (scrim.startTime?.includes("3:00") || scrim.startTime?.includes("15:00")))
            )
            const targetWhatsappUrl = (is3pmCR ? championRush3pmWhatsappUrl : championRushWhatsappUrl) || "https://whatsapp.com/channel/0029Vb7Bq9w42DcT1O2b0s3V"
            const channelTitle = is3pmCR
              ? (isBn ? "অফিসিয়াল ৩ টা চ্যাম্পিয়ন রাশ হোয়াটসঅ্যাপ চ্যানেল" : "Official 3 PM Champion Rush WhatsApp Channel")
              : (isBn ? "অফিসিয়াল ১০ টা চ্যাম্পিয়ন রাশ হোয়াটসঅ্যাপ চ্যানেল" : "Official 10 PM Champion Rush WhatsApp Channel")

            return (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5 shadow-sm">
                <div className="flex flex-col gap-1">
                  <span className="flex items-center gap-1.5 font-display text-sm font-bold uppercase tracking-wider text-emerald-400">
                    <MessageCircle className="size-4" />
                    {channelTitle}
                  </span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {isBn
                      ? "আপনার টিম নিশ্চিত করা হয়েছে। ম্যাচ রুম আইডি, পাসওয়ার্ড ও লাইভ আপডেট সরাসরি এই চ্যানেলে পোস্ট করা হবে।"
                      : "Your squad is confirmed! Match credentials, announcements, and live room coordination are posted directly in this channel."}
                  </p>
                </div>
                <a
                  href={targetWhatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-500 transition-colors shadow-lg shrink-0"
                >
                  <MessageCircle className="size-4" />
                  {isBn ? "হোয়াটসঅ্যাপ চ্যানেলে যোগ দিন" : "Join WhatsApp Channel"}
                </a>
              </div>
            )
          })()}

          <ScrimRules scrim={scrim} />

          {scrim.notes && (
            <section aria-labelledby="notes-heading" className="glass rounded-2xl p-6">
              <h2
                id="notes-heading"
                className="flex items-center gap-2 font-display text-xl font-bold uppercase tracking-wide"
              >
                <StickyNote className="size-5 text-accent" aria-hidden />
                {t("notes_heading", "Important Notes")}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {isBn && scrim.notes.toLowerCase().includes("within 6 hours")
                  ? "ফলাফল প্রকাশের ৬ ঘণ্টার মধ্যে (সর্বোচ্চ ২৪ ঘণ্টা) ক্যাপ্টেনের বিকাশ/নগদে প্রাইজ মানি প্রদান করা হবে। রুমে অনটাইমে জয়েন করবেন। কোনোপ্রকার এমুলেটর প্লেয়ার এলাউড নেই।"
                  : scrim.notes}
              </p>
            </section>
          )}
        </div>

        {/* Booking sidebar */}
        <aside className="lg:sticky lg:top-24 lg:self-start flex flex-col gap-4">
          <div className="glass-strong rounded-2xl p-6">
            <div className="flex items-baseline justify-between">
              <p className="font-display text-3xl font-bold text-primary">{bdt(scrim.priceBdt)}</p>
              <p className="text-sm text-muted-foreground">{isBn ? "প্রতি টিম" : "per team"}</p>
            </div>

            <div className="mt-5">
              <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                <span>{remaining} {isBn ? "টি স্লট বাকি" : "spots left"}</span>
                <span>
                  {confirmedCount}/{maxCount} {isBn ? "বুকড" : "booked"}
                </span>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-secondary"
                role="progressbar"
                aria-valuenow={confirmedCount}
                aria-valuemin={0}
                aria-valuemax={maxCount}
                aria-label="Slots filled"
              >
                <div
                  className={cn(
                    "h-full rounded-full",
                    status.tone === "full"
                      ? "bg-destructive"
                      : status.tone === "filling"
                        ? "bg-warning"
                        : "bg-primary",
                  )}
                  style={{ width: `${Math.min(100, (confirmedCount / maxCount) * 100)}%` }}
                />
              </div>
            </div>

            {/* Quick Prize Summary in Sidebar */}
            <div className="mt-5 rounded-xl border border-border/60 bg-secondary/40 p-3.5 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-muted-foreground">{isBn ? "প্রাইজ পুল:" : "Prize Pool:"}</span>
                <span className="font-display font-bold text-amber-400">{bdt(prizeBreakdown.totalPrizeBdt)}</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-border/40 text-center">
                {prizeBreakdown.places.slice(0, 3).map((p) => (
                  <div key={p.rank} className="rounded bg-background/50 py-1 px-1 text-[10px]">
                    <span className="text-muted-foreground block">
                      {isBn ? (p.rank === 1 ? "১ম" : p.rank === 2 ? "২য়" : "৩য়") : (p.rank === 1 ? "1st" : p.rank === 2 ? "2nd" : "3rd")}
                    </span>
                    <span className="font-bold text-primary">{bdt(p.prizeBdt)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              {bookable ? (
                <Button asChild size="lg" className="h-12 w-full bg-primary hover:bg-primary/90 text-primary-foreground font-display text-sm font-bold uppercase tracking-wider border border-primary/50 shadow-md shadow-primary/20">
                  <Link href={`/book/${scrim.slug}`}>{isBn ? "আপনার স্লট বুক করুন" : "Book Your Spot"}</Link>
                </Button>
              ) : (
                <Button size="lg" variant="secondary" className="h-12 w-full font-display text-sm font-bold uppercase tracking-wider border border-border/50" disabled>
                  {status.tone === "full" ? (isBn ? "লবি ফুল" : "Lobby Full") : (isBn ? "রেজিস্ট্রেশন বন্ধ" : "Registration Closed")}
                </Button>
              )}
              <p className="text-center text-xs leading-relaxed text-muted-foreground">
                {isBn
                  ? "বিকাশ বা নগদে পেমেন্ট করার সাথে সাথেই বুকিং নিশ্চিত হবে। প্রকাশ হওয়ার পর রুম আইডি ও পাসওয়ার্ড আপনার ড্যাশবোর্ডে দেখতে পাবেন।"
                  : "Instant confirmation after payment via bKash or Nagad. Room ID & password appear in your dashboard once published."}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </main>
  )
}

