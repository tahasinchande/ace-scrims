"use client"

import Link from "next/link"
import Image from "next/image"
import { motion } from "motion/react"
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
  Mail,
  ChevronRight,
  MessageSquare,
} from "lucide-react"
import { FacebookIcon, DiscordIcon, WhatsAppIcon } from "@/components/site/brand-icons"
import { useLanguage } from "@/lib/language"
import { LiveSupportButton } from "@/components/site/live-support-button"

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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5 }}
      className="mx-auto mb-12 max-w-2xl text-center relative"
    >
      <div className="inline-flex items-center gap-2 mb-3">
        <span className="h-px w-6 bg-gradient-to-r from-transparent to-orange-500" />
        <p className="font-display text-xs font-bold uppercase tracking-[0.25em] text-orange-400">{eyebrow}</p>
        <span className="h-px w-6 bg-gradient-to-l from-transparent to-orange-500" />
      </div>
      <h2 className="font-display text-3xl font-black tracking-tight text-balance md:text-4xl text-foreground">{title}</h2>
      {subtitle && <p className="mt-4 text-muted-foreground leading-relaxed text-pretty">{subtitle}</p>}
    </motion.div>
  )
}

export function Features() {
  const { t } = useLanguage()

  const features = [
    {
      icon: CreditCard,
      title: t("feat1_title", "Instant Auto Payment"),
      body: t("feat1_body", "Pay through secure automated gateway or account balance. Your slot is confirmed the second your payment clears."),
      color: "text-orange-400",
    },
    {
      icon: KeyRound,
      title: t("feat2_title", "Room ID On Time"),
      body: t("feat2_body", "Room ID and password are published to paid teams right in your dashboard before match start."),
      color: "text-amber-400",
    },
    {
      icon: Trophy,
      title: t("facility_1", "Top 3 Prize Pool"),
      body: t("feat3_body", "Guaranteed cash prize pool (৳330) paid out to Top 3 teams for every lobby within 6 hours."),
      color: "text-amber-300",
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
      color: "text-orange-400",
    },
    {
      icon: Wallet,
      title: t("feat6_title", "Transparent History"),
      body: t("feat6_body", "Every booking, payment and result is tracked in your dashboard. Full transaction history, always."),
      color: "text-orange-300",
    },
  ]

  return (
    <section className="relative mx-auto max-w-6xl px-4 py-20 md:px-6 overflow-hidden" aria-labelledby="features-heading">
      {/* Background Cyber Laser Ribbon Sweep */}
      <div className="pointer-events-none absolute -left-40 top-1/2 -translate-y-1/2 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl" />

      <SectionHeading
        eyebrow={t("features_eyebrow", "Why Ace Scrims")}
        title={t("features_title", "Built for serious squads")}
        subtitle={t("features_subtitle", "Everything a competitive Free Fire team needs — automated, transparent and fast.")}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 relative z-10">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
            whileHover={{ y: -4, borderColor: "rgba(249, 115, 22, 0.5)" }}
            className="glass group relative rounded-2xl p-6 transition-all duration-300 border border-border/70 bg-card/55 hover:shadow-xl hover:shadow-orange-500/10 overflow-hidden"
          >
            {/* Subtle cyber scan line on hover */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-500/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

            <span className={`mb-4 flex size-11 items-center justify-center rounded-xl bg-orange-950/45 border border-orange-500/25 ${f.color} transition-transform group-hover:scale-105`}>
              <f.icon className="size-5" aria-hidden />
            </span>
            <h3 className="font-display text-lg font-bold tracking-wide text-foreground">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

export function HowItWorks() {
  const { t } = useLanguage()

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
    <section id="how-it-works" className="border-y border-border/50 bg-card/30 py-20" aria-labelledby="how-heading">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <SectionHeading
          eyebrow={t("how_eyebrow", "How It Works")}
          title={t("how_title", "From booking to booyah in 4 steps")}
          subtitle={t("how_subtitle", "The entire flow is automatic. Book, pay, play — no admins to chase.")}
        />
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <motion.li
              key={s.step}
              initial={{ opacity: 0, y: 25 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              whileHover={{ y: -4 }}
              className="glass group relative rounded-2xl p-6 transition-all border border-border/75 bg-card/55 hover:border-orange-500/50 hover:shadow-xl hover:shadow-orange-500/10 cursor-pointer flex flex-col justify-between"
            >
              <Link
                href={s.actionHref}
                onClick={s.onClick}
                className="absolute inset-0 z-10 rounded-2xl"
                aria-label={`${s.title} — ${s.actionText}`}
              />
              <div>
                <span className="absolute right-5 top-4 font-display text-4xl font-black text-orange-500/20 group-hover:text-orange-500/40 transition-colors tabular-nums" aria-hidden>
                  {s.step}
                </span>
                <span className="mb-4 flex size-11 items-center justify-center rounded-xl bg-orange-950/45 border border-orange-500/30 text-orange-400 shadow-sm group-hover:scale-105 group-hover:border-orange-500 transition-all">
                  <s.icon className="size-5" aria-hidden />
                </span>
                <h3 className="font-display text-lg font-bold tracking-wide text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-xs font-semibold text-orange-400 group-hover:text-orange-300">
                <span>{s.actionText}</span>
                <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-1" />
              </div>
            </motion.li>
          ))}
        </ol>

        <div className="mt-10 text-center">
          <Button asChild size="lg" variant="outline" className="glass gap-2 border-orange-500/40 font-semibold hover:border-orange-500 hover:bg-orange-500/10 text-foreground">
            <Link href="/tutorial">
              <KeyRound className="size-4 text-orange-400" />
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

  return (
    <section className="mx-auto max-w-6xl px-4 py-20 md:px-6" aria-labelledby="why-heading">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5 }}
          className="relative order-2 h-96 sm:h-[460px] md:h-[520px] lg:h-[560px] overflow-hidden rounded-3xl lg:order-1 shadow-2xl border border-orange-500/30 bg-black/60 group"
        >
          <Image
            src="/images/sakura_warrior_1786871705952.jpg"
            alt="Free Fire Sakura Warrior under Blood Moon"
            fill
            className="object-cover object-[center_25%] transition-transform duration-700 ease-out group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 600px"
            priority
          />
          {/* Cyberpunk Vignette & Lighting Accents */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#020306]/90 via-[#020306]/20 to-transparent pointer-events-none" />
          <div className="absolute inset-0 bg-radial-gradient from-transparent via-transparent to-[#020306]/50 pointer-events-none" />
          
          {/* Bottom Card Floating Cyber Tag */}
          <div className="absolute bottom-4 left-4 right-4 p-4 rounded-2xl glass border border-orange-500/35 bg-black/75 backdrop-blur-md flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-widest font-bold text-orange-400">Elite Battleground</p>
              <p className="text-sm font-semibold text-white">Daily High-Tier Scrims</p>
            </div>
            <span className="flex size-8 items-center justify-center rounded-lg bg-orange-500/15 border border-orange-500/35 text-orange-400">
              <ShieldCheck className="size-4" aria-hidden />
            </span>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="order-1 lg:order-2"
        >
          <p className="mb-3 font-display text-xs font-bold uppercase tracking-[0.2em] text-primary">
            {t("features_eyebrow", "Why Choose Us")}
          </p>
          <h2 className="font-display text-3xl font-black tracking-tight text-balance md:text-4xl">
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
                initial={{ opacity: 0, x: 15 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 * i, duration: 0.3 }}
                className="flex gap-4"
              >
                <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <ShieldCheck className="size-3.5" aria-hidden />
                </span>
                <div>
                  <h3 className="font-semibold">{title}</h3>
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

  const faqs = [
    { q: t("faq1_q", "How do I book a scrim slot?"), a: t("faq1_a", "Create an account, pick a scrim from tonight's schedule, enter your squad details, and pay ৳35 via secure gateway or account balance. Your slot is confirmed automatically.") },
    { q: t("faq2_q", "When do I get the Room ID and password?"), a: t("faq2_a", "Room credentials are published by our moderators 10-15 minutes before match start in your dashboard and sent via WhatsApp.") },
    { q: t("faq3_q", "What happens if the lobby is full?"), a: t("faq3_a", "Each scrim is capped at 12 teams. Once full, booking closes automatically. Check the other 11 nightly time slots.") },
    { q: t("faq4_q", "How are prizes paid out?"), a: t("faq4_a", "Winners are published on the Results page with kills and screenshots. Prizes are sent to the leader's digital payout wallet within 6 hours.") },
    { q: t("faq5_q", "Can I get a refund?"), a: t("faq5_a", "If a scrim is cancelled by us, you get a full automatic refund. See our Refund Policy for details.") },
    { q: t("faq6_q", "Are emulator players allowed?"), a: t("faq6_a", "No. Ace Scrims is mobile-only. Emulator players are banned without refund per our fair play rules.") },
  ]

  return (
    <section id="faq" className="border-t border-border/50 bg-card/30 py-20" aria-labelledby="faq-heading">
      <div className="mx-auto max-w-3xl px-4 md:px-6">
        <SectionHeading eyebrow={t("faq_eyebrow", "FAQ")} title={t("faq_title", "Questions, answered")} />
        <Accordion multiple={false} className="flex flex-col gap-3">
          {faqs.map((f, i) => (
            <motion.div
              key={f.q}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
            >
              <AccordionItem
                value={`item-${i}`}
                className="glass rounded-xl border border-border/60 px-5 last:border-b hover:border-primary/40 transition-colors"
              >
                <AccordionTrigger className="text-left font-semibold hover:no-underline">{f.q}</AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-muted-foreground flex flex-col gap-2">
                  <p>{f.a}</p>
                  {i === 0 && (
                    <div className="pt-1">
                      <Button asChild size="sm" variant="outline" className="text-xs gap-1.5 border-primary/40 text-primary hover:bg-primary/10">
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

  const discord = settings?.discordUrl || "https://discord.gg/aKF4hMuhmA"
  const supportWhatsapp = settings?.supportWhatsapp || "+8801831510108"
  const cleanWaNumber = supportWhatsapp.replace(/[^0-9]/g, "")

  const handleOpenLiveSupport = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("open-live-chat"))
    }
  }

  return (
    <section id="contact" className="mx-auto max-w-6xl px-4 py-20 md:px-6" aria-labelledby="contact-heading">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="glass relative overflow-hidden rounded-3xl p-8 md:p-12 border border-orange-500/30 bg-black/60 shadow-2xl"
      >
        <div className="absolute -right-20 -top-20 size-64 rounded-full bg-orange-600/15 blur-3xl" aria-hidden />
        <div className="absolute -bottom-20 -left-20 size-64 rounded-full bg-amber-500/10 blur-3xl" aria-hidden />
        <div className="relative grid items-center gap-8 md:grid-cols-2">
          <div>
            <div className="inline-flex items-center gap-2 mb-3">
              <span className="h-px w-6 bg-gradient-to-r from-transparent to-orange-500" />
              <p className="font-display text-xs font-bold uppercase tracking-[0.25em] text-orange-400">{t("contact_eyebrow", "Support")}</p>
            </div>
            <h2 className="font-display text-3xl font-black tracking-tight text-balance text-foreground">
              {t("contact_title", "Need Help? Talk to Ace Support")}
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground text-pretty">
              {t("contact_subtitle", "Connect with our team directly via Live Support or WhatsApp.")}
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {/* 1. Live Support */}
            <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
              <LiveSupportButton
                variant="cta"
                label={t("live_support", "Live Support")}
              />
            </motion.div>

            {/* 2. WhatsApp Support */}
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button asChild size="lg" className="h-12 w-full justify-start gap-3 font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20">
                <a href={`https://wa.me/${cleanWaNumber || "8801831510108"}`} target="_blank" rel="noopener noreferrer">
                  <WhatsAppIcon className="size-5 text-white" />
                  <span>WhatsApp Support</span>
                </a>
              </Button>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </section>
  )
}


