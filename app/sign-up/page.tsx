import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import { AuthShell } from "@/components/auth/auth-shell"
import { AuthForm } from "@/components/auth/auth-form"

export const metadata = { title: "Create Account — Ace Scrims" }

export default async function SignUpPage() {
  const user = await getSessionUser()
  if (user) redirect("/dashboard")

  return (
    <AuthShell title="Join the lobby" subtitle="Create your account and start competing tonight.">
      <AuthForm mode="sign-up" />
    </AuthShell>
  )
}
