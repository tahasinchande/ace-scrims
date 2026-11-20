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
 * [Champion Rush (3 PM & 10 PM)]
 * - Total Prizepool: 480 tk
 * - 1st: 180 tk
 * - 2nd: 130 tk
 * - 3rd: 100 tk
 * - 4th: 70 tk
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
    categoryName: "Champion Rush",
    totalPrizeBdt: 480,
    places: [
      { rank: 1, place: "1st Place", prizeBdt: 180 },
      { rank: 2, place: "2nd Place", prizeBdt: 130 },
      { rank: 3, place: "3rd Place", prizeBdt: 100 },
      { rank: 4, place: "4th Place", prizeBdt: 70 },
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

  let base: ScrimPrizeBreakdown = PRIZE_DISTRIBUTIONS.daily

  // 1. Friday Special Blasts / Friday Scrims
  if (
    title.includes("friday special") ||
    slug.includes("friday-special") ||
    category.includes("friday special") ||
    category === "friday scrims" ||
    (id.includes("scrim-fri-") && !id.includes("cr"))
  ) {
    base = {
      ...PRIZE_DISTRIBUTIONS.friday_special,
      categoryName: category === "friday scrims" ? "Friday Scrims" : "Friday Special Blasts",
    }
  }
  // 2. Champion Rush (3 PM and 10 PM)
  else if (
    title.includes("champion rush") ||
    slug.includes("champion-rush") ||
    category.includes("champion rush") ||
    id.includes("-cr") ||
    id.includes("champion-rush")
  ) {
    base = PRIZE_DISTRIBUTIONS.champion_rush
  }

  // Respect custom admin-configured prize pools (including 0 BDT)
  if (typeof scrim.prizePoolBdt === "number" && Number.isFinite(scrim.prizePoolBdt) && scrim.prizePoolBdt >= 0) {
    const customTotal = Math.round(scrim.prizePoolBdt)
    if (customTotal === base.totalPrizeBdt) {
      return base
    }
    if (customTotal === 0) {
      return {
        categoryName: base.categoryName,
        totalPrizeBdt: 0,
        places: [],
      }
    }

    // Scale places proportionally so custom totals sum cleanly to customTotal
    const ratio = customTotal / base.totalPrizeBdt
    const scaled = base.places.map((p) => ({
      ...p,
      prizeBdt: Math.max(0, Math.round(p.prizeBdt * ratio)),
    }))
    const currentSum = scaled.reduce((acc, p) => acc + p.prizeBdt, 0)
    const diff = customTotal - currentSum
    if (scaled.length > 0 && diff !== 0) {
      scaled[0] = { ...scaled[0], prizeBdt: Math.max(0, scaled[0].prizeBdt + diff) }
    }
    return {
      categoryName: base.categoryName,
      totalPrizeBdt: customTotal,
      places: scaled.filter((p) => p.prizeBdt > 0),
    }
  }

  return base
}
