import Link from "next/link"
import Image from "next/image"
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
} from "lucide-react"
import { FacebookIcon, DiscordIcon } from "@/components/site/brand-icons"

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
    <div className="mx-auto mb-12 max-w-2xl text-center">
      <p className="mb-3 font-display text-xs font-bold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
      <h2 className="font-display text-3xl font-black tracking-tight text-balance md:text-4xl">{title}</h2>
      {subtitle && <p className="mt-4 text-muted-foreground leading-relaxed text-pretty">{subtitle}</p>}
    </div>
  )
}

const features = [
  {
    icon: CreditCard,
    title: "Instant Auto Payment",
    body: "Pay with bKash, Nagad or Rocket through UddoktaPay. Your slot is confirmed the second your payment clears — no screenshots, no waiting.",
    color: "text-primary",
  },
  {
    icon: KeyRound,
    title: "Room ID On Time",
    body: "Room ID and password are published to paid teams right in your dashboard before match start. No begging in group chats.",
    color: "text-accent",
  },
  {
    icon: Trophy,
    title: "Real Cash Prizes",
    body: "Every lobby has a guaranteed prize pool. Winners are published with proof and prizes are paid out fast.",
    color: "text-warning",
  },
  {
    icon: ShieldCheck,
    title: "Fair Play Enforced",
    body: "No emulators, no teaming, no hackers. Moderated lobbies with instant bans for rule breakers.",
    color: "text-success",
  },
  {
    icon: Bell,
    title: "Live Notifications",
    body: "Get notified the moment your room ID drops, results are published, or your prize is on the way.",
    color: "text-info",
  },
  {
    icon: Wallet,
    title: "Transparent History",
    body: "Every booking, payment and result is tracked in your dashboard. Full transaction history, always.",
    color: "text-primary",
  },
]

export function Features() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 md:px-6" aria-labelledby="features-heading">
      <SectionHeading
        eyebrow="Why Ace Scrims"
        title="Built for serious squads"
        subtitle="Everything a competitive Free Fire team needs — automated, transparent and fast."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div
            key={f.title}
            className="glass group rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40"
          >
            <span className={`mb-4 flex size-11 items-center justify-center rounded-xl bg-secondary ${f.color}`}>
              <f.icon className="size-5" aria-hidden />
            </span>
            <h3 className="font-display text-lg font-bold">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

const steps = [
  {
    icon: CalendarClock,
    step: "01",
    title: "Pick a Scrim",
    body: "Six lobbies every night from 7 PM to 12 AM. Choose your time, check the map and prize pool.",
  },
  {
    icon: CreditCard,
    step: "02",
    title: "Pay ৳50",
    body: "Checkout with bKash, Nagad or Rocket. Payment is verified automatically in seconds.",
  },
  {
    icon: KeyRound,
    step: "03",
    title: "Get Room Details",
    body: "Enter your squad info. Room ID and password appear in your dashboard before match time.",
  },
  {
    icon: Swords,
    step: "04",
    title: "Play & Win",
    body: "Drop in, top the lobby, and get your prize. Results and payouts published the same night.",
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-y border-border/50 bg-card/30 py-20" aria-labelledby="how-heading">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <SectionHeading
          eyebrow="How It Works"
          title="From booking to booyah in 4 steps"
          subtitle="The entire flow is automatic. Book, pay, play — no admins to chase."
        />
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <li key={s.step} className="glass relative rounded-2xl p-6">
              <span className="absolute right-5 top-4 font-display text-4xl font-black text-border" aria-hidden>
                {s.step}
              </span>
              <span className="mb-4 flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <s.icon className="size-5" aria-hidden />
              </span>
              <h3 className="font-display text-lg font-bold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

export function WhyChooseUs() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 md:px-6" aria-labelledby="why-heading">
      <div className="grid items-center gap-10 lg:grid-cols-2">
        <div className="relative order-2 h-72 overflow-hidden rounded-3xl md:h-96 lg:order-1">
          <Image
            src="/images/victory.png"
            alt="Champion lifting a trophy under stage lights"
            fill
            className="object-cover"
            sizes="(max-width: 1024px) 100vw, 50vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
        </div>
        <div className="order-1 lg:order-2">
          <p className="mb-3 font-display text-xs font-bold uppercase tracking-[0.2em] text-primary">Why Choose Us</p>
          <h2 className="font-display text-3xl font-black tracking-tight text-balance md:text-4xl">
            The lobby where grinders become champions
          </h2>
          <ul className="mt-8 flex flex-col gap-5">
            {[
              ["Zero manual verification", "Payments confirm instantly through UddoktaPay's secure gateway."],
              ["Six lobbies, every single night", "7 PM to midnight. Whenever your squad is ready, we have a lobby."],
              ["Results with receipts", "Every match result is published with screenshots and kill counts."],
              ["Moderated, competitive, clean", "Dedicated moderators run every lobby so matches start on time."],
            ].map(([title, body]) => (
              <li key={title} className="flex gap-4">
                <span className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <ShieldCheck className="size-3.5" aria-hidden />
                </span>
                <div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

const faqs = [
  {
    q: "How do I book a scrim slot?",
    a: "Create an account, pick a scrim from tonight's schedule, enter your squad details, and pay ৳50 with bKash, Nagad or Rocket. Your slot is confirmed automatically the moment payment clears.",
  },
  {
    q: "When do I get the Room ID and password?",
    a: "Room credentials are published by our moderators shortly before match start. You'll get a notification and they'll appear instantly in your dashboard under your booking.",
  },
  {
    q: "What happens if the lobby is full?",
    a: "Each scrim is capped at 12 teams. Once full, booking closes automatically. Check the other five nightly time slots — there's almost always space.",
  },
  {
    q: "How are prizes paid out?",
    a: "Winners are published on the Results page with kills and screenshots. Prizes are sent to the captain's bKash/Nagad number, usually within 24 hours.",
  },
  {
    q: "Can I get a refund?",
    a: "If a scrim is cancelled by us, you get a full automatic refund. See our Refund Policy for cases like no-shows or rule violations.",
  },
  {
    q: "Are emulator players allowed?",
    a: "No. Ace Scrims is mobile-only. Emulator players are banned without refund per our fair play rules.",
  },
]

export function Faq() {
  return (
    <section id="faq" className="border-t border-border/50 bg-card/30 py-20" aria-labelledby="faq-heading">
      <div className="mx-auto max-w-3xl px-4 md:px-6">
        <SectionHeading eyebrow="FAQ" title="Questions, answered" />
        <Accordion multiple={false} className="flex flex-col gap-3">
          {faqs.map((f, i) => (
            <AccordionItem
              key={f.q}
              value={`item-${i}`}
              className="glass rounded-xl border border-border/60 px-5 last:border-b"
            >
              <AccordionTrigger className="text-left font-semibold hover:no-underline">{f.q}</AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}

export function Contact() {
  return (
    <section id="contact" className="mx-auto max-w-6xl px-4 py-20 md:px-6" aria-labelledby="contact-heading">
      <div className="glass relative overflow-hidden rounded-3xl p-8 md:p-12">
        <div className="absolute -right-20 -top-20 size-64 rounded-full bg-primary/10 blur-3xl" aria-hidden />
        <div className="absolute -bottom-20 -left-20 size-64 rounded-full bg-accent/10 blur-3xl" aria-hidden />
        <div className="relative grid items-center gap-8 md:grid-cols-2">
          <div>
            <p className="mb-3 font-display text-xs font-bold uppercase tracking-[0.2em] text-primary">Contact</p>
            <h2 className="font-display text-3xl font-black tracking-tight text-balance">
              Need help? Talk to a human.
            </h2>
            <p className="mt-4 leading-relaxed text-muted-foreground text-pretty">
              Our moderators are active on Discord every evening. For payment issues, message us with your transaction
              ID and we&apos;ll sort it out fast.
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <Button asChild size="lg" className="h-12 justify-start gap-3 font-semibold">
              <a href="https://discord.gg/acescrims" target="_blank" rel="noopener noreferrer">
                <DiscordIcon className="size-5" />
                Join our Discord server
              </a>
            </Button>
            <Button asChild size="lg" variant="outline" className="glass h-12 justify-start gap-3 font-semibold bg-transparent">
              <a href="https://facebook.com/acescrims" target="_blank" rel="noopener noreferrer">
                <FacebookIcon className="size-5" />
                Message on Facebook
              </a>
            </Button>
            <Button asChild size="lg" variant="outline" className="glass h-12 justify-start gap-3 font-semibold bg-transparent">
              <a href="mailto:support@acescrims.com">
                <Mail className="size-5" />
                support@acescrims.com
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

