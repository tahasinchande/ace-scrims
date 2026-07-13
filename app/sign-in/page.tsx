import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import { AuthShell } from "@/components/auth/auth-shell"
import { AuthForm } from "@/components/auth/auth-form"

export const metadata = { title: "Sign In — Ace Scrims" }

export default async function SignInPage() {
  const user = await getSessionUser()
  if (user) redirect("/dashboard")

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to book scrims and manage your squad.">
      <AuthForm mode="sign-in" />
    </AuthShell>
  )
}
