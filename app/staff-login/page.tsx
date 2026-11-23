"use client"

export const dynamic = "force-dynamic"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ShieldCheck, Loader2, Eye, EyeOff, Lock } from "lucide-react"

export default function StaffLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [iframeTabUrl, setIframeTabUrl] = useState<string | null>(null)

  async function handleGoogleStaff() {
    setError(null)
    setIframeTabUrl(null)
    setGoogleLoading(true)

    const isInIframe = typeof window !== "undefined" && window.self !== window.top
    if (isInIframe) {
      setIframeTabUrl(window.location.href)
      setError(
        "Google Sign-In cannot load inside an embedded preview iframe (Google blocks iframe logins). Open the app in a new tab to authenticate staff access."
      )
      setGoogleLoading(false)
      return
    }

    try {
      const callbackURL = `${window.location.origin}/admin/scrims`
      const res = await authClient.signIn.social({
        provider: "google",
        callbackURL,
      })
      if (res?.error) {
        setError(
          res.error.message ||
            `Google staff sign-in failed. Please ensure ${window.location.origin}/api/auth/callback/google is added to Authorized Redirect URIs in Google Cloud Console.`
        )
        setGoogleLoading(false)
      }
    } catch (err: any) {
      setError(
        err?.message ||
          "Google sign-in failed. Ensure your preview URL is added to Authorized Redirect URIs in Google Cloud Console, or sign in using staff email & password above."
      )
      setGoogleLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { data, error: signInError } = await authClient.signIn.email({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message || "Invalid staff credentials")
        setLoading(false)
        return
      }

      // Check session role server-side
      const sessionRes = await authClient.getSession()
      const role = (sessionRes?.data?.user as any)?.role

      if (role !== "admin" && role !== "moderator") {
        await authClient.signOut()
        setError("Access Denied: This account is not registered as RushX Organization Staff.")
        setLoading(false)
        return
      }

      router.push("/admin/scrims")
      router.refresh()
    } catch (err) {
      setError("An unexpected error occurred during staff authentication.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-[80vh] w-full max-w-md flex-col items-center justify-center p-4">
      <div className="glass flex w-full flex-col gap-6 rounded-3xl p-8 border border-primary/20 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-12 -top-12 size-32 rounded-full bg-primary/10 blur-2xl pointer-events-none" />

        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/30 shadow-inner">
            <Lock className="size-7" />
          </div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-wider text-foreground">
            Staff Portal
          </h1>
          <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold text-primary">
            Restricted Admin & Moderator Access
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Staff Email / Gmail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="staff@gmail.com or staff@acescrims.online"
              required
              autoComplete="email"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password">Staff Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs font-semibold text-destructive leading-relaxed space-y-2">
              <p>{error}</p>
              {iframeTabUrl && (
                <a
                  href={iframeTabUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block underline font-bold hover:opacity-80"
                >
                  Open Staff Portal in a new tab
                </a>
              )}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading || googleLoading}
            className="glow-primary h-11 font-display font-bold uppercase tracking-wider mt-2"
          >
            {loading ? <Loader2 className="size-4 animate-spin mr-2" /> : <ShieldCheck className="size-4 mr-2" />}
            Authenticate Staff Access
          </Button>

          <div className="flex items-center gap-3 my-1">
            <span className="h-px flex-1 bg-border" aria-hidden="true" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-bold">or</span>
            <span className="h-px flex-1 bg-border" aria-hidden="true" />
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={loading || googleLoading}
            onClick={handleGoogleStaff}
            className="h-11 w-full gap-2.5 font-semibold bg-transparent hover:bg-secondary/60 border-border/80 transition-all font-display uppercase tracking-wider text-xs"
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
            Login with Gmail
          </Button>

          <p className="text-center text-xs text-muted-foreground leading-relaxed bg-muted/20 p-2.5 rounded-lg border border-border/40 mt-1">
            Staff members can sign in using their registered <strong>@gmail.com</strong> account or standard credentials.
          </p>
        </form>
      </div>
    </main>
  )
}
