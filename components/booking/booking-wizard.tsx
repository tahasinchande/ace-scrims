"use client"

import { useActionState, useEffect, useState } from "react"
import Link from "next/link"
import { createBooking, type BookingFormState } from "@/app/actions/booking"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { bdt, formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Check, ChevronLeft, Loader2, Lock, ShieldCheck, Users, CreditCard } from "lucide-react"

type WizardScrim = {
  id: string
  slug: string
  title: string
  startTime: string
  scrimDate: string
  map: string
  mode: string
  priceBdt: number
  prizePoolBdt: number
  maxTeams: number
  confirmedTeams: number
}

const STEPS = [
  { n: 1, label: "Scrim" },
  { n: 2, label: "Squad Info" },
  { n: 3, label: "Payment" },
] as const

const initialState: BookingFormState = { ok: false }

function Field({
  id,
  label,
  error,
  optional,
  ...inputProps
}: {
  id: string
  label: string
  error?: string
  optional?: boolean
} & React.ComponentProps<typeof Input>) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
        {optional && <span className="ml-1 font-normal normal-case opacity-60">(optional)</span>}
      </Label>
      <Input id={id} name={id} aria-invalid={!!error} {...inputProps} />
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

export function BookingWizard({ scrim }: { scrim: WizardScrim }) {
  const [step, setStep] = useState(1)
  const [state, formAction, pending] = useActionState(createBooking, initialState)

  // Redirect to the payment gateway when the action returns a payment URL
  useEffect(() => {
    if (state.ok && state.paymentUrl) {
      window.location.href = state.paymentUrl
    }
  }, [state.ok, state.paymentUrl])

  const remaining = Math.max(0, scrim.maxTeams - scrim.confirmedTeams)

  return (
    <div className="flex flex-col gap-8">
      {/* Stepper */}
      <nav aria-label="Booking progress">
        <ol className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <li key={s.n} className="flex flex-1 items-center gap-2">
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold transition-colors",
                  step > s.n
                    ? "bg-success text-background"
                    : step === s.n
                      ? "glow-primary bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground",
                )}
                aria-current={step === s.n ? "step" : undefined}
              >
                {step > s.n ? <Check className="size-4" aria-hidden /> : s.n}
              </div>
              <span
                className={cn(
                  "hidden text-xs font-semibold uppercase tracking-wide sm:block",
                  step >= s.n ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {s.label}
              </span>
              {i < STEPS.length - 1 && <div className="h-px flex-1 bg-border" aria-hidden />}
            </li>
          ))}
        </ol>
      </nav>

      {/* Step 1: Review scrim */}
      {step === 1 && (
        <section aria-labelledby="step1-heading" className="glass-strong flex flex-col gap-6 rounded-2xl p-6 sm:p-8">
          <div>
            <h1 id="step1-heading" className="font-display text-2xl font-bold uppercase tracking-tight sm:text-3xl">
              Confirm Your Scrim
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Review the lobby before entering squad details.</p>
          </div>

          <div className="flex flex-col gap-3 rounded-xl bg-secondary/60 p-5">
            <p className="font-display text-lg font-bold">{scrim.title}</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-muted-foreground">Time</dt>
                <dd className="font-semibold">{scrim.startTime}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Date</dt>
                <dd className="font-semibold">{formatDate(scrim.scrimDate)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Map / Mode</dt>
                <dd className="font-semibold">
                  {scrim.map} · {scrim.mode}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Entry Fee</dt>
                <dd className="font-semibold text-primary">{bdt(scrim.priceBdt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Prize Pool</dt>
                <dd className="font-semibold">{bdt(scrim.prizePoolBdt)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Spots Left</dt>
                <dd className="font-semibold">{remaining} teams</dd>
              </div>
            </dl>
          </div>

          <div className="flex items-center justify-between gap-4">
            <Button asChild variant="ghost">
              <Link href={`/scrims/${scrim.slug}`}>
                <ChevronLeft className="size-4" aria-hidden />
                Back
              </Link>
            </Button>
            <Button onClick={() => setStep(2)} size="lg" className="glow-primary font-display font-bold uppercase">
              <Users className="size-4" aria-hidden />
              Enter Squad Info
            </Button>
          </div>
        </section>
      )}

      {/* Step 2 + 3: Squad info form, submits to payment */}
      {step >= 2 && (
        <form
          action={formAction}
          onSubmit={(e) => {
            // If any hidden step-2 field is invalid, return to step 2 so the
            // browser can show validation messages on visible fields.
            if (!e.currentTarget.checkValidity()) {
              e.preventDefault()
              setStep(2)
              requestAnimationFrame(() => e.currentTarget?.reportValidity?.())
            }
          }}
          className="glass-strong flex flex-col gap-6 rounded-2xl p-6 sm:p-8"
        >
          <input type="hidden" name="scrimId" value={scrim.id} />

          <div className={step === 2 ? "flex flex-col gap-6" : "hidden"}>
            <div>
              <h1 className="font-display text-2xl font-bold uppercase tracking-tight sm:text-3xl">Squad Information</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Enter your team&apos;s in-game names and Free Fire UIDs exactly as they appear in game.
              </p>
            </div>

            {state.error && !state.ok && (
              <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {state.error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field id="teamName" label="Team Name" placeholder="e.g. Team Inferno" error={state.fieldErrors?.teamName} required maxLength={40} />
              <Field id="phone" label="Phone Number" type="tel" placeholder="01XXXXXXXXX" error={state.fieldErrors?.phone} required />
            </div>

            <div className="flex flex-col gap-4">
              <p className="font-display text-sm font-bold uppercase tracking-wide text-primary">Captain</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field id="captainName" label="Captain Name" placeholder="In-game name" error={state.fieldErrors?.captainName} required maxLength={40} />
                <Field id="captainUid" label="Captain UID" inputMode="numeric" placeholder="Free Fire UID" error={state.fieldErrors?.captainUid} required />
              </div>
            </div>

            {[2, 3, 4].map((n) => (
              <div key={n} className="flex flex-col gap-4">
                <p className="font-display text-sm font-bold uppercase tracking-wide text-primary">Player {n}</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field
                    id={`player${n}Name`}
                    label={`Player ${n} Name`}
                    placeholder="In-game name"
                    error={state.fieldErrors?.[`player${n}Name`]}
                    required
                    maxLength={40}
                  />
                  <Field
                    id={`player${n}Uid`}
                    label={`Player ${n} UID`}
                    inputMode="numeric"
                    placeholder="Free Fire UID"
                    error={state.fieldErrors?.[`player${n}Uid`]}
                    required
                  />
                </div>
              </div>
            ))}

            <div className="flex flex-col gap-4">
              <p className="font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">
                Player 5 — Substitute
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field id="player5Name" label="Player 5 Name" placeholder="In-game name" error={state.fieldErrors?.player5Name} optional maxLength={40} />
                <Field id="player5Uid" label="Player 5 UID" inputMode="numeric" placeholder="Free Fire UID" error={state.fieldErrors?.player5Uid} optional />
              </div>
            </div>

            <Field id="discordTelegram" label="Discord / Telegram" placeholder="@username" error={state.fieldErrors?.discordTelegram} optional maxLength={60} />

            <div className="flex items-center justify-between gap-4">
              <Button type="button" variant="ghost" onClick={() => setStep(1)}>
                <ChevronLeft className="size-4" aria-hidden />
                Back
              </Button>
              <Button
                type="button"
                size="lg"
                className="glow-primary font-display font-bold uppercase"
                onClick={(e) => {
                  const form = (e.currentTarget as HTMLButtonElement).closest("form")
                  if (form && !form.checkValidity()) {
                    form.reportValidity()
                    return
                  }
                  setStep(3)
                }}
              >
                <CreditCard className="size-4" aria-hidden />
                Continue to Payment
              </Button>
            </div>
          </div>

          {/* Step 3: Payment summary + submit */}
          <div className={step === 3 ? "flex flex-col gap-6" : "hidden"}>
            <div>
              <h1 className="font-display text-2xl font-bold uppercase tracking-tight sm:text-3xl">Payment</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                You&apos;ll be redirected to our secure payment gateway to pay with bKash, Nagad or Rocket.
              </p>
            </div>

            {state.error && !state.ok && (
              <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {state.error}
              </div>
            )}

            <div className="flex flex-col gap-3 rounded-xl bg-secondary/60 p-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {scrim.title} · {scrim.startTime}
                </span>
                <span className="font-semibold">{bdt(scrim.priceBdt)}</span>
              </div>
              <div className="h-px bg-border" aria-hidden />
              <div className="flex items-center justify-between">
                <span className="font-display font-bold uppercase">Total</span>
                <span className="font-display text-2xl font-bold text-primary">{bdt(scrim.priceBdt)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-xl border border-border/60 p-4 text-xs leading-relaxed text-muted-foreground">
              <p className="flex items-center gap-2">
                <ShieldCheck className="size-4 shrink-0 text-success" aria-hidden />
                Payment is verified automatically. Your booking confirms instantly on success.
              </p>
              <p className="flex items-center gap-2">
                <Lock className="size-4 shrink-0 text-success" aria-hidden />
                Processed securely by UddoktaPay. We never see your wallet PIN.
              </p>
            </div>

            <div className="flex items-center justify-between gap-4">
              <Button type="button" variant="ghost" onClick={() => setStep(2)} disabled={pending}>
                <ChevronLeft className="size-4" aria-hidden />
                Back
              </Button>
              <Button
                type="submit"
                size="lg"
                disabled={pending || (state.ok && !!state.paymentUrl)}
                className="glow-primary font-display font-bold uppercase"
              >
                {pending || (state.ok && state.paymentUrl) ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Redirecting...
                  </>
                ) : (
                  <>Pay {bdt(scrim.priceBdt)} Now</>
                )}
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}
