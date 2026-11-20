export const PRESET_MAPS = [
  "Bermuda",
  "Purgatory",
  "Kalahari",
  "Alpine",
  "NeXTerra",
  "Solara",
  "Bermuda Remastered",
] as const

export const PRESET_START_TIMES = [
  "2:00 PM",
  "3:00 PM",
  "4:00 PM",
  "5:00 PM",
  "6:00 PM",
  "7:00 PM",
  "8:00 PM",
  "9:00 PM",
  "10:00 PM",
  "11:00 PM",
  "12:00 AM",
] as const

export type ScrimCategoryOption = {
  value: string
  label: string
  shortLabel: string
  scheduleGroup: "daily" | "friday"
  defaultMaps: string[]
  defaultPriceBdt: number
  defaultPrizePoolBdt: number
  defaultDescription: (title: string, mapsText: string) => string
  defaultRules: (mapsText: string, maxTeams: number) => string
  defaultNotes: (mapsText: string) => string
}

export const SCRIM_CATEGORY_OPTIONS: ScrimCategoryOption[] = [
  {
    value: "Daily Scrims",
    label: "Daily Scrims",
    shortLabel: "Daily Scrims",
    scheduleGroup: "daily",
    defaultMaps: ["Bermuda", "Purgatory", "Kalahari"],
    defaultPriceBdt: 35,
    defaultPrizePoolBdt: 330,
    defaultDescription: (title, mapsText) =>
      `Daily competitive Free Fire squad scrim lobby (${title}) featuring ${mapsText}.`,
    defaultRules: (mapsText, maxTeams) =>
      `1. Maps: ${mapsText}.\n2. BATTLE ROYALE squad mode (${maxTeams} Teams).\n3. Mobile devices only — emulators are strictly prohibited.\n4. Join room 10-15 minutes prior to match start and sit strictly in your assigned slot.`,
    defaultNotes: () =>
      "Prize distributed to captain's digital wallet within 6 hours of result publication (Maximum 24 hours). Receive payment within 6 hours (সর্বোচ্চ ২৪ ঘণ্টা)।",
  },
  {
    value: "Friday Scrims",
    label: "Friday Scrims",
    shortLabel: "Friday Scrims",
    scheduleGroup: "friday",
    defaultMaps: ["Bermuda", "Purgatory", "Kalahari", "Solara", "NeXTerra"],
    defaultPriceBdt: 80,
    defaultPrizePoolBdt: 850,
    defaultDescription: (title, mapsText) =>
      `Friday Scrims weekend tournament (${title}) featuring ${mapsText}.`,
    defaultRules: (mapsText, maxTeams) =>
      `1. Friday Scrims Format — Maps: ${mapsText}.\n2. BATTLE ROYALE squad mode (${maxTeams} Teams).\n3. Mobile devices only — emulators are strictly prohibited.\n4. Join room 10-15 minutes prior to match start and verify your slot.`,
    defaultNotes: (mapsText) =>
      `Friday Scrims Tournament (${mapsText}). Prize distributed to captain's digital wallet within 6 hours of result publication (Maximum 24 hours). Receive payment within 6 hours (সর্বোচ্চ ২৪ ঘণ্টা)।`,
  },
  {
    value: "Friday Special Blast",
    label: "Friday Special Blast",
    shortLabel: "Friday Blast",
    scheduleGroup: "friday",
    defaultMaps: ["Bermuda", "Purgatory", "Kalahari", "Solara", "NeXTerra"],
    defaultPriceBdt: 80,
    defaultPrizePoolBdt: 850,
    defaultDescription: (title, mapsText) =>
      `Friday Special Blast (${title}) — 5 competitive matches (${mapsText}).`,
    defaultRules: (mapsText, maxTeams) =>
      `1. 5 Matches (${mapsText}).\n2. BATTLE ROYALE squad mode (${maxTeams} Teams).\n3. No emulators allowed.\n4. Join room 10-15 minutes prior to match start.`,
    defaultNotes: (mapsText) =>
      `5 Matches Tournament (${mapsText}). Prize distributed to captain's digital wallet within 6 hours of result publication (Maximum 24 hours). Receive payment within 6 hours (সর্বোচ্চ ২৪ ঘণ্টা)।`,
  },
  {
    value: "Champion Rush",
    label: "Champion Rush (Friday)",
    shortLabel: "Champion Rush",
    scheduleGroup: "friday",
    defaultMaps: ["Bermuda", "Purgatory", "Kalahari", "NeXTerra"],
    defaultPriceBdt: 50,
    defaultPrizePoolBdt: 480,
    defaultDescription: (title) =>
      `${title} — Champion Rush squad survival championship format (80 pts unlock + Booyah decider).`,
    defaultRules: (_mapsText, maxTeams) =>
      `1. BATTLE ROYALE format (${maxTeams} Teams) — Maximum 8 matches will occur. Not more than that.\n2. 80 Points Unlock: The team which collects 80 points unlocks the Champion Rush format.\n3. Champion Decider: Once unlocked, any unlocked team winning a BOOYAH immediately wins the tournament.\n4. If 8 matches conclude without an unlocked Booyah, highest overall points wins.\n5. Join room on time. Emulators are strictly prohibited.`,
    defaultNotes: () =>
      "RULES: MAX 8 MATCHES WILL OCCUR. THE TEAM WHICH COLLECTS 80 PTS UNLOCKS CHAMPION RUSH, THEN ANY UNLOCKED TEAM GETTING A BOOYAH WINS IMMEDIATELY. Prize distributed to captain's digital wallet within 6 hours of result publication (Maximum 24 hours).",
  },
]

export function getScrimCategoryConfig(category?: string | null): ScrimCategoryOption {
  const norm = (category || "").trim().toLowerCase()
  if (norm.includes("champion rush")) {
    return SCRIM_CATEGORY_OPTIONS.find((c) => c.value === "Champion Rush")!
  }
  if (norm.includes("friday special") || norm.includes("special blast")) {
    return SCRIM_CATEGORY_OPTIONS.find((c) => c.value === "Friday Special Blast")!
  }
  if (norm.includes("friday")) {
    return SCRIM_CATEGORY_OPTIONS.find((c) => c.value === "Friday Scrims")!
  }
  return SCRIM_CATEGORY_OPTIONS[0]
}

export function parseMapsList(mapStr?: string | null): string[] {
  if (!mapStr || !mapStr.trim()) return ["Bermuda"]
  const cleaned = mapStr
    .trim()
    .replace(/^\d+\s*matches?\s*\((.+)\)$/i, "$1")
    .trim()

  // Preserve special format strings like "Champion Mode (Max 8 Matches)"
  if (/champion mode/i.test(cleaned)) {
    return [cleaned]
  }

  const parts = cleaned
    .split(/[,&+/|]+|\band\b/i)
    .map((p) => p.trim())
    .filter(Boolean)

  if (parts.length === 0) return [cleaned]
  return Array.from(new Set(parts))
}

export function formatMapsDisplay(maps: string[]): string {
  const cleaned = maps.map((m) => m.trim()).filter(Boolean)
  if (cleaned.length === 0) return "Bermuda"
  return cleaned.join(", ")
}
