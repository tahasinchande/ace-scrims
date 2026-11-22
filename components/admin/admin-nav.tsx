"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
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
  AlertTriangle,
  Video,
  MessageSquare,
  Trash2,
  Camera,
  History,
  Coins,
  BellRing,
  KeyRound,
  Mail,
  Snowflake,
  Gift,
  Handshake,
} from "lucide-react"

type NavLink = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  exact?: boolean
}

const adminLinks: NavLink[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/scrims", label: "Scrims", icon: Swords },
  { href: "/admin/scrims?tab=room1", label: "Room 1", icon: KeyRound, exact: true },
  { href: "/admin/iceberg", label: "Iceberg", icon: Snowflake },
  { href: "/admin/notices", label: "Notices", icon: BellRing },
  { href: "/admin/email", label: "Email", icon: Mail },
  { href: "/admin/history", label: "Historical Data", icon: History },
  { href: "/admin/announce", label: "Announce", icon: Megaphone },
  { href: "/admin/tutorials", label: "Tutorials", icon: Video },
  { href: "/admin/logs", label: "Logs", icon: ScrollText },
  { href: "/admin/live-chat", label: "Live Chat", icon: MessageSquare },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/referrals", label: "Referrals & Creators", icon: Gift },
  { href: "/admin/partnerships", label: "Partnerships", icon: Handshake },
  { href: "/admin/credits", label: "Credit Management", icon: Coins },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/results", label: "Results", icon: Trophy },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/reports", label: "Reports", icon: ScrollText },
  { href: "/admin/not-hosted", label: "Not Hosted", icon: AlertTriangle },
  { href: "/admin/image-requests", label: "Image Requests", icon: Camera },
  { href: "/admin/trash", label: "Trash", icon: Trash2 },
]

// Moderators see room/result publishing and live support chat.
const moderatorLinks: NavLink[] = [
  { href: "/admin/scrims", label: "Scrims", icon: Swords },
  { href: "/admin/scrims?tab=room1", label: "Room 1", icon: KeyRound, exact: true },
  { href: "/admin/history", label: "Historical Data", icon: History },
  { href: "/admin/image-requests", label: "Image Requests", icon: Camera },
  { href: "/admin/results", label: "Results", icon: Trophy },
  { href: "/admin/live-chat", label: "Live Chat", icon: MessageSquare },
]

export function AdminNav({ role, name, logoUrl }: { role: string; name: string; logoUrl?: string }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get("tab")
  const links = role === "admin" ? adminLinks : moderatorLinks

  return (
    <aside className="w-full shrink-0 md:w-60">
      <div className="dc-surface sticky top-20 flex flex-col gap-4 rounded-2xl p-4">
        <div className="flex items-center gap-3 border-b border-white/[0.07] pb-3.5">
          {logoUrl ? (
            <div className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/[0.1] bg-white/[0.04] p-1">
              <img src={logoUrl} alt="Ace Scrims" className="h-full w-full object-contain" />
            </div>
          ) : (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/14 text-primary">
              <ShieldCheck className="size-5" />
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-semibold tracking-tight text-foreground">{name}</p>
            <p className="text-xs capitalize text-muted-foreground">{role}</p>
          </div>
        </div>

        <nav aria-label="Admin navigation" className="flex flex-row flex-wrap gap-1 md:flex-col">
          {links.map((link) => {
            const isRoom1Link = link.href === "/admin/scrims?tab=room1"
            const isAllScrimsLink = link.href === "/admin/scrims"
            const active = isRoom1Link
              ? pathname === "/admin/scrims" && tabParam === "room1"
              : isAllScrimsLink
                ? pathname.startsWith("/admin/scrims") && tabParam !== "room1"
                : link.exact
                  ? pathname === link.href
                  : pathname.startsWith(link.href)
            const Icon = link.icon
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold transition-all border border-transparent",
                  active
                    ? isRoom1Link
                      ? "bg-blue-500/14 text-blue-300 border-blue-500/30 shadow-xs"
                      : "bg-primary/14 text-primary border-primary/25 shadow-xs"
                    : "text-muted-foreground hover:bg-white/[0.05] hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="truncate">{link.label}</span>
              </Link>
            )
          })}
        </nav>

        <Link
          href="/dashboard"
          className="flex items-center gap-2 border-t border-white/[0.07] pt-3.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back to dashboard
        </Link>
      </div>
    </aside>
  )
}
