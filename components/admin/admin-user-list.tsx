"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"
import { setUserRole, setUserBanned, setUserEmailVerified, trashUsers } from "@/app/actions/admin"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { formatDate } from "@/lib/format"
import { resolveImageUrl } from "@/lib/image-url"
import { cn } from "@/lib/utils"
import {
  Ban,
  Search,
  ShieldCheck,
  Undo2,
  User as UserIcon,
  Trash2,
  CheckSquare,
  Square,
  Coins,
  BadgeCheck,
  ShieldAlert,
} from "lucide-react"
import { toast } from "sonner"

type UserRow = {
  id: string
  name: string
  email: string
  image?: string | null
  role: string
  balance?: number
  banned: boolean
  emailVerified: boolean
  createdAt: Date
}

function getUserInitials(name: string): string {
  if (!name || !name.trim()) return "U"
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function AdminUserList({
  users,
  currentUserId,
}: {
  users: UserRow[]
  currentUserId: string
}) {
  const router = useRouter()
  const [localUsers, setLocalUsers] = useState<UserRow[]>(users)
  const [query, setQuery] = useState("")
  const [isPending, startTransition] = useTransition()
  const [togglingVerifyId, setTogglingVerifyId] = useState<string | null>(null)
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({})
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [pendingTrashIds, setPendingTrashIds] = useState<string[] | null>(null)

  useEffect(() => {
    setLocalUsers(users)
  }, [users])

  const filtered = localUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(query.toLowerCase()) ||
      u.email.toLowerCase().includes(query.toLowerCase()),
  )

  const selectableUsers = filtered.filter((u) => u.id !== currentUserId && u.role !== "admin")
  const allSelected = selectableUsers.length > 0 && selectedUserIds.length === selectableUsers.length

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedUserIds([])
    } else {
      setSelectedUserIds(selectableUsers.map((u) => u.id))
    }
  }

  function toggleSelectUser(id: string) {
    setSelectedUserIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
  }

  function handleDeleteToTrash(ids: string[]) {
    if (ids.length === 0) return
    setPendingTrashIds(ids)
  }

  function executeDeleteToTrash() {
    if (!pendingTrashIds || pendingTrashIds.length === 0) return
    const ids = pendingTrashIds
    setPendingTrashIds(null)
    startTransition(async () => {
      const res = await trashUsers(ids)
      if (res.ok) {
        toast.success(`Moved ${res.count} user(s) to Trash`)
        setSelectedUserIds((prev) => prev.filter((i) => !ids.includes(i)))
        setLocalUsers((prev) => prev.filter((u) => !ids.includes(u.id)))
        router.refresh()
      } else {
        toast.error(res.error || "Failed to move users to trash")
      }
    })
  }

  function changeRole(userId: string, role: "user" | "moderator" | "admin") {
    startTransition(async () => {
      try {
        await setUserRole(userId, role)
        setLocalUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)))
        toast.success(`Role updated to ${role}`)
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to update role")
      }
    })
  }

  function toggleBan(userId: string, banned: boolean) {
    startTransition(async () => {
      try {
        await setUserBanned(userId, banned)
        setLocalUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, banned } : u)))
        toast.success(banned ? "User banned" : "User unbanned")
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to update user")
      }
    })
  }

  async function handleToggleVerified(targetUser: UserRow, nextVerified: boolean) {
    if (togglingVerifyId === targetUser.id) return
    const prevVerified = targetUser.emailVerified
    setTogglingVerifyId(targetUser.id)
    setLocalUsers((prev) =>
      prev.map((u) => (u.id === targetUser.id ? { ...u, emailVerified: nextVerified } : u)),
    )

    try {
      const res = await setUserEmailVerified(targetUser.id, nextVerified)
      if (!res.ok) {
        setLocalUsers((prev) =>
          prev.map((u) => (u.id === targetUser.id ? { ...u, emailVerified: prevVerified } : u)),
        )
        toast.error(res.error || "Failed to update verification status")
        return
      }
      toast.success(
        nextVerified
          ? `${targetUser.name || "User"} marked as Verified`
          : `${targetUser.name || "User"} marked as Unverified`,
      )
      router.refresh()
    } catch (err) {
      setLocalUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, emailVerified: prevVerified } : u)),
      )
      toast.error(err instanceof Error ? err.message : "Failed to update verification status")
    } finally {
      setTogglingVerifyId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-sm w-full">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email…"
            className="pl-9"
            aria-label="Search users"
          />
        </div>

        {selectedUserIds.length > 0 && (
          <Button
            size="sm"
            variant="destructive"
            disabled={isPending}
            onClick={() => handleDeleteToTrash(selectedUserIds)}
            className="h-8 gap-1.5 text-xs"
          >
            <Trash2 className="size-3.5" /> Move Selected to Trash ({selectedUserIds.length})
          </Button>
        )}
      </div>

      {selectableUsers.length > 0 && (
        <div className="glass flex items-center justify-between rounded-xl border border-border/60 p-3">
          <button
            type="button"
            onClick={toggleSelectAll}
            className="flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            {allSelected ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4" />}
            <span>{selectedUserIds.length > 0 ? `${selectedUserIds.length} user(s) selected` : "Select all selectable users"}</span>
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center text-sm text-muted-foreground">
          No users match your search.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((u) => {
            const isSelf = u.id === currentUserId
            const isCanTrash = !isSelf && u.role !== "admin"
            const isSelected = selectedUserIds.includes(u.id)
            const hasValidImage = Boolean(u.image && u.image.trim()) && !failedImages[u.id]
            const isTogglingThis = togglingVerifyId === u.id

            return (
              <li
                key={u.id}
                className={`glass flex flex-wrap items-center gap-3 rounded-xl p-4 border transition-all ${
                  isSelected ? "border-primary bg-primary/5" : "border-border/70 hover:border-border"
                }`}
              >
                {isCanTrash ? (
                  <button
                    type="button"
                    onClick={() => toggleSelectUser(u.id)}
                    className="p-1 text-muted-foreground hover:text-foreground"
                  >
                    {isSelected ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4" />}
                  </button>
                ) : (
                  <div className="size-4" />
                )}

                {/* User Avatar */}
                <div className="relative size-10 shrink-0 rounded-full overflow-hidden border border-border/80 bg-secondary/80 flex items-center justify-center">
                  {hasValidImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={resolveImageUrl(u.image!)}
                      alt={`${u.name}'s avatar`}
                      onError={() => setFailedImages((prev) => ({ ...prev, [u.id]: true }))}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="size-full flex items-center justify-center font-display font-bold text-xs uppercase text-foreground bg-secondary">
                      {u.name ? getUserInitials(u.name) : <UserIcon className="size-4 text-muted-foreground" />}
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 font-medium">
                    <span className="truncate">{u.name}</span>
                    {u.role !== "user" && (
                      <Badge variant="default" className="capitalize">
                        <ShieldCheck className="size-3" />
                        {u.role}
                      </Badge>
                    )}
                    {u.banned && <Badge variant="destructive">Banned</Badge>}
                    {u.emailVerified ? (
                      <Badge
                        variant="outline"
                        className="gap-1 border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                      >
                        <BadgeCheck className="size-3" />
                        Verified
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-400"
                      >
                        <ShieldAlert className="size-3" />
                        Unverified
                      </Badge>
                    )}
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-mono font-bold tabular-nums text-emerald-400 border border-emerald-500/25">
                      ৳{(u.balance ?? 0).toLocaleString()}
                    </span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground mt-0.5">
                    {u.email} · joined {formatDate(u.createdAt)}
                  </p>
                </div>

                {!isSelf && (
                  <div className="flex flex-wrap items-center gap-2">
                    <div
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition-colors",
                        u.emailVerified
                          ? "border-emerald-500/35 bg-emerald-500/10"
                          : "border-amber-500/35 bg-amber-500/10",
                      )}
                      title={u.emailVerified ? "Click to mark Unverified" : "Click to mark Verified"}
                    >
                      <Switch
                        checked={u.emailVerified}
                        disabled={isPending || isTogglingThis}
                        onCheckedChange={(checked) => void handleToggleVerified(u, Boolean(checked))}
                        aria-label={`Verification status for ${u.name}`}
                      />
                      <button
                        type="button"
                        disabled={isPending || isTogglingThis}
                        onClick={() => void handleToggleVerified(u, !u.emailVerified)}
                        className={cn(
                          "text-xs font-semibold cursor-pointer disabled:opacity-50",
                          u.emailVerified ? "text-emerald-300" : "text-amber-300",
                        )}
                      >
                        {isTogglingThis
                          ? "Saving..."
                          : u.emailVerified
                            ? "Verified"
                            : "Unverified"}
                      </button>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                      className="h-8 gap-1 text-xs border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                      title="Manage credits"
                    >
                      <Link href="/admin/credits">
                        <Coins className="size-3.5" />
                        Credits
                      </Link>
                    </Button>
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
                    {isCanTrash && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={isPending}
                        onClick={() => handleDeleteToTrash([u.id])}
                        title="Move user to Trash"
                        className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                )}
                {isSelf && (
                  <div className="flex items-center gap-2">
                    {!u.emailVerified && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isTogglingThis}
                        onClick={() => void handleToggleVerified(u, true)}
                        className="h-8 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 text-xs"
                      >
                        Verify My Account
                      </Button>
                    )}
                    <span className="text-xs text-muted-foreground">You</span>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <ConfirmDialog
        open={pendingTrashIds !== null}
        onOpenChange={(open) => !open && setPendingTrashIds(null)}
        title="Move Users to Trash?"
        description={`Move ${pendingTrashIds?.length ?? 0} user(s) to Trash?`}
        confirmLabel="Move to Trash"
        variant="destructive"
        loading={isPending}
        onConfirm={executeDeleteToTrash}
      />
    </div>
  )
}
