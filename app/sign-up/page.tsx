import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import { getLiveShowcaseSummary } from "@/lib/queries/showcase"
import { AuthShell } from "@/components/auth/auth-shell"
import { AuthForm } from "@/components/auth/auth-form"

export const dynamic = "force-dynamic"
export const metadata = { title: "Create Account — RushX Organization" }

export default async function SignUpPage() {
  const [user, showcase] = await Promise.all([
    getSessionUser(),
    getLiveShowcaseSummary(),
  ])
  if (user) redirect("/dashboard")

  return (
    <AuthShell
      title="Join the lobby"
      subtitle="Create your account and start competing tonight."
      highlights={showcase.authHighlights}
    >
      <AuthForm mode="sign-up" />
    </AuthShell>
  )
}
