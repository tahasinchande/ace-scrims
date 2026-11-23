"use client"

import React from "react"
import { useRouter, usePathname } from "next/navigation"
import { MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"

export interface LiveSupportButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "cta" | "footer" | "floating"
  showStatusDot?: boolean
  label?: string
}

export function openLiveSupportChat(router?: ReturnType<typeof useRouter>, pathname?: string) {
  if (typeof window === "undefined") return

  // If in admin area where the widget is hidden, navigate to home with query param
  if (pathname?.startsWith("/admin") && router) {
    router.push("/?openChat=true")
    return
  }

  // Dispatch global event for the widget
  window.dispatchEvent(new CustomEvent("open-live-chat"))
}

export function LiveSupportButton({
  variant = "primary",
  label = "Live Support",
  className,
  onClick,
  ...props
}: LiveSupportButtonProps) {
  const router = useRouter()
  const pathname = usePathname()

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(e)
    if (!e.defaultPrevented) {
      openLiveSupportChat(router, pathname)
    }
  }

  // Unified dynamic color-shifting appearance shared identically across floating, CTA, footer & page buttons
  const sizeClass =
    variant === "cta"
      ? "h-11 px-5 text-xs sm:text-sm"
      : variant === "footer"
        ? "h-10 px-4 text-xs"
        : variant === "floating"
          ? "h-12 px-5 text-xs"
          : "h-10 px-4.5 text-xs"

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "rushx-live-support-btn rushx-btn-splash group inline-flex items-center justify-center gap-2.5 rounded-full font-display font-bold uppercase tracking-wider text-white cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:pointer-events-none",
        sizeClass,
        className
      )}
      {...props}
    >
      <MessageSquare className="size-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
      <span className="truncate">{label}</span>
    </button>
  )
}
