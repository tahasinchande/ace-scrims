"use client"

import React from "react"
import { useRouter, usePathname } from "next/navigation"
import { MessageSquare, Sparkles } from "lucide-react"
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
  if ((pathname?.startsWith("/botsito") || pathname?.startsWith("/admin")) && router) {
    router.push("/?openChat=true")
    return
  }

  // Dispatch global event for the widget
  window.dispatchEvent(new CustomEvent("open-live-chat"))
}

export function LiveSupportButton({
  variant = "primary",
  showStatusDot = true,
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

  // Standardized variant styles
  const baseStyles =
    "inline-flex items-center justify-center font-display font-bold uppercase tracking-wider text-xs transition-all duration-200 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:pointer-events-none"

  let variantStyles = ""

  switch (variant) {
    case "cta":
      // Homepage CTA block style
      variantStyles =
        "h-12 w-full justify-start gap-3 rounded-xl px-5 text-sm font-semibold bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-600 hover:to-amber-600 text-black shadow-lg shadow-orange-500/20 border border-orange-400/40 hover:scale-[1.01] active:scale-[0.99]"
      break

    case "floating":
      // Fixed bottom-right widget trigger
      variantStyles =
        "h-12 px-5 gap-2.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-black shadow-xl shadow-orange-500/25 border border-orange-400/50 hover:scale-105 active:scale-95 group"
      break

    case "footer":
      // Footer direct support link/button
      variantStyles =
        "h-9 px-3.5 gap-2 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 hover:text-orange-300 border border-orange-500/25 hover:border-orange-500/40 text-xs font-semibold normal-case tracking-normal justify-start"
      break

    case "secondary":
      // Sleek dark glass style
      variantStyles =
        "h-10 px-4 gap-2 rounded-xl bg-secondary/80 hover:bg-secondary text-foreground hover:text-white border border-border/80 hover:border-border active:scale-95 shadow-sm"
      break

    case "primary":
    default:
      // Standard primary pill
      variantStyles =
        "h-10 px-4 gap-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-black font-bold shadow-md shadow-orange-500/20 border border-orange-400/40 hover:scale-[1.02] active:scale-[0.98]"
      break
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(baseStyles, variantStyles, className)}
      {...props}
    >
      <div className="relative flex items-center justify-center shrink-0">
        <MessageSquare
          className={cn(
            "transition-transform duration-200",
            variant === "cta" ? "size-5" : "size-4",
            variant === "floating" && "group-hover:scale-110"
          )}
        />
        {showStatusDot && (
          <span
            className={cn(
              "absolute -top-1 -right-1 rounded-full bg-emerald-400 border-2 animate-pulse",
              variant === "floating" || variant === "cta"
                ? "size-2.5 border-black"
                : "size-2 border-background"
            )}
            aria-hidden="true"
          />
        )}
      </div>
      <span className="truncate">{label}</span>
    </button>
  )
}
