"use client"

import { useRef, type ReactNode } from "react"
import Link from "next/link"
import Image from "next/image"
import { motion, useReducedMotion } from "motion/react"
import { Button } from "@/components/ui/button"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  CreditCard,
  KeyRound,
  Trophy,
  ShieldCheck,
  Bell,
  Wallet,
  CalendarClock,
  Swords,
  ChevronRight,
} from "lucide-react"
import { WhatsAppIcon } from "@/components/site/brand-icons"
import { useLanguage } from "@/lib/language"
import { LiveSupportButton } from "@/components/site/live-support-button"
import { useReliableOnceReveal } from "@/components/site/reveal"
import type { LiveShowcaseSummary } from "@/lib/queries/showcase"

function CrispReveal({
  children,
  className,
  initial,
  animateTarget = { opacity: 1, x: 0, y: 0, scale: 1 },
  duration = 0.45,
  delay = 0,
  whileHover,
}: {
  children: ReactNode
  className?: string
  initial: { opacity: number; x?: number; y?: number; scale?: number }
  animateTarget?: { opacity: number; x?: number; y?: number; scale?: number }
  duration?: number
  delay?: number
  whileHover?: { y?: number; scale?: number }
}) {
  const prefersReducedMotion = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const visible = useReliableOnceReveal(ref, prefersReducedMotion, false)

  return (
    <motion.div
      ref={ref}
      initial={prefersReducedMotion ? animateTarget : initial}
      animate={visible || prefersReducedMotion ? animateTarget : initial}
      whileHover={prefersReducedMotion ? undefined : whileHover}
      transition={{ duration: prefersReducedMotion ? 0 : duration, delay: prefersReducedMotion ? 0 : delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string
  title: string
  subtitle?: string
}) {
  return (
    <CrispReveal
      initial={{ opacity: 0, y: 20 }}
      duration={0.5}
      className="mx-auto mb-12 max-w-2xl text-center relative"
    >
      <div className="inline-flex items-center gap-2.5 mb-3">
        <span
          className="h-px w-6"
          style={{
            background: "linear-gradient(to right, transparent, rgba(var(--rushx-soft-rgb), 0.85))",
          }}
        />
        <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-accent">
          {eyebrow}
        </p>
        <span
          className="h-px w-6"
          style={{
            background: "linear-gradient(to left, transparent, rgba(var(--rushx-accent-rgb), 0.85))",
          }}
        />
      </div>
      <h2 className="font-display text-3xl font-bold tracking-tight text-balance md:text-4xl text-foreground">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-3.5 text-sm sm:text-base text-muted-foreground leading-relaxed text-pretty">
          {subtitle}
        </p>
      )}
    </CrispReveal>
  )
}

export function Features({ showcase }: { showcase?: LiveShowcaseSummary }) {
  const { lang, t } = useLanguage()

  const prizeBody =
    showcase?.maxPrizePoolBdt
      ? lang === "bn"
        ? `প্রতিটি লবিতে নিশ্চিত প্রাইজ পুল (সর্বোচ্চ ৳${showcase.maxPrizePoolBdt.toLocaleString()} পর্যন্ত)। বিজয়ীদের তালিকা ও স্ক্রিনশট প্রুফসহ দ্রুত পুরষ্কার পাঠানো হয়।`
        : `Guaranteed cash prize pools (up to ৳${showcase.maxPrizePoolBdt.toLocaleString()}) paid directly to top squads with verified result proof.`
      : t("feat3_body", "Every lobby has a guaranteed cash prize pool. Winners are published with proof and prizes are paid out fast.")

  const payoutBody =
    showcase?.payoutSla && lang === "en"
      ? `${showcase.payoutSla} — verified payouts sent directly to the team leader's payout wallet after result publication.`
      : t("facility_5_body", "Prizes are paid directly to the winner's payout wallet after match result verification.")

  const features = [
    {
      icon: CreditCard,
      title: t("feat1_title", "Instant Auto Payment"),
      body: t("feat1_body", "Pay through secure automated gateway or account balance. Your slot is confirmed the second your payment clears."),
      color: "text-accent",
    },
    {
      icon: KeyRound,
      title: t("feat2_title", "Room ID On Time"),
      body: t("feat2_body", "Room ID and password are published to paid teams right in your dashboard before match start."),
      color: "text-accent",
    },
    {
      icon: Trophy,
      title: t("facility_1", "Top 3 Prize Pool"),
      body: prizeBody,
      color: "text-accent",
    },
    {
      icon: ShieldCheck,
      title: t("facility_2", "Top 3 & MVP Face Banners"),
      body: t("facility_2_body", "Exclusive Top 3 Face Banners, MVP Face Banner & Overall Standing Banners published on results."),
      color: "text-emerald-400",
    },
    {
      icon: Bell,
      title: t("facility_5", "Fast Verified Payouts"),
      body: payoutBody,
      color: "text-accent",
    },
    {
      icon: Wallet,
      title: t("feat6_title", "Transparent History"),
      body: t("feat6_body", "Every booking, payment and result is tracked in your dashboard. Full transaction history, always."),
      color: "text-accent",
    },
  ]

  return (
    <section className="relative mx-auto max-w-6xl px-4 py-20 md:px-6 overflow-hidden" aria-labelledby="features-heading">
      <div
        className="pointer-events-none absolute -left-40 top-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-3xl"
        style={{ background: "rgba(var(--rushx-primary-rgb), 0.14)" }}
      />

      <SectionHeading
        eyebrow={t("features_eyebrow", "Why RushX Organization")}
        title={t("features_title", "Built for serious squads")}
        subtitle={t("features_subtitle", "Everything a competitive Free Fire team needs — automated, transparent and fast.")}
      />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 relative z-10">
        {features.map((f, i) => (
          <CrispReveal
            key={f.title}
            initial={{ opacity: 0, y: 25 }}
            duration={0.4}
            delay={i * 0.08}
            whileHover={{ y: -4 }}
            className="dc-surface dc-card-hover rushx-box-splash group relative rounded-2xl p-6 overflow-hidden"
          >
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-50 group-hover:opacity-100 transition-opacity"
              style={{
                background:
                  "linear-gradient(to right, transparent, rgba(var(--rushx-soft-rgb), 0.6), transparent)",
              }}
            />

            <f.icon className={`mb-4 size-5 ${f.color} transition-transform duration-200 group-hover:scale-110`} aria-hidden />
            <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
          </CrispReveal>
        ))}
      </div>
    </section>
  )
}

export function HowItWorks({ showcase }: { showcase?: LiveShowcaseSummary }) {
  const { lang, t } = useLanguage()

  const dynamicStep1Body =
    showcase && showcase.activeScrimCount > 0 && lang === "en"
      ? `${showcase.activeScrimCount} live ${showcase.activeScrimCount === 1 ? "lobby" : "lobbies"} currently open${showcase.timeWindow ? ` (${showcase.timeWindow})` : ""}. Choose your time slot, map, and prize pool.`
      : t("step1_body", "Browse today's live lobbies managed by RushX admins. Choose your time slot, map, and prize pool.")

  const dynamicStep2Title =
    showcase?.minEntryFeeBdt
      ? lang === "bn"
        ? `এনট্রি ফি প্রদান করুন (৳${showcase.minEntryFeeBdt} থেকে)`
        : `Pay Entry (From ৳${showcase.minEntryFeeBdt})`
      : t("step2_title", "Instant Checkout")

  const steps = [
    {
      icon: CalendarClock,
      step: "01",
      title: t("step1_title", "Pick a Scrim"),
      body: dynamicStep1Body,
      actionHref: "#schedule",
      actionText: "View Schedule",
      onClick: (e: React.MouseEvent) => {
        const el = document.getElementById("schedule")
        if (el) {
          e.preventDefault()
          el.scrollIntoView({ behavior: "smooth" })
        }
      },
    },
    {
      icon: CreditCard,
      step: "02",
      title: dynamicStep2Title,
      body: t("step2_body", "Checkout with automated gateway or wallet balance. Payment is verified automatically in seconds."),
      actionHref: "#schedule",
      actionText: "Book Now",
      onClick: (e: React.MouseEvent) => {
        const el = document.getElementById("schedule")
        if (el) {
          e.preventDefault()
          el.scrollIntoView({ behavior: "smooth" })
        }
      },
    },
    {
      icon: KeyRound,
      step: "03",
      title: t("step3_title", "Get Room Details"),
      body: t("step3_body", "Enter your squad info. Room ID and password appear in your dashboard before match time."),
      actionHref: "/dashboard",
      actionText: "Go to Dashboard",
      onClick: undefined,
    },
    {
      icon: Swords,
      step: "04",
      title: t("step4_title", "Play & Win"),
      body: t("step4_body", "Drop in, top the lobby, and get your prize. Results and payouts published promptly after matches."),
      actionHref: "/results",
      actionText: "View Leaderboard",
      onClick: undefined,
    },
  ]

  return (
    <section id="how-it-works" className="border-y border-white/[0.06] bg-[#040814]/28 backdrop-blur-[2px] py-20" aria-labelledby="how-heading">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <SectionHeading
          eyebrow={t("how_eyebrow", "How It Works")}
          title={t("how_title", "From booking to booyah in 4 steps")}
          subtitle={t("how_subtitle", "The entire flow is automatic. Book, pay, play — no admins to chase.")}
        />
        <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <li key={s.step} className="h-full">
              <CrispReveal
                initial={{ opacity: 0, y: 25 }}
                duration={0.4}
                delay={i * 0.1}
                whileHover={{ y: -4 }}
                className="dc-surface dc-card-hover rushx-box-splash group relative h-full rounded-2xl p-6 cursor-pointer flex flex-col justify-between overflow-hidden"
              >
                <div
                  className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-45 group-hover:opacity-100 transition-opacity"
                  style={{
                    background:
                      "linear-gradient(to right, transparent, rgba(var(--rushx-soft-rgb), 0.6), transparent)",
                  }}
                />
                <Link
                  href={s.actionHref}
                  onClick={s.onClick}
                  className="absolute inset-0 z-10 rounded-2xl"
                  aria-label={`${s.title} — ${s.actionText}`}
                />
                <div>
                  <span className="absolute right-5 top-4 font-display text-3xl font-semibold text-white/15 group-hover:text-accent/40 transition-colors tabular-nums" aria-hidden>
                    {s.step}
                  </span>
                  <s.icon className="mb-4 size-5 text-accent transition-transform duration-200 group-hover:scale-110" aria-hidden />
                  <h3 className="font-display text-lg font-semibold tracking-tight text-foreground group-hover:text-white transition-colors flex items-center gap-1.5">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                </div>

                <div className="mt-5 pt-3 border-t border-white/[0.07] flex items-center justify-between text-xs font-semibold text-accent transition-colors">
                  <span>{s.actionText}</span>
                  <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </CrispReveal>
            </li>
          ))}
        </ol>

        <div className="mt-10 text-center">
          <Button asChild size="lg" variant="outline" className="glass gap-2 rounded-xl font-semibold text-foreground">
            <Link href="/tutorial">
              <KeyRound className="size-4 text-accent" />
              {t("watch_tutorial", "Watch Video Tutorial / কীভাবে বুক করবেন দেখুন")}
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

export function WhyChooseUs({ showcase }: { showcase?: LiveShowcaseSummary }) {
  const { t } = useLanguage()

  return (
    <section className="mx-auto max-w-6xl px-4 py-20 md:px-6" aria-labelledby="why-heading">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <CrispReveal
          initial={{ opacity: 0, scale: 0.92 }}
          duration={0.5}
          className="relative order-2 h-96 sm:h-[460px] md:h-[520px] lg:h-[560px] overflow-hidden rounded-3xl lg:order-1 shadow-2xl border border-[rgba(var(--rushx-soft-rgb),0.18)] bg-[#050a18] group"
        >
          <Image
            src="/images/sakura_warrior_1786871705952.jpg"
            alt="Free Fire Sakura Warrior under Blood Moon"
            fill
            className="object-cover object-[center_25%] transition-transform duration-700 ease-out group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 600px"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#040814]/94 via-[#040814]/24 to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-radial-gradient from-transparent via-transparent to-[#040814]/55 pointer-events-none" />

          {/* Cleanly pinned bottom overlay card inside the image frame */}
          <div className="dc-surface absolute inset-x-4 bottom-4 z-10 p-4 rounded-2xl flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-accent">
                Elite Battleground
              </p>
              <p className="text-sm font-semibold text-white truncate">
                {showcase?.timeWindow ? `Daily High-Tier Scrims · ${showcase.timeWindow}` : "Daily High-Tier Scrims"}
              </p>
            </div>
            <ShieldCheck className="size-5 text-accent shrink-0" aria-hidden />
          </div>
        </CrispReveal>

        <CrispReveal
          initial={{ opacity: 0, x: 20 }}
          duration={0.5}
          delay={0.1}
          className="order-1 lg:order-2"
        >
          <p className="mb-3 font-display text-xs font-semibold uppercase tracking-[0.22em] text-accent">
            {t("features_eyebrow", "Why Choose Us")}
          </p>
          <h2 className="font-display text-3xl font-bold tracking-tight text-balance md:text-4xl">
            {t("features_title", "The lobby where grinders become champions")}
          </h2>
          <ul className="mt-8 flex flex-col gap-5">
            {[
              [t("feat1_title", "Zero manual verification"), t("feat1_body", "Payments confirm instantly through automated gateway.")],
              [t("feat2_title", "Daily competitive lobbies"), t("feat2_body", "Scheduled competitive lobbies managed live by RushX admins.")],
              [t("feat3_title", "Results with receipts"), t("feat3_body", "Every match result is published with screenshots and kill counts.")],
              [t("feat4_title", "Moderated, competitive, clean"), t("feat4_body", "Dedicated moderators run every lobby so matches start on time.")],
            ].map(([title, body], i) => (
              <li key={title}>
                <CrispReveal
                  initial={{ opacity: 0, x: 15 }}
                  duration={0.3}
                  delay={0.1 * i}
                  className="flex gap-3.5"
                >
                  <ShieldCheck className="mt-0.5 size-4.5 shrink-0 text-accent" aria-hidden />
                  <div>
                    <h3 className="font-semibold text-foreground">{title}</h3>
                    <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
                  </div>
                </CrispReveal>
              </li>
            ))}
          </ul>
        </CrispReveal>
      </div>
    </section>
  )
}

export function Faq({ showcase }: { showcase?: LiveShowcaseSummary }) {
  const { lang, t } = useLanguage()

  const faq1Answer =
    showcase?.minEntryFeeBdt && lang === "en"
      ? `Create an account, pick an open scrim from today's schedule, enter your squad details, and pay the listed entry fee (starting from ৳${showcase.minEntryFeeBdt}) via automated gateway or wallet balance. Your slot confirms immediately.`
      : t("faq1_a", "Create an account, pick an open scrim from today's schedule, enter your squad details, and pay via automated gateway or wallet balance. Your slot is confirmed automatically.")

  const faqs = [
    { q: t("faq1_q", "How do I book a scrim slot?"), a: faq1Answer },
    { q: t("faq2_q", "When do I get the Room ID and password?"), a: t("faq2_a", "Room credentials are published by our moderators 10-15 minutes before match start in your dashboard and sent via WhatsApp.") },
    { q: t("faq3_q", "What happens if the lobby is full?"), a: t("faq3_a", "Once a lobby reaches its max team slots, booking closes automatically. Check any other open time slots on the live schedule.") },
    { q: t("faq4_q", "How are prizes paid out?"), a: t("faq4_a", "Winners are published on the Results page with kills and screenshots. Prizes are sent directly to the team leader's payout wallet after verification.") },
    { q: t("faq5_q", "Can I get a refund?"), a: t("faq5_a", "If a scrim is cancelled by us, you get a full automatic refund. See our Refund Policy for details.") },
    { q: t("faq6_q", "Are emulator players allowed?"), a: t("faq6_a", "No. RushX Organization is mobile-only. Emulator players are banned without refund per our fair play rules.") },
  ]

  return (
    <section id="faq" className="border-t border-white/[0.06] bg-[#040814]/28 backdrop-blur-[2px] py-20" aria-labelledby="faq-heading">
      <div className="mx-auto max-w-3xl px-4 md:px-6">
        <SectionHeading eyebrow={t("faq_eyebrow", "FAQ")} title={t("faq_title", "Questions, answered")} />
        <Accordion multiple={false} className="flex flex-col gap-3">
          {faqs.map((f, i) => (
            <CrispReveal key={f.q} initial={{ opacity: 0, y: 15 }} duration={0.35} delay={i * 0.05}>
              <AccordionItem
                value={`item-${i}`}
                className="dc-surface rushx-box-splash rounded-2xl px-5 last:border-b hover:border-[rgba(var(--rushx-soft-rgb),0.36)] transition-colors"
              >
                <AccordionTrigger className="text-left font-semibold tracking-tight hover:no-underline">{f.q}</AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-muted-foreground flex flex-col gap-2">
                  <p>{f.a}</p>
                  {i === 0 && (
                    <div className="pt-1">
                      <Button asChild size="sm" variant="outline" className="rounded-xl text-xs gap-1.5">
                        <Link href="/tutorial">
                          <KeyRound className="size-3.5 text-accent" />
                          {t("watch_tutorial", "Watch Tutorial / কীভাবে বুক করবেন দেখুন")}
                        </Link>
                      </Button>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </CrispReveal>
          ))}
        </Accordion>
      </div>
    </section>
  )
}

export function Contact({ settings }: { settings?: { discordUrl?: string; facebookUrl?: string; supportWhatsapp?: string } }) {
  const { t } = useLanguage()

  const supportWhatsapp = settings?.supportWhatsapp || "+8801831510108"
  const cleanWaNumber = supportWhatsapp.replace(/[^0-9]/g, "")

  return (
    <section id="contact" className="mx-auto max-w-6xl px-4 py-20 md:px-6" aria-labelledby="contact-heading">
      <CrispReveal
        initial={{ opacity: 0, y: 30 }}
        duration={0.5}
        className="dc-surface rushx-box-splash relative overflow-hidden rounded-3xl p-8 md:p-12 shadow-2xl"
      >
        <div
          className="absolute -right-20 -top-20 size-64 rounded-full blur-3xl pointer-events-none"
          style={{ background: "rgba(var(--rushx-primary-rgb), 0.18)" }}
          aria-hidden
        />
        <div
          className="absolute -bottom-20 -left-20 size-64 rounded-full blur-3xl pointer-events-none"
          style={{ background: "rgba(var(--rushx-accent-rgb), 0.14)" }}
          aria-hidden
        />
        <div className="relative grid items-center gap-8 md:grid-cols-2">
          <div>
            <div className="inline-flex items-center gap-2.5 mb-3">
              <span
                className="h-px w-6"
                style={{
                  background: "linear-gradient(to right, transparent, rgba(var(--rushx-soft-rgb), 0.85))",
                }}
              />
              <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-accent">
                {t("contact_eyebrow", "Support")}
              </p>
            </div>
            <h2 className="font-display text-3xl font-bold tracking-tight text-balance text-foreground">
              {t("contact_title", "Need Help? Talk to RushX Support")}
            </h2>
            <p className="mt-3.5 text-sm sm:text-base leading-relaxed text-muted-foreground text-pretty">
              {t("contact_subtitle", "Connect with our team directly via Live Support or WhatsApp.")}
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
              <LiveSupportButton
                variant="cta"
                label={t("live_support", "Live Support")}
                className="w-full"
              />
            </motion.div>

            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
              <Button asChild size="lg" className="h-11 w-full justify-center gap-2.5 rounded-full font-display font-bold uppercase tracking-wider text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20">
                <a href={`https://wa.me/${cleanWaNumber || "8801831510108"}`} target="_blank" rel="noopener noreferrer">
                  <WhatsAppIcon className="size-4.5 text-white" />
                  <span>WhatsApp Support</span>
                </a>
              </Button>
            </motion.div>
          </div>
        </div>
      </CrispReveal>
    </section>
  )
}
