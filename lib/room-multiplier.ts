export const MIN_ROOM_MULTIPLIER = 1
export const MAX_ROOM_MULTIPLIER = 10

export type RoomTierOverrideMode = "normal" | "force_on" | "force_off"
export type RoomTierOverrides = Record<string, RoomTierOverrideMode>

export interface StandardScrimDef {
  id: string
  time: string
  name: string
  slug: string
  map: string
  isRoom2: boolean
  roomNumber: number
  priceBdt: number
  prizePoolBdt: number
  category: string
  matchCount?: number
  bannerUrl: string
  scheduleType: "daily" | "friday_blast" | "champion_rush"
}

const DAILY_BASE_SLOTS = [
  { key: "3pm", time: "3:00 PM", label: "3 PM", maps: ["Bermuda", "Purgatory", "Kalahari"], banners: ["/images/scrim-1.jpg", "/images/scrim-2.jpg", "/images/scrim-3.jpg"] },
  { key: "4pm", time: "4:00 PM", label: "4 PM", maps: ["Kalahari", "Bermuda", "Purgatory"], banners: ["/images/scrim-3.jpg", "/images/scrim-4.jpg", "/images/scrim-5.jpg"] },
  { key: "5pm", time: "5:00 PM", label: "5 PM", maps: ["Purgatory", "Kalahari", "Bermuda"], banners: ["/images/scrim-5.jpg", "/images/scrim-6.jpg", "/images/scrim-7.jpg"] },
  { key: "7pm", time: "7:00 PM", label: "7 PM", maps: ["Bermuda", "Purgatory", "Kalahari"], banners: ["/images/scrim-7.jpg", "/images/scrim-8.jpg", "/images/scrim-9.jpg"] },
  { key: "8pm", time: "8:00 PM", label: "8 PM", maps: ["Kalahari", "Bermuda", "Purgatory"], banners: ["/images/scrim-9.jpg", "/images/scrim-10.jpg", "/images/scrim-11.jpg"] },
  { key: "9pm", time: "9:00 PM", label: "9 PM", maps: ["Purgatory", "Kalahari", "Bermuda"], banners: ["/images/scrim-11.jpg", "/images/scrim-12.jpg", "/images/bermuda.jpg"] },
  { key: "10pm", time: "10:00 PM", label: "10 PM", maps: ["Bermuda", "Purgatory", "Kalahari"], banners: ["/images/bermuda.jpg", "/images/purgatory.jpg", "/images/kalahari.jpg"] },
  { key: "11pm", time: "11:00 PM", label: "11 PM", maps: ["Kalahari", "Bermuda", "Purgatory"], banners: ["/images/kalahari.jpg", "/images/nexterra.jpg", "/images/alpine.jpg"] },
  { key: "12am", time: "12:00 AM", label: "12 AM", maps: ["Purgatory", "Kalahari", "Bermuda"], banners: ["/images/alpine.jpg", "/images/scrim_squad_clash_1786956645507.jpg", "/images/scrim-1.jpg"] },
] as const

const FRIDAY_BLAST_BASE_SLOTS = [
  { key: "3pm", time: "3:00 PM", label: "3 PM", banners: ["/images/scrim-2.jpg", "/images/scrim-3.jpg", "/images/scrim-4.jpg"] },
  { key: "5pm", time: "5:00 PM", label: "5 PM", banners: ["/images/scrim-4.jpg", "/images/scrim-5.jpg", "/images/scrim-6.jpg"] },
  { key: "7pm", time: "7:00 PM", label: "7 PM", banners: ["/images/scrim-6.jpg", "/images/scrim-7.jpg", "/images/scrim-8.jpg"] },
  { key: "9pm", time: "9:00 PM", label: "9 PM", banners: ["/images/scrim-8.jpg", "/images/scrim-9.jpg", "/images/scrim-10.jpg"] },
  { key: "11pm", time: "11:00 PM", label: "11 PM", banners: ["/images/scrim-10.jpg", "/images/scrim-11.jpg", "/images/scrim-12.jpg"] },
] as const

const CHAMPION_RUSH_BASE_SLOTS = [
  { key: "3pm", time: "3:00 PM", label: "3 PM", category: "3 PM Champion Rush", banners: ["/images/scrim_cyber_arena_1786956594944.jpg", "/images/scrim-5.jpg", "/images/scrim-9.jpg"] },
  { key: "10pm", time: "10:00 PM", label: "10 PM", category: "10 PM Champion Rush", banners: ["/images/sakura-wallpaper.jpg", "/images/scrim-11.jpg", "/images/scrim-7.jpg"] },
] as const

export function clampRoomMultiplier(val: unknown): number {
  const num = Number.parseInt(String(val ?? ""), 10)
  if (!Number.isFinite(num) || num < MIN_ROOM_MULTIPLIER) return MIN_ROOM_MULTIPLIER
  if (num > MAX_ROOM_MULTIPLIER) return MAX_ROOM_MULTIPLIER
  return num
}

export function parseRoomMultiplier(
  rawMultiplier: string | null | undefined,
  legacyShowRoom2?: string | boolean | null
): number {
  if (rawMultiplier !== undefined && rawMultiplier !== null && String(rawMultiplier).trim() !== "") {
    const parsed = Number.parseInt(String(rawMultiplier).trim(), 10)
    if (Number.isFinite(parsed) && parsed >= MIN_ROOM_MULTIPLIER) {
      return Math.min(MAX_ROOM_MULTIPLIER, parsed)
    }
  }
  const room2On = legacyShowRoom2 === true || legacyShowRoom2 === "true"
  return room2On ? 2 : 1
}

export function parseRoomTierOverrides(rawJson: string | null | undefined): RoomTierOverrides {
  if (!rawJson || !rawJson.trim()) return {}
  try {
    const parsed = JSON.parse(rawJson)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    const out: RoomTierOverrides = {}
    for (const [key, val] of Object.entries(parsed)) {
      const roomNum = Number.parseInt(key, 10)
      if (!Number.isFinite(roomNum) || roomNum < 1 || roomNum > MAX_ROOM_MULTIPLIER) continue
      if (val === "force_on" || val === "force_off" || val === "normal") {
        if (val !== "normal") {
          out[String(roomNum)] = val
        }
      }
    }
    return out
  } catch {
    return {}
  }
}

/**
 * Extracts the numeric room tier (1, 2, 3, ..., N) from any scrim ID, slug, or title.
 * Legacy Room 1 Friday scrims (e.g. `scrim-fri-3pm`) cleanly resolve to 1.
 */
export function getScrimRoomNumber(scrim: {
  id?: string | null
  slug?: string | null
  title?: string | null
}): number {
  const id = (scrim.id || "").trim().toLowerCase()
  const slug = (scrim.slug || "").trim().toLowerCase()
  const title = (scrim.title || "").trim().toLowerCase()

  const idMatch = id.match(/-r(\d+)$/)
  if (idMatch) {
    const n = Number.parseInt(idMatch[1], 10)
    if (Number.isFinite(n) && n >= 1) return n
  }

  const slugMatch = slug.match(/-room-(\d+)$/)
  if (slugMatch) {
    const n = Number.parseInt(slugMatch[1], 10)
    if (Number.isFinite(n) && n >= 1) return n
  }

  const titleMatch = title.match(/\broom\s*(\d+)\b/)
  if (titleMatch) {
    const n = Number.parseInt(titleMatch[1], 10)
    if (Number.isFinite(n) && n >= 1) return n
  }

  return 1
}

/**
 * Generates Daily Scrim definitions for rooms 1..multiplier.
 * Preserves exact legacy IDs & slugs for Room 1 (`scrim-3pm-r1`) and Room 2 (`scrim-3pm-r2`).
 */
export function buildMultipliedDailyDefinitions(multiplier: number): StandardScrimDef[] {
  const count = clampRoomMultiplier(multiplier)
  const defs: StandardScrimDef[] = []

  for (const slot of DAILY_BASE_SLOTS) {
    for (let roomNum = 1; roomNum <= count; roomNum++) {
      const slugTime = slot.label.toLowerCase().replace(/\s+/g, "-")
      defs.push({
        id: `scrim-${slot.key}-r${roomNum}`,
        time: slot.time,
        name: `${slot.label} SCRIM ROOM ${roomNum}`,
        slug: `${slugTime}-scrim-room-${roomNum}`,
        map: slot.maps[(roomNum - 1) % slot.maps.length],
        isRoom2: roomNum >= 2,
        roomNumber: roomNum,
        priceBdt: 35,
        prizePoolBdt: 330,
        category: "Daily Scrims",
        bannerUrl: slot.banners[(roomNum - 1) % slot.banners.length],
        scheduleType: "daily",
      })
    }
  }

  return defs
}

/**
 * Generates Friday Special Blast definitions for rooms 1..multiplier.
 * Room 1 preserves exact legacy IDs & slugs (`scrim-fri-3pm` / `3-pm-friday-special-blast`).
 * Room 2..N receive `-rN` IDs and `-room-N` slugs cleanly.
 */
export function buildMultipliedFridayBlastDefinitions(multiplier: number): StandardScrimDef[] {
  const count = clampRoomMultiplier(multiplier)
  const defs: StandardScrimDef[] = []

  for (const slot of FRIDAY_BLAST_BASE_SLOTS) {
    for (let roomNum = 1; roomNum <= count; roomNum++) {
      const slugTime = slot.label.toLowerCase().replace(/\s+/g, "-")
      const isBase = roomNum === 1
      defs.push({
        id: isBase ? `scrim-fri-${slot.key}` : `scrim-fri-${slot.key}-r${roomNum}`,
        time: slot.time,
        name: isBase
          ? `${slot.label} Friday Special Blast`
          : `${slot.label} Friday Special Blast ROOM ${roomNum}`,
        slug: isBase
          ? `${slugTime}-friday-special-blast`
          : `${slugTime}-friday-special-blast-room-${roomNum}`,
        map: "5 Matches (Bermuda, Purgatory, Kalahari, Solana, Nexterra)",
        isRoom2: roomNum >= 2,
        roomNumber: roomNum,
        priceBdt: 80,
        prizePoolBdt: 850,
        category: "Friday Special Blast",
        matchCount: 5,
        bannerUrl: slot.banners[(roomNum - 1) % slot.banners.length],
        scheduleType: "friday_blast",
      })
    }
  }

  return defs
}

/**
 * Generates Champion Rush (Friday) definitions for rooms 1..multiplier.
 * Room 1 preserves exact legacy IDs & slugs (`scrim-fri-3pm-cr` / `3-pm-champion-rush`).
 * Room 2..N receive `-cr-rN` IDs and `-room-N` slugs cleanly.
 */
export function buildMultipliedChampionRushDefinitions(multiplier: number): StandardScrimDef[] {
  const count = clampRoomMultiplier(multiplier)
  const defs: StandardScrimDef[] = []

  for (const slot of CHAMPION_RUSH_BASE_SLOTS) {
    for (let roomNum = 1; roomNum <= count; roomNum++) {
      const slugTime = slot.label.toLowerCase().replace(/\s+/g, "-")
      const isBase = roomNum === 1
      defs.push({
        id: isBase ? `scrim-fri-${slot.key}-cr` : `scrim-fri-${slot.key}-cr-r${roomNum}`,
        time: slot.time,
        name: isBase
          ? `${slot.label} Champion Rush`
          : `${slot.label} Champion Rush ROOM ${roomNum}`,
        slug: isBase
          ? `${slugTime}-champion-rush`
          : `${slugTime}-champion-rush-room-${roomNum}`,
        map: "Champion Mode (Max 8 Matches)",
        isRoom2: roomNum >= 2,
        roomNumber: roomNum,
        priceBdt: 50,
        prizePoolBdt: 480,
        category: slot.category,
        matchCount: 8,
        bannerUrl: slot.banners[(roomNum - 1) % slot.banners.length],
        scheduleType: "champion_rush",
      })
    }
  }

  return defs
}

export function buildMultipliedFridayDefinitions(multiplier: number): StandardScrimDef[] {
  return [
    ...buildMultipliedFridayBlastDefinitions(multiplier),
    ...buildMultipliedChampionRushDefinitions(multiplier),
  ]
}

export function buildAllStandardScrimDefinitions(multiplier: number): StandardScrimDef[] {
  return [
    ...buildMultipliedDailyDefinitions(multiplier),
    ...buildMultipliedFridayBlastDefinitions(multiplier),
    ...buildMultipliedChampionRushDefinitions(multiplier),
  ]
}

/**
 * Finds a standard scrim definition by ID or slug across all possible multipliers (1..MAX_ROOM_MULTIPLIER),
 * ensuring direct URL lookups or booking resolution work even for dynamically generated Room 3..10 lobbies.
 */
export function findStandardScrimDefinition(idOrSlug: string): StandardScrimDef | undefined {
  const target = (idOrSlug || "").trim()
  if (!target) return undefined
  const all = buildAllStandardScrimDefinitions(MAX_ROOM_MULTIPLIER)
  return all.find((d) => d.id === target || d.slug === target)
}
