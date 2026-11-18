"use client"

import { useState, useTransition } from "react"
import {
  Users,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Upload,
  Image as ImageIcon,
  Trash2,
  Sparkles,
  Wallet,
  ShieldCheck,
  Link as LinkIcon,
  Phone,
  Eye,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { uploadMediaFile } from "@/lib/client-upload"
import { saveUserDefaultInfo } from "@/app/actions/user-info"
import type { UserDefaultInfo, PayoutMethod } from "@/lib/db/schema"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const FALLBACK_PAYOUT_METHODS: PayoutMethod[] = [
  { id: "pm-bkash", name: "bKash", code: "bKash", label: "bKash Personal", description: null, accentColor: "#E2136E", requiresAccountNumber: true, isActive: true, sortOrder: 1, createdAt: new Date(0), updatedAt: new Date(0) },
  { id: "pm-nagad", name: "Nagad", code: "Nagad", label: "Nagad Personal", description: null, accentColor: "#F7941D", requiresAccountNumber: true, isActive: true, sortOrder: 2, createdAt: new Date(0), updatedAt: new Date(0) },
  { id: "pm-rocket", name: "Rocket", code: "Rocket", label: "Rocket Personal", description: null, accentColor: "#8C3494", requiresAccountNumber: true, isActive: true, sortOrder: 3, createdAt: new Date(0), updatedAt: new Date(0) },
  { id: "pm-tap", name: "Tap", code: "Tap", label: "Tap Personal", description: null, accentColor: "#00A19D", requiresAccountNumber: true, isActive: true, sortOrder: 4, createdAt: new Date(0), updatedAt: new Date(0) },
  { id: "pm-balance", name: "Balance", code: "Balance", label: "Ace Scrims Wallet", description: null, accentColor: "#10B981", requiresAccountNumber: false, isActive: true, sortOrder: 5, createdAt: new Date(0), updatedAt: new Date(0) },
]

export function InfoSetupForm({
  initialData,
  payoutMethods,
}: {
  initialData: UserDefaultInfo | null
  payoutMethods?: PayoutMethod[]
}) {
  const availableMethods =
    payoutMethods && payoutMethods.length > 0 ? payoutMethods : FALLBACK_PAYOUT_METHODS

  const matchedInitial = availableMethods.find(
    (m) =>
      m.code.toLowerCase() === (initialData?.paymentMethod || "").toLowerCase() ||
      m.name.toLowerCase() === (initialData?.paymentMethod || "").toLowerCase()
  )

  const [teamName, setTeamName] = useState(initialData?.teamName || "")
  const [teamTag, setTeamTag] = useState(initialData?.teamTag || "")
  const [captainName, setCaptainName] = useState(initialData?.captainName || "")
  const [captainUid, setCaptainUid] = useState(initialData?.captainUid || "")
  const [phone, setPhone] = useState(initialData?.phone || "")
  const [paymentMethod, setPaymentMethod] = useState<string>(
    matchedInitial?.code || availableMethods[0]?.code || "bKash"
  )
  const [paymentNumber, setPaymentNumber] = useState(initialData?.paymentNumber || "")
  const [teamMembersDriveLink, setTeamMembersDriveLink] = useState(
    initialData?.teamMembersDriveLink || ""
  )
  const [teamLeaderImageUrl, setTeamLeaderImageUrl] = useState(
    initialData?.teamLeaderImageUrl || ""
  )

  const [isUploadingLeader, setIsUploadingLeader] = useState(false)
  const [leaderUploadError, setLeaderUploadError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  async function handleLeaderImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploadingLeader(true)
    setLeaderUploadError(null)
    try {
      const res = await uploadMediaFile(file, "avatars")
      setTeamLeaderImageUrl(res.url)
      toast.success("Team Leader photo uploaded successfully")
    } catch (err: any) {
      console.error("Leader image upload error:", err)
      setLeaderUploadError(err?.message || "Failed to upload image. Please try again.")
      toast.error(err?.message || "Failed to upload image")
    } finally {
      setIsUploadingLeader(false)
    }
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    const activeMethodObj =
      availableMethods.find((m) => m.code === paymentMethod) || availableMethods[0]
    const finalPaymentNumber =
      activeMethodObj && !activeMethodObj.requiresAccountNumber
        ? "Ace Scrims Account Balance"
        : paymentNumber

    startTransition(async () => {
      try {
        const res = await saveUserDefaultInfo({
          teamName,
          teamTag,
          captainName,
          captainUid,
          phone,
          paymentMethod,
          paymentNumber: finalPaymentNumber,
          teamMembersDriveLink,
          teamLeaderImageUrl,
        })

        if (!res.ok) {
          setErrorMsg(res.error || "Failed to save squad information.")
          toast.error(res.error || "Failed to save information")
          return
        }

        setSuccessMsg("Default team info saved successfully! All scrim booking forms will now auto-fill.")
        toast.success("Info Setup saved successfully!")
      } catch (err: any) {
        setErrorMsg(err?.message || "An unexpected error occurred.")
        toast.error("Error saving default info")
      }
    })
  }

  const selectedMethodObj =
    availableMethods.find((m) => m.code === paymentMethod) || availableMethods[0]
  const requiresAccountNumber = selectedMethodObj?.requiresAccountNumber ?? paymentMethod !== "Balance"

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold uppercase tracking-tight">
              Info Setup
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Save your permanent squad details and prize payout account to auto-fill every scrim booking.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">
            <Sparkles className="size-3.5" />
            Auto-Fill Scrim Registration
          </span>
        </div>
      </div>

      {/* Feature explanation banner */}
      <div className="glass relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-secondary/40 to-background p-5 shadow-sm">
        <div className="flex items-start gap-3.5">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary border border-primary/30">
            <Users className="size-5" />
          </div>
          <div className="space-y-1 text-xs leading-relaxed">
            <p className="font-display text-sm font-bold uppercase text-foreground">
              ⚡ How Info Setup Works
            </p>
            <p className="text-muted-foreground">
              Save your team name, tag, captain UID, WhatsApp number, prize payout details, and squad leader photo once. Whenever you book a scrim, these details are <strong>automatically pre-filled</strong> into the registration form so you can secure high-demand slots in seconds.
            </p>
            <p className="text-emerald-400 font-semibold pt-0.5">
              ✓ Convenience feature: You can still freely change or edit any field right on the booking form before final submission.
            </p>
          </div>
        </div>
      </div>

      {/* Status Alerts */}
      {successMsg && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-emerald-400">
          <CheckCircle2 className="size-5 shrink-0" />
          <div className="text-sm">
            <p className="font-bold">Info Setup Updated!</p>
            <p className="text-emerald-300/90 text-xs">{successMsg}</p>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-destructive">
          <AlertCircle className="size-5 shrink-0" />
          <div className="text-sm">
            <p className="font-bold">Could not save info</p>
            <p className="text-destructive/90 text-xs">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleSave} className="flex flex-col gap-6">
        {/* Section 1: Team & Tag */}
        <div className="glass rounded-2xl p-6 border border-border/80 flex flex-col gap-5">
          <div className="flex items-center gap-2 border-b border-border/60 pb-3">
            <Users className="size-4 text-primary" />
            <h2 className="font-display text-base font-bold uppercase tracking-wide">
              Team Identity
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="teamName" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Team Name
              </Label>
              <Input
                id="teamName"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="e.g. Team Inferno"
                maxLength={40}
                className="bg-background/50 font-medium"
              />
              <p className="text-[11px] text-muted-foreground">Your official team or esports squad name.</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="teamTag" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Team Tag
              </Label>
              <Input
                id="teamTag"
                value={teamTag}
                onChange={(e) => setTeamTag(e.target.value)}
                placeholder="e.g. INF"
                maxLength={10}
                className="bg-background/50 font-mono uppercase font-bold"
              />
              <p className="text-[11px] text-muted-foreground">Short 2-6 letter squad tag.</p>
            </div>
          </div>
        </div>

        {/* Section 2: Squad Leader & Contact */}
        <div className="glass rounded-2xl p-6 border border-border/80 flex flex-col gap-5">
          <div className="flex items-center gap-2 border-b border-border/60 pb-3">
            <ShieldCheck className="size-4 text-primary" />
            <h2 className="font-display text-base font-bold uppercase tracking-wide">
              Team Leader &amp; WhatsApp Contact
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="captainName" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Team Leader Name
              </Label>
              <Input
                id="captainName"
                value={captainName}
                onChange={(e) => setCaptainName(e.target.value)}
                placeholder="e.g. Leader / Captain IG Name"
                maxLength={40}
                className="bg-background/50"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="captainUid" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Team Leader Free Fire UID
              </Label>
              <Input
                id="captainUid"
                value={captainUid}
                onChange={(e) => setCaptainUid(e.target.value)}
                placeholder="e.g. 1234567890"
                maxLength={30}
                className="bg-background/50 font-mono"
              />
            </div>

            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="phone" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Phone className="size-3.5 text-primary" />
                WhatsApp Number
              </Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
                className="bg-background/50 font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Room credentials, match updates, and verification links are delivered to this WhatsApp number.
              </p>
            </div>
          </div>
        </div>

        {/* Section 3: Prize Pool Payout Account */}
        <div className="glass rounded-2xl p-6 border border-primary/30 bg-primary/[0.02] flex flex-col gap-5">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <Wallet className="size-4 text-primary" />
              <h2 className="font-display text-base font-bold uppercase tracking-wide">
                Prize Pool Payout Method &amp; Account
              </h2>
            </div>
            <span className="text-xs font-semibold text-primary">Direct Disbursement</span>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Preferred Payout Provider
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {availableMethods.map((prov) => {
                  const active = paymentMethod === prov.code
                  return (
                    <button
                      key={prov.id}
                      type="button"
                      onClick={() => {
                        setPaymentMethod(prov.code)
                        if (!prov.requiresAccountNumber && !paymentNumber) {
                          setPaymentNumber("Ace Scrims Account Balance")
                        }
                      }}
                      style={
                        active && prov.accentColor
                          ? {
                              borderColor: prov.accentColor,
                              backgroundColor: `${prov.accentColor}1A`,
                              color: prov.accentColor,
                            }
                          : undefined
                      }
                      className={cn(
                        "flex flex-col items-center justify-center gap-1 py-3 px-3 rounded-xl border font-display font-bold text-sm uppercase transition-all whitespace-nowrap",
                        active
                          ? "shadow-sm ring-1 ring-primary"
                          : "border-border/60 bg-secondary/40 text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                      )}
                    >
                      <span className="text-base font-extrabold tracking-wide">{prov.name}</span>
                      <span className="text-[10px] font-medium tracking-normal text-muted-foreground">
                        {active ? "Default Selected" : !prov.requiresAccountNumber ? "Instant Wallet" : "Select"}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="paymentNumber" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {!requiresAccountNumber
                  ? `Payout Destination (${selectedMethodObj?.label || paymentMethod})`
                  : `Personal Payment Number (${selectedMethodObj?.name || paymentMethod})`}
              </Label>
              <Input
                id="paymentNumber"
                type={!requiresAccountNumber ? "text" : "tel"}
                value={!requiresAccountNumber ? "Ace Scrims Wallet Balance (Auto-credited to this account)" : paymentNumber}
                onChange={(e) => setPaymentNumber(e.target.value)}
                disabled={!requiresAccountNumber}
                placeholder={
                  !requiresAccountNumber
                    ? "Auto-credited to your account wallet"
                    : `01XXXXXXXXX (${selectedMethodObj?.name || paymentMethod} Personal Account)`
                }
                className="bg-background/50 font-mono text-base font-bold disabled:opacity-90 disabled:text-emerald-400"
              />
              <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 text-xs text-foreground flex flex-col gap-1 mt-1">
                <span className="font-bold text-primary flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5" /> Prize Pool Disbursement Declaration:
                </span>
                {!requiresAccountNumber ? (
                  <p className="leading-relaxed">
                    When your team ranks in winning positions or secures the Champion title, your prize money will be deposited <strong>directly and instantly into your Ace Scrims account balance</strong>, allowing for seamless 1-click entry into future scrims!
                  </p>
                ) : (
                  <p className="leading-relaxed">
                    When your team ranks in top positions or wins the match, your prize money will automatically be sent to this <strong>{selectedMethodObj?.name || paymentMethod}</strong> personal account number.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Squad Photo & Drive Assets */}
        <div className="glass rounded-2xl p-6 border border-border/80 flex flex-col gap-5">
          <div className="flex items-center gap-2 border-b border-border/60 pb-3">
            <ImageIcon className="size-4 text-primary" />
            <h2 className="font-display text-base font-bold uppercase tracking-wide">
              Team Assets &amp; Leader Photo
            </h2>
          </div>

          <div className="flex flex-col gap-5">
            {/* Team Members Drive Link */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="teamMembersDriveLink" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <LinkIcon className="size-3.5 text-primary" />
                Default Team Members Drive Link
                <span className="text-[11px] font-normal normal-case opacity-60">(optional)</span>
              </Label>
              <Input
                id="teamMembersDriveLink"
                type="url"
                value={teamMembersDriveLink}
                onChange={(e) => setTeamMembersDriveLink(e.target.value)}
                placeholder="https://drive.google.com/drive/folders/..."
                className="bg-background/50"
              />
              <p className="text-[11px] text-muted-foreground">
                Google Drive folder containing high-resolution photos of your entire roster for victory banners.
              </p>
            </div>

            {/* Default Team Leader Image Upload & Preview */}
            <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-secondary/30 p-4">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wide text-foreground flex items-center gap-1.5">
                  <ImageIcon className="size-3.5 text-primary" />
                  Default Team Leader Image / Squad Leader Photo
                </Label>
                {teamLeaderImageUrl && (
                  <span className="flex items-center gap-1 text-xs font-bold text-emerald-400">
                    <CheckCircle2 className="size-3.5" /> Photo Attached
                  </span>
                )}
              </div>

              {/* Exact required upload rules */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">
                  (1) You must submit a waist-up photo. / কোমর পর্যন্ত ছবি দিতে হবে।
                </p>
                <p className="text-muted-foreground">
                  (2) It would be better if your uploaded image has its background removed. / আপলোড করা ছবির ব্যাকগ্রাউন্ড রিমুভ করা থাকলে ভালো হয়।
                </p>
              </div>

              {teamLeaderImageUrl ? (
                <div className="flex items-center gap-4 rounded-lg border border-border bg-background p-3">
                  <img
                    src={teamLeaderImageUrl}
                    alt="Team Leader Preview"
                    className="size-16 rounded-md object-cover border border-border/60"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">Default Leader Photo Ready</p>
                    <p className="text-[11px] text-emerald-400">Waist-up squad leader photo stored securely</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setTeamLeaderImageUrl("")}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ) : (
                <label
                  htmlFor="info-setup-leader-image"
                  className={cn(
                    "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/80 bg-background/50 p-6 text-center transition-all cursor-pointer hover:border-primary/60 hover:bg-primary/[0.02]",
                    isUploadingLeader && "pointer-events-none opacity-60"
                  )}
                >
                  <input
                    id="info-setup-leader-image"
                    type="file"
                    accept="image/*"
                    onChange={handleLeaderImageChange}
                    disabled={isUploadingLeader}
                    className="sr-only"
                  />
                  {isUploadingLeader ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="size-6 animate-spin text-primary" />
                      <span className="text-xs font-medium text-foreground">Uploading leader photo...</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Upload className="size-5" />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-semibold text-foreground">
                          Click or drag photo to upload default photo
                        </span>
                        <span className="text-xs text-muted-foreground">
                          PNG, JPG, WEBP (No size limit)
                        </span>
                      </div>
                    </>
                  )}
                </label>
              )}

              {leaderUploadError && (
                <p role="alert" className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="size-3.5" />
                  {leaderUploadError}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Live Preview Card */}
        <div className="glass rounded-2xl p-5 border border-border/60 bg-secondary/20 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <Eye className="size-3.5 text-primary" />
            <span>Registration Auto-Fill Preview</span>
          </div>
          <div className="rounded-xl border border-border/80 bg-background/80 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {teamLeaderImageUrl ? (
                <img
                  src={teamLeaderImageUrl}
                  alt="Captain"
                  className="size-12 rounded-lg object-cover border border-primary/40 shrink-0"
                />
              ) : (
                <div className="size-12 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground border border-border shrink-0">
                  <Users className="size-6" />
                </div>
              )}
              <div>
                <p className="font-display text-sm font-bold text-foreground">
                  {teamName || "Your Team Name"} {teamTag ? `[${teamTag}]` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  Captain: {captainName || "Leader Name"} · UID: {captainUid || "—"}
                </p>
              </div>
            </div>
            <div className="text-right sm:border-l sm:border-border sm:pl-4">
              <span className="rounded bg-primary/15 text-primary px-2 py-0.5 text-[10px] font-bold uppercase">
                {paymentMethod}
              </span>
              <p className="font-mono text-xs font-semibold text-foreground mt-1">
                {paymentNumber || "01XXXXXXXXX"}
              </p>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          size="lg"
          disabled={isPending || isUploadingLeader}
          className="glow-primary h-12 w-full font-display text-base font-bold uppercase tracking-wide sm:w-auto sm:self-end px-8"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Saving Info Setup...
            </>
          ) : (
            <>
              <Save className="mr-2 size-4" />
              Save Default Squad Info
            </>
          )}
        </Button>
      </form>
    </div>
  )
}
