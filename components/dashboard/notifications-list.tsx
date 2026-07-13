"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import Link from "next/link"
import { markNotificationRead, markAllNotificationsRead } from "@/app/actions/dashboard"
import { Button } from "@/components/ui/button"
import { timeAgo } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Bell, KeyRound, Trophy, CreditCard, Megaphone, CheckCheck } from "lucide-react"

type Item = {
  id: string
  type: string
  title: string
  body: string | null
  href: string | null
  read: boolean
  createdAt: string
}

const typeIcons: Record<string, typeof Bell> = {
  payment: CreditCard,
  room: KeyRound,
  result: Trophy,
  prize: Trophy,
  announcement: Megaphone,
}

export function NotificationsList({ items }: { items: Item[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const unread = items.filter((i) => !i.read).length

  if (items.length === 0) {
    return (
      <div className="glass flex flex-col items-center gap-3 rounded-2xl py-16 text-center">
        <Bell className="size-10 text-muted-foreground" aria-hidden />
        <p className="font-display text-xl font-bold uppercase">All quiet</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Notifications about payments, room credentials and results will land here.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {unread > 0 && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await markAllNotificationsRead()
                router.refresh()
              })
            }
          >
            <CheckCheck className="size-4" aria-hidden />
            Mark all as read
          </Button>
        </div>
      )}
      <ul className="glass divide-y divide-border/60 rounded-2xl">
        {items.map((n) => {
          const Icon = typeIcons[n.type] ?? Bell
          const inner = (
            <div className="flex items-start gap-3 px-5 py-4">
              <div
                className={cn(
                  "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
                  n.read ? "bg-secondary" : "bg-primary/15",
                )}
              >
                <Icon className={cn("size-4", n.read ? "text-muted-foreground" : "text-primary")} aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm", n.read ? "text-muted-foreground" : "font-semibold")}>{n.title}</p>
                {n.body && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{n.body}</p>}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="text-xs text-muted-foreground">{timeAgo(new Date(n.createdAt))}</span>
                {!n.read && <span className="size-2 rounded-full bg-primary" aria-label="Unread" />}
              </div>
            </div>
          )
          return (
            <li key={n.id}>
              {n.href ? (
                <Link
                  href={n.href}
                  className="block transition-colors hover:bg-secondary/40"
                  onClick={() => {
                    if (!n.read) startTransition(() => markNotificationRead(n.id))
                  }}
                >
                  {inner}
                </Link>
              ) : (
                <button
                  type="button"
                  className="block w-full text-left transition-colors hover:bg-secondary/40"
                  onClick={() => {
                    if (!n.read)
                      startTransition(async () => {
                        await markNotificationRead(n.id)
                        router.refresh()
                      })
                  }}
                >
                  {inner}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
