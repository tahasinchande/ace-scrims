import { AuthShell } from "@/components/auth/auth-shell"
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"

export const dynamic = "force-dynamic"
export const metadata = { title: "Forgot Password — RushX Organization" }

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Reset your password" subtitle="Enter your email and we'll send you a reset link.">
      <ForgotPasswordForm />
    </AuthShell>
  )
}
