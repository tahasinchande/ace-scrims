"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Zap, Menu, X } from "lucide-react"
import { cn } from "@/lib/utils"

const links = [
  { href: "/", label: "Home" },
  { href: "/scrims", label: "Scrims" },
  { href: "/results", label: "Results" },
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/#faq", label: "FAQ" },
]

export function SiteHeader({ user }: { user: { name: string; role: string } | null }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <header className="glass sticky top-0 z-50 border-b border-border/50">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2" aria-label="Ace Scrims home">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Zap className="size-4" />
          </span>
          <span className="font-display text-lg font-bold tracking-wide">
            ACE<span className="text-primary">SCRIMS</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground",
                pathname === l.href && "text-foreground",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              {(user.role === "admin" || user.role === "moderator") && (
                <Button asChild variant="ghost" size="sm">
                  <Link href="/admin">Admin</Link>
                </Button>
              )}
              <Button asChild size="sm" className="font-semibold">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/sign-in">Sign in</Link>
              </Button>
              <Button asChild size="sm" className="font-semibold glow-primary">
                <Link href="/sign-up">Join Now</Link>
              </Button>
            </>
          )}
        </div>

        <button
          className="flex size-10 items-center justify-center rounded-lg text-foreground md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label="Toggle menu"
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      {open && (
        <nav className="border-t border-border/50 px-4 pb-4 pt-2 md:hidden" aria-label="Mobile">
          <div className="flex flex-col gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground"
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2">
              {user ? (
                <Button asChild className="font-semibold">
                  <Link href="/dashboard" onClick={() => setOpen(false)}>
                    Dashboard
                  </Link>
                </Button>
              ) : (
                <>
                  <Button asChild variant="outline">
                    <Link href="/sign-in" onClick={() => setOpen(false)}>
                      Sign in
                    </Link>
                  </Button>
                  <Button asChild className="font-semibold">
                    <Link href="/sign-up" onClick={() => setOpen(false)}>
                      Join Now
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </nav>
      )}
    </header>
  )
}
