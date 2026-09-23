export type PrizePlace = {
  rank: number
  place: string
  prizeBdt: number
}

export type ScrimPrizeBreakdown = {
  categoryName: string
  totalPrizeBdt: number
  places: PrizePlace[]
}

/**
 * Exact Prize Distributions:
 *
 * [Daily Scrims]
 * - Total Prizepool: 330 tk
 * - 1st: 160 tk
 * - 2nd: 100 tk
 * - 3rd: 70 tk
 *
 * [10 PM Champion Rush]
 * - Total Prizepool: 320 tk
 * - 1st: 140 tk
 * - 2nd: 100 tk
 * - 3rd: 80 tk
 *
 * [Friday Special Blasts]
 * - Total Prizepool: 850 tk
 * - 1st: 300 tk
 * - 2nd: 190 tk
 * - 3rd: 140 tk
 * - 4th: 120 tk
 * - 5th: 100 tk
 */

export const PRIZE_DISTRIBUTIONS: Record<"daily" | "champion_rush" | "friday_special", ScrimPrizeBreakdown> = {
  daily: {
    categoryName: "Daily Scrims",
    totalPrizeBdt: 330,
    places: [
      { rank: 1, place: "1st Place", prizeBdt: 160 },
      { rank: 2, place: "2nd Place", prizeBdt: 100 },
      { rank: 3, place: "3rd Place", prizeBdt: 70 },
    ],
  },
  champion_rush: {
    categoryName: "10 PM Champion Rush",
    totalPrizeBdt: 320,
    places: [
      { rank: 1, place: "1st Place", prizeBdt: 140 },
      { rank: 2, place: "2nd Place", prizeBdt: 100 },
      { rank: 3, place: "3rd Place", prizeBdt: 80 },
    ],
  },
  friday_special: {
    categoryName: "Friday Special Blasts",
    totalPrizeBdt: 850,
    places: [
      { rank: 1, place: "1st Place", prizeBdt: 300 },
      { rank: 2, place: "2nd Place", prizeBdt: 190 },
      { rank: 3, place: "3rd Place", prizeBdt: 140 },
      { rank: 4, place: "4th Place", prizeBdt: 120 },
      { rank: 5, place: "5th Place", prizeBdt: 100 },
    ],
  },
}

export function getScrimPrizeBreakdown(scrim: {
  title?: string | null
  slug?: string | null
  category?: string | null
  id?: string | null
  prizePoolBdt?: number | null
}): ScrimPrizeBreakdown {
  const title = (scrim.title || "").toLowerCase()
  const slug = (scrim.slug || "").toLowerCase()
  const category = (scrim.category || "").toLowerCase()
  const id = (scrim.id || "").toLowerCase()

  // 1. Friday Special Blasts
  if (
    title.includes("friday special") ||
    slug.includes("friday-special") ||
    category.includes("friday special") ||
    id.includes("scrim-fri-") && !id.includes("cr")
  ) {
    return PRIZE_DISTRIBUTIONS.friday_special
  }

  // 2. 10 PM Champion Rush
  if (
    title.includes("champion rush") ||
    slug.includes("champion-rush") ||
    category.includes("champion rush") ||
    id.includes("10pm-cr") ||
    id === "scrim-fri-10pm-cr"
  ) {
    return PRIZE_DISTRIBUTIONS.champion_rush
  }

  // 3. Default: Daily Scrims
  return PRIZE_DISTRIBUTIONS.daily
}
