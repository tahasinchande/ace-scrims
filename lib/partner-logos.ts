export type VerifiedPartnerLogo = {
  id: string
  name: string
  url: string
  keywords: string[]
}

export const VERIFIED_PARTNER_LOGOS: VerifiedPartnerLogo[] = [
  {
    id: "garena-free-fire",
    name: "Garena Free Fire",
    url: "/images/partners/garena-free-fire.svg",
    keywords: ["garena", "free fire", "freefire", "ff"],
  },
  {
    id: "bkash",
    name: "bKash",
    url: "/images/partners/bkash.svg",
    keywords: ["bkash"],
  },
  {
    id: "nagad",
    name: "Nagad",
    url: "/images/partners/nagad.svg",
    keywords: ["nagad"],
  },
  {
    id: "discord",
    name: "Discord",
    url: "/images/partners/discord.svg",
    keywords: ["discord"],
  },
  {
    id: "youtube-gaming",
    name: "YouTube Gaming",
    url: "/images/partners/youtube-gaming.svg",
    keywords: ["youtube", "yt"],
  },
  {
    id: "uddoktapay",
    name: "UddoktaPay",
    url: "/images/partners/uddoktapay.svg",
    keywords: ["uddoktapay", "uddokta"],
  },
  {
    id: "supportkori",
    name: "SupportKori",
    url: "/images/partners/supportkori.svg",
    keywords: ["supportkori", "support kori"],
  },
]

function isBrokenOrPlaceholderLogoUrl(url?: string | null): boolean {
  if (!url) return true
  const trimmed = url.trim().toLowerCase()
  if (!trimmed) return true
  return (
    trimmed.includes("placeholder-logo") ||
    trimmed.includes("placeholder.svg") ||
    trimmed.includes("placeholder.jpg") ||
    trimmed.includes("via.placeholder.com") ||
    trimmed.includes("placehold.co") ||
    trimmed === "/icon.svg"
  )
}

/**
 * Resolves a partner logo URL: preserves valid custom uploaded/real URLs,
 * and replaces broken or placeholder logos with verified local brand assets when matched.
 */
export function resolveVerifiedPartnerLogo(
  partnerName?: string | null,
  logoUrl?: string | null
): string | null {
  if (logoUrl && !isBrokenOrPlaceholderLogoUrl(logoUrl)) {
    return logoUrl.trim()
  }

  const normalized = (partnerName || "").trim().toLowerCase()
  if (normalized) {
    const matched = VERIFIED_PARTNER_LOGOS.find((entry) =>
      entry.keywords.some((kw) => normalized.includes(kw))
    )
    if (matched) return matched.url
  }

  return null
}
