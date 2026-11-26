"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { motion, useReducedMotion } from "motion/react"
import { DEEPCHARTS_EASE } from "@/lib/intro-motion"
import { isAdminOrOwner } from "@/lib/roles"
import { cn } from "@/lib/utils"
import { RushXBrandLogo } from "@/components/site/brand-logo"
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
  const prefersReducedMotion = useReducedMotion()
  const tabParam = searchParams.get("tab")
  const links = isAdminOrOwner(role) ? adminLinks : moderatorLinks

  return (
    <motion.aside
      initial={prefersReducedMotion ? { opacity: 1, x: 0 } : { opacity: 0.92, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.28, ease: DEEPCHARTS_EASE }}
      className="w-full shrink-0 md:w-60"
    >
      <div className="dc-surface sticky top-20 flex flex-col gap-4 rounded-2xl p-4">
        <div className="flex items-center gap-3 border-b border-white/[0.08] pb-3.5">
          <RushXBrandLogo variant="symbol" size="sm" logoUrl={logoUrl} />
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
                  "group relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold transition-all duration-200 border",
                  active
                    ? isRoom1Link
                      ? "bg-cyan-500/14 text-cyan-200 border-cyan-400/30 shadow-xs"
                      : "bg-[rgba(var(--rushx-primary-rgb),0.15)] text-white border-[rgba(var(--rushx-primary-rgb),0.32)] shadow-xs"
                    : "border-transparent text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100 hover:translate-x-0.5 active:scale-[0.99]",
                )}
              >
                {active && (
                  <span
                    className={cn(
                      "hidden md:block absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full",
                      isRoom1Link ? "bg-cyan-400" : "bg-primary"
                    )}
                    aria-hidden="true"
                  />
                )}
                <Icon
                  className={cn(
                    "size-4 shrink-0 transition-colors duration-200",
                    active
                      ? isRoom1Link
                        ? "text-cyan-300"
                        : "text-primary"
                      : "text-zinc-400 group-hover:text-zinc-200"
                  )}
                />
                <span className="truncate">{link.label}</span>
              </Link>
            )
          })}
        </nav>

        <Link
          href="/dashboard"
          className="flex items-center gap-2 border-t border-white/[0.08] pt-3.5 text-xs font-semibold text-zinc-400 transition-all duration-200 hover:text-white hover:translate-x-0.5"
        >
          <ArrowLeft className="size-3.5" />
          Back to dashboard
        </Link>
      </div>
    </motion.aside>
  )
}
