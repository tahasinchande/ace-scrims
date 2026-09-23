"use client"

export const dynamic = "force-dynamic"

import { useState, Suspense } from "react"
import { authClient, useSession } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import {
  Mail,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  LogOut,
  ArrowLeft,
  AlertCircle,
  RefreshCw,
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"

function VerifyEmailContent() {
  const { data: session, isPending: sessionLoading } = useSession()
  const [loading, setLoading] = useState(false)
  const [signOutLoading, setSignOutLoading] = useState(false)
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle")
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  const user = session?.user
  const userEmail = user?.email || searchParams?.get("email") || ""

  async function handleResend() {
    const targetEmail = user?.email || userEmail
    if (!targetEmail) {
      const errorMsg = "No email found for this session. Please sign in or register."
      toast.error(errorMsg)
      setStatus("error")
      setFeedbackMessage(errorMsg)
      return
    }

    setLoading(true)
    setStatus("idle")
    setFeedbackMessage(null)

    try {
      const res = await authClient.sendVerificationEmail({
        email: targetEmail,
        callbackURL: "/dashboard",
      })

      if (res?.error) {
        const errorMsg = res.error.message || "Failed to send verification email"
        toast.error(errorMsg)
        setStatus("error")
        setFeedbackMessage(errorMsg)
      } else {
        const successMsg = `Verification email sent to ${targetEmail}! Please check your inbox and spam folder.`
        toast.success(successMsg)
        setStatus("success")
        setFeedbackMessage(successMsg)
      }
    } catch (err: any) {
      const errorMsg = err?.message || "An unexpected error occurred while sending the email."
      toast.error(errorMsg)
      setStatus("error")
      setFeedbackMessage(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  async function handleSignOut() {
    setSignOutLoading(true)
    try {
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            toast.success("Signed out successfully")
            router.push("/")
            router.refresh()
          },
        },
      })
    } catch {
      toast.error("Error signing out. Redirecting...")
      router.push("/")
    } finally {
      setSignOutLoading(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-[75vh] w-full max-w-lg flex-col items-center justify-center p-4">
      <div className="glass flex w-full flex-col items-center gap-6 rounded-3xl p-8 text-center border border-border/80 shadow-2xl">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary border border-primary/20">
          <Mail className="size-8" />
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
            Verify Your Email Address
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Please verify your email address to access bookings, slot purchases, dashboards, and reporting on Ace Scrims.
          </p>

          {userEmail ? (
            <div className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-secondary px-4 py-1.5 text-xs font-semibold text-foreground">
              <ShieldAlert className="size-4 text-primary" />
              <span>{userEmail}</span>
            </div>
          ) : sessionLoading ? (
            <div className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-secondary/50 px-4 py-1 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              <span>Checking session...</span>
            </div>
          ) : null}
        </div>

        {/* Dynamic feedback alerts */}
        {status === "success" && (
          <div className="w-full flex items-start gap-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3.5 text-left text-xs text-emerald-400">
            <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed font-medium">
              {feedbackMessage || "Verification email sent successfully! Please check your inbox."}
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="w-full flex items-start gap-2.5 rounded-xl bg-destructive/10 border border-destructive/30 p-3.5 text-left text-xs text-destructive">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed font-medium">
              {feedbackMessage || "Failed to send verification email. Please try again."}
            </div>
          </div>
        )}

        {user?.emailVerified ? (
          <div className="flex flex-col items-center gap-3 w-full">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
              <CheckCircle2 className="size-5" />
              Your email is verified!
            </div>
            <Button
              render={<Link href="/dashboard" />}
              className="glow-primary font-display font-bold uppercase mt-2 w-full"
            >
              Go to Dashboard
            </Button>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-3">
            <Button
              id="resend-verification-email-btn"
              onClick={handleResend}
              disabled={loading || sessionLoading}
              className="glow-primary w-full font-display font-bold uppercase"
            >
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  Sending Verification Email...
                </>
              ) : (
                <>
                  <RefreshCw className="size-4 mr-2" />
                  RESEND VERIFICATION EMAIL AGAIN
                </>
              )}
            </Button>

            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="w-full font-display font-semibold"
            >
              I have verified, Refresh Page
            </Button>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50">
              <Button
                variant="ghost"
                render={<Link href="/" />}
                className="w-full text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-3.5 mr-1" /> Back to Home
              </Button>
              <Button
                variant="destructive"
                onClick={handleSignOut}
                disabled={signOutLoading}
                className="w-full text-xs font-semibold"
              >
                {signOutLoading ? (
                  <Loader2 className="size-3.5 animate-spin mr-1" />
                ) : (
                  <LogOut className="size-3.5 mr-1" />
                )}
                Sign Out
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-[75vh] w-full max-w-lg items-center justify-center p-4">
          <Loader2 className="size-8 animate-spin text-primary" />
        </main>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  )
}
