import "server-only"

import { getActiveScrims } from "@/lib/queries/scrims"
import { getPublicSiteSettings, type PublicSiteSettings } from "@/lib/queries/settings"

export type LiveShowcaseSummary = {
  activeScrimCount: number
  totalTeamSlots: number
  maxTeamsPerLobby: number
  minEntryFeeBdt: number | null
  maxEntryFeeBdt: number | null
  minPrizePoolBdt: number | null
  maxPrizePoolBdt: number | null
  totalPrizePoolBdt: number
  timeWindow: string
  formatLabel: string
  payoutSla: string
  highlightNote: string
  authHighlights: string[]
}

function parseTimeSortMinutes(timeStr: string): number {
  const clean = (timeStr || "").trim().toUpperCase()
  const match = clean.match(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/)
  if (!match) return 9999
  let hour = Number.parseInt(match[1], 10)
  const minute = match[2] ? Number.parseInt(match[2], 10) : 0
  const meridiem = match[3]
  if (meridiem === "PM" && hour < 12) hour += 12
  if (meridiem === "AM" && hour === 12) hour = 24 // midnight sits after 11 PM in nightly schedule
  return hour * 60 + minute
}

type ScrimLike = {
  startTime?: string | null
  maxTeams?: number | null
  entryFeeBdt?: number | null
  prizePoolBdt?: number | null
}

export function buildShowcaseSummary(
  scrims: ScrimLike[],
  settings?: PublicSiteSettings
): LiveShowcaseSummary {
  const activeScrimCount = scrims.length
  const totalTeamSlots = scrims.reduce((acc, s) => acc + (s.maxTeams || 12), 0)
  const maxTeamsPerLobby =
    scrims.length > 0 ? Math.max(...scrims.map((s) => s.maxTeams || 12)) : 12

  const entryFees = scrims
    .map((s) => s.entryFeeBdt)
    .filter((v): v is number => typeof v === "number" && v > 0)
  const prizePools = scrims
    .map((s) => s.prizePoolBdt)
    .filter((v): v is number => typeof v === "number" && v > 0)

  const minEntryFeeBdt = entryFees.length > 0 ? Math.min(...entryFees) : null
  const maxEntryFeeBdt = entryFees.length > 0 ? Math.max(...entryFees) : null
  const minPrizePoolBdt = prizePools.length > 0 ? Math.min(...prizePools) : null
  const maxPrizePoolBdt = prizePools.length > 0 ? Math.max(...prizePools) : null
  const totalPrizePoolBdt = prizePools.reduce((a, b) => a + b, 0)

  // Derive live schedule time window from active scrims unless overridden by Admin Settings
  let derivedWindow = ""
  const uniqueTimes = Array.from(
    new Set(scrims.map((s) => (s.startTime || "").trim()).filter(Boolean))
  ).sort((a, b) => parseTimeSortMinutes(a) - parseTimeSortMinutes(b))

  if (uniqueTimes.length === 1) {
    derivedWindow = uniqueTimes[0]
  } else if (uniqueTimes.length > 1) {
    derivedWindow = `${uniqueTimes[0]} – ${uniqueTimes[uniqueTimes.length - 1]}`
  }

  const timeWindow = settings?.showcaseTimeWindow || derivedWindow
  const formatLabel =
    settings?.showcaseFormatLabel ||
    "Competitive squad lobbies across official Free Fire maps"
  const payoutSla = settings?.showcasePayoutSla || "Fast verified prize payouts"
  const highlightNote = settings?.showcaseHighlightNote || ""

  const lobbyHighlight =
    activeScrimCount > 0
      ? timeWindow
        ? `${activeScrimCount} active ${activeScrimCount === 1 ? "lobby" : "lobbies"} live today (${timeWindow})`
        : `${activeScrimCount} active Free Fire ${activeScrimCount === 1 ? "lobby" : "lobbies"} open today`
      : "Live Free Fire scrim lobbies managed daily by RushX admins"

  const feePrizeHighlight =
    minEntryFeeBdt !== null && maxPrizePoolBdt !== null
      ? `Entries from ৳${minEntryFeeBdt} · Prize pools up to ৳${maxPrizePoolBdt.toLocaleString()}`
      : "Instant automated checkout via bKash, Nagad, Rocket & Wallet"

  const authHighlights = [
    highlightNote || lobbyHighlight,
    feePrizeHighlight,
    "Room ID & password delivered before match start in your Dashboard",
    payoutSla,
  ]

  return {
    activeScrimCount,
    totalTeamSlots,
    maxTeamsPerLobby,
    minEntryFeeBdt,
    maxEntryFeeBdt,
    minPrizePoolBdt,
    maxPrizePoolBdt,
    totalPrizePoolBdt,
    timeWindow,
    formatLabel,
    payoutSla,
    highlightNote,
    authHighlights,
  }
}

export async function getLiveShowcaseSummary(): Promise<LiveShowcaseSummary> {
  const [scrims, siteSettings] = await Promise.all([
    getActiveScrims().catch(() => []),
    getPublicSiteSettings().catch(() => undefined),
  ])
  return buildShowcaseSummary(scrims, siteSettings)
}
