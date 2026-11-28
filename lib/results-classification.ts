export type ResultBannerType = "overall" | "mvp" | "top3" | "other"

export interface ClassifiableResultLike {
  category?: string | null
  mvpPlayerName?: string | null
  mvpTeamName?: string | null
  winnerTeamName?: string | null
  screenshotUrl?: string | null
}

/**
 * Strictly classifies published results into mutually-exclusive showcase buckets
 * so Overall Standings, Top 3 Face Banner, and MVP Face Banner never cross-contaminate.
 */
export function classifyResultBannerType(result: ClassifiableResultLike): ResultBannerType {
  const cat = (result.category || "").trim().toLowerCase()

  // 1. Overall Standings (strictly separated first so it never leaks into Top 3 or MVP)
  if (
    cat.includes("overall standing") ||
    cat.includes("overall standings") ||
    cat === "overall" ||
    cat.includes("leaderboard banner") ||
    cat.includes("standings banner")
  ) {
    return "overall"
  }

  // 2. MVP Face Banner
  if (cat.includes("mvp")) {
    return "mvp"
  }

  // 3. Top 3 Face Banner
  if (
    cat.includes("top 3") ||
    cat.includes("top3") ||
    cat.includes("face banner")
  ) {
    return "top3"
  }

  // 4. Fallback for legacy rows without explicit category labels
  if (result.mvpPlayerName && result.mvpPlayerName.trim().length > 0) {
    return "mvp"
  }

  return "other"
}

export function splitHomepageShowcaseResults<T extends ClassifiableResultLike>(items: T[]): {
  overallStandings: T[]
  top3Banners: T[]
  mvpBanners: T[]
} {
  const overallStandings: T[] = []
  const top3Banners: T[] = []
  const mvpBanners: T[] = []

  for (const item of items) {
    if (!item.screenshotUrl) continue
    const kind = classifyResultBannerType(item)
    if (kind === "overall") {
      overallStandings.push(item)
    } else if (kind === "mvp") {
      mvpBanners.push(item)
    } else if (kind === "top3") {
      top3Banners.push(item)
    }
  }

  return { overallStandings, top3Banners, mvpBanners }
}
