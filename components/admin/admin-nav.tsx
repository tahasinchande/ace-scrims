"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Swords,
  Users,
  CreditCard,
  Trophy,
  Megaphone,
  Settings,
  ScrollText,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react"

const adminLinks = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/scrims", label: "Scrims", icon: Swords },
  { href: "/admin/results", label: "Results", icon: Trophy },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/announcements", label: "Announce", icon: Megaphone },
  { href: "/admin/logs", label: "Logs", icon: ScrollText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
]

// Moderators only see room/result publishing surfaces.
const moderatorLinks = [
  { href: "/admin/scrims", label: "Scrims", icon: Swords },
  { href: "/admin/results", label: "Results", icon: Trophy },
]

export function AdminNav({ role, name }: { role: string; name: string }) {
  const pathname = usePathname()
  const links = role === "admin" ? adminLinks : moderatorLinks

  return (
    <aside className="w-full shrink-0 md:w-56">
      <div className="glass sticky top-4 flex flex-col gap-4 rounded-2xl p-4">
        <div className="flex items-center gap-3 border-b border-border pb-3">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <ShieldCheck className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-bold uppercase">{name}</p>
            <p className="text-xs capitalize text-muted-foreground">{role}</p>
          </div>
        </div>

        <nav aria-label="Admin navigation" className="flex flex-row flex-wrap gap-1 md:flex-col">
          {links.map((link) => {
            const active = link.exact ? pathname === link.href : pathname.startsWith(link.href)
            const Icon = link.icon
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {link.label}
              </Link>
            )
          })}
        </nav>

        <Link
          href="/dashboard"
          className="flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back to dashboard
        </Link>
      </div>
    </aside>
  )
}
