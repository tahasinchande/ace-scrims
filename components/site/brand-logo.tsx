import { cn } from "@/lib/utils"
import { BRAND } from "@/lib/brand"

const BUILTIN_BRAND_PATHS = new Set<string>([
  "/icon.svg",
  "/icon",
  ...Object.values(BRAND.assets),
])

function isCustomUploadedLogo(logoUrl?: string): boolean {
  if (!logoUrl) return false
  const trimmed = logoUrl.trim()
  if (!trimmed || trimmed.includes("placeholder")) return false
  if (BUILTIN_BRAND_PATHS.has(trimmed)) return false
  if (trimmed.startsWith("/images/brand/rushx-")) return false
  return true
}

export function RushXBrandLogo({
  className,
  size = "md",
  variant = "wordmark",
  surface = "dark",
  showSubtext = false,
  logoUrl,
}: {
  className?: string
  size?: "sm" | "md" | "lg" | "xl"
  variant?: "wordmark" | "lockup" | "full" | "symbol"
  surface?: "dark" | "light"
  showSubtext?: boolean
  logoUrl?: string
}) {
  // Respect explicit admin-uploaded custom logos, while ignoring legacy/default built-in RushX asset paths
  const hasCustomUploadedLogo = isCustomUploadedLogo(logoUrl)

  if (variant === "symbol") {
    const symbolSizes = {
      sm: "size-7",
      md: "size-9",
      lg: "size-12",
      xl: "size-16",
    }
    const symbolSrc = hasCustomUploadedLogo
      ? logoUrl!
      : surface === "light"
        ? BRAND.assets.symbolDark
        : BRAND.assets.symbol

    return (
      <div className={cn("inline-flex items-center justify-center shrink-0 select-none", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={symbolSrc}
          alt={BRAND.name}
          className={cn(symbolSizes[size], "object-contain")}
        />
      </div>
    )
  }

  if (variant === "lockup") {
    const symbolSizes = {
      sm: "size-6 sm:size-7",
      md: "size-7 sm:size-8",
      lg: "size-9 sm:size-10",
      xl: "size-12 sm:size-14",
    }
    const wordmarkSizes = {
      sm: "h-5 sm:h-6 w-auto",
      md: "h-[22px] sm:h-7 w-auto",
      lg: "h-8 sm:h-9 w-auto",
      xl: "h-12 sm:h-14 w-auto",
    }
    const symbolSrc = hasCustomUploadedLogo
      ? logoUrl!
      : surface === "light"
        ? BRAND.assets.symbolDark
        : BRAND.assets.symbol
    const wordmarkSrc = surface === "light" ? BRAND.assets.wordmarkDark : BRAND.assets.wordmark

    return (
      <div className={cn("inline-flex items-center gap-1.5 sm:gap-2 shrink-0 select-none", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={symbolSrc}
          alt=""
          aria-hidden="true"
          className={cn(symbolSizes[size], "shrink-0 object-contain")}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={wordmarkSrc}
          alt={BRAND.shortName}
          className={cn(wordmarkSizes[size], "max-w-[110px] sm:max-w-[148px] object-contain")}
        />
        {showSubtext && <span className="sr-only">{BRAND.name}</span>}
      </div>
    )
  }

  if (variant === "full") {
    const fullSizes = {
      sm: "h-6 sm:h-7 w-auto",
      md: "h-9 sm:h-10 w-auto",
      lg: "h-12 sm:h-14 w-auto",
      xl: "h-16 sm:h-20 md:h-24 w-auto",
    }
    const fullSrc = surface === "light" ? BRAND.assets.fullWordmarkDark : BRAND.assets.fullWordmark

    return (
      <div className={cn("inline-flex items-center shrink-0 select-none", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={fullSrc}
          alt={BRAND.name}
          className={cn(fullSizes[size], "max-w-full object-contain")}
        />
      </div>
    )
  }

  // Stylized RushX wordmark ONLY (no "Organization")
  const wordmarkSizes = {
    sm: "h-6 w-auto",
    md: "h-7 sm:h-8 w-auto",
    lg: "h-10 sm:h-11 w-auto",
    xl: "h-14 sm:h-18 w-auto",
  }
  const wordmarkSrc = hasCustomUploadedLogo
    ? logoUrl!
    : surface === "light"
      ? BRAND.assets.wordmarkDark
      : BRAND.assets.wordmark

  return (
    <div className={cn("inline-flex items-center gap-2 shrink-0 select-none", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={wordmarkSrc}
        alt={BRAND.shortName}
        className={cn(wordmarkSizes[size], "max-w-[150px] sm:max-w-[175px] object-contain")}
      />
      {showSubtext && <span className="sr-only">{BRAND.name}</span>}
    </div>
  )
}
