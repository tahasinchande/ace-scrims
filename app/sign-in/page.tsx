import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import { getLiveShowcaseSummary } from "@/lib/queries/showcase"
import { AuthShell } from "@/components/auth/auth-shell"
import { AuthForm } from "@/components/auth/auth-form"

export const dynamic = "force-dynamic"
export const metadata = { title: "Sign In — RushX Organization" }

export default async function SignInPage() {
  const [user, showcase] = await Promise.all([
    getSessionUser(),
    getLiveShowcaseSummary(),
  ])
  if (user) redirect("/dashboard")

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to book scrims and manage your squad."
      highlights={showcase.authHighlights}
    >
      <AuthForm mode="sign-in" />
    </AuthShell>
  )
}
