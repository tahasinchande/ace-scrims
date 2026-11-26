"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence, useReducedMotion } from "motion/react"
import { DEEPCHARTS_EASE } from "@/lib/intro-motion"
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
  const closeDropdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { lang, setLang, t } = useLanguage()
  const { mode, setMode } = useViewMode()
  const { data: sessionData } = useSession()
  const prefersReducedMotion = useReducedMotion()

  const openScrimsMenu = () => {
    if (closeDropdownTimerRef.current) {
      clearTimeout(closeDropdownTimerRef.current)
      closeDropdownTimerRef.current = null
    }
    setScrimsDropdownOpen(true)
  }

  const scheduleCloseScrimsMenu = () => {
    if (closeDropdownTimerRef.current) {
      clearTimeout(closeDropdownTimerRef.current)
    }
    closeDropdownTimerRef.current = setTimeout(() => {
      setScrimsDropdownOpen(false)
    }, 160)
  }

  useEffect(() => {
    return () => {
      if (closeDropdownTimerRef.current) {
        clearTimeout(closeDropdownTimerRef.current)
      }
    }
  }, [])

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
    <motion.header
      initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: -14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.42, ease: DEEPCHARTS_EASE }}
      className="sticky top-0 z-50 w-full border-b border-white/[0.08] bg-[#050508]/82 backdrop-blur-2xl shadow-[0_14px_34px_-18px_rgba(0,0,0,0.9)] transition-colors duration-200"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        {/* Brand Logo (Left — 'R' mark beside stylized RushX wordmark) */}
        <Link href="/" className="flex shrink-0 items-center group transition-opacity hover:opacity-90" aria-label="RushX Organization Home">
          <RushXBrandLogo size="md" variant="lockup" logoUrl={activeLogoUrl} />
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

          {/* Scrims Dropdown Menu (Hover bridge + hover-intent + focus + click accessible) */}
          <div
            className="relative"
            onMouseEnter={openScrimsMenu}
            onMouseLeave={scheduleCloseScrimsMenu}
            onFocus={openScrimsMenu}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                setScrimsDropdownOpen(false)
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setScrimsDropdownOpen(false)
            }}
          >
            <div className="inline-flex items-center">
              <Link
                href="/scrims"
                className={cn(
                  "flex items-center gap-1 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold tracking-tight transition-all",
                  pathname.startsWith("/scrims") || scrimsDropdownOpen
                    ? "text-white bg-white/[0.08] border border-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    : "text-zinc-400 border border-transparent hover:text-zinc-100 hover:bg-white/[0.05]"
                )}
                aria-haspopup="menu"
                aria-expanded={scrimsDropdownOpen}
              >
                {t("nav_scrims", "Scrims")}
                <ChevronDown
                  className={cn(
                    "size-3.5 opacity-75 transition-transform duration-200",
                    scrimsDropdownOpen && "rotate-180 opacity-100 text-accent"
                  )}
                />
              </Link>
            </div>

            <AnimatePresence>
              {scrimsDropdownOpen && (
                <div
                  className="absolute left-0 top-full z-[60] pt-2"
                  onMouseEnter={openScrimsMenu}
                  onMouseLeave={scheduleCloseScrimsMenu}
                >
                  <motion.div
                    role="menu"
                    aria-label="Scrim categories"
                    initial={{ opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.98 }}
                    transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                    className="dc-surface w-80 rounded-2xl p-2 shadow-[0_24px_60px_-14px_rgba(2,6,20,0.95)] flex flex-col gap-1"
                  >
                    <Link
                      role="menuitem"
                      href="/scrims"
                      onClick={() => setScrimsDropdownOpen(false)}
                      className="flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-200 hover:bg-[rgba(var(--rushx-primary-rgb),0.15)] transition-colors group"
                    >
                      <Calendar className="mt-0.5 size-4 shrink-0 text-accent" />
                      <div className="flex flex-col">
                        <span className="text-white font-semibold">All Scrims</span>
                        <span className="text-[11px] font-normal text-slate-400">Browse all active lobbies &amp; schedules</span>
                      </div>
                    </Link>

                    <div className="my-0.5 h-px bg-white/[0.07]" />

                    <Link
                      role="menuitem"
                      href="/scrims?category=champion-rush"
                      onClick={() => setScrimsDropdownOpen(false)}
                      className="flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-200 hover:bg-emerald-500/12 transition-colors group"
                    >
                      <Trophy className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                      <div className="flex flex-col">
                        <span className="text-emerald-300 font-semibold">Champion Rush</span>
                        <span className="text-[11px] font-normal text-slate-400">Multi-match survival series · Top standings</span>
                      </div>
                    </Link>

                    <Link
                      role="menuitem"
                      href="/scrims?category=friday-special-blast"
                      onClick={() => setScrimsDropdownOpen(false)}
                      className="flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-200 hover:bg-[rgba(var(--rushx-accent-rgb),0.14)] transition-colors group"
                    >
                      <Flame className="mt-0.5 size-4 shrink-0 text-amber-400" />
                      <div className="flex flex-col">
                        <span className="text-amber-300 font-semibold">Friday Special Blast</span>
                        <span className="text-[11px] font-normal text-slate-400">Featured high-stakes weekend scrim series</span>
                      </div>
                    </Link>
                  </motion.div>
                </div>
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
                  ? "bg-[rgba(var(--rushx-primary-rgb),0.26)] text-white shadow-xs"
                  : "text-slate-400 hover:text-white"
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
                  ? "bg-[rgba(var(--rushx-primary-rgb),0.26)] text-white shadow-xs"
                  : "text-slate-400 hover:text-white"
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
              {(currentUser.role === "owner" || currentUser.role === "admin" || currentUser.role === "moderator") && (
                <Button asChild variant="ghost" size="sm" className="whitespace-nowrap text-xs font-semibold text-zinc-300 hover:text-white">
                  <Link href="/admin">
                    {currentUser.role === "owner" ? "Owner" : currentUser.role === "admin" ? "Admin" : "Mod Panel"}
                  </Link>
                </Button>
              )}
              {/* Persistent User Balance Widget directly next to Dashboard */}
              <UserBalanceWidget initialBalance={initialBalance} />
              <Button asChild size="sm" className="h-9 whitespace-nowrap px-4 rounded-xl font-semibold">
                <Link href="/dashboard">{t("nav_dashboard", "Dashboard")}</Link>
              </Button>

              {/* 3-Dot Navigation Dropdown on Desktop */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label="More navigation options"
                  className="flex size-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-300 hover:border-[rgba(var(--rushx-soft-rgb),0.36)] hover:bg-[rgba(var(--rushx-primary-rgb),0.12)] hover:text-white transition-all cursor-pointer"
                >
                  <MoreVertical className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="dc-surface w-56 rounded-2xl p-1.5 text-slate-200">
                  <div className="px-2.5 py-2 border-b border-white/[0.07]">
                    <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">RushX Wallet</span>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-xs text-slate-300">Live Balance:</span>
                      <UserBalanceWidget initialBalance={initialBalance} compact />
                    </div>
                  </div>
                  <DropdownMenuItem className="p-0 mt-1">
                    <Link href="/dashboard/wallet" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 cursor-pointer text-accent font-semibold">
                      <Wallet className="size-4 text-accent" />
                      <span>Load / View Balance</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="p-0">
                    <Link href="/dashboard/scrims" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 cursor-pointer">
                      <Calendar className="size-4 text-accent" />
                      <span>My Scrims</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="p-0">
                    <Link href="/results" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 cursor-pointer">
                      <Trophy className="size-4 text-cyan-300" />
                      <span>Results &amp; Leaderboard</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem className="p-0">
                    <Link href="/tutorial" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 cursor-pointer">
                      <Boxes className="size-4 text-slate-300" />
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
                className="whitespace-nowrap rounded-xl px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-300 hover:bg-white/[0.05] hover:text-white transition-colors"
              >
                {t("nav_signin", "Sign In")}
              </Link>
              <Button
                asChild
                size="sm"
                className="h-9 whitespace-nowrap px-4 rounded-xl font-semibold"
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
                  <Link href="/dashboard" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 cursor-pointer text-accent font-semibold">
                    <Trophy className="size-4 text-accent" />
                    <span>My Dashboard</span>
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className="p-0">
                <Link href="/scrims" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 cursor-pointer">
                  <Calendar className="size-4 text-slate-300" />
                  <span>All Scrims</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="p-0">
                <Link href="/results" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 cursor-pointer">
                  <Trophy className="size-4 text-cyan-300" />
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
            className="flex h-8 items-center gap-1 whitespace-nowrap rounded-xl border border-white/[0.09] bg-white/[0.04] px-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
          >
            {mode === "2d" ? <Layers className="size-3 text-accent" /> : <Boxes className="size-3 text-accent" />}
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
            className="overflow-hidden border-t border-white/[0.07] bg-[#040814]/95 px-4 pb-5 pt-3 backdrop-blur-2xl md:hidden"
            aria-label="Mobile Navigation"
          >
            <div className="flex flex-col gap-1.5">
              {/* Account Balance Highlight in Mobile Drawer */}
              <div className="dc-surface rounded-2xl p-3 flex items-center justify-between my-1">
                <div className="flex items-center gap-2.5">
                  <Wallet className="size-4 text-accent shrink-0" />
                  <div>
                    <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">Account Balance</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <UserBalanceWidget initialBalance={initialBalance} compact isGuest={!currentUser} />
                    </div>
                  </div>
                </div>
                <Link
                  href={currentUser ? "/dashboard/wallet" : "/sign-in?next=/dashboard/wallet"}
                  onClick={() => setOpen(false)}
                  className="rushx-primary-btn rushx-btn-splash rounded-xl px-3 py-1.5 text-xs font-semibold text-white transition-all"
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
                  className="rounded-xl px-2.5 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/10 flex items-center gap-2"
                  onClick={() => setOpen(false)}
                >
                  <Flame className="size-3.5" />
                  <span>Friday Special Blast</span>
                </Link>
              </div>
              <Link
                href="/results"
                className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-white/[0.06] hover:text-white"
                onClick={() => setOpen(false)}
              >
                {t("nav_results", "Results & Leaderboards")}
              </Link>
              <Link
                href="/report"
                className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-white/[0.06] hover:text-white"
                onClick={() => setOpen(false)}
              >
                {t("nav_report", "Report Cheater / Issue")}
              </Link>
              <Link
                href="/tutorial"
                className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-white/[0.06] hover:text-white"
                onClick={() => setOpen(false)}
              >
                {t("nav_tutorial", "How to Play Tutorial")}
              </Link>
              <a
                href={supportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-white/[0.06] hover:text-white"
              >
                {t("nav_support", "WhatsApp Support")}
              </a>

              <div className="my-2 h-px bg-white/[0.08]" />

              {currentUser ? (
                <div className="flex flex-col gap-2">
                  {(currentUser.role === "owner" || currentUser.role === "admin" || currentUser.role === "moderator") && (
                    <Link
                      href="/admin"
                      className="rounded-xl px-3 py-2 text-sm font-semibold text-accent hover:bg-white/[0.06]"
                      onClick={() => setOpen(false)}
                    >
                      {currentUser.role === "owner" ? "Owner Panel" : currentUser.role === "admin" ? "Admin Panel" : "Mod Panel"}
                    </Link>
                  )}
                  <Button asChild className="w-full rounded-xl font-semibold">
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
                  <Button asChild className="w-full rounded-xl font-semibold">
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
    </motion.header>
  )
}
