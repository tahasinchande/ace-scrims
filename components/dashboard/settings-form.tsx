"use client"

import { useActionState, useState } from "react"
import { useRouter } from "next/navigation"
import { updateProfileName, type ProfileState } from "@/app/actions/dashboard"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Loader2, BadgeCheck, MailWarning } from "lucide-react"

const initialState: ProfileState = { ok: false }

export function SettingsForm({
  user,
}: {
  user: { name: string; email: string; emailVerified: boolean }
}) {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(updateProfileName, initialState)

  const [pwState, setPwState] = useState<{ error?: string; message?: string; busy: boolean }>({ busy: false })

  async function handlePasswordChange(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    const currentPassword = String(data.get("currentPassword") ?? "")
    const newPassword = String(data.get("newPassword") ?? "")
    if (newPassword.length < 8) {
      setPwState({ error: "New password must be at least 8 characters.", busy: false })
      return
    }
    setPwState({ busy: true })
    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    })
    if (error) {
      setPwState({ error: error.message ?? "Could not change password.", busy: false })
    } else {
      form.reset()
      setPwState({ message: "Password changed. Other sessions were signed out.", busy: false })
      router.refresh()
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Profile */}
      <section aria-labelledby="profile-heading" className="glass rounded-2xl p-6">
        <h2 id="profile-heading" className="font-display text-lg font-bold uppercase tracking-wide">
          Profile
        </h2>
        <form action={formAction} className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Display Name
            </Label>
            <Input id="name" name="name" defaultValue={user.name} required minLength={2} maxLength={50} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</Label>
            <div className="flex items-center gap-2">
              <Input value={user.email} disabled aria-label="Email (read only)" />
              {user.emailVerified ? (
                <Badge variant="outline" className="shrink-0 border-success/30 text-success">
                  <BadgeCheck className="size-3.5" aria-hidden />
                  Verified
                </Badge>
              ) : (
                <Badge variant="outline" className="shrink-0 border-warning/30 text-warning">
                  <MailWarning className="size-3.5" aria-hidden />
                  Unverified
                </Badge>
              )}
            </div>
          </div>
          {state.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
          {state.ok && state.message && <p className="text-sm text-success">{state.message}</p>}
          <div>
            <Button type="submit" disabled={pending} className="font-display font-bold uppercase">
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Save Changes
            </Button>
          </div>
        </form>
      </section>

      {/* Password */}
      <section aria-labelledby="password-heading" className="glass rounded-2xl p-6">
        <h2 id="password-heading" className="font-display text-lg font-bold uppercase tracking-wide">
          Change Password
        </h2>
        <form onSubmit={handlePasswordChange} className="mt-4 flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="currentPassword" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Current Password
              </Label>
              <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="newPassword" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                New Password
              </Label>
              <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required minLength={8} />
            </div>
          </div>
          {pwState.error && (
            <p role="alert" className="text-sm text-destructive">
              {pwState.error}
            </p>
          )}
          {pwState.message && <p className="text-sm text-success">{pwState.message}</p>}
          <div>
            <Button type="submit" disabled={pwState.busy} variant="secondary" className="font-display font-bold uppercase">
              {pwState.busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
              Update Password
            </Button>
          </div>
        </form>
      </section>
    </div>
  )
}
