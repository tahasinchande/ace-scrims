"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Eye, EyeOff, Gift, CheckCircle2, AlertCircle, Lock } from "lucide-react"

type Mode = "sign-in" | "sign-up"

type ReferralCheckState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "valid"; type: "creator" | "user"; referrerName: string; code: string }
  | { status: "invalid"; reason: string }

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [referralCode, setReferralCode] = useState("")
  const [refCheck, setRefCheck] = useState<ReferralCheckState>({ status: "idle" })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [iframeTabUrl, setIframeTabUrl] = useState<string | null>(null)

  // Prefill referral code on sign-up from ?ref= query parameter or previously staged cookie
  useEffect(() => {
    if (mode !== "sign-up" || typeof window === "undefined") return
    let active = true

    const params = new URLSearchParams(window.location.search)
    const urlRef = (params.get("ref") || params.get("referral") || "").trim().toUpperCase()

    async function initReferral() {
      if (urlRef) {
        setReferralCode(urlRef)
        setRefCheck({ status: "checking" })
        try {
          const res = await fetch("/api/referrals/stage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: urlRef }),
          })
          const json = await res.json().catch(() => ({}))
          if (!active) return
          if (res.ok && json.valid) {
            setRefCheck({
              status: "valid",
              type: json.type,
              referrerName: json.referrerName,
              code: json.code,
            })
          } else {
            setRefCheck({
              status: "invalid",
              reason: json.error || "Referral code not found.",
            })
          }
        } catch {
          if (active) setRefCheck({ status: "idle" })
        }
        return
      }

      // Otherwise check if a referral code was already staged in HttpOnly cookie
      try {
        const res = await fetch("/api/referrals/stage", { cache: "no-store" })
        const json = await res.json().catch(() => ({}))
        if (!active) return
        if (json.code && json.valid) {
          setReferralCode(json.code)
          setRefCheck({
            status: "valid",
            type: json.type,
            referrerName: json.referrerName,
            code: json.code,
          })
        }
      } catch {
        // ignore
      }
    }

    initReferral()
    return () => {
      active = false
    }
  }, [mode])

  // Debounced live validation when user types a referral code manually
  useEffect(() => {
    if (mode !== "sign-up") return
    const trimmed = referralCode.trim().toUpperCase()
    if (!trimmed) {
      setRefCheck({ status: "idle" })
      return
    }
    if (refCheck.status === "valid" && refCheck.code === trimmed) {
      return
    }
    if (trimmed.length < 4) {
      setRefCheck({ status: "invalid", reason: "Referral codes are at least 4 characters." })
      return
    }

    let cancelled = false
    setRefCheck({ status: "checking" })
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/referrals/stage?code=${encodeURIComponent(trimmed)}`, {
          cache: "no-store",
        })
        const json = await res.json().catch(() => ({}))
        if (cancelled) return
        if (json.valid) {
          setRefCheck({
            status: "valid",
            type: json.type,
            referrerName: json.referrerName,
            code: json.code,
          })
        } else {
          setRefCheck({
            status: "invalid",
            reason: json.reason || "Referral code not found.",
          })
        }
      } catch {
        if (!cancelled) setRefCheck({ status: "idle" })
      }
    }, 350)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referralCode, mode])

  async function stageReferralBeforeSignup(): Promise<boolean> {
    if (mode !== "sign-up") return true
    const trimmed = referralCode.trim().toUpperCase()
    if (!trimmed) {
      await fetch("/api/referrals/stage", { method: "DELETE" }).catch(() => null)
      return true
    }

    const res = await fetch("/api/referrals/stage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: trimmed }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json.valid) {
      setError(json.error || "Invalid referral code. Please check the code or leave the field blank.")
      setRefCheck({
        status: "invalid",
        reason: json.error || "Invalid referral code.",
      })
      return false
    }
    setRefCheck({
      status: "valid",
      type: json.type,
      referrerName: json.referrerName,
      code: json.code,
    })
    return true
  }

  async function handleGoogle() {
    setError(null)
    setIframeTabUrl(null)
    setGoogleLoading(true)

    const isInIframe = typeof window !== "undefined" && window.self !== window.top
    if (isInIframe) {
      setIframeTabUrl(window.location.href)
      setError(
        "Google Sign-In cannot load inside an embedded preview iframe (Google blocks iframe logins). Open this page in a new tab to sign in."
      )
      setGoogleLoading(false)
      return
    }

    try {
      if (mode === "sign-up") {
        const okToProceed = await stageReferralBeforeSignup()
        if (!okToProceed) {
          setGoogleLoading(false)
          return
        }
      }

      const callbackURL = `${window.location.origin}/dashboard`
      const res = await authClient.signIn.social({
        provider: "google",
        callbackURL,
      })
      if (res?.error) {
        setError(
          res.error.message ||
            `Google sign-in failed. Please ensure ${window.location.origin}/api/auth/callback/google is added to Authorized Redirect URIs in Google Cloud Console.`
        )
        setGoogleLoading(false)
      }
    } catch (err: unknown) {
      setError(
        (err instanceof Error ? err.message : null) ||
          "Google sign-in failed. Ensure your preview URL is added to Authorized Redirect URIs in Google Cloud Console, or sign in using email & password above."
      )
      setGoogleLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)
    try {
      if (mode === "sign-up") {
        const okToProceed = await stageReferralBeforeSignup()
        if (!okToProceed) {
          setLoading(false)
          return
        }

        const { error } = await authClient.signUp.email({
          email,
          password,
          name,
          callbackURL: "/dashboard",
        })
        if (error) {
          setError(error.message ?? "Could not create account.")
        } else {
          await fetch("/api/referrals/stage", { method: "DELETE" }).catch(() => null)
          setInfo("Account created! Check your email to verify your address.")
          router.push(`/verify-email?email=${encodeURIComponent(email)}`)
          router.refresh()
        }
      } else {
        const { error } = await authClient.signIn.email({ email, password })
        if (error) {
          setError(error.message ?? "Invalid email or password.")
        } else {
          router.push("/dashboard")
          router.refresh()
        }
      }
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.form
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      onSubmit={handleSubmit}
      className="flex flex-col gap-5"
    >
      {mode === "sign-up" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            required
            autoComplete="name"
          />
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          autoComplete="email"
        />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          {mode === "sign-in" && (
            <Link href="/forgot-password" className="text-xs text-primary hover:underline">
              Forgot password?
            </Link>
          )}
        </div>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Min. 8 characters"
            required
            minLength={8}
            autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      {mode === "sign-up" && (
        <div className="flex flex-col gap-2 rounded-xl border border-border/70 bg-secondary/20 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="referralCode" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Gift className="size-3.5 text-primary" />
              Referral Code (Optional)
            </Label>
            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
              <Lock className="size-3" /> Sign-up only
            </span>
          </div>
          <Input
            id="referralCode"
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
            placeholder="Enter Creator or Player referral code"
            maxLength={24}
            autoComplete="off"
            className="font-mono uppercase tracking-wider bg-background/70"
          />
          {refCheck.status === "checking" && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> Checking referral code...
            </p>
          )}
          {refCheck.status === "valid" && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
              <CheckCircle2 className="size-3.5 shrink-0" />
              {refCheck.type === "creator" ? "Verified Creator Code" : "Valid Player Code"} by{" "}
              <span className="font-bold">{refCheck.referrerName}</span> — works with both Email &amp; Google sign-up.
            </p>
          )}
          {refCheck.status === "invalid" && (
            <p className="flex items-center gap-1.5 text-xs text-amber-400">
              <AlertCircle className="size-3.5 shrink-0" />
              {refCheck.reason}
            </p>
          )}
          {refCheck.status === "idle" && (
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Applies to both Email &amp; Password and Google sign-up. Referral codes lock permanently after registration.
            </p>
          )}
        </div>
      )}

      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive space-y-1.5"
        >
          <p>{error}</p>
          {iframeTabUrl && (
            <a
              href={iframeTabUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs font-semibold underline hover:opacity-80"
            >
              Open in a new browser tab
            </a>
          )}
        </motion.div>
      )}
      {info && (
        <motion.p
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary"
        >
          {info}
        </motion.p>
      )}

      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
        <Button
          type="submit"
          disabled={loading || googleLoading}
          className="h-11 w-full font-semibold glow-primary button-shimmer"
        >
          {loading && <Loader2 className="size-4 animate-spin mr-2" />}
          {mode === "sign-up" ? "Create account" : "Sign in"}
        </Button>
      </motion.div>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
        <span className="text-xs uppercase tracking-wider text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
      </div>

      <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
        <Button
          type="button"
          variant="outline"
          disabled={loading || googleLoading}
          onClick={handleGoogle}
          className="h-11 w-full gap-2 font-semibold bg-transparent hover:bg-secondary/50 border-border/80 transition-all"
        >
          {googleLoading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52Z"
              />
            </svg>
          )}
          Continue with Google
        </Button>
      </motion.div>

      <p className="text-center text-xs text-muted-foreground leading-relaxed bg-muted/30 p-2.5 rounded-lg border border-border/50">
        Tip: You can enter any <strong>@gmail.com</strong> address in the Email field above with a password to sign up or sign in instantly.
      </p>

      <p className="text-center text-sm text-muted-foreground">
        {mode === "sign-up" ? (
          <>
            Already have an account?{" "}
            <Link href="/sign-in" className="text-primary hover:underline font-semibold">
              Sign in
            </Link>
          </>
        ) : (
          <>
            New to Ace Scrims?{" "}
            <Link href="/sign-up" className="text-primary hover:underline font-semibold">
              Create account
            </Link>
          </>
        )}
      </p>
    </motion.form>
  )
}
