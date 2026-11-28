"use client"

import { useState } from "react"
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
  Palette,
  Menu,
  X,
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
  { href: "/admin/background", label: "Background", icon: Palette },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/reports", label: "Reports", icon: ScrollText },
  { href: "/admin/not-hosted", label: "Not Hosted", icon: AlertTriangle },
  { href: "/admin/image-requests", label: "Image Requests", icon: Camera },
  { href: "/admin/trash", label: "Trash", icon: Trash2 },
]

// Moderators see Scrims, Room 1, Historical Data, Image Requests, Results, and Live Chat.
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isLinkActive = (link: NavLink) => {
    const isRoom1Link = link.href === "/admin/scrims?tab=room1"
    const isAllScrimsLink = link.href === "/admin/scrims"
    if (isRoom1Link) return pathname === "/admin/scrims" && tabParam === "room1"
    if (isAllScrimsLink) return pathname.startsWith("/admin/scrims") && tabParam !== "room1"
    return link.exact ? pathname === link.href : pathname.startsWith(link.href)
  }

  const activeLink = links.find(isLinkActive) || links[0]

  const renderLinks = (onNavigate?: () => void) =>
    links.map((link) => {
      const isRoom1Link = link.href === "/admin/scrims?tab=room1"
      const active = isLinkActive(link)
      const Icon = link.icon
      return (
        <Link
          key={link.href}
          href={link.href}
          onClick={onNavigate}
          aria-current={active ? "page" : undefined}
          className={cn(
            "group relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold transition-all duration-200 border",
            active
              ? isRoom1Link
                ? "bg-cyan-500/14 text-cyan-200 border-cyan-400/30 shadow-xs"
                : "bg-[rgba(var(--rushx-primary-rgb),0.15)] text-white border-[rgba(var(--rushx-primary-rgb),0.32)] shadow-xs"
              : "border-transparent text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100 hover:translate-x-0.5 active:scale-[0.99]"
          )}
        >
          {active && (
            <span
              className={cn(
                "hidden lg:block absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full",
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
    })

  return (
    <motion.aside
      initial={prefersReducedMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.36, ease: DEEPCHARTS_EASE }}
      className="w-full shrink-0 lg:w-64 lg:p-4 lg:pr-0"
    >
      {/* Compact Sticky Mobile/Tablet Navigation Bar */}
      <div className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#070b18]/95 px-3 py-2.5 lg:hidden">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <RushXBrandLogo variant="symbol" size="sm" logoUrl={logoUrl} />
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-bold tracking-tight text-foreground">
                {activeLink?.label || "Admin Panel"}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {name} · <span className="capitalize">{role}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Link
              href="/dashboard"
              className="inline-flex h-9 items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-2.5 text-xs font-semibold text-zinc-300 hover:bg-white/[0.08] hover:text-white"
            >
              <ArrowLeft className="size-3.5" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? "Close admin menu" : "Open admin menu"}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[rgba(var(--rushx-primary-rgb),0.35)] bg-[rgba(var(--rushx-primary-rgb),0.14)] px-3 text-xs font-bold text-white transition-colors hover:bg-[rgba(var(--rushx-primary-rgb),0.24)] cursor-pointer"
            >
              {mobileMenuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
              <span>Menu</span>
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="dc-surface mt-2.5 max-h-[68dvh] overflow-y-auto overscroll-contain rounded-2xl p-2.5 shadow-2xl">
            <nav aria-label="Admin mobile navigation" className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {renderLinks(() => setMobileMenuOpen(false))}
            </nav>
            <Link
              href="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="mt-2.5 flex items-center justify-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] py-2 text-xs font-semibold text-zinc-300 hover:text-white"
            >
              <ArrowLeft className="size-3.5" />
              Back to dashboard
            </Link>
          </div>
        )}
      </div>

      {/* Desktop Sticky Sidebar */}
      <div className="dc-surface sticky top-4 hidden max-h-[calc(100dvh-2rem)] flex-col gap-4 rounded-2xl p-4 lg:flex">
        <div className="flex items-center gap-3 border-b border-white/[0.08] pb-3.5 shrink-0">
          <RushXBrandLogo variant="symbol" size="sm" logoUrl={logoUrl} />
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-semibold tracking-tight text-foreground">{name}</p>
            <p className="text-xs capitalize text-muted-foreground">{role}</p>
          </div>
        </div>

        <nav
          aria-label="Admin navigation"
          className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain pr-1"
        >
          {renderLinks()}
        </nav>

        <Link
          href="/dashboard"
          className="flex shrink-0 items-center gap-2 border-t border-white/[0.08] pt-3.5 text-xs font-semibold text-zinc-400 transition-all duration-200 hover:text-white hover:translate-x-0.5"
        >
          <ArrowLeft className="size-3.5" />
          Back to dashboard
        </Link>
      </div>
    </motion.aside>
  )
}
