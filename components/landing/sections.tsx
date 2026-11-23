"use client"

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

const DEEPCHARTS_EASE = [0.16, 1, 0.3, 1] as const

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string
  title: string
  subtitle?: string
}) {
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.div
      initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.56, ease: DEEPCHARTS_EASE }}
      className="mx-auto mb-12 max-w-2xl text-center relative"
    >
      <div className="inline-flex items-center gap-2.5 mb-3">
        <span className="h-px w-6 bg-gradient-to-r from-transparent to-violet-400/80" />
        <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-violet-300">{eyebrow}</p>
        <span className="h-px w-6 bg-gradient-to-l from-transparent to-cyan-400/80" />
      </div>
      <h2 className="font-display text-3xl font-bold tracking-tight text-balance md:text-4xl text-foreground">{title}</h2>
      {subtitle && <p className="mt-3.5 text-sm sm:text-base text-muted-foreground leading-relaxed text-pretty">{subtitle}</p>}
    </motion.div>
  )
}

export function Features() {
  const { t } = useLanguage()
  const prefersReducedMotion = useReducedMotion()

  const features = [
    {
      icon: CreditCard,
      title: t("feat1_title", "Instant Auto Payment"),
      body: t("feat1_body", "Pay through secure automated gateway or account balance. Your slot is confirmed the second your payment clears."),
      color: "text-violet-300",
    },
    {
      icon: KeyRound,
      title: t("feat2_title", "Room ID On Time"),
      body: t("feat2_body", "Room ID and password are published to paid teams right in your dashboard before match start."),
      color: "text-cyan-300",
    },
    {
      icon: Trophy,
      title: t("facility_1", "Top 3 Prize Pool"),
      body: t("feat3_body", "Guaranteed cash prize pool (৳330) paid out to Top 3 teams for every lobby within 6 hours."),
      color: "text-violet-300",
    },
    {
      icon: ShieldCheck,
      title: t("facility_2", "Top 3 & MVP Face Banners"),
      body: t("facility_2_body", "Exclusive Top 3 Face Banners, MVP Face Banner & Overall Standing Banners published on results."),
      color: "text-emerald-400",
    },
    {
      icon: Bell,
      title: t("facility_5", "6 Hour Guaranteed Payout"),
      body: t("facility_5_body", "Prizes are paid directly to winner's wallet within 6 hours of match completion."),
      color: "text-cyan-300",
    },
    {
      icon: Wallet,
      title: t("feat6_title", "Transparent History"),
      body: t("feat6_body", "Every booking, payment and result is tracked in your dashboard. Full transaction history, always."),
      color: "text-indigo-300",
    },
  ]

  return (
    <section className="relative mx-auto max-w-6xl px-4 py-20 md:px-6 overflow-hidden" aria-labelledby="features-heading">
      <div className="pointer-events-none absolute -left-40 top-1/2 -translate-y-1/2 w-96 h-96 bg-violet-600/12 rounded-full blur-3xl" />

      <SectionHeading
        eyebrow={t("features_eyebrow", "Why RushX Organization")}
        title={t("features_title", "Built for serious squads")}
        subtitle={t("features_subtitle", "Everything a competitive Free Fire team needs — automated, transparent and fast.")}
      />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 relative z-10">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.12 }}
            transition={{
              duration: prefersReducedMotion ? 0 : 0.5,
              delay: prefersReducedMotion ? 0 : i * 0.055,
              ease: DEEPCHARTS_EASE,
            }}
            className="dc-surface dc-card-hover rushx-box-splash group relative rounded-2xl p-6 overflow-hidden"
          >
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/50 to-transparent opacity-45 group-hover:opacity-100 transition-opacity" />

            <f.icon className={`mb-4 size-5 ${f.color} transition-transform duration-200 group-hover:scale-110`} aria-hidden />
            <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

export function HowItWorks() {
  const { t } = useLanguage()
  const prefersReducedMotion = useReducedMotion()

  const steps = [
    {
      icon: CalendarClock,
      step: "01",
      title: t("step1_title", "Pick a Scrim"),
      body: t("step1_body", "12 lobbies every night from 7 PM to 12 AM. Choose your time, check the map and prize pool."),
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
      title: t("step2_title", "Pay ৳35"),
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
      body: t("step4_body", "Drop in, top the lobby, and get your prize. Results and payouts published the same night."),
      actionHref: "/results",
      actionText: "View Leaderboard",
      onClick: undefined,
    },
  ]

  return (
    <section id="how-it-works" className="border-y border-white/[0.06] bg-[#060917]/28 backdrop-blur-[2px] py-20" aria-labelledby="how-heading">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <SectionHeading
          eyebrow={t("how_eyebrow", "How It Works")}
          title={t("how_title", "From booking to booyah in 4 steps")}
          subtitle={t("how_subtitle", "The entire flow is automatic. Book, pay, play — no admins to chase.")}
        />
        <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <motion.li
              key={s.step}
              initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.12 }}
              transition={{
                duration: prefersReducedMotion ? 0 : 0.5,
                delay: prefersReducedMotion ? 0 : i * 0.07,
                ease: DEEPCHARTS_EASE,
              }}
              className="dc-surface dc-card-hover rushx-box-splash group relative rounded-2xl p-6 cursor-pointer flex flex-col justify-between overflow-hidden"
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/50 to-transparent opacity-40 group-hover:opacity-100 transition-opacity" />
              <Link
                href={s.actionHref}
                onClick={s.onClick}
                className="absolute inset-0 z-10 rounded-2xl"
                aria-label={`${s.title} — ${s.actionText}`}
              />
              <div>
                <span className="absolute right-5 top-4 font-display text-3xl font-semibold text-violet-400/20 group-hover:text-violet-300/40 transition-colors tabular-nums" aria-hidden>
                  {s.step}
                </span>
                <s.icon className="mb-4 size-5 text-cyan-300 transition-transform duration-200 group-hover:scale-110" aria-hidden />
                <h3 className="font-display text-lg font-semibold tracking-tight text-foreground group-hover:text-violet-200 transition-colors flex items-center gap-1.5">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </div>

              <div className="mt-5 pt-3 border-t border-white/[0.07] flex items-center justify-between text-xs font-semibold text-violet-300 group-hover:text-cyan-200 transition-colors">
                <span>{s.actionText}</span>
                <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </motion.li>
          ))}
        </ol>

        <div className="mt-10 text-center">
          <Button asChild size="lg" variant="outline" className="glass gap-2 rounded-xl border-violet-300/20 font-semibold hover:border-violet-400/50 hover:bg-violet-500/12 text-foreground">
            <Link href="/tutorial">
              <KeyRound className="size-4 text-cyan-300" />
              {t("watch_tutorial", "Watch Video Tutorial / কীভাবে বুক করবেন দেখুন")}
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

export function WhyChooseUs() {
  const { t } = useLanguage()
  const prefersReducedMotion = useReducedMotion()

  return (
    <section className="mx-auto max-w-6xl px-4 py-20 md:px-6" aria-labelledby="why-heading">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.96, y: 18 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.6, ease: DEEPCHARTS_EASE }}
          className="relative order-2 h-96 sm:h-[460px] md:h-[520px] lg:h-[560px] overflow-hidden rounded-3xl lg:order-1 shadow-2xl border border-violet-300/15 bg-[#070a18] group"
        >
          <Image
            src="/images/sakura_warrior_1786871705952.jpg"
            alt="Free Fire Sakura Warrior under Blood Moon"
            fill
            className="object-cover object-[center_25%] transition-transform duration-700 ease-out group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 600px"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#050816]/94 via-[#050816]/24 to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-radial-gradient from-transparent via-transparent to-[#050816]/55 pointer-events-none" />

          <div className="dc-surface absolute bottom-4 left-4 right-4 p-4 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-cyan-300">Elite Battleground</p>
              <p className="text-sm font-semibold text-white">Daily High-Tier Scrims</p>
            </div>
            <ShieldCheck className="size-5 text-violet-300 shrink-0" aria-hidden />
          </div>
        </motion.div>
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.15 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.56, delay: 0.08, ease: DEEPCHARTS_EASE }}
          className="order-1 lg:order-2"
        >
          <p className="mb-3 font-display text-xs font-semibold uppercase tracking-[0.22em] text-violet-300">
            {t("features_eyebrow", "Why Choose Us")}
          </p>
          <h2 className="font-display text-3xl font-bold tracking-tight text-balance md:text-4xl">
            {t("features_title", "The lobby where grinders become champions")}
          </h2>
          <ul className="mt-8 flex flex-col gap-5">
            {[
              [t("feat1_title", "Zero manual verification"), t("feat1_body", "Payments confirm instantly through automated gateway.")],
              [t("feat2_title", "Daily competitive lobbies"), t("feat2_body", "Scheduled nightly lobbies. Whenever your squad is ready, we have a lobby.")],
              [t("feat3_title", "Results with receipts"), t("feat3_body", "Every match result is published with screenshots and kill counts.")],
              [t("feat4_title", "Moderated, competitive, clean"), t("feat4_body", "Dedicated moderators run every lobby so matches start on time.")],
            ].map(([title, body], i) => (
              <motion.li
                key={title}
                initial={prefersReducedMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: 14 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{
                  delay: prefersReducedMotion ? 0 : 0.07 * i,
                  duration: prefersReducedMotion ? 0 : 0.45,
                  ease: DEEPCHARTS_EASE,
                }}
                className="flex gap-3.5"
              >
                <ShieldCheck className="mt-0.5 size-4.5 shrink-0 text-cyan-300" aria-hidden />
                <div>
                  <h3 className="font-semibold text-foreground">{title}</h3>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </div>
              </motion.li>
            ))}
          </ul>
        </motion.div>
      </div>
    </section>
  )
}

export function Faq() {
  const { t } = useLanguage()
  const prefersReducedMotion = useReducedMotion()

  const faqs = [
    { q: t("faq1_q", "How do I book a scrim slot?"), a: t("faq1_a", "Create an account, pick a scrim from tonight's schedule, enter your squad details, and pay ৳35 via secure gateway or account balance. Your slot is confirmed automatically.") },
    { q: t("faq2_q", "When do I get the Room ID and password?"), a: t("faq2_a", "Room credentials are published by our moderators 10-15 minutes before match start in your dashboard and sent via WhatsApp.") },
    { q: t("faq3_q", "What happens if the lobby is full?"), a: t("faq3_a", "Each scrim is capped at 12 teams. Once full, booking closes automatically. Check the other 11 nightly time slots.") },
    { q: t("faq4_q", "How are prizes paid out?"), a: t("faq4_a", "Winners are published on the Results page with kills and screenshots. Prizes are sent to the leader's digital payout wallet within 6 hours.") },
    { q: t("faq5_q", "Can I get a refund?"), a: t("faq5_a", "If a scrim is cancelled by us, you get a full automatic refund. See our Refund Policy for details.") },
    { q: t("faq6_q", "Are emulator players allowed?"), a: t("faq6_a", "No. RushX Organization is mobile-only. Emulator players are banned without refund per our fair play rules.") },
  ]

  return (
    <section id="faq" className="border-t border-white/[0.06] bg-[#060917]/28 backdrop-blur-[2px] py-20" aria-labelledby="faq-heading">
      <div className="mx-auto max-w-3xl px-4 md:px-6">
        <SectionHeading eyebrow={t("faq_eyebrow", "FAQ")} title={t("faq_title", "Questions, answered")} />
        <Accordion multiple={false} className="flex flex-col gap-3">
          {faqs.map((f, i) => (
            <motion.div
              key={f.q}
              initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{
                delay: prefersReducedMotion ? 0 : i * 0.05,
                duration: prefersReducedMotion ? 0 : 0.45,
                ease: DEEPCHARTS_EASE,
              }}
            >
              <AccordionItem
                value={`item-${i}`}
                className="dc-surface rushx-box-splash rounded-2xl px-5 last:border-b hover:border-violet-400/35 transition-colors"
              >
                <AccordionTrigger className="text-left font-semibold tracking-tight hover:no-underline">{f.q}</AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-muted-foreground flex flex-col gap-2">
                  <p>{f.a}</p>
                  {i === 0 && (
                    <div className="pt-1">
                      <Button asChild size="sm" variant="outline" className="rounded-xl text-xs gap-1.5 border-violet-400/35 text-violet-200 hover:bg-violet-500/12">
                        <Link href="/tutorial">
                          <KeyRound className="size-3.5" />
                          {t("watch_tutorial", "Watch Tutorial / কীভাবে বুক করবেন দেখুন")}
                        </Link>
                      </Button>
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            </motion.div>
          ))}
        </Accordion>
      </div>
    </section>
  )
}

export function Contact({ settings }: { settings?: { discordUrl?: string; facebookUrl?: string; supportWhatsapp?: string } }) {
  const { t } = useLanguage()
  const prefersReducedMotion = useReducedMotion()

  const supportWhatsapp = settings?.supportWhatsapp || "+8801831510108"
  const cleanWaNumber = supportWhatsapp.replace(/[^0-9]/g, "")

  return (
    <section id="contact" className="mx-auto max-w-6xl px-4 py-20 md:px-6" aria-labelledby="contact-heading">
      <motion.div
        initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 22 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.56, ease: DEEPCHARTS_EASE }}
        className="dc-surface rushx-box-splash relative overflow-hidden rounded-3xl p-8 md:p-12 border-violet-300/16 shadow-2xl"
      >
        <div className="absolute -right-20 -top-20 size-64 rounded-full bg-violet-600/16 blur-3xl" aria-hidden />
        <div className="absolute -bottom-20 -left-20 size-64 rounded-full bg-cyan-500/12 blur-3xl" aria-hidden />
        <div className="relative grid items-center gap-8 md:grid-cols-2">
          <div>
            <div className="inline-flex items-center gap-2.5 mb-3">
              <span className="h-px w-6 bg-gradient-to-r from-transparent to-violet-400/80" />
              <p className="font-display text-xs font-semibold uppercase tracking-[0.22em] text-violet-300">{t("contact_eyebrow", "Support")}</p>
            </div>
            <h2 className="font-display text-3xl font-bold tracking-tight text-balance text-foreground">
              {t("contact_title", "Need Help? Talk to RushX Support")}
            </h2>
            <p className="mt-3.5 text-sm sm:text-base leading-relaxed text-muted-foreground text-pretty">
              {t("contact_subtitle", "Connect with our team directly via Live Support or WhatsApp.")}
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <LiveSupportButton
              variant="cta"
              label={t("live_support", "Live Support")}
              className="w-full"
            />

            <Button asChild size="lg" className="h-11 w-full justify-center gap-2.5 rounded-full font-display font-bold uppercase tracking-wider text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20">
              <a href={`https://wa.me/${cleanWaNumber || "8801831510108"}`} target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon className="size-4.5 text-white" />
                <span>WhatsApp Support</span>
              </a>
            </Button>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
