"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "motion/react"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Eye, EyeOff } from "lucide-react"

type Mode = "sign-in" | "sign-up"

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [iframeTabUrl, setIframeTabUrl] = useState<string | null>(null)

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
    } catch (err: any) {
      setError(
        err?.message ||
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
        const { error } = await authClient.signUp.email({
          email,
          password,
          name,
          callbackURL: "/dashboard",
        })
        if (error) {
          setError(error.message ?? "Could not create account.")
        } else {
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
        💡 <strong>Tip:</strong> You can enter any <strong>@gmail.com</strong> address in the Email field above with a password to sign up or sign in instantly.
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
