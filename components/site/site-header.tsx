"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import { Button } from "@/components/ui/button"
import { Menu, X, Globe, ChevronDown, Flame, Trophy, Calendar, Layers, Boxes, MoreVertical, Wallet, MessageSquare } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { UserBalanceWidget } from "@/components/site/user-balance-widget"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/language"
import { useSession } from "@/lib/auth-client"
import { useViewMode } from "@/lib/view-mode"
import { RushXBrandLogo } from "@/components/site/brand-logo"

export type HeaderSettings = {
  supportWhatsapp?: string
  logoUrl?: string
}

export function SiteHeader({
  user: initialUser = null,
  initialBalance,
  settings: initialSettings,
  supportWhatsapp: initialWa,
}: {
  user?: { name: string; role: string; balance?: number } | null
  initialBalance?: number
  settings?: HeaderSettings
  supportWhatsapp?: string
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [scrimsDropdownOpen, setScrimsDropdownOpen] = useState(false)
  const { lang, setLang, t } = useLanguage()
  const { mode, setMode } = useViewMode()
  const { data: sessionData } = useSession()

  const [liveSettings, setLiveSettings] = useState<HeaderSettings | undefined>(initialSettings)

  // Fetch settings dynamically if not provided via props or to keep state fresh
  useEffect(() => {
    let isMounted = true
    if (!initialSettings?.supportWhatsapp && !initialWa) {
      fetch("/api/settings")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (isMounted && data) {
            setLiveSettings((prev) => ({ ...prev, ...data }))
          }
        })
        .catch(() => {})
    }
    return () => {
      isMounted = false
    }
  }, [initialSettings, initialWa])

  // Support link calculation from dynamic Admin data
  const rawSupportWa =
    initialWa ||
    liveSettings?.supportWhatsapp ||
    initialSettings?.supportWhatsapp ||
    "+8801831510108"
  const cleanWaNumber = rawSupportWa.replace(/[^0-9]/g, "")
  const supportUrl = `https://wa.me/${cleanWaNumber || "8801831510108"}`

  // Use client session or server initialUser
  const currentUser = sessionData?.user
    ? { name: sessionData.user.name, role: (sessionData.user as { role?: string }).role || "user" }
    : initialUser

  const activeLogoUrl = liveSettings?.logoUrl || initialSettings?.logoUrl

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/[0.07] bg-[#050811]/72 backdrop-blur-2xl shadow-[0_12px_32px_-16px_rgba(0,0,0,0.85)]">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        {/* Brand Logo (Left — RushX wordmark ONLY) */}
        <Link href="/" className="flex shrink-0 items-center gap-2 group transition-opacity hover:opacity-90" aria-label="RushX Organization Home">
          <RushXBrandLogo size="md" variant="wordmark" logoUrl={activeLogoUrl} />
        </Link>

        {/* Central Navigation Links */}
        <nav className="hidden items-center gap-0.5 lg:gap-1 md:flex" aria-label="Main Navigation">
          <Link
            href="/"
            className={cn(
              "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold tracking-tight transition-all",
              pathname === "/"
                ? "text-white bg-white/[0.08] border border-white/[0.11] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                : "text-zinc-400 border border-transparent hover:text-zinc-100 hover:bg-white/[0.05]"
            )}
          >
            {t("nav_home", "Home")}
          </Link>

          {/* Scrims Dropdown Menu */}
          <div
            className="relative"
            onMouseEnter={() => setScrimsDropdownOpen(true)}
            onMouseLeave={() => setScrimsDropdownOpen(false)}
          >
            <Link
              href="/scrims"
              className={cn(
                "flex items-center gap-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold tracking-tight transition-all",
                pathname.startsWith("/scrims")
                  ? "text-white bg-white/[0.08] border border-white/[0.11] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                  : "text-zinc-400 border border-transparent hover:text-zinc-100 hover:bg-white/[0.05]"
              )}
            >
              {t("nav_scrims", "Scrims")}
              <ChevronDown
                className={cn(
                  "size-3.5 opacity-70 transition-transform duration-200",
                  scrimsDropdownOpen && "rotate-180 opacity-100"
                )}
              />
            </Link>

            <AnimatePresence>
              {scrimsDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="dc-surface absolute left-0 top-full mt-1.5 w-76 rounded-2xl p-2 shadow-2xl z-50 flex flex-col gap-1"
                >
                  <Link
                    href="/scrims"
                    onClick={() => setScrimsDropdownOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-zinc-200 hover:bg-white/[0.06] transition-colors group"
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-orange-500/25 bg-orange-500/12 text-orange-400 group-hover:bg-orange-500/20">
                      <Calendar className="size-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-zinc-100 font-semibold">All Scrims</span>
                      <span className="text-[11px] text-zinc-400">Browse all active lobbies &amp; formats</span>
                    </div>
                  </Link>

                  <div className="my-1 h-px bg-white/[0.07]" />

                  <Link
                    href="/scrims?category=champion-rush"
                    onClick={() => setScrimsDropdownOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-zinc-200 hover:bg-white/[0.06] transition-colors group"
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/12 text-emerald-400 group-hover:bg-emerald-500/20">
                      <Trophy className="size-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-emerald-400 font-semibold">Champion Rush</span>
                      <span className="text-[11px] text-zinc-400">3 PM &amp; 10 PM · 8-Match Survival Challenge</span>
                    </div>
                  </Link>

                  <Link
                    href="/scrims?category=friday-special-blast"
                    onClick={() => setScrimsDropdownOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-zinc-200 hover:bg-white/[0.06] transition-colors group"
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-amber-500/25 bg-amber-500/12 text-amber-400 group-hover:bg-amber-500/20">
                      <Flame className="size-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-amber-400 font-semibold">Friday Special Blast</span>
                      <span className="text-[11px] text-zinc-400">5 Premium Matches · ৳80 Entry / ৳850 Prize</span>
                    </div>
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Link
            href="/results"
            className={cn(
              "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold tracking-tight transition-all",
              pathname === "/results"
                ? "text-white bg-white/[0.08] border border-white/[0.11] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                : "text-zinc-400 border border-transparent hover:text-zinc-100 hover:bg-white/[0.05]"
            )}
          >
            {t("nav_results", "Results")}
          </Link>

          <Link
            href="/report"
            className={cn(
              "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold tracking-tight transition-all",
              pathname === "/report"
                ? "text-white bg-white/[0.08] border border-white/[0.11] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                : "text-zinc-400 border border-transparent hover:text-zinc-100 hover:bg-white/[0.05]"
            )}
          >
            {t("nav_report", "Report")}
          </Link>

          <Link
            href="/tutorial"
            className={cn(
              "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold tracking-tight transition-all",
              pathname === "/tutorial"
                ? "text-white bg-white/[0.08] border border-white/[0.11] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                : "text-zinc-400 border border-transparent hover:text-zinc-100 hover:bg-white/[0.05]"
            )}
          >
            {t("nav_tutorial", "Tutorial")}
          </Link>

          <a
            href={supportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="whitespace-nowrap rounded-lg border border-transparent px-3 py-1.5 text-sm font-semibold tracking-tight text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.05] transition-all"
          >
            {t("nav_support", "Support")}
          </a>
        </nav>

        {/* Right Side Header Controls */}
        <div className="hidden shrink-0 items-center gap-2.5 md:flex">
          {/* 2D / 3D Segmented Switch */}
          <div
            className="inline-flex items-center rounded-xl border border-white/[0.08] bg-white/[0.03] p-0.5 shadow-inner"
            role="group"
            aria-label="View mode toggle"
          >
            <button
              type="button"
              onClick={() => setMode("2d")}
              className={cn(
                "flex items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer",
                mode === "2d"
                  ? "bg-white/[0.1] text-orange-300 shadow-xs"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
              title="2D Dynamic Ambient Mode"
            >
              <Layers className="size-3" />
              2D
            </button>
            <button
              type="button"
              onClick={() => setMode("3d")}
              className={cn(
                "flex items-center gap-1 whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer",
                mode === "3d"
                  ? "bg-white/[0.1] text-orange-300 shadow-xs"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
              title="3D Cyber Mode"
            >
              <Boxes className="size-3" />
              3D
            </button>
          </div>

          {/* Language Switcher */}
          <button
            type="button"
            onClick={() => setLang(lang === "en" ? "bn" : "en")}
            className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-xl border border-white/[0.08] bg-white/[0.03] px-2.5 text-xs font-semibold text-zinc-300 hover:border-white/[0.16] hover:bg-white/[0.07] hover:text-white transition-all cursor-pointer"
            title="Switch Language"
          >
            <Globe className="size-3.5 text-zinc-400" />
            <span>{lang === "en" ? "বাং" : "EN"}</span>
          </button>

          {currentUser ? (
            <div className="flex items-center gap-2">
              {(currentUser.role === "admin" || currentUser.role === "moderator") && (
                <Button asChild variant="ghost" size="sm" className="whitespace-nowrap text-xs font-semibold text-zinc-300 hover:text-white">
                  <Link href="/admin">{currentUser.role === "admin" ? "Admin" : "Mod Panel"}</Link>
                </Button>
              )}
              {/* Persistent User Balance Widget directly next to Dashboard */}
              <UserBalanceWidget initialBalance={initialBalance} />
              <Button asChild size="sm" className="h-9 whitespace-nowrap px-4 rounded-xl font-semibold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-zinc-950 shadow-sm shadow-orange-500/20 transition-all">
                <Link href="/dashboard">{t("nav_dashboard", "Dashboard")}</Link>
              </Button>

              {/* 3-Dot Navigation Dropdown on Desktop */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label="More navigation options"
                  className="flex size-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-zinc-300 hover:border-white/[0.16] hover:bg-white/[0.07] hover:text-white transition-all cursor-pointer"
                >
                  <MoreVertical className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="dc-surface w-56 rounded-2xl p-1.5 text-zinc-200">
                  <div className="px-2.5 py-2 border-b border-white/[0.07]">
                    <span className="text-[10px] uppercase font-semibold tracking-wider text-zinc-400">RushX Wallet</span>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-xs text-zinc-300">Live Balance:</span>
                      <UserBalanceWidget initialBalance={initialBalance} compact />
                    </div>
                  </div>
                  <DropdownMenuItem className="p-0 mt-1">
                    <Link href="/dashboard/wallet" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 cursor-pointer text-emerald-400 font-semibold focus:text-emerald-300">
                      <Wallet className="size-4 text-emerald-400" />
                      <span>Load / View Balance</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="p-0">
                    <Link href="/dashboard/scrims" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 cursor-pointer">
                      <Calendar className="size-4 text-orange-400" />
                      <span>My Scrims</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="p-0">
                    <Link href="/results" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 cursor-pointer">
                      <Trophy className="size-4 text-amber-400" />
                      <span>Results &amp; Leaderboard</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="p-0">
                    <Link href="/tutorial" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 cursor-pointer">
                      <Boxes className="size-4 text-blue-400" />
                      <span>Tutorial Video</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/[0.07]" />
                  <DropdownMenuItem className="p-0">
                    <a href={supportUrl} target="_blank" rel="noopener noreferrer" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 cursor-pointer text-emerald-400">
                      <MessageSquare className="size-4 text-emerald-400" />
                      <span>WhatsApp Support</span>
                    </a>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <UserBalanceWidget initialBalance={0} isGuest />
              <Link
                href="/sign-in"
                className="whitespace-nowrap rounded-xl px-3 py-1.5 text-xs sm:text-sm font-semibold text-zinc-300 hover:bg-white/[0.05] hover:text-white transition-colors"
              >
                {t("nav_signin", "Sign In")}
              </Link>
              <Button
                asChild
                size="sm"
                className="h-9 whitespace-nowrap px-4 rounded-xl font-semibold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-zinc-950 shadow-sm shadow-orange-500/20 transition-all"
              >
                <Link href="/sign-up">{t("nav_join", "Join Now")}</Link>
              </Button>
            </div>
          )}
        </div>

        {/* Mobile Top-Right Direct View Controls */}
        <div className="flex shrink-0 items-center gap-1.5 md:hidden">
          {/* Direct view of site on top right: Balance will ALWAYS be shown */}
          <UserBalanceWidget initialBalance={initialBalance} compact isGuest={!currentUser} />

          {/* Mobile 3-Dot Navigation Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="3-dot quick navigation"
              className="flex size-8 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.04] text-zinc-300 hover:text-white transition-colors cursor-pointer"
            >
              <MoreVertical className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="dc-surface w-56 rounded-2xl p-1.5 text-zinc-200">
              <div className="px-2.5 py-2 border-b border-white/[0.07]">
                <span className="text-[10px] uppercase font-semibold tracking-wider text-zinc-400">RushX Wallet</span>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs text-zinc-300">Live Balance:</span>
                  <UserBalanceWidget initialBalance={initialBalance} compact isGuest={!currentUser} />
                </div>
              </div>
              <DropdownMenuItem className="p-0 mt-1">
                <Link href={currentUser ? "/dashboard/wallet" : "/sign-in?next=/dashboard/wallet"} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 cursor-pointer text-emerald-400 font-semibold focus:text-emerald-300">
                  <Wallet className="size-4 text-emerald-400" />
                  <span>Load / View Balance</span>
                </Link>
              </DropdownMenuItem>
              {currentUser && (
                <DropdownMenuItem className="p-0">
                  <Link href="/dashboard" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 cursor-pointer text-orange-400 font-semibold">
                    <Trophy className="size-4 text-orange-400" />
                    <span>My Dashboard</span>
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className="p-0">
                <Link href="/scrims" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 cursor-pointer">
                  <Calendar className="size-4 text-zinc-300" />
                  <span>All Scrims</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="p-0">
                <Link href="/results" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 cursor-pointer">
                  <Trophy className="size-4 text-amber-400" />
                  <span>Results &amp; Leaderboard</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/[0.07]" />
              <DropdownMenuItem className="p-0">
                <a href={supportUrl} target="_blank" rel="noopener noreferrer" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 cursor-pointer text-emerald-400">
                  <MessageSquare className="size-4 text-emerald-400" />
                  <span>WhatsApp Support</span>
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            type="button"
            onClick={() => setMode(mode === "2d" ? "3d" : "2d")}
            className="flex h-8 items-center gap-1 whitespace-nowrap rounded-xl border border-white/[0.09] bg-white/[0.04] px-2 text-xs font-semibold text-zinc-300 hover:text-white transition-colors"
          >
            {mode === "2d" ? <Layers className="size-3 text-orange-400" /> : <Boxes className="size-3 text-orange-400" />}
            {mode.toUpperCase()}
          </button>

          <button
            type="button"
            onClick={() => setLang(lang === "en" ? "bn" : "en")}
            className="h-8 whitespace-nowrap rounded-xl border border-white/[0.09] bg-white/[0.04] px-2 text-xs font-semibold text-zinc-300 hover:text-white transition-colors"
          >
            {lang === "en" ? "বাং" : "EN"}
          </button>

          <button
            className="flex size-8 items-center justify-center rounded-xl border border-white/[0.09] bg-white/[0.04] text-zinc-300 hover:text-white"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label="Toggle menu"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-white/[0.07] bg-[#050811]/95 px-4 pb-5 pt-3 backdrop-blur-2xl md:hidden"
            aria-label="Mobile Navigation"
          >
            <div className="flex flex-col gap-1.5">
              {/* Account Balance Highlight in Mobile Drawer */}
              <div className="dc-surface rounded-2xl border-emerald-500/25 p-3 flex items-center justify-between my-1">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-emerald-400">
                    <Wallet className="size-4" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-semibold tracking-wider text-emerald-400">Account Balance</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <UserBalanceWidget initialBalance={initialBalance} compact isGuest={!currentUser} />
                    </div>
                  </div>
                </div>
                <Link
                  href={currentUser ? "/dashboard/wallet" : "/sign-in?next=/dashboard/wallet"}
                  onClick={() => setOpen(false)}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors shadow-sm"
                >
                  + Load
                </Link>
              </div>
              <Link
                href="/"
                className="rounded-xl px-3 py-2 text-sm font-semibold text-zinc-300 hover:bg-white/[0.06] hover:text-white"
                onClick={() => setOpen(false)}
              >
                {t("nav_home", "Home")}
              </Link>
              <Link
                href="/scrims"
                className="flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold text-zinc-300 hover:bg-white/[0.06] hover:text-white"
                onClick={() => setOpen(false)}
              >
                <span>{t("nav_scrims", "All Scrims & Tournaments")}</span>
                <span className="text-[10px] uppercase font-semibold text-primary font-mono">Live</span>
              </Link>
              <div className="pl-4 flex flex-col gap-1 border-l border-white/[0.08] ml-3">
                <Link
                  href="/scrims?category=champion-rush"
                  className="rounded-xl px-2.5 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10 flex items-center gap-2"
                  onClick={() => setOpen(false)}
                >
                  <Trophy className="size-3.5" />
                  <span>Champion Rush (3 PM &amp; 10 PM)</span>
                </Link>
                <Link
                  href="/scrims?category=friday-special-blast"
                  className="rounded-xl px-2.5 py-1.5 text-xs font-semibold text-amber-400 hover:bg-amber-500/10 flex items-center gap-2"
                  onClick={() => setOpen(false)}
                >
                  <Flame className="size-3.5" />
                  <span>Friday Special Blast</span>
                </Link>
              </div>
              <Link
                href="/results"
                className="rounded-xl px-3 py-2 text-sm font-semibold text-zinc-300 hover:bg-white/[0.06] hover:text-white"
                onClick={() => setOpen(false)}
              >
                {t("nav_results", "Results & Leaderboards")}
              </Link>
              <Link
                href="/report"
                className="rounded-xl px-3 py-2 text-sm font-semibold text-zinc-300 hover:bg-white/[0.06] hover:text-white"
                onClick={() => setOpen(false)}
              >
                {t("nav_report", "Report Cheater / Issue")}
              </Link>
              <Link
                href="/tutorial"
                className="rounded-xl px-3 py-2 text-sm font-semibold text-zinc-300 hover:bg-white/[0.06] hover:text-white"
                onClick={() => setOpen(false)}
              >
                {t("nav_tutorial", "How to Play Tutorial")}
              </Link>
              <a
                href={supportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl px-3 py-2 text-sm font-semibold text-zinc-300 hover:bg-white/[0.06] hover:text-white"
              >
                {t("nav_support", "WhatsApp Support")}
              </a>

              <div className="my-2 h-px bg-white/[0.08]" />

              {currentUser ? (
                <div className="flex flex-col gap-2">
                  {(currentUser.role === "admin" || currentUser.role === "moderator") && (
                    <Link
                      href="/admin"
                      className="rounded-xl px-3 py-2 text-sm font-semibold text-orange-400 hover:bg-white/[0.06]"
                      onClick={() => setOpen(false)}
                    >
                      {currentUser.role === "admin" ? "Admin Panel" : "Mod Panel"}
                    </Link>
                  )}
                  <Button asChild className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 font-semibold text-zinc-950">
                    <Link href="/dashboard" onClick={() => setOpen(false)}>
                      {t("nav_dashboard", "Dashboard")}
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Button asChild variant="outline" className="w-full rounded-xl border-white/[0.1] bg-white/[0.04] text-white font-semibold">
                    <Link href="/sign-in" onClick={() => setOpen(false)}>
                      {t("nav_signin", "Sign In")}
                    </Link>
                  </Button>
                  <Button asChild className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-zinc-950 font-semibold">
                    <Link href="/sign-up" onClick={() => setOpen(false)}>
                      {t("nav_join", "Join Now")}
                    </Link>
                  </Button>
                </div>
              )}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  )
}
