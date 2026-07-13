"use client"

import { useState, useTransition } from "react"
import { setUserRole, setUserBanned } from "@/app/actions/admin"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatDate } from "@/lib/format"
import { Ban, Search, ShieldCheck, Undo2 } from "lucide-react"
import { toast } from "sonner"

type UserRow = {
  id: string
  name: string
  email: string
  role: string
  banned: boolean
  emailVerified: boolean
  createdAt: Date
}

export function AdminUserList({
  users,
  currentUserId,
}: {
  users: UserRow[]
  currentUserId: string
}) {
  const [query, setQuery] = useState("")
  const [isPending, startTransition] = useTransition()

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(query.toLowerCase()) ||
      u.email.toLowerCase().includes(query.toLowerCase()),
  )

  function changeRole(userId: string, role: "user" | "moderator" | "admin") {
    startTransition(async () => {
      try {
        await setUserRole(userId, role)
        toast.success(`Role updated to ${role}`)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to update role")
      }
    })
  }

  function toggleBan(userId: string, banned: boolean) {
    startTransition(async () => {
      try {
        await setUserBanned(userId, banned)
        toast.success(banned ? "User banned" : "User unbanned")
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to update user")
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-sm">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email…"
          className="pl-9"
          aria-label="Search users"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center text-sm text-muted-foreground">
          No users match your search.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((u) => {
            const isSelf = u.id === currentUserId
            return (
              <li key={u.id} className="glass flex flex-wrap items-center gap-3 rounded-xl p-4">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-medium">
                    <span className="truncate">{u.name}</span>
                    {u.role !== "user" && (
                      <Badge variant="default" className="capitalize">
                        <ShieldCheck className="size-3" />
                        {u.role}
                      </Badge>
                    )}
                    {u.banned && <Badge variant="destructive">Banned</Badge>}
                    {!u.emailVerified && <Badge variant="outline">Unverified</Badge>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {u.email} · joined {formatDate(u.createdAt)}
                  </p>
                </div>

                {!isSelf && (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={u.role}
                      disabled={isPending}
                      onChange={(e) =>
                        changeRole(u.id, e.target.value as "user" | "moderator" | "admin")
                      }
                      aria-label={`Role for ${u.name}`}
                      className="h-8 rounded-md border border-input bg-secondary px-2 text-xs capitalize"
                    >
                      <option value="user">User</option>
                      <option value="moderator">Moderator</option>
                      <option value="admin">Admin</option>
                    </select>
                    <Button
                      size="sm"
                      variant={u.banned ? "outline" : "destructive"}
                      disabled={isPending}
                      onClick={() => toggleBan(u.id, !u.banned)}
                    >
                      {u.banned ? <Undo2 className="size-3.5" /> : <Ban className="size-3.5" />}
                      {u.banned ? "Unban" : "Ban"}
                    </Button>
                  </div>
                )}
                {isSelf && <span className="text-xs text-muted-foreground">You</span>}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
