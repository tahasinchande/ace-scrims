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
} from "lucide-react"

const links = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
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
    <aside className="w-full shrink-0 lg:w-60">
      <div className="glass rounded-2xl p-4 border border-border/80 shadow-lg">
        <div className="mb-4 flex items-center gap-3 border-b border-border/60 px-1 pb-4">
          <div className="size-10 shrink-0 rounded-full overflow-hidden border border-border/80 bg-secondary/80 flex items-center justify-center">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={user.name} className="size-full object-cover" />
            ) : (
              <span className="font-display text-xs font-bold text-foreground">
                {getUserInitials(user.name)}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-sm font-bold text-foreground">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <nav aria-label="Dashboard navigation">
          <ul className="flex flex-row flex-wrap gap-1 lg:flex-col">
            {links.map((link) => {
              const active = link.exact ? pathname === link.href : pathname.startsWith(link.href)
              return (
                <li key={link.href} className="flex-1 lg:flex-none">
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                    )}
                  >
                    <link.icon className="size-4 shrink-0" aria-hidden />
                    <span className="hidden sm:inline">{link.label}</span>
                    {link.href === "/dashboard/notifications" && unread > 0 && (
                      <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                        {unread}
                      </span>
                    )}
                    {link.href === "/dashboard/image-requests" && pendingImageRequestsCount > 0 && (
                      <span className="ml-auto rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-black animate-pulse">
                        {pendingImageRequestsCount}
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
            {isStaff && (
              <li className="flex-1 lg:flex-none">
                <Link
                  href={user.role === "admin" ? "/admin" : "/admin/scrims"}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-accent transition-colors hover:bg-secondary"
                >
                  <Shield className="size-4 shrink-0" aria-hidden />
                  <span className="hidden sm:inline">{user.role === "admin" ? "Admin Panel" : "Mod Panel"}</span>
                </Link>
              </li>
            )}
            <li className="flex-1 lg:flex-none">
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="size-4 shrink-0" aria-hidden />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </aside>
  )
}
