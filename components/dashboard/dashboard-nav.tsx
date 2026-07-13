"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Swords,
  Bell,
  Receipt,
  Settings,
  LogOut,
  Shield,
  Trophy,
} from "lucide-react"

const links = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/scrims", label: "My Scrims", icon: Swords },
  { href: "/dashboard/results", label: "My Results", icon: Trophy },
  { href: "/dashboard/notifications", label: "Notifications", icon: Bell },
  { href: "/dashboard/payments", label: "Payments", icon: Receipt },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
]

export function DashboardNav({
  unread,
  user,
}: {
  unread: number
  user: { name: string; email: string; role: string }
}) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    await authClient.signOut()
    router.push("/")
    router.refresh()
  }

  const isStaff = user.role === "admin" || user.role === "moderator"

  return (
    <aside className="w-full shrink-0 lg:w-60">
      <div className="glass rounded-2xl p-4">
        <div className="mb-4 border-b border-border/60 px-2 pb-4">
          <p className="truncate font-display font-bold">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
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
                  </Link>
                </li>
              )
            })}
            {isStaff && (
              <li className="flex-1 lg:flex-none">
                <Link
                  href={user.role === "admin" ? "/admin" : "/mod"}
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
