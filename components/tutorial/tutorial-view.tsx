"use client"

import { parseVideoEmbed } from "@/lib/video-parser"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Users, CreditCard, KeyRound, Trophy, ArrowRight, ShieldCheck } from "lucide-react"
import { useLanguage } from "@/lib/language"
import type { Tutorial } from "@/lib/db/schema"
import type { LiveShowcaseSummary } from "@/lib/queries/showcase"

export function TutorialView({
  tutorials = [],
  showcase,
}: {
  tutorials?: Tutorial[]
  showcase?: LiveShowcaseSummary
}) {
  const { lang } = useLanguage()
  const isBn = lang === "bn"

  const lobbyCountTextEn =
    showcase && showcase.activeScrimCount > 0
      ? `${showcase.activeScrimCount} live ${showcase.activeScrimCount === 1 ? "lobby" : "lobbies"}${showcase.timeWindow ? ` (${showcase.timeWindow})` : ""}`
      : "today's live scheduled lobbies"

  const entryLabelEn = showcase?.minEntryFeeBdt
    ? `from ৳${showcase.minEntryFeeBdt}`
    : "the listed entry fee"

  const entryLabelBn = showcase?.minEntryFeeBdt
    ? `৳${showcase.minEntryFeeBdt} থেকে শুরু`
    : "নির্ধারিত এনট্রি ফি"

  const prizeLabelEn = showcase?.maxPrizePoolBdt
    ? `up to ৳${showcase.maxPrizePoolBdt.toLocaleString()}`
    : "verified cash prize pools"

  const steps = [
    {
      num: "01",
      icon: Users,
      title: isBn ? "১. লবি নির্বাচন ও স্কোয়াডের তথ্য দিন" : "01. Select Scrim & Enter Squad Info",
      desc: isBn
        ? "আজকের লাইভ সিডিউল থেকে আপনার পছন্দের লবি বাছুন। টিমের নাম, টিম ট্যাগ, ক্যাপ্টেনের নাম ও হোয়াটসঅ্যাপ নম্বর প্রবেশ করান।"
        : `Choose your preferred time slot from ${lobbyCountTextEn}. Provide your Team Name, Team Tag, Team Leader Name, and valid Bangladeshi WhatsApp Number.`,
    },
    {
      num: "02",
      icon: CreditCard,
      title: isBn ? `২. অটোমেটেড গেটওয়ে দিয়ে পেমেন্ট করুন (${entryLabelBn})` : `02. Pay Entry (${entryLabelEn}) via Instant Gateway`,
      desc: isBn
        ? "আমাদের অটোমেটিক গেটওয়ে বা ওয়ালেট ব্যালেন্স দিয়ে সহজে রেজিস্ট্রেশন ফি পেমেন্ট করুন। পেমেন্ট সফল হওয়ার সাথে সাথেই আপনার স্লট কনফার্ম হয়ে যাবে।"
        : "Complete your registration payment securely using our automated payment gateway or account balance. Your spot is confirmed immediately upon successful transaction.",
    },
    {
      num: "03",
      icon: KeyRound,
      title: isBn ? "৩. রুম আইডি ও পাসওয়ার্ড পান" : "03. Receive Room ID & Password",
      desc: isBn
        ? "ম্যাচ শুরুর ১০-১৫ মিনিট পূর্বে আপনার ড্যাশবোর্ড এবং হোয়াটসঅ্যাপ নম্বরে কাস্টম রুম আইডি ও পাসওয়ার্ড চলে যাবে।"
        : "Room details (Custom Room ID and Password) are published on your Dashboard and sent directly to your WhatsApp 10-15 minutes prior to match time.",
    },
    {
      num: "04",
      icon: Trophy,
      title: isBn ? "৪. ম্যাচ খেলুন ও ক্যাশ প্রাইজ জিতুন" : "04. Play Matches & Win Cash Prizes",
      desc: isBn
        ? "অফিশিয়াল ম্যাপ রোটেশনে অংশ নিন এবং পয়েন্ট টেবিলে শীর্ষে থেকে জিতে নিন ক্যাশ প্রাইজ পুল, যা ভেরিফিকেশনের পর আপনার ডিজিটাল ওয়ালেটে পৌঁছে দেওয়া হবে।"
        : `Compete in the lobby's official match format (${showcase?.formatLabel || "official Free Fire maps"}). Top placed teams win real cash prizes (${prizeLabelEn}) sent directly to your digital payout wallet.`,
    },
  ]

  return (
    <div className="mx-auto max-w-4xl px-4 md:px-6">
      <div className="text-center">
        <span className="text-xs font-semibold uppercase tracking-wider text-accent">
          {isBn ? "সহজ নির্দেশিকা" : "Easy Guide"}
        </span>
        <h1 className="mt-2 font-display text-3xl font-bold uppercase tracking-tight sm:text-5xl">
          {isBn ? "কীভাবে RushX Organization এ অংশ নেবেন" : "How to Join RushX Organization"}
        </h1>
        <p className="mt-3 text-base text-muted-foreground sm:text-lg">
          {isBn
            ? "আজকের টুর্নামেন্টে খেলতে এবং আপনার স্কোয়াড রেজিস্টার করতে এই নির্দেশিকাটি অনুসরণ করুন।"
            : "Follow this step-by-step tutorial to book your Free Fire squad slot and compete tonight."}
        </p>
      </div>

      {/* Video Tutorials Section */}
      {tutorials.length > 0 && (
        <div className="mt-10 flex flex-col gap-6">
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-center">
            {isBn ? "ভিডিও টিউটোরিয়াল" : "Video Guides"}
          </h2>
          <div className="grid gap-6 sm:grid-cols-2">
            {tutorials.map((v) => (
              <div key={v.id} className="dc-surface flex flex-col gap-3 rounded-2xl p-4">
                <h3 className="font-display text-base font-bold text-foreground">{v.title}</h3>
                {v.description && <p className="text-xs text-muted-foreground">{v.description}</p>}
                <div className="relative w-full aspect-video overflow-hidden rounded-xl bg-black border border-border/80">
                  {(() => {
                    const parsed = parseVideoEmbed(v.videoUrl)
                    if (parsed.isEmbeddableIframe) {
                      return (
                        <iframe
                          src={parsed.embedUrl}
                          title={v.title}
                          loading="lazy"
                          className="absolute inset-0 h-full w-full border-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                          allowFullScreen
                        />
                      )
                    }
                    return (
                      <video
                        src={parsed.embedUrl || v.videoUrl}
                        controls
                        playsInline
                        preload="metadata"
                        className="absolute inset-0 h-full w-full object-contain bg-black"
                      />
                    )
                  })()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-12 flex flex-col gap-6">
        {steps.map((s) => (
          <div key={s.num} className="dc-surface dc-card-hover rushx-box-splash flex flex-col sm:flex-row items-start gap-6 rounded-2xl p-6 sm:p-8">
            <div className="font-display text-3xl font-bold text-accent tabular-nums shrink-0 leading-none pt-1">
              {s.num}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 font-display text-xl font-bold uppercase tracking-wide">
                <s.icon className="size-5 text-accent" />
                {s.title}
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 dc-surface rounded-2xl p-6 text-center sm:p-8">
        <ShieldCheck className="mx-auto size-10 text-accent" />
        <h2 className="mt-3 font-display text-2xl font-bold uppercase">
          {isBn ? "বুয়াহ নিতে প্রস্তুত তো?" : "Ready to Booyah?"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {isBn
            ? "আজকের লাইভ স্ক্রিম লবিগুলো দেখুন এবং এখনই আপনার স্লট বুক করে ফেলুন।"
            : "Explore today's live scrim lobbies and reserve your squad spot now."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          <Button asChild size="lg" className="glow-primary font-display font-bold uppercase">
            <Link href="/scrims">
              {isBn ? "লবিসমূহ দেখুন" : "View Scrim Lobbies"}
              <ArrowRight className="size-4 ml-1" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
