import { cn } from "@/lib/utils"
import { BRAND } from "@/lib/brand"

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
  variant?: "wordmark" | "full" | "symbol"
  surface?: "dark" | "light"
  showSubtext?: boolean
  logoUrl?: string
}) {
  // Respect explicit admin-uploaded custom logos, but ignore legacy default `/icon.svg`
  const hasCustomUploadedLogo =
    Boolean(logoUrl) &&
    logoUrl !== "/icon.svg" &&
    logoUrl !== "/icon" &&
    !logoUrl?.includes("placeholder")

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
        <img
          src={symbolSrc}
          alt={BRAND.name}
          className={cn(symbolSizes[size], "object-contain")}
        />
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
        <img
          src={fullSrc}
          alt={BRAND.name}
          className={cn(fullSizes[size], "max-w-full object-contain")}
        />
      </div>
    )
  }

  // Default: stylized RushX wordmark ONLY (no "Organization") for top-left header & loading screens
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
      <img
        src={wordmarkSrc}
        alt={BRAND.shortName}
        className={cn(wordmarkSizes[size], "max-w-[150px] sm:max-w-[175px] object-contain")}
      />
      {showSubtext && <span className="sr-only">{BRAND.name}</span>}
    </div>
  )
}

/**
 * Backward-compatible alias so existing imports keep working cleanly.
 */
export const AceScrimsBrandLogo = RushXBrandLogo
