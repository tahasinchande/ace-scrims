"use client"

import { useActionState, useEffect, useState } from "react"
import Link from "next/link"
import { createBooking, type BookingFormState } from "@/app/actions/booking"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { bdt, formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Check, ChevronLeft, Loader2, Lock, ShieldCheck, Users, CreditCard, Award, Upload, Image as ImageIcon, CheckCircle2, AlertCircle, Trash2, Wallet, Sparkles } from "lucide-react"
import { getScrimPrizeBreakdown } from "@/lib/prizepool"
import { uploadMediaFile } from "@/lib/client-upload"
import { toast } from "sonner"
import type { UserDefaultInfo } from "@/lib/db/schema"

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

export function BookingWizard({
  scrim,
  userBalance = 0,
  defaultInfo = null,
  alreadyBooked = null,
}: {
  scrim: WizardScrim
  userBalance?: number
  defaultInfo?: UserDefaultInfo | null
  alreadyBooked?: { teamName: string; slotNumber: number | null } | null
}) {
  const [step, setStep] = useState(1)
  const [state, formAction, pending] = useActionState(createBooking, initialState)
  const [leaderImageUrl, setLeaderImageUrl] = useState(defaultInfo?.teamLeaderImageUrl || "")
  const [isUploadingLeader, setIsUploadingLeader] = useState(false)
  const [leaderUploadError, setLeaderUploadError] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<"bKash" | "Nagad" | "Tap" | "Balance">(
    (defaultInfo?.paymentMethod as "bKash" | "Nagad" | "Tap" | "Balance") || "bKash"
  )

  // Redirect to the payment gateway or dashboard when the action completes
  useEffect(() => {
    if (state.ok) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("acescrims:slots-updated", { detail: { scrimId: scrim.id } }))
        if (typeof BroadcastChannel !== "undefined") {
          const ch = new BroadcastChannel("acescrims-slots")
          ch.postMessage({ type: "slots-updated", scrimId: scrim.id })
          ch.close()
        }
      }
      if (state.paidWithBalance && state.redirectUrl) {
        toast.success("Slot booked successfully using your account balance!")
        window.location.href = state.redirectUrl
      } else if (state.paymentUrl) {
        window.location.href = state.paymentUrl
      }
    } else if (state.error) {
      toast.error(state.error)
    }
  }, [state.ok, state.error, state.paidWithBalance, state.redirectUrl, state.paymentUrl, scrim.id])

  async function handleLeaderImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploadingLeader(true)
    setLeaderUploadError(null)
    try {
      const res = await uploadMediaFile(file, "avatars")
      setLeaderImageUrl(res.url)
      toast.success("Team Leader image uploaded successfully")
    } catch (err: any) {
      console.error("Leader image upload error:", err)
      setLeaderUploadError(err?.message || "Failed to upload image. Please try again.")
      toast.error(err?.message || "Failed to upload image")
    } finally {
      setIsUploadingLeader(false)
    }
  }

  const remaining = Math.max(0, scrim.maxTeams - scrim.confirmedTeams)

  if (alreadyBooked) {
    return (
      <section className="glass-strong flex flex-col items-center gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-8 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400">
          <CheckCircle2 className="size-8" />
        </div>
        <h1 className="font-display text-2xl font-bold uppercase tracking-tight">
          Squad Already Registered
        </h1>
        <p className="max-w-md text-sm text-muted-foreground leading-relaxed">
          Your squad <strong className="text-foreground">{alreadyBooked.teamName}</strong> already has a confirmed slot
          {alreadyBooked.slotNumber ? ` (Slot #${alreadyBooked.slotNumber})` : ""} for{" "}
          <strong className="text-foreground">{scrim.title}</strong> ({scrim.startTime}). Duplicate registrations for the same lobby are disabled.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <Button asChild className="font-display font-bold uppercase">
            <Link href="/dashboard/scrims">View My Bookings</Link>
          </Button>
          <Button asChild variant="outline" className="font-display font-bold uppercase">
            <Link href="/scrims">Browse Other Lobbies</Link>
          </Button>
        </div>
      </section>
    )
  }

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
                <dt className="text-xs text-muted-foreground">Map / Format</dt>
                <dd className="font-semibold">
                  {scrim.title.trim().toLowerCase() === "10 pm champion rush" ||
                  scrim.title.toLowerCase().includes("champion rush") ||
                  scrim.slug.toLowerCase().includes("champion-rush")
                    ? "Champion Mode (Max 8 Matches)"
                    : scrim.title.toLowerCase().includes("friday special") ||
                      scrim.slug.toLowerCase().includes("friday-special")
                    ? "5 Matches (Bermuda, Purgatory, Kalahari, Solana, Nexterra)"
                    : "3 Matches (BERMUDA, PURGATORY & KALAHARI)"}
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
                <dd className="font-bold text-accent">{remaining} teams</dd>
              </div>
            </dl>
          </div>

          {/* Prize Distribution Breakdown in Booking Wizard */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-amber-400 font-display uppercase tracking-wider">
                <Award className="size-4" />
                Prize Distribution List
              </span>
              <span className="font-bold text-amber-300">Total: {bdt(getScrimPrizeBreakdown(scrim).totalPrizeBdt)}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
              {getScrimPrizeBreakdown(scrim).places.map((p) => (
                <div key={p.rank} className="flex items-center justify-between rounded-lg bg-secondary/60 border border-border/40 px-2.5 py-1.5 text-xs">
                  <span className="text-muted-foreground font-medium">{p.place}</span>
                  <span className="font-bold text-primary">{bdt(p.prizeBdt)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex flex-col gap-3">
            <h3 className="font-display text-sm font-bold uppercase text-primary flex items-center gap-2">
              <ShieldCheck className="size-4" />
              Facilities & Rewards
            </h3>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-medium text-foreground">
              <li className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-primary" />
                1. Top 3 Prize Pool
              </li>
              <li className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-primary" />
                2. Top 3 Face Banner
              </li>
              <li className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-primary" />
                3. MVP Face Banner
              </li>
              <li className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-primary" />
                4. Overall Standing Banner
              </li>
              <li className="flex items-center gap-2 sm:col-span-2">
                <span className="size-1.5 rounded-full bg-warning" />
                5. Prize distribution within 6 hours (Highest 24 hours)
              </li>
            </ul>
          </div>

          <div className="flex items-center justify-between gap-4">
            <Button asChild variant="ghost">
              <Link href={`/scrims/${scrim.slug}`}>
                <ChevronLeft className="size-4" aria-hidden />
                Back
              </Link>
            </Button>
            <Button onClick={() => setStep(2)} size="lg" className="glow-primary h-12 px-8 text-base font-display font-bold uppercase tracking-wide">
              <Users className="size-5" aria-hidden />
              ENTER SQUAD INFO
            </Button>
          </div>
        </section>
      )}

      {/* Step 2 + 3: Squad info form, submits to payment */}
      {step >= 2 && (
        <form
          action={formAction}
          onSubmit={(e) => {
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
                Enter your team details and WhatsApp number for room details and verification.
              </p>
            </div>

            {/* Auto-Fill Status Banner */}
            {defaultInfo ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-xs text-primary shadow-sm">
                <Sparkles className="size-4 shrink-0 text-primary" />
                <span>
                  <strong>⚡ Auto-Filled:</strong> Default squad details have been automatically loaded from your <strong>Info Setup</strong>. You can freely edit, update, or overwrite any field before registering.
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-secondary/30 px-4 py-2.5 text-xs text-muted-foreground">
                <span>💡 Tip: Save your squad details in Dashboard to auto-fill every registration instantly.</span>
                <Link href="/dashboard/info-setup" className="font-semibold text-primary hover:underline shrink-0">
                  Setup Info →
                </Link>
              </div>
            )}

            {state.error && !state.ok && (
              <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {state.error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field
                id="teamName"
                label="Team Name"
                placeholder="e.g. Team Inferno"
                defaultValue={defaultInfo?.teamName || ""}
                error={state.fieldErrors?.teamName}
                required
                maxLength={40}
              />
              <Field
                id="teamTag"
                label="Team Tag"
                placeholder="e.g. INF"
                defaultValue={defaultInfo?.teamTag || ""}
                error={state.fieldErrors?.teamTag}
                required
                maxLength={10}
              />
              <Field
                id="captainName"
                label="Team Leader Name"
                placeholder="e.g. Leader / Captain IG Name"
                defaultValue={defaultInfo?.captainName || ""}
                error={state.fieldErrors?.captainName}
                required
                maxLength={40}
              />
              <Field
                id="captainUid"
                label="Team Leader Free Fire UID"
                placeholder="e.g. 1234567890"
                defaultValue={defaultInfo?.captainUid || ""}
                error={state.fieldErrors?.captainUid}
                required
                maxLength={30}
              />
              <Field
                id="phone"
                label="WhatsApp Number"
                type="tel"
                placeholder="01XXXXXXXXX"
                defaultValue={defaultInfo?.phone || ""}
                error={state.fieldErrors?.phone}
                required
                className="sm:col-span-2"
              />

              {/* Payment Provider Selection for Prizepool Disbursement */}
              <div className="sm:col-span-2 flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary/5 p-4">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs font-bold uppercase tracking-wide text-foreground flex items-center gap-1.5">
                    <Wallet className="size-4 text-primary" />
                    Prize Pool Payout Method <span className="text-destructive">*</span>
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Select your preferred prize pool payout provider (bKash, Nagad, Tap, or Balance) to receive your tournament winnings.
                  </p>
                </div>

                <input type="hidden" name="paymentMethod" value={paymentMethod} />

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-1">
                  {(
                    [
                      { id: "bKash", label: "bKash" },
                      { id: "Nagad", label: "Nagad" },
                      { id: "Tap", label: "Tap" },
                      { id: "Balance", label: "Balance" },
                    ] as const
                  ).map((provider) => {
                    const active = paymentMethod === provider.id
                    return (
                      <button
                        key={provider.id}
                        type="button"
                        onClick={() => setPaymentMethod(provider.id)}
                        className={cn(
                          "flex flex-col items-center justify-center gap-1 py-3 px-2 rounded-xl border font-display font-bold text-sm uppercase transition-all",
                          active
                            ? "border-primary bg-primary/20 text-primary shadow-sm ring-1 ring-primary"
                            : "border-border/60 bg-secondary/40 text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                        )}
                      >
                        <span className="text-base font-extrabold tracking-wide">{provider.label}</span>
                        <span className="text-[10px] font-medium tracking-normal text-muted-foreground">
                          {active ? "Selected" : provider.id === "Balance" ? "Account Wallet" : "Select"}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Dynamic Payment Number Field with Prizepool Declaration */}
              <div className="sm:col-span-2 flex flex-col gap-2">
                <Field
                  id="paymentNumber"
                  label={
                    paymentMethod === "Balance"
                      ? "Payout Destination (Ace Scrims Account Balance)"
                      : `Payment Number (${paymentMethod} Personal Account for Prize Pool Payout)`
                  }
                  type={paymentMethod === "Balance" ? "text" : "tel"}
                  placeholder={
                    paymentMethod === "Balance"
                      ? "Ace Scrims Account Balance (Auto-credited)"
                      : `01XXXXXXXXX (${paymentMethod} Personal Account)`
                  }
                  defaultValue={
                    defaultInfo?.paymentMethod === "Balance"
                      ? (defaultInfo?.paymentNumber || "Ace Scrims Account Balance")
                      : paymentMethod === "Balance"
                      ? "Ace Scrims Account Balance"
                      : (defaultInfo?.paymentNumber || "")
                  }
                  error={state.fieldErrors?.paymentNumber}
                  required={paymentMethod !== "Balance"}
                />

                {/* Dynamic Prizepool Declaration Bracket */}
                <div className="rounded-xl border border-primary/40 bg-primary/10 p-3.5 text-xs text-foreground flex flex-col gap-1 shadow-sm">
                  <div className="flex items-center gap-1.5 font-bold text-primary">
                    <CheckCircle2 className="size-4 shrink-0" />
                    <span>Prize Pool Payout Declaration ({paymentMethod}):</span>
                  </div>
                  {paymentMethod === "Balance" ? (
                    <>
                      <p className="leading-relaxed">
                        Tournament winning prize pool will be deposited <strong>directly into your Ace Scrims account balance</strong> upon match result publication.
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        (আপনার টুর্নামেন্ট প্রাইজপুল সরাসরি আপনার Ace Scrims ব্যালেন্সে জমা করা হবে।)
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="leading-relaxed">
                        Tournament winning prize pool will be disbursed strictly to the specific <strong>{paymentMethod}</strong> number/account you provide above.
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        (আপনার টুর্নামেন্ট প্রাইজপুল বিজয়ী হলে সরাসরি আপনার দেওয়া এই <strong>{paymentMethod}</strong> একাউন্ট নম্বরে পাঠানো হবে।)
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Optional Team Members Drive Link */}
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <Field
                  id="teamMembersDriveLink"
                  label="Team Members Drive Link"
                  type="url"
                  placeholder="https://drive.google.com/drive/folders/..."
                  defaultValue={defaultInfo?.teamMembersDriveLink || ""}
                  error={state.fieldErrors?.teamMembersDriveLink}
                  optional
                />
                <p className="text-[11px] text-muted-foreground">
                  Provide a Google Drive folder link containing high-resolution photos of your squad members (optional).
                </p>
              </div>

              {/* Required Team Leader Image */}
              <div className="sm:col-span-2 flex flex-col gap-2 rounded-xl border border-border/80 bg-secondary/30 p-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-foreground flex items-center gap-1.5">
                      <ImageIcon className="size-3.5 text-primary" />
                      Team Leader Image <span className="text-destructive">*</span>
                    </Label>
                    {leaderImageUrl && (
                      <span className="flex items-center gap-1 text-xs font-bold text-emerald-400">
                        <CheckCircle2 className="size-3.5" /> Uploaded
                      </span>
                    )}
                  </div>
                  
                  {/* Exact required upload rules */}
                  <div className="mt-1 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground space-y-1">
                    <p className="font-semibold text-foreground">
                      (1) You must submit a waist-up photo. / কোমর পর্যন্ত ছবি দিতে হবে।
                    </p>
                    <p className="text-muted-foreground">
                      (2) It would be better if your uploaded image has its background removed. / আপলোড করা ছবির ব্যাকগ্রাউন্ড রিমুভ করা থাকলে ভালো হয়।
                    </p>
                  </div>
                </div>

                <input type="hidden" name="teamLeaderImageUrl" value={leaderImageUrl} />

                {leaderImageUrl ? (
                  <div className="flex items-center gap-4 rounded-lg border border-border bg-background p-3">
                    <img
                      src={leaderImageUrl}
                      alt="Team Leader"
                      className="size-16 rounded-md object-cover border border-border/60"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">Team Leader Photo Attached</p>
                      <p className="text-[11px] text-emerald-400">Waist-up photo verified &amp; ready for banner</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setLeaderImageUrl("")}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ) : (
                  <label
                    htmlFor="leader-image-file"
                    className={cn(
                      "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/80 bg-background/50 p-6 text-center transition-all cursor-pointer hover:border-primary/60 hover:bg-primary/[0.02]",
                      isUploadingLeader && "pointer-events-none opacity-60"
                    )}
                  >
                    <input
                      id="leader-image-file"
                      type="file"
                      accept="image/*"
                      onChange={handleLeaderImageChange}
                      disabled={isUploadingLeader}
                      className="sr-only"
                    />
                    {isUploadingLeader ? (
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 className="size-6 animate-spin text-primary" />
                        <span className="text-xs font-medium text-foreground">Uploading Team Leader photo...</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Upload className="size-5" />
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-semibold text-foreground">
                            Click or drag photo to upload
                          </span>
                          <span className="text-xs text-muted-foreground">
                            PNG, JPG, WEBP (No size limit)
                          </span>
                        </div>
                      </>
                    )}
                  </label>
                )}

                {(leaderUploadError || state.fieldErrors?.teamLeaderImageUrl) && (
                  <p role="alert" className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="size-3.5" />
                    {leaderUploadError || state.fieldErrors?.teamLeaderImageUrl}
                  </p>
                )}
              </div>
            </div>

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
                  if (!leaderImageUrl) {
                    toast.error("Please upload the Team Leader waist-up image before continuing.")
                    setLeaderUploadError("Team Leader image is required.")
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
              <h1 className="font-display text-2xl font-bold uppercase tracking-tight sm:text-3xl">Payment &amp; Confirmation</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {userBalance >= scrim.priceBdt
                  ? "You have sufficient account balance. Your slot will confirm instantly with zero gateway redirects."
                  : "Review your squad and click pay to reserve your slot securely."}
              </p>
            </div>

            {state.error && !state.ok && (
              <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {state.error}
              </div>
            )}

            {/* Wallet Balance Status Card */}
            <div
              className={`rounded-xl border p-4 ${
                userBalance >= scrim.priceBdt
                  ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-300"
                  : "border-border/80 bg-secondary/40 text-muted-foreground"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`flex size-7 items-center justify-center rounded-lg ${
                    userBalance >= scrim.priceBdt ? "bg-emerald-500/20 text-emerald-400" : "bg-secondary text-muted-foreground"
                  }`}>
                    <Wallet className="size-4" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Your Account Balance
                  </span>
                </div>
                <span className="font-mono text-base font-bold text-emerald-400">
                  {bdt(userBalance)}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed">
                {userBalance >= scrim.priceBdt ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="size-3.5 shrink-0" />
                    Sufficient balance! ৳{scrim.priceBdt} will be automatically deducted from your account for instant confirmation.
                  </span>
                ) : (
                  <span className="text-zinc-400">
                    Your wallet balance is {bdt(userBalance)} (Need {bdt(scrim.priceBdt)}). You will be securely redirected to pay {bdt(scrim.priceBdt)} via bKash, Nagad, or Tap.
                  </span>
                )}
              </p>
            </div>

            <div className="flex flex-col gap-3 rounded-xl bg-secondary/60 p-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {scrim.title} · {scrim.startTime}
                </span>
                <span className="font-semibold">{bdt(scrim.priceBdt)}</span>
              </div>
              <div className="h-px bg-border" aria-hidden />
              <div className="flex items-center justify-between">
                <span className="font-display font-bold uppercase">Total Entry Fee</span>
                <span className="font-display text-2xl font-bold text-primary">{bdt(scrim.priceBdt)}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-xl border border-warning/40 bg-warning/10 p-4 text-xs leading-relaxed text-warning-foreground">
              <p className="font-bold text-amber-300">⚠️ জরুরি নির্দেশনা (Important Disclaimer):</p>
              <p className="flex items-start gap-1.5">
                • <span>প্রাইজপুলের টাকা পাওয়ার জন্য আপনার বিকাশ/নগদ/ট্যাপ নাম্বারটি সঠিকভাবে দিয়েছেন কি না নিশ্চিত করুন।</span>
              </p>
              <p className="flex items-start gap-1.5">
                • <span>স্লট কনফার্ম হওয়ার পর আপনার ড্যাশবোর্ডে রুম আইডি এবং পাসওয়ার্ড দেখতে পাবেন।</span>
              </p>
              <p className="flex items-start gap-1.5">
                • <span>যেকোনো সমস্যায় আমাদের সাথে সাপোর্ট চ্যানেলে যোগাযোগ করুন।</span>
              </p>
            </div>

            <div className="flex flex-col gap-2 rounded-xl border border-border/60 p-4 text-xs leading-relaxed text-muted-foreground">
              <p className="flex items-center gap-2">
                <ShieldCheck className="size-4 shrink-0 text-success" aria-hidden />
                {userBalance >= scrim.priceBdt
                  ? "Instant wallet deduction with atomic server validation. No waiting for payment callbacks."
                  : "Payment is verified automatically. Your booking confirms instantly on success."}
              </p>
              <p className="flex items-center gap-2">
                <Lock className="size-4 shrink-0 text-success" aria-hidden />
                Processed securely via encrypted server. We never see your payment PIN.
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
                className={`glow-primary font-display font-bold uppercase ${
                  userBalance >= scrim.priceBdt ? "bg-emerald-600 hover:bg-emerald-500 text-white" : ""
                }`}
              >
                {pending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    {userBalance >= scrim.priceBdt ? "Confirming with Balance..." : "Connecting to Payment Gateway..."}
                  </>
                ) : userBalance >= scrim.priceBdt ? (
                  <>Register with Balance ({bdt(scrim.priceBdt)})</>
                ) : (
                  <>Pay {bdt(scrim.priceBdt)} (bKash / Nagad / Tap)</>
                )}
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}
