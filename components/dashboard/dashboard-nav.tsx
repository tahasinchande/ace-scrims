"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"
import { resolveImageUrl } from "@/lib/image-url"
import {
  LayoutDashboard,
  Swords,
  Bell,
  Receipt,
  Settings,
  LogOut,
  Shield,
  Trophy,
  ShieldAlert,
  User as UserIcon,
  Camera,
  Wallet,
  UserCog,
  Megaphone,
  Gift,
} from "lucide-react"

const links = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/notices", label: "Notices", icon: Megaphone },
  { href: "/dashboard/info-setup", label: "Info Setup", icon: UserCog },
  { href: "/dashboard/wallet", label: "Wallet & Balance", icon: Wallet },
  { href: "/dashboard/referrals", label: "Referrals", icon: Gift },
  { href: "/dashboard/scrims", label: "My Scrims", icon: Swords },
  { href: "/dashboard/results", label: "My Results", icon: Trophy },
  { href: "/dashboard/image-requests", label: "Image Requests", icon: Camera },
  { href: "/dashboard/reports", label: "My Reports", icon: ShieldAlert },
  { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
  { href: "/dashboard/payments", label: "Payments", icon: Receipt },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
]

function getUserInitials(name: string): string {
  if (!name || !name.trim()) return "U"
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function DashboardNav({
  unread,
  pendingImageRequestsCount = 0,
  user,
}: {
  unread: number
  pendingImageRequestsCount?: number
  user: { name: string; email: string; role: string; image?: string | null }
}) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    await authClient.signOut()
    router.push("/")
    router.refresh()
  }

  const isStaff = user.role === "admin" || user.role === "moderator"
  const avatarUrl = user.image ? resolveImageUrl(user.image) : null

  return (
    <aside className="w-full shrink-0 lg:w-62">
      <div className="dc-surface lg:sticky lg:top-20 rounded-2xl p-4">
        <div className="mb-4 flex items-center gap-3 border-b border-white/[0.07] px-1 pb-4">
          <div className="size-10 shrink-0 rounded-xl overflow-hidden border border-white/[0.1] bg-white/[0.04] flex items-center justify-center">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={user.name} className="size-full object-cover" />
            ) : (
              <span className="font-display text-xs font-semibold text-foreground">
                {getUserInitials(user.name)}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-semibold tracking-tight text-foreground">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <nav aria-label="Dashboard navigation">
          <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-2 lg:flex lg:flex-col lg:gap-1">
            {links.map((link) => {
              const active = link.exact ? pathname === link.href : pathname.startsWith(link.href)
              return (
                <li key={link.href} className="w-full lg:flex-none">
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl border px-3 py-2 text-xs sm:text-sm font-semibold transition-all w-full",
                      active
                        ? "border-primary/25 bg-primary/14 text-primary shadow-xs"
                        : "border-transparent text-muted-foreground hover:bg-white/[0.05] hover:text-foreground",
                    )}
                  >
                    <link.icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground/85")} aria-hidden />
                    <span className="truncate">{link.label}</span>
                    {link.href === "/dashboard/notifications" && unread > 0 && (
                      <span className="ml-auto shrink-0 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground tabular-nums">
                        {unread}
                      </span>
                    )}
                    {link.href === "/dashboard/image-requests" && pendingImageRequestsCount > 0 && (
                      <span className="ml-auto shrink-0 rounded-md bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-950 tabular-nums">
                        {pendingImageRequestsCount}
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
            {isStaff && (
              <li className="w-full lg:flex-none">
                <Link
                  href={user.role === "admin" ? "/admin" : "/admin/scrims"}
                  className="flex items-center gap-2.5 rounded-xl border border-transparent px-3 py-2 text-xs sm:text-sm font-semibold text-indigo-300 transition-all hover:bg-white/[0.05] hover:text-indigo-200 w-full"
                >
                  <Shield className="size-4 shrink-0" aria-hidden />
                  <span className="truncate">{user.role === "admin" ? "Admin Panel" : "Mod Panel"}</span>
                </Link>
              </li>
            )}
            <li className="w-full lg:flex-none">
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center gap-2.5 rounded-xl border border-transparent px-3 py-2 text-xs sm:text-sm font-semibold text-muted-foreground transition-all hover:bg-destructive/12 hover:text-destructive text-left cursor-pointer"
              >
                <LogOut className="size-4 shrink-0" aria-hidden />
                <span className="truncate">Sign Out</span>
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </aside>
  )
}
