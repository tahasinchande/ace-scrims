import type { Metadata } from "next"
import Link from "next/link"
import { SiteHeader } from "@/components/site/site-header"
import { SiteFooter } from "@/components/site/site-footer"
import { Button } from "@/components/ui/button"
import { CheckCircle2, XCircle, Clock3, CircleAlert } from "lucide-react"

export const metadata: Metadata = {
  title: "Payment Status — Ace Scrims",
}

const STATES = {
  success: {
    icon: CheckCircle2,
    tone: "text-success",
    title: "Booking Confirmed!",
    body: "Payment received. Your squad's slot is locked in. Room ID and password will appear in your dashboard once published by a moderator.",
    cta: { href: "/dashboard/scrims", label: "View My Scrims" },
  },
  pending: {
    icon: Clock3,
    tone: "text-warning",
    title: "Payment Pending",
    body: "Your payment is being verified. This usually takes under a minute — your booking will confirm automatically. Check your dashboard shortly.",
    cta: { href: "/dashboard/scrims", label: "Go to Dashboard" },
  },
  cancelled: {
    icon: XCircle,
    tone: "text-muted-foreground",
    title: "Payment Cancelled",
    body: "You cancelled the payment. Your slot was not booked and no money was charged. You can try again any time before the lobby fills.",
    cta: { href: "/scrims", label: "Back to Scrims" },
  },
  failed: {
    icon: CircleAlert,
    tone: "text-destructive",
    title: "Payment Failed",
    body: "The payment could not be completed. No booking was made. If money was deducted, it will be refunded automatically by your wallet provider.",
    cta: { href: "/scrims", label: "Try Again" },
  },
} as const

export default async function PaymentResultPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const { status } = await searchParams
  const key = (status && status in STATES ? status : "pending") as keyof typeof STATES
  const s = STATES[key]

  return (
    <>
      <SiteHeader />
      <main className="flex min-h-screen items-center justify-center px-4 pb-20 pt-28">
        <div className="glass-strong flex w-full max-w-md flex-col items-center gap-5 rounded-2xl p-8 text-center sm:p-10">
          <s.icon className={`size-16 ${s.tone}`} aria-hidden />
          <h1 className="font-display text-3xl font-bold uppercase tracking-tight text-balance">{s.title}</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">{s.body}</p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="glow-primary font-display font-bold uppercase">
              <Link href={s.cta.href}>{s.cta.label}</Link>
            </Button>
            <Button asChild variant="ghost" size="lg">
              <Link href="/">Home</Link>
            </Button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
