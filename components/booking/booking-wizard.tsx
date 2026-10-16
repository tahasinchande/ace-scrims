"use client"

import { useActionState, useEffect, useState } from "react"
import Link from "next/link"
import { createBooking, type BookingFormState } from "@/app/actions/booking"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { bdt, formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Check, ChevronLeft, Loader2, Lock, ShieldCheck, Users, CreditCard, Award, Upload, Image as ImageIcon, CheckCircle2, AlertCircle, Trash2, Wallet } from "lucide-react"
import { getScrimPrizeBreakdown } from "@/lib/prizepool"
import { uploadMediaFile } from "@/lib/client-upload"
import { toast } from "sonner"

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
  const [leaderImageUrl, setLeaderImageUrl] = useState("")
  const [isUploadingLeader, setIsUploadingLeader] = useState(false)
  const [leaderUploadError, setLeaderUploadError] = useState<string | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<"bKash" | "Nagad" | "Tap">("bKash")

  // Redirect to the payment gateway when the action returns a payment URL
  useEffect(() => {
    if (state.ok && state.paymentUrl) {
      window.location.href = state.paymentUrl
    }
  }, [state.ok, state.paymentUrl])

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

            {state.error && !state.ok && (
              <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {state.error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field id="teamName" label="Team Name" placeholder="e.g. Team Inferno" error={state.fieldErrors?.teamName} required maxLength={40} />
              <Field id="teamTag" label="Team Tag" placeholder="e.g. INF" error={state.fieldErrors?.teamTag} required maxLength={10} />
              <Field id="captainName" label="Team Leader Name" placeholder="e.g. Leader / Captain IG Name" error={state.fieldErrors?.captainName} required maxLength={40} />
              <Field id="captainUid" label="Team Leader Free Fire UID" placeholder="e.g. 1234567890" error={state.fieldErrors?.captainUid} required maxLength={30} />
              <Field id="phone" label="WhatsApp Number" type="tel" placeholder="01XXXXXXXXX" error={state.fieldErrors?.phone} required className="sm:col-span-2" />

              {/* Payment Provider Selection for Prizepool Disbursement */}
              <div className="sm:col-span-2 flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary/5 p-4">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs font-bold uppercase tracking-wide text-foreground flex items-center gap-1.5">
                    <Wallet className="size-4 text-primary" />
                    Prizepool Disbursement Method <span className="text-destructive">*</span>
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Select one payment provider (bKash, Nagad, or Tap) to receive your tournament prizepool.
                  </p>
                </div>

                <input type="hidden" name="paymentMethod" value={paymentMethod} />

                <div className="grid grid-cols-3 gap-2.5 mt-1">
                  {(
                    [
                      { id: "bKash", label: "bKash" },
                      { id: "Nagad", label: "Nagad" },
                      { id: "Tap", label: "Tap" },
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
                          {active ? "Selected" : "Select"}
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
                  label={`Payment Number (${paymentMethod} Account for Prizepool Disbursement)`}
                  type="tel"
                  placeholder={`01XXXXXXXXX (${paymentMethod} Personal Account)`}
                  error={state.fieldErrors?.paymentNumber}
                  required
                />

                {/* Dynamic Prizepool Declaration Bracket */}
                <div className="rounded-xl border border-primary/40 bg-primary/10 p-3.5 text-xs text-foreground flex flex-col gap-1 shadow-sm">
                  <div className="flex items-center gap-1.5 font-bold text-primary">
                    <CheckCircle2 className="size-4 shrink-0" />
                    <span>Prizepool Disbursement Declaration ({paymentMethod}):</span>
                  </div>
                  <p className="leading-relaxed">
                    Tournament winning prizepool will be disbursed strictly to the specific <strong>{paymentMethod}</strong> number/account you provide above.
                  </p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    (আপনার টুর্নামেন্ট প্রাইজপুল বিজয়ী হলে সরাসরি আপনার দেওয়া এই <strong>{paymentMethod}</strong> একাউন্ট নম্বরে পাঠানো হবে।)
                  </p>
                </div>
              </div>

              {/* Optional Team Members Drive Link */}
              <div className="sm:col-span-2 flex flex-col gap-1.5">
                <Field
                  id="teamMembersDriveLink"
                  label="Team Members Drive Link"
                  type="url"
                  placeholder="https://drive.google.com/drive/folders/..."
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
                      <p className="text-[11px] text-muted-foreground truncate">{leaderImageUrl}</p>
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
              <h1 className="font-display text-2xl font-bold uppercase tracking-tight sm:text-3xl">Payment</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                You&apos;ll be redirected to our secure gateway to pay via bKash or Nagad.
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

            <div className="flex flex-col gap-2 rounded-xl border border-warning/40 bg-warning/10 p-4 text-xs leading-relaxed text-warning-foreground">
              <p className="font-bold text-amber-300">⚠️ জরুরি নির্দেশনা (Important Disclaimer):</p>
              <p className="flex items-start gap-1.5">
                • <span>পেমেন্ট করার পর ট্রানজ্যাকশন আইডি এবং যে নাম্বার থেকে টাকা পাঠিয়েছেন তা সঠিকভাবে দিন।</span>
              </p>
              <p className="flex items-start gap-1.5">
                • <span>ভুল তথ্য দিলে স্লট কনফার্ম হবে না।</span>
              </p>
              <p className="flex items-start gap-1.5">
                • <span>যেকোনো সমস্যায় আমাদের সাথে সাপোর্ট চ্যানেলে যোগাযোগ করুন।</span>
              </p>
            </div>

            <div className="flex flex-col gap-2 rounded-xl border border-border/60 p-4 text-xs leading-relaxed text-muted-foreground">
              <p className="flex items-center gap-2">
                <ShieldCheck className="size-4 shrink-0 text-success" aria-hidden />
                Payment is verified automatically. Your booking confirms instantly on success.
              </p>
              <p className="flex items-center gap-2">
                <Lock className="size-4 shrink-0 text-success" aria-hidden />
                Processed securely via official payment gateway. We never see your wallet PIN.
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
