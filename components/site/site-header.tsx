"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "motion/react"
import { Button } from "@/components/ui/button"
import { Menu, X, Globe, ChevronDown, Flame, Trophy, Calendar, Layers, Boxes } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/language"
import { useSession } from "@/lib/auth-client"
import { useViewMode } from "@/lib/view-mode"
import { AceScrimsBrandLogo } from "@/components/site/brand-logo"

export type HeaderSettings = {
  supportWhatsapp?: string
  supportPhone?: string
  logoUrl?: string
}

export function SiteHeader({
  user: initialUser = null,
  settings: initialSettings,
  supportWhatsapp: initialWa,
}: {
  user?: { name: string; role: string } | null
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
    <header className="sticky top-0 z-50 w-full border-b border-zinc-800/80 bg-[#030407]/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Brand Logo (Left) */}
        <Link href="/" className="flex items-center gap-2 group transition-opacity hover:opacity-90" aria-label="Ace Scrims Home">
          <AceScrimsBrandLogo size="md" logoUrl={activeLogoUrl} />
        </Link>

        {/* Central Navigation Links */}
        <nav className="hidden items-center gap-1 lg:gap-2 md:flex" aria-label="Main Navigation">
          <Link
            href="/"
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              pathname === "/"
                ? "text-white bg-zinc-800/70"
                : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40"
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
                "flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                pathname.startsWith("/scrims")
                  ? "text-white bg-zinc-800/70"
                  : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40"
              )}
            >
              {t("nav_scrims", "Scrims")}
              <ChevronDown className="size-3.5 opacity-70 transition-transform group-hover:rotate-180" />
            </Link>

            <AnimatePresence>
              {scrimsDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 top-full mt-1 w-64 rounded-xl border border-zinc-800 bg-[#090a0f] p-2 shadow-xl backdrop-blur-xl z-50 flex flex-col gap-1"
                >
                  <Link
                    href="/scrims"
                    onClick={() => setScrimsDropdownOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800/80 transition-colors"
                  >
                    <Calendar className="size-4 text-orange-500" />
                    <div className="flex flex-col">
                      <span>All Daily Scrims</span>
                      <span className="text-[10px] text-zinc-400 font-normal">7 PM – 12 AM (12 Lobbies)</span>
                    </div>
                  </Link>

                  <div className="my-1 h-px bg-zinc-800" />

                  <Link
                    href="/scrims?category=friday-special-blast"
                    onClick={() => setScrimsDropdownOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800/80 transition-colors"
                  >
                    <Flame className="size-4 text-amber-500" />
                    <div className="flex flex-col">
                      <span className="text-amber-400 font-bold">Friday Special Blast</span>
                      <span className="text-[10px] text-zinc-400 font-normal">5 Matches · ৳80 Entry / ৳850 Prize</span>
                    </div>
                  </Link>

                  <Link
                    href="/scrims?category=champion-rush"
                    onClick={() => setScrimsDropdownOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-800/80 transition-colors"
                  >
                    <Trophy className="size-4 text-emerald-400" />
                    <div className="flex flex-col">
                      <span className="text-emerald-400 font-bold">10 PM Champion Rush</span>
                      <span className="text-[10px] text-zinc-400 font-normal">Max 8 Matches · Friday Special</span>
                    </div>
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Link
            href="/results"
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              pathname === "/results"
                ? "text-white bg-zinc-800/70"
                : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40"
            )}
          >
            {t("nav_results", "Results")}
          </Link>

          <Link
            href="/report"
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              pathname === "/report"
                ? "text-white bg-zinc-800/70"
                : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40"
            )}
          >
            {t("nav_report", "Report")}
          </Link>

          <Link
            href="/tutorial"
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              pathname === "/tutorial"
                ? "text-white bg-zinc-800/70"
                : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40"
            )}
          >
            {t("nav_tutorial", "Tutorial")}
          </Link>

          <a
            href={supportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/40 transition-colors"
          >
            {t("nav_support", "Support")}
          </a>
        </nav>

        {/* Right Side Header Controls (Normal, Clean, SaaS-style) */}
        <div className="hidden items-center gap-3 md:flex">
          {/* 2D / 3D Segmented Switch */}
          <div
            className="inline-flex items-center rounded-full border border-zinc-800 bg-zinc-900/90 p-0.5"
            role="group"
            aria-label="View mode toggle"
          >
            <button
              type="button"
              onClick={() => setMode("2d")}
              className={cn(
                "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-all",
                mode === "2d"
                  ? "bg-zinc-800 text-orange-400 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
              title="2D Static Mode"
            >
              <Layers className="size-3" />
              2D
            </button>
            <button
              type="button"
              onClick={() => setMode("3d")}
              className={cn(
                "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-all",
                mode === "3d"
                  ? "bg-zinc-800 text-orange-400 shadow-sm"
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
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
            title="Switch Language"
          >
            <Globe className="size-3.5 text-zinc-400" />
            <span>{lang === "en" ? "বাং" : "EN"}</span>
          </button>

          {currentUser ? (
            <div className="flex items-center gap-2">
              {(currentUser.role === "admin" || currentUser.role === "moderator") && (
                <Button asChild variant="ghost" size="sm" className="text-xs text-zinc-300 hover:text-white">
                  <Link href="/admin">{currentUser.role === "admin" ? "Admin" : "Mod Panel"}</Link>
                </Button>
              )}
              <Button asChild size="sm" className="h-9 px-4 rounded-lg font-semibold bg-orange-600 hover:bg-orange-500 text-white shadow-sm transition-colors">
                <Link href="/dashboard">{t("nav_dashboard", "Dashboard")}</Link>
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/sign-in"
                className="px-3 py-1.5 text-xs sm:text-sm font-medium text-zinc-300 hover:text-white transition-colors"
              >
                {t("nav_signin", "Sign In")}
              </Link>
              <Button
                asChild
                size="sm"
                className="h-9 px-4 rounded-lg font-semibold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-black shadow-sm transition-all"
              >
                <Link href="/sign-up">{t("nav_join", "Join Now")}</Link>
              </Button>
            </div>
          )}
        </div>

        {/* Mobile Hamburger & Quick Actions */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            onClick={() => setMode(mode === "2d" ? "3d" : "2d")}
            className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs font-semibold text-zinc-300 hover:text-white transition-colors h-8"
          >
            {mode === "2d" ? <Layers className="size-3 text-orange-400" /> : <Boxes className="size-3 text-orange-400" />}
            {mode.toUpperCase()}
          </button>

          <button
            type="button"
            onClick={() => setLang(lang === "en" ? "bn" : "en")}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs font-semibold text-zinc-300 hover:text-white transition-colors h-8"
          >
            {lang === "en" ? "বাং" : "EN"}
          </button>

          <button
            className="flex size-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white"
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
            className="overflow-hidden border-t border-zinc-800 bg-[#030407] px-4 pb-5 pt-3 md:hidden"
            aria-label="Mobile Navigation"
          >
            <div className="flex flex-col gap-1.5">
              <Link
                href="/"
                className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white"
                onClick={() => setOpen(false)}
              >
                {t("nav_home", "Home")}
              </Link>
              <Link
                href="/scrims"
                className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white"
                onClick={() => setOpen(false)}
              >
                {t("nav_scrims", "Daily Scrims (12 Rooms)")}
              </Link>
              <Link
                href="/results"
                className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white"
                onClick={() => setOpen(false)}
              >
                {t("nav_results", "Results & Leaderboards")}
              </Link>
              <Link
                href="/report"
                className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white"
                onClick={() => setOpen(false)}
              >
                {t("nav_report", "Report Cheater / Issue")}
              </Link>
              <Link
                href="/tutorial"
                className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white"
                onClick={() => setOpen(false)}
              >
                {t("nav_tutorial", "How to Play Tutorial")}
              </Link>
              <a
                href={supportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white"
              >
                {t("nav_support", "WhatsApp Support")}
              </a>

              <div className="my-2 h-px bg-zinc-800" />

              {currentUser ? (
                <div className="flex flex-col gap-2">
                  {(currentUser.role === "admin" || currentUser.role === "moderator") && (
                    <Link
                      href="/admin"
                      className="rounded-lg px-3 py-2 text-sm font-medium text-orange-400 hover:bg-zinc-800"
                      onClick={() => setOpen(false)}
                    >
                      {currentUser.role === "admin" ? "Admin Panel" : "Mod Panel"}
                    </Link>
                  )}
                  <Button asChild className="w-full bg-orange-600 font-semibold text-white">
                    <Link href="/dashboard" onClick={() => setOpen(false)}>
                      {t("nav_dashboard", "Dashboard")}
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Button asChild variant="outline" className="w-full border-zinc-800 bg-zinc-900 text-white">
                    <Link href="/sign-in" onClick={() => setOpen(false)}>
                      {t("nav_signin", "Sign In")}
                    </Link>
                  </Button>
                  <Button asChild className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-black font-bold">
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
