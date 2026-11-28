import "server-only"

import { db, ensureSchemaReady } from "@/lib/db"
import { scrims, bookings, settings } from "@/lib/db/schema"
import { and, or, eq, ne, lt, gte, sql, asc, desc } from "drizzle-orm"
import { scrimStartDate, sortScrimsAscending } from "@/lib/format"
import { getRandomScrimImage, SCRIM_BACKGROUND_IMAGES } from "@/lib/scrim-images"
import { computeIcebergDisplayCount } from "@/lib/iceberg"
import {
  buildAllStandardScrimDefinitions,
  buildMultipliedDailyDefinitions,
  buildMultipliedFridayDefinitions,
  findStandardScrimDefinition,
  getScrimRoomNumber,
  parseRoomMultiplier,
  parseRoomTierOverrides,
  type RoomTierOverrides,
  type StandardScrimDef,
} from "@/lib/room-multiplier"
import {
  evaluateScheduleOverride,
  parseScheduleOverrideConfig,
  type EvaluatedScheduleOverride,
  type ScheduleOverrideConfig,
} from "@/lib/schedule-override"
export { getRandomScrimImage, SCRIM_BACKGROUND_IMAGES }

export type ScrimWithSlots = typeof scrims.$inferSelect & {
  confirmedTeams: number
  publicConfirmedTeams?: number
}

export function getBangladeshActiveDate(): string {
  const now = new Date()
  const dhakaFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  })
  const parts = dhakaFormatter.formatToParts(now)
  let year = "", month = "", day = "", hour = 0
  for (const part of parts) {
    if (part.type === "year") year = part.value
    if (part.type === "month") month = part.value
    if (part.type === "day") day = part.value
    if (part.type === "hour") hour = Number.parseInt(part.value, 10)
  }
  const dateObj = new Date(Date.UTC(Number.parseInt(year, 10), Number.parseInt(month, 10) - 1, Number.parseInt(day, 10)))
  if (hour < 1) {
    dateObj.setUTCDate(dateObj.getUTCDate() - 1)
  }
  return dateObj.toISOString().slice(0, 10)
}

export function isFridayBD(): boolean {
  try {
    const now = new Date()
    const dhakaFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Dhaka",
      weekday: "long",
    })
    return dhakaFormatter.format(now).toLowerCase() === "friday"
  } catch {
    return new Date().getDay() === 5
  }
}

let lastArchivedDate: string | null = null
let lastArchivedAtMs = 0
const ARCHIVE_THROTTLE_MS = 5 * 60 * 1000

export async function archivePreviousDayBookings(force = false): Promise<number> {
  try {
    const activeDate = getBangladeshActiveDate()
    const nowMs = Date.now()
    if (!force && lastArchivedDate === activeDate && nowMs - lastArchivedAtMs < ARCHIVE_THROTTLE_MS) {
      return 0
    }
    lastArchivedDate = activeDate
    lastArchivedAtMs = nowMs

    // 1. Recover any confirmed, non-trashed active/future-date bookings that may have been prematurely archived
    await db
      .update(bookings)
      .set({
        isArchived: false,
        archivedAt: null,
      })
      .where(
        and(
          eq(bookings.isArchived, true),
          eq(bookings.isTrashed, false),
          eq(bookings.status, "confirmed"),
          gte(bookings.scrimDate, activeDate)
        )
      )

    // 2. Backfill and archive bookings strictly from previous days so they are preserved in historical archive
    await db
      .update(bookings)
      .set({
        isArchived: true,
        archivedAt: new Date(),
        scrimDate: sql`COALESCE(${bookings.scrimDate}, (((${bookings.createdAt} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dhaka')::date)::text)`,
      })
      .where(
        and(
          eq(bookings.isArchived, false),
          or(
            lt(bookings.scrimDate, activeDate),
            and(
              sql`${bookings.scrimDate} IS NULL`,
              sql`(((${bookings.createdAt} AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dhaka')::date)::text < ${activeDate}`
            )
          )
        )
      )

    // 3. Synchronize recurring daily scrims in DB whose date is from yesterday
    await db
      .update(scrims)
      .set({
        scrimDate: activeDate,
        status: "upcoming",
        registrationOpen: true,
        roomPublished: false,
        roomId: null,
        roomPassword: null,
        icebergStartRealCount: 0,
        icebergShowAllFilled: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          or(lt(scrims.scrimDate, activeDate), sql`${scrims.scrimDate} IS NULL`),
          ne(scrims.status, "deleted"),
          ne(scrims.status, "permanently_deleted"),
          eq(scrims.isTrashed, false)
        )
      )

    return 1
  } catch (err) {
    lastArchivedAtMs = 0
    console.warn("[Queries] Auto-archive previous day bookings error:", err)
    return 0
  }
}

const confirmedCount = sql<number>`0`.as("confirmedTeams")

function sortByStartTime(list: ScrimWithSlots[]): ScrimWithSlots[] {
  return sortScrimsAscending(list)
}

export const DAILY_SCRIM_DEFINITIONS = [
  { id: "scrim-3pm-r1", time: "3:00 PM", name: "3 PM SCRIM ROOM 1", slug: "3-pm-scrim-room-1", map: "Bermuda", isRoom2: false, priceBdt: 35, prizePoolBdt: 330, category: "Daily Scrims", bannerUrl: "/images/scrim-1.jpg" },
  { id: "scrim-3pm-r2", time: "3:00 PM", name: "3 PM SCRIM ROOM 2", slug: "3-pm-scrim-room-2", map: "Purgatory", isRoom2: true, priceBdt: 35, prizePoolBdt: 330, category: "Daily Scrims", bannerUrl: "/images/scrim-2.jpg" },
  { id: "scrim-4pm-r1", time: "4:00 PM", name: "4 PM SCRIM ROOM 1", slug: "4-pm-scrim-room-1", map: "Kalahari", isRoom2: false, priceBdt: 35, prizePoolBdt: 330, category: "Daily Scrims", bannerUrl: "/images/scrim-3.jpg" },
  { id: "scrim-4pm-r2", time: "4:00 PM", name: "4 PM SCRIM ROOM 2", slug: "4-pm-scrim-room-2", map: "Bermuda", isRoom2: true, priceBdt: 35, prizePoolBdt: 330, category: "Daily Scrims", bannerUrl: "/images/scrim-4.jpg" },
  { id: "scrim-5pm-r1", time: "5:00 PM", name: "5 PM SCRIM ROOM 1", slug: "5-pm-scrim-room-1", map: "Purgatory", isRoom2: false, priceBdt: 35, prizePoolBdt: 330, category: "Daily Scrims", bannerUrl: "/images/scrim-5.jpg" },
  { id: "scrim-5pm-r2", time: "5:00 PM", name: "5 PM SCRIM ROOM 2", slug: "5-pm-scrim-room-2", map: "Kalahari", isRoom2: true, priceBdt: 35, prizePoolBdt: 330, category: "Daily Scrims", bannerUrl: "/images/scrim-6.jpg" },
  { id: "scrim-7pm-r1", time: "7:00 PM", name: "7 PM SCRIM ROOM 1", slug: "7-pm-scrim-room-1", map: "Bermuda", isRoom2: false, priceBdt: 35, prizePoolBdt: 330, category: "Daily Scrims", bannerUrl: "/images/scrim-7.jpg" },
  { id: "scrim-7pm-r2", time: "7:00 PM", name: "7 PM SCRIM ROOM 2", slug: "7-pm-scrim-room-2", map: "Purgatory", isRoom2: true, priceBdt: 35, prizePoolBdt: 330, category: "Daily Scrims", bannerUrl: "/images/scrim-8.jpg" },
  { id: "scrim-8pm-r1", time: "8:00 PM", name: "8 PM SCRIM ROOM 1", slug: "8-pm-scrim-room-1", map: "Kalahari", isRoom2: false, priceBdt: 35, prizePoolBdt: 330, category: "Daily Scrims", bannerUrl: "/images/scrim-9.jpg" },
  { id: "scrim-8pm-r2", time: "8:00 PM", name: "8 PM SCRIM ROOM 2", slug: "8-pm-scrim-room-2", map: "Bermuda", isRoom2: true, priceBdt: 35, prizePoolBdt: 330, category: "Daily Scrims", bannerUrl: "/images/scrim-10.jpg" },
  { id: "scrim-9pm-r1", time: "9:00 PM", name: "9 PM SCRIM ROOM 1", slug: "9-pm-scrim-room-1", map: "Purgatory", isRoom2: false, priceBdt: 35, prizePoolBdt: 330, category: "Daily Scrims", bannerUrl: "/images/scrim-11.jpg" },
  { id: "scrim-9pm-r2", time: "9:00 PM", name: "9 PM SCRIM ROOM 2", slug: "9-pm-scrim-room-2", map: "Kalahari", isRoom2: true, priceBdt: 35, prizePoolBdt: 330, category: "Daily Scrims", bannerUrl: "/images/scrim-12.jpg" },
  { id: "scrim-10pm-r1", time: "10:00 PM", name: "10 PM SCRIM ROOM 1", slug: "10-pm-scrim-room-1", map: "Bermuda", isRoom2: false, priceBdt: 35, prizePoolBdt: 330, category: "Daily Scrims", bannerUrl: "/images/bermuda.jpg" },
  { id: "scrim-10pm-r2", time: "10:00 PM", name: "10 PM SCRIM ROOM 2", slug: "10-pm-scrim-room-2", map: "Purgatory", isRoom2: true, priceBdt: 35, prizePoolBdt: 330, category: "Daily Scrims", bannerUrl: "/images/purgatory.jpg" },
  { id: "scrim-11pm-r1", time: "11:00 PM", name: "11 PM SCRIM ROOM 1", slug: "11-pm-scrim-room-1", map: "Kalahari", isRoom2: false, priceBdt: 35, prizePoolBdt: 330, category: "Daily Scrims", bannerUrl: "/images/kalahari.jpg" },
  { id: "scrim-11pm-r2", time: "11:00 PM", name: "11 PM SCRIM ROOM 2", slug: "11-pm-scrim-room-2", map: "Bermuda", isRoom2: true, priceBdt: 35, prizePoolBdt: 330, category: "Daily Scrims", bannerUrl: "/images/nexterra.jpg" },
  { id: "scrim-12am-r1", time: "12:00 AM", name: "12 AM SCRIM ROOM 1", slug: "12-am-scrim-room-1", map: "Purgatory", isRoom2: false, priceBdt: 35, prizePoolBdt: 330, category: "Daily Scrims", bannerUrl: "/images/alpine.jpg" },
  { id: "scrim-12am-r2", time: "12:00 AM", name: "12 AM SCRIM ROOM 2", slug: "12-am-scrim-room-2", map: "Kalahari", isRoom2: true, priceBdt: 35, prizePoolBdt: 330, category: "Daily Scrims", bannerUrl: "/images/scrim_squad_clash_1786956645507.jpg" },
]

export const FRIDAY_SPECIAL_BLAST_DEFINITIONS = [
  { id: "scrim-fri-3pm", time: "3:00 PM", name: "3 PM Friday Special Blast", slug: "3-pm-friday-special-blast", map: "5 Matches (Bermuda, Purgatory, Kalahari, Solana, Nexterra)", isRoom2: false, priceBdt: 80, prizePoolBdt: 850, category: "Friday Special Blast", matchCount: 5, bannerUrl: "/images/scrim-2.jpg" },
  { id: "scrim-fri-5pm", time: "5:00 PM", name: "5 PM Friday Special Blast", slug: "5-pm-friday-special-blast", map: "5 Matches (Bermuda, Purgatory, Kalahari, Solana, Nexterra)", isRoom2: false, priceBdt: 80, prizePoolBdt: 850, category: "Friday Special Blast", matchCount: 5, bannerUrl: "/images/scrim-4.jpg" },
  { id: "scrim-fri-7pm", time: "7:00 PM", name: "7 PM Friday Special Blast", slug: "7-pm-friday-special-blast", map: "5 Matches (Bermuda, Purgatory, Kalahari, Solana, Nexterra)", isRoom2: false, priceBdt: 80, prizePoolBdt: 850, category: "Friday Special Blast", matchCount: 5, bannerUrl: "/images/scrim-6.jpg" },
  { id: "scrim-fri-9pm", time: "9:00 PM", name: "9 PM Friday Special Blast", slug: "9-pm-friday-special-blast", map: "5 Matches (Bermuda, Purgatory, Kalahari, Solana, Nexterra)", isRoom2: false, priceBdt: 80, prizePoolBdt: 850, category: "Friday Special Blast", matchCount: 5, bannerUrl: "/images/scrim-8.jpg" },
  { id: "scrim-fri-11pm", time: "11:00 PM", name: "11 PM Friday Special Blast", slug: "11-pm-friday-special-blast", map: "5 Matches (Bermuda, Purgatory, Kalahari, Solana, Nexterra)", isRoom2: false, priceBdt: 80, prizePoolBdt: 850, category: "Friday Special Blast", matchCount: 5, bannerUrl: "/images/scrim-10.jpg" },
]

export const CHAMPION_RUSH_DEFINITIONS = [
  { id: "scrim-fri-3pm-cr", time: "3:00 PM", name: "3 PM Champion Rush", slug: "3-pm-champion-rush", map: "Champion Mode (Max 8 Matches)", isRoom2: false, priceBdt: 50, prizePoolBdt: 480, category: "3 PM Champion Rush", matchCount: 8, bannerUrl: "/images/scrim_cyber_arena_1786956594944.jpg" },
  { id: "scrim-fri-10pm-cr", time: "10:00 PM", name: "10 PM Champion Rush", slug: "10-pm-champion-rush", map: "Champion Mode (Max 8 Matches)", isRoom2: false, priceBdt: 50, prizePoolBdt: 480, category: "10 PM Champion Rush", matchCount: 8, bannerUrl: "/images/sakura-wallpaper.jpg" },
]

export const FRIDAY_SCRIM_DEFINITIONS = [
  ...FRIDAY_SPECIAL_BLAST_DEFINITIONS,
  ...CHAMPION_RUSH_DEFINITIONS,
]

export const ALL_STANDARD_SCRIM_DEFINITIONS = [
  ...DAILY_SCRIM_DEFINITIONS,
  ...FRIDAY_SPECIAL_BLAST_DEFINITIONS,
  ...CHAMPION_RUSH_DEFINITIONS,
]

export async function getRoomMultiplier(): Promise<number> {
  try {
    const rows = await db
      .select({ key: settings.key, value: settings.value })
      .from(settings)
      .where(or(eq(settings.key, "room_multiplier"), eq(settings.key, "show_room2")))
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
    return parseRoomMultiplier(map.room_multiplier, map.show_room2)
  } catch {
    return 1
  }
}

export async function getRoomTierOverrides(): Promise<RoomTierOverrides> {
  try {
    const rows = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, "room_tier_overrides"))
      .limit(1)
    return parseRoomTierOverrides(rows[0]?.value)
  } catch {
    return {}
  }
}

export async function getScheduleOverrideConfig(): Promise<ScheduleOverrideConfig> {
  try {
    const rows = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, "schedule_override_config"))
      .limit(1)
    return parseScheduleOverrideConfig(rows[0]?.value)
  } catch {
    return parseScheduleOverrideConfig(null)
  }
}

export async function getEvaluatedScheduleOverride(): Promise<{
  config: ScheduleOverrideConfig
  status: EvaluatedScheduleOverride
}> {
  const activeDate = getBangladeshActiveDate()
  const config = await getScheduleOverrideConfig()
  const status = evaluateScheduleOverride(config, activeDate)
  return { config, status }
}

export async function isFridayScrimsActive(): Promise<boolean> {
  try {
    const rows = await db
      .select({ key: settings.key, value: settings.value })
      .from(settings)
      .where(or(eq(settings.key, "friday_scrims_override"), eq(settings.key, "schedule_override_config")))
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
    if (map.friday_scrims_override === "force_on") return true
    if (map.friday_scrims_override === "force_off") return false

    if (map.schedule_override_config) {
      const evalStatus = evaluateScheduleOverride(
        parseScheduleOverrideConfig(map.schedule_override_config),
        getBangladeshActiveDate()
      )
      if (evalStatus.isRegWindowActive && evalStatus.targetIsFriday !== null) {
        return evalStatus.targetIsFriday
      }
    }
  } catch {}
  return isFridayBD()
}

export function getActiveDefinitionsSync(): typeof DAILY_SCRIM_DEFINITIONS {
  return isFridayBD() ? (FRIDAY_SCRIM_DEFINITIONS as any) : DAILY_SCRIM_DEFINITIONS
}

export async function getActiveDefinitions(): Promise<StandardScrimDef[]> {
  const [isFriday, multiplier] = await Promise.all([isFridayScrimsActive(), getRoomMultiplier()])
  return isFriday
    ? buildMultipliedFridayDefinitions(multiplier)
    : buildMultipliedDailyDefinitions(multiplier)
}

function buildSampleScrimFromDef(
  def: StandardScrimDef,
  idx: number,
  scrimDate: string
): ScrimWithSlots {
  const isCR =
    def.scheduleType === "champion_rush" ||
    def.id.includes("-cr") ||
    def.slug.includes("champion-rush") ||
    def.name.toLowerCase().includes("champion rush")
  const isBlast = def.scheduleType === "friday_blast" || def.category === "Friday Special Blast"

  return {
    id: def.id,
    title: def.name,
    slug: def.slug,
    description: isCR
      ? `${def.time} Champion Rush Tournament: Free Fire squad survival championship format.`
      : isBlast
        ? `Friday Special Blast (${def.name}) — 5 competitive matches (Bermuda, Purgatory, Kalahari, Solana, and Nexterra).`
        : `Competitive Free Fire squad scrim lobby (${def.name}).`,
    rules: isCR
      ? "1. BATTLE ROYALE format — Maximum 8 matches will occur. Not more than that.\n2. 80 Points Unlock: The team which collects 80 points can unlock the Champion Rush format.\n3. Champion Decider: Once Champion Rush format is unlocked, if any of the teams that unlocked the Champion Rush format gets a BOOYAH, the scrim will finish there and that team will be Champion.\n4. If 8 matches conclude without a Booyah by an unlocked team, the team with the highest overall points wins.\n5. Join room on time. Emulators are strictly prohibited.\n6. If you want to submit a hacker report, you have to submit it within 1 hour after the match gets completed.\n7. Please note that a 5.00 BDT fee will be deducted from the final prize payout to cover transfer charges."
      : isBlast
        ? "1. 5 Matches (Bermuda, Purgatory, Kalahari, Solana, and Nexterra).\n2. BATTLE ROYALE squad mode (12 Teams).\n3. No emulators allowed.\n4. Join room 10-15 minutes prior to match start.\n5. If you want to submit a hacker report, you have to submit it within 1 hour after the match gets completed.\n6. Please note that a 5.00 BDT fee will be deducted from the final prize payout to cover transfer charges."
        : "1. 3 Matches (BERMUDA, PURGATORY & KALAHARI).\n2. BATTLE ROYALE squad mode (12 Teams).\n3. No emulators allowed.\n4. Join room 10-15 minutes prior to match start.\n5. If you want to submit a hacker report, you have to submit it within 1 hour after the match gets completed.\n6. Please note that a 5.00 BDT fee will be deducted from the final prize payout to cover transfer charges.",
    notes: isCR
      ? "RULES: MAX 8 MATCHES WILL OCCUR. NOT MORE THAT THAT. THE TEAM WHICH WOULD COLLECT 80 PTS CAN UNLOCK THE CHAMPION RUSH FORMAT, THEN IF ANY OF THE TEAMS THAT UNLOCKED THE CHAMPION RUSH FORMAT GETS A BOOYAH, THE SCRIM WILL FINISH THERE AND THAT TEAM WILL BE CHAMPION. Prize distributed to captain's digital wallet within 6 hours of result publication (Maximum 24 hours)."
      : isBlast
        ? "5 Matches Tournament (Bermuda, Purgatory, Kalahari, Solana, and Nexterra). Prize distributed to captain's digital wallet within 6 hours of result publication (Maximum 24 hours). Receive payment within 6 hours (সর্বোচ্চ ২৪ ঘণ্টা)।"
        : "Prize distributed to captain's digital wallet within 6 hours of result publication (Maximum 24 hours). Receive payment within 6 hours (সর্বোচ্চ ২৪ ঘণ্টা)।",
    map: def.map,
    mode: "BATTLE ROYALE",
    startTime: def.time,
    scrimDate,
    category: def.category || null,
    priceBdt: def.priceBdt,
    prizePoolBdt: def.prizePoolBdt,
    maxTeams: 12,
    bannerUrl: def.bannerUrl || getRandomScrimImage(idx),
    roomId: null,
    roomPassword: null,
    roomPublished: false,
    registrationOpen: true,
    status: "upcoming",
    createdAt: new Date(),
    updatedAt: new Date(),
    confirmedTeams: 0,
    publicConfirmedTeams: 0,
    hidden: false,
    icebergEnabled: false,
    icebergShowAllFilled: false,
    icebergAmount: 7,
    icebergThreshold: 3,
    icebergStartRealCount: 0,
    isTrashed: false,
    deletedAt: null,
  }
}

export function getAllSampleScrims(multiplier = 2): ScrimWithSlots[] {
  const activeDate = getBangladeshActiveDate()
  return buildAllStandardScrimDefinitions(multiplier).map((def, idx) =>
    buildSampleScrimFromDef(def, idx, activeDate)
  )
}

function getSampleScrims(
  isFriday: boolean = false,
  multiplier: number = 1,
  effectiveDate?: string
): ScrimWithSlots[] {
  const scrimDate = effectiveDate || getBangladeshActiveDate()
  const defs = isFriday
    ? buildMultipliedFridayDefinitions(multiplier)
    : buildMultipliedDailyDefinitions(multiplier)
  return defs.map((def, idx) => buildSampleScrimFromDef(def, idx, scrimDate))
}

export function appendGlobalScrimRules(rules: string): string {
  const HACKER_RULE = "If you want to submit a hacker report, you have to submit it within 1 hour after the match gets completed."
  const PRIZE_FEE_RULE = "Please note that a 5.00 BDT fee will be deducted from the final prize payout to cover transfer charges."

  const lines = rules
    .split("\n")
    .map((r) => r.trim())
    .filter(Boolean)
    .filter(
      (r) =>
        !r.toLowerCase().includes("hacker report") &&
        !r.toLowerCase().includes("5.00 bdt fee") &&
        !r.toLowerCase().includes("final prize payout")
    )

  const renumbered = lines.map((r, i) => `${i + 1}. ${r.replace(/^\d+\.\s*/, "")}`)
  renumbered.push(`${lines.length + 1}. ${HACKER_RULE}`)
  renumbered.push(`${lines.length + 2}. ${PRIZE_FEE_RULE}`)
  return renumbered.join("\n")
}

function normalizeScrim(
  s: ScrimWithSlots,
  isFriday: boolean = false,
  opts?: {
    roomTierOverrides?: RoomTierOverrides
    scheduleEval?: EvaluatedScheduleOverride
  }
): ScrimWithSlots {
  const match = findStandardScrimDefinition(s.id) || findStandardScrimDefinition(s.slug)
  const activeDate = getBangladeshActiveDate()
  const confirmed = s.confirmedTeams ?? 0
  const isFull = confirmed >= (s.maxTeams || 12)

  // On a new active date, automatically reset yesterday's completed or closed statuses to fresh upcoming
  const isNewDay = !s.scrimDate || s.scrimDate < activeDate
  const baseEffectiveDate = s.scrimDate && s.scrimDate > activeDate ? s.scrimDate : activeDate
  const scheduleEval = opts?.scheduleEval
  const effectiveDate = scheduleEval?.isRegWindowActive
    ? scheduleEval.effectiveScrimDate
    : baseEffectiveDate

  const baseStatus = isNewDay && (s.status === "completed" || s.status === "registration_closed")
    ? "upcoming"
    : s.status
  const baseRegOpen = isNewDay ? true : s.registrationOpen

  // Apply per-room tier override (Force Turn On / Force Turn Off / Normal Mode)
  const roomNum = getScrimRoomNumber(s)
  const tierMode = opts?.roomTierOverrides?.[String(roomNum)] || "normal"

  const isIndividuallyForcedOpen = baseStatus === "force_open" || baseStatus === "force_turn_on"
  const isForcedOpen =
    baseStatus !== "not_hosted" &&
    baseStatus !== "completed" &&
    (isIndividuallyForcedOpen || (tierMode === "force_on" && baseStatus !== "registration_closed"))
  const isTierForcedOff =
    tierMode === "force_off" && !isIndividuallyForcedOpen && baseStatus !== "not_hosted" && baseStatus !== "completed"
  const isShutdownBlocked =
    Boolean(scheduleEval?.isShutdownActive) && !isForcedOpen && baseStatus !== "not_hosted" && baseStatus !== "completed"

  // Check if start time is passed for effective scrim date (ignored when admin enables Force Turn On or when advance registration window targets a future date)
  const effectiveStartTime = s.startTime?.trim() || match?.time || "7:00 PM"
  const startDate = scrimStartDate(effectiveDate, effectiveStartTime)
  const isTimePassed = new Date().getTime() >= startDate.getTime()

  const isClosed = isForcedOpen
    ? isFull
    : (isShutdownBlocked || isTierForcedOff || !baseRegOpen || isFull || isTimePassed || baseStatus === "registration_closed" || baseStatus === "completed" || baseStatus === "not_hosted")

  const isCustomUploaded = Boolean(
    s.bannerUrl &&
    (s.bannerUrl.startsWith("http") || s.bannerUrl.includes("/uploads/") || s.bannerUrl.includes("res.cloudinary.com"))
  )
  const bannerFallback = match?.bannerUrl || getRandomScrimImage(s.slug || s.id || s.title || "scrim")

  const chosenBanner = isCustomUploaded
    ? s.bannerUrl!
    : (match?.bannerUrl || (s.bannerUrl && !s.bannerUrl.includes("map-") ? s.bannerUrl : bannerFallback))

  const isCR =
    s.id?.includes("-cr") ||
    s.slug?.includes("champion-rush") ||
    s.title?.toLowerCase().includes("champion rush") ||
    (s.category || "").toLowerCase().includes("champion rush")
  const isFridayCat =
    (s.category || "").toLowerCase().includes("friday") || match?.category === "Friday Special Blast"

  // Sanitize title if Champion Rush leaked onto standard scrims
  let title = s.title && !s.title.startsWith("scrim-") ? s.title : match?.name || s.title
  if (!isCR && title && title.toLowerCase().includes("champion rush")) {
    title = match ? match.name : title.replace(/champion rush/gi, "Scrim")
  }

  // Sanitize description if Champion Rush leaked
  let description = s.description
  if (!isCR && (!description || description.toLowerCase().includes("champion rush") || description.toLowerCase().includes("survival championship"))) {
    description = isFridayCat
      ? `Friday Scrims (${title}) — ${s.map || "Bermuda, Purgatory, Kalahari, Solara, NeXTerra"}.`
      : `Competitive Free Fire squad scrim lobby (${title}).`
  }

  // Sanitize rules if Champion Rush leaked
  let rules = s.rules
  if (!isCR && (!rules || rules.toLowerCase().includes("champion rush") || rules.toLowerCase().includes("80 points"))) {
    rules = isFridayCat
      ? `1. Maps: ${s.map || "Bermuda, Purgatory, Kalahari, Solara, NeXTerra"}.\n2. BATTLE ROYALE squad mode (${s.maxTeams || 12} Teams).\n3. No emulators allowed.\n4. Join room 10-15 minutes prior to match start.\n5. If you want to submit a hacker report, you have to submit it within 1 hour after the match gets completed.\n6. Please note that a 5.00 BDT fee will be deducted from the final prize payout to cover transfer charges.`
      : `1. Maps: ${s.map || "Bermuda, Purgatory & Kalahari"}.\n2. BATTLE ROYALE squad mode (${s.maxTeams || 12} Teams).\n3. No emulators allowed.\n4. Join room 10-15 minutes prior to match start.\n5. If you want to submit a hacker report, you have to submit it within 1 hour after the match gets completed.\n6. Please note that a 5.00 BDT fee will be deducted from the final prize payout to cover transfer charges.`
  } else if (rules) {
    rules = appendGlobalScrimRules(rules)
  }

  // Sanitize notes
  let notes = s.notes
  if (!isCR && (!notes || notes.toLowerCase().includes("champion rush") || notes.toLowerCase().includes("80 pts"))) {
    notes = isFridayCat
      ? `Friday Scrims Tournament (${s.map || "5 Matches"}). Prize distributed to captain's digital wallet within 6 hours of result publication (Maximum 24 hours). Receive payment within 6 hours (সর্বোচ্চ ২৪ ঘণ্টা)।`
      : "Prize distributed to captain's digital wallet within 6 hours of result publication (Maximum 24 hours). Receive payment within 6 hours (সর্বোচ্চ ২৪ ঘণ্টা)।"
  }

  const finalStatus =
    baseStatus === "not_hosted"
      ? "not_hosted"
      : isForcedOpen
      ? "force_open"
      : (isShutdownBlocked || isTierForcedOff || (isClosed && baseStatus === "upcoming"))
      ? "registration_closed"
      : baseStatus
  const finalRegOpen = baseStatus === "not_hosted" ? false : isForcedOpen ? !isFull : !isClosed

  const publicConfirmedTeams = computeIcebergDisplayCount({
    realConfirmed: confirmed,
    maxTeams: s.maxTeams || 12,
    icebergEnabled: Boolean(s.icebergEnabled) && !isFull,
    icebergShowAllFilled: Boolean(s.icebergShowAllFilled) && !isFull,
    icebergAmount: Number(s.icebergAmount ?? 7),
    icebergThreshold: Number(s.icebergThreshold ?? 3),
    icebergStartRealCount: Number(s.icebergStartRealCount ?? 0),
  })

  // Always preserve admin-saved DB values (including 0 BDT for free/giveaway scrims!)
  const resolvedPrice =
    typeof s.priceBdt === "number" && Number.isFinite(s.priceBdt) && s.priceBdt >= 0
      ? s.priceBdt
      : (match?.priceBdt ?? (isCR ? 50 : 35))
  const resolvedPrize =
    typeof s.prizePoolBdt === "number" && Number.isFinite(s.prizePoolBdt) && s.prizePoolBdt >= 0
      ? s.prizePoolBdt
      : (match?.prizePoolBdt ?? (isCR ? 480 : 330))
  const resolvedCategory = s.category?.trim() || match?.category || (isCR ? "Champion Rush" : "Daily Scrims")

  return {
    ...s,
    roomId: null,
    roomPassword: null,
    title,
    description,
    rules,
    notes,
    category: resolvedCategory,
    mode: s.mode?.trim() || "BATTLE ROYALE",
    startTime: effectiveStartTime,
    scrimDate: effectiveDate,
    priceBdt: resolvedPrice,
    prizePoolBdt: resolvedPrize,
    bannerUrl: chosenBanner,
    registrationOpen: finalRegOpen,
    status: finalStatus,
    publicConfirmedTeams,
  }
}

/** Check if Room 2+ should be visible publicly (backwards-compatible wrapper over roomMultiplier) */
export async function isRoom2Enabled(): Promise<boolean> {
  const mult = await getRoomMultiplier()
  return mult >= 2
}

export function isFridayTournament(s: { id?: string; slug?: string; title?: string; category?: string | null; map?: string; scrimDate?: string }): boolean {
  if (!s) return false
  const cat = (s.category || "").trim().toLowerCase()
  if (cat === "daily scrims") return false
  if (cat === "friday scrims" || cat === "friday special blast" || cat.includes("friday") || cat.includes("champion rush")) return true
  if (s.id?.startsWith("scrim-fri-") || s.id?.includes("-cr")) return true
  if (s.slug?.includes("friday") || s.slug?.includes("champion-rush")) return true
  if (s.title?.toLowerCase().includes("friday") || s.title?.toLowerCase().includes("champion rush")) return true
  if (s.map?.toLowerCase().includes("champion mode")) return true
  return false
}

export function isDailyWeekdayScrim(s: { id?: string; slug?: string; title?: string; category?: string | null }): boolean {
  if (!s) return false
  const cat = (s.category || "").trim().toLowerCase()
  if (cat.includes("friday") || cat.includes("champion rush")) return false
  if (cat === "daily scrims") return true
  if (DAILY_SCRIM_DEFINITIONS.some((d) => d.id === s.id || d.slug === s.slug)) return true
  if (/\bscrim\s+room\s+\d+\b/i.test(s.title || "")) return true
  return false
}

/** All active scrims with confirmed team counts, ordered by start time. Respects Room Multiplier (Daily & Friday), Room Tier Overrides, and Schedule Shutdown / Target-Date Registration Window. */
export async function getActiveScrims(includeRoom2Override?: boolean, includeHidden?: boolean): Promise<ScrimWithSlots[]> {
  await ensureSchemaReady()
  // Synchronize past days and archive previous bookings before loading scrims
  await archivePreviousDayBookings().catch(() => {})

  const [isFriday, configuredMultiplier, roomTierOverrides, scheduleOverride] = await Promise.all([
    isFridayScrimsActive(),
    getRoomMultiplier(),
    getRoomTierOverrides(),
    getScheduleOverrideConfig(),
  ])

  const activeDate = getBangladeshActiveDate()
  const scheduleEval = evaluateScheduleOverride(scheduleOverride, activeDate)
  const effectiveMultiplier = includeRoom2Override === true
    ? Math.max(2, configuredMultiplier)
    : includeRoom2Override === false
      ? 1
      : configuredMultiplier

  const samples = getSampleScrims(isFriday, effectiveMultiplier, scheduleEval.effectiveScrimDate).map((sample) =>
    normalizeScrim(sample, isFriday, { roomTierOverrides, scheduleEval })
  )

  let dbRows: ScrimWithSlots[] = []
  try {
    const rows = await db
      .select({ scrim: scrims, confirmedTeams: confirmedCount })
      .from(scrims)
      .orderBy(asc(scrims.scrimDate))
    dbRows = rows.map((r) =>
      normalizeScrim({ ...r.scrim, confirmedTeams: r.confirmedTeams }, isFriday, {
        roomTierOverrides,
        scheduleEval,
      })
    )
  } catch (err) {
    console.warn("[Queries] Database error fetching active scrims:", err)
    dbRows = []
  }

  // Combine active DB scrims + active sample definitions matching the current day schedule
  const allScrims: ScrimWithSlots[] = []

  // Fetch permanently deleted IDs stored in settings tombstones
  let permanentlyDeletedIds = new Set<string>()
  try {
    const deletedSettings = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, "permanently_deleted_scrims"))
      .limit(1)
    if (deletedSettings[0]?.value) {
      permanentlyDeletedIds = new Set<string>(JSON.parse(deletedSettings[0].value))
    }
  } catch {
    // ignore
  }

  // 1. Add DB rows matching current day schedule and active status
  for (const row of dbRows) {
    if (
      row.status === "deleted" ||
      row.status === "permanently_deleted" ||
      row.deletedAt !== null ||
      row.isTrashed === true ||
      permanentlyDeletedIds.has(row.id) ||
      (row.slug && permanentlyDeletedIds.has(row.slug))
    ) {
      continue
    }

    const isFriTourney = isFridayTournament(row)
    const isDaily = isDailyWeekdayScrim(row)

    // On Friday: strictly include Friday tournaments, exclude standard daily weekday scrims
    if (isFriday) {
      if (isDaily && !isFriTourney) {
        continue
      }
      allScrims.push(row)
    } else {
      // On Non-Friday (Saturday - Thursday): strictly exclude Friday tournaments
      if (isFriTourney) {
        continue
      }
      allScrims.push(row)
    }
  }

  // 2. Add sample definitions that are not already in allScrims
  for (const sample of samples) {
    const alreadyPresent = allScrims.some(
      (item) => item.id === sample.id || item.slug === sample.slug
    )
    const wasDeletedInDb =
      dbRows.some(
        (item) =>
          (item.id === sample.id || item.slug === sample.slug) &&
          (item.status === "deleted" ||
            item.status === "permanently_deleted" ||
            item.deletedAt !== null ||
            item.isTrashed === true)
      ) ||
      permanentlyDeletedIds.has(sample.id) ||
      (sample.slug && permanentlyDeletedIds.has(sample.slug))

    if (!alreadyPresent && !wasDeletedInDb) {
      allScrims.push(sample)
    }
  }

  // Ensure exact confirmedTeams count for all scrims from the database
  try {
    const dateFilter = scheduleEval.isRegWindowActive
      ? eq(bookings.scrimDate, scheduleEval.effectiveScrimDate)
      : gte(bookings.scrimDate, activeDate)

    const bookingCounts = await db
      .select({
        scrimId: bookings.scrimId,
        count: sql<number>`count(*)::int`,
      })
      .from(bookings)
      .where(
        and(
          eq(bookings.status, "confirmed"),
          eq(bookings.isTrashed, false),
          eq(bookings.isArchived, false),
          dateFilter
        )
      )
      .groupBy(bookings.scrimId)

    const countMap = new Map<string, number>()
    for (const b of bookingCounts) {
      countMap.set(b.scrimId, Number(b.count))
    }

    for (const s of allScrims) {
      const c1 = countMap.get(s.id) ?? 0
      const c2 = s.slug && s.slug !== s.id ? (countMap.get(s.slug) ?? 0) : 0
      s.confirmedTeams = c1 + c2
      const maxTeams = s.maxTeams || 12
      if (s.confirmedTeams >= maxTeams) {
        s.registrationOpen = false
        if (s.status === "upcoming" || s.status === "force_open") {
          s.status = "registration_closed"
        }
        if (s.icebergEnabled || s.icebergShowAllFilled) {
          s.icebergEnabled = false
          s.icebergShowAllFilled = false
          void db
            .update(scrims)
            .set({ icebergEnabled: false, icebergShowAllFilled: false, updatedAt: new Date() })
            .where(or(eq(scrims.id, s.id), eq(scrims.slug, s.slug)))
            .catch(() => {})
        }
      }
      s.publicConfirmedTeams = computeIcebergDisplayCount({
        realConfirmed: s.confirmedTeams,
        maxTeams,
        icebergEnabled: Boolean(s.icebergEnabled),
        icebergShowAllFilled: Boolean(s.icebergShowAllFilled),
        icebergAmount: Number(s.icebergAmount ?? 7),
        icebergThreshold: Number(s.icebergThreshold ?? 3),
        icebergStartRealCount: Number(s.icebergStartRealCount ?? 0),
      })
    }
  } catch (countErr) {
    console.warn("[Queries] Could not compute live slot counts:", countErr)
  }

  // Filter out rooms above the configured room multiplier (applies cleanly to BOTH Daily and Friday scrims)
  let filtered = allScrims.filter((s) => {
    const roomNum = getScrimRoomNumber(s)
    return roomNum <= effectiveMultiplier
  })

  if (!includeHidden) {
    filtered = filtered.filter((s) => !s.hidden && s.status !== "deleted")
  } else {
    filtered = filtered.filter((s) => s.status !== "deleted")
  }

  return sortByStartTime(filtered)
}

export async function getScrimBySlug(slug: string): Promise<ScrimWithSlots | null> {
  await ensureSchemaReady()
  await archivePreviousDayBookings().catch(() => {})
  const [isFriday, roomTierOverrides, scheduleOverride] = await Promise.all([
    isFridayScrimsActive(),
    getRoomTierOverrides(),
    getScheduleOverrideConfig(),
  ])
  const activeDate = getBangladeshActiveDate()
  const scheduleEval = evaluateScheduleOverride(scheduleOverride, activeDate)

  let result: ScrimWithSlots | null = null
  try {
    const rows = await db
      .select({ scrim: scrims, confirmedTeams: confirmedCount })
      .from(scrims)
      .where(or(eq(scrims.slug, slug), eq(scrims.id, slug)))
      .limit(1)
    if (rows.length > 0) {
      result = normalizeScrim({ ...rows[0].scrim, confirmedTeams: rows[0].confirmedTeams }, isFriday, {
        roomTierOverrides,
        scheduleEval,
      })
    }
  } catch (err) {
    console.warn("[Queries] Database error in getScrimBySlug:", err)
  }
  if (!result) {
    const def = findStandardScrimDefinition(slug)
    if (def) {
      result = normalizeScrim(
        buildSampleScrimFromDef(def, 0, scheduleEval.effectiveScrimDate),
        isFriday,
        { roomTierOverrides, scheduleEval }
      )
    }
  }

  if (result) {
    if (result.status === "deleted" || result.deletedAt !== null) {
      return null
    }

    try {
      const dateFilter = scheduleEval.isRegWindowActive
        ? eq(bookings.scrimDate, scheduleEval.effectiveScrimDate)
        : gte(bookings.scrimDate, activeDate)

      const countRows = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(bookings)
        .where(
          and(
            or(eq(bookings.scrimId, result.id), eq(bookings.scrimId, result.slug)),
            eq(bookings.status, "confirmed"),
            eq(bookings.isTrashed, false),
            eq(bookings.isArchived, false),
            dateFilter
          )
        )
      result.confirmedTeams = Number(countRows[0]?.count ?? 0)
      const maxTeams = result.maxTeams || 12
      if (result.confirmedTeams >= maxTeams) {
        result.registrationOpen = false
        if (result.status === "upcoming" || result.status === "force_open") {
          result.status = "registration_closed"
        }
        if (result.icebergEnabled || result.icebergShowAllFilled) {
          result.icebergEnabled = false
          result.icebergShowAllFilled = false
          await db
            .update(scrims)
            .set({ icebergEnabled: false, icebergShowAllFilled: false, updatedAt: new Date() })
            .where(or(eq(scrims.id, result.id), eq(scrims.slug, result.slug)))
            .catch(() => {})
        }
      }
      result.publicConfirmedTeams = computeIcebergDisplayCount({
        realConfirmed: result.confirmedTeams,
        maxTeams,
        icebergEnabled: Boolean(result.icebergEnabled),
        icebergShowAllFilled: Boolean(result.icebergShowAllFilled),
        icebergAmount: Number(result.icebergAmount ?? 7),
        icebergThreshold: Number(result.icebergThreshold ?? 3),
        icebergStartRealCount: Number(result.icebergStartRealCount ?? 0),
      })
    } catch {}
  }

  return result
}

export async function getScrimById(id: string): Promise<ScrimWithSlots | null> {
  await ensureSchemaReady()
  await archivePreviousDayBookings().catch(() => {})
  const [isFriday, roomTierOverrides, scheduleOverride] = await Promise.all([
    isFridayScrimsActive(),
    getRoomTierOverrides(),
    getScheduleOverrideConfig(),
  ])
  const activeDate = getBangladeshActiveDate()
  const scheduleEval = evaluateScheduleOverride(scheduleOverride, activeDate)

  let result: ScrimWithSlots | null = null
  try {
    const rows = await db
      .select({ scrim: scrims, confirmedTeams: confirmedCount })
      .from(scrims)
      .where(or(eq(scrims.id, id), eq(scrims.slug, id)))
      .limit(1)
    if (rows.length > 0) {
      result = normalizeScrim({ ...rows[0].scrim, confirmedTeams: rows[0].confirmedTeams }, isFriday, {
        roomTierOverrides,
        scheduleEval,
      })
    }
  } catch (err) {
    console.warn("[Queries] Database error in getScrimById:", err)
  }
  if (!result) {
    const def = findStandardScrimDefinition(id)
    if (def) {
      result = normalizeScrim(
        buildSampleScrimFromDef(def, 0, scheduleEval.effectiveScrimDate),
        isFriday,
        { roomTierOverrides, scheduleEval }
      )
    }
  }

  if (result) {
    if (result.status === "deleted" || result.deletedAt !== null) {
      return null
    }

    try {
      const dateFilter = scheduleEval.isRegWindowActive
        ? eq(bookings.scrimDate, scheduleEval.effectiveScrimDate)
        : gte(bookings.scrimDate, activeDate)

      const countRows = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(bookings)
        .where(
          and(
            or(eq(bookings.scrimId, result.id), eq(bookings.scrimId, result.slug)),
            eq(bookings.status, "confirmed"),
            eq(bookings.isTrashed, false),
            eq(bookings.isArchived, false),
            dateFilter
          )
        )
      result.confirmedTeams = Number(countRows[0]?.count ?? 0)
      const maxTeams = result.maxTeams || 12
      if (result.confirmedTeams >= maxTeams) {
        result.registrationOpen = false
        if (result.status === "upcoming" || result.status === "force_open") {
          result.status = "registration_closed"
        }
        if (result.icebergEnabled || result.icebergShowAllFilled) {
          result.icebergEnabled = false
          result.icebergShowAllFilled = false
          await db
            .update(scrims)
            .set({ icebergEnabled: false, icebergShowAllFilled: false, updatedAt: new Date() })
            .where(or(eq(scrims.id, result.id), eq(scrims.slug, result.slug)))
            .catch(() => {})
        }
      }
      result.publicConfirmedTeams = computeIcebergDisplayCount({
        realConfirmed: result.confirmedTeams,
        maxTeams,
        icebergEnabled: Boolean(result.icebergEnabled),
        icebergShowAllFilled: Boolean(result.icebergShowAllFilled),
        icebergAmount: Number(result.icebergAmount ?? 7),
        icebergThreshold: Number(result.icebergThreshold ?? 3),
        icebergStartRealCount: Number(result.icebergStartRealCount ?? 0),
      })
    } catch {}
  }

  return result
}

export async function getAllScrims(): Promise<ScrimWithSlots[]> {
  await ensureSchemaReady()
  await archivePreviousDayBookings().catch(() => {})
  const [isFriday, multiplier, roomTierOverrides, scheduleOverride] = await Promise.all([
    isFridayScrimsActive(),
    getRoomMultiplier(),
    getRoomTierOverrides(),
    getScheduleOverrideConfig(),
  ])
  const activeDate = getBangladeshActiveDate()
  const scheduleEval = evaluateScheduleOverride(scheduleOverride, activeDate)
  const samples = getAllSampleScrims(Math.max(2, multiplier)).map((s) =>
    normalizeScrim(s, isFriday, { roomTierOverrides, scheduleEval })
  )
  try {
    const [rows, bookingCounts] = await Promise.all([
      db
        .select({ scrim: scrims, confirmedTeams: confirmedCount })
        .from(scrims)
        .orderBy(desc(scrims.scrimDate), asc(scrims.startTime)),
      db
        .select({
          scrimId: bookings.scrimId,
          count: sql<number>`count(*)::int`,
        })
        .from(bookings)
        .where(
          and(
            eq(bookings.status, "confirmed"),
            eq(bookings.isTrashed, false),
            eq(bookings.isArchived, false),
            gte(bookings.scrimDate, activeDate)
          )
        )
        .groupBy(bookings.scrimId),
    ])

    const countMap = new Map<string, number>()
    for (const b of bookingCounts) {
      countMap.set(b.scrimId, Number(b.count))
    }

    const list = rows.map((r) => {
      const c1 = countMap.get(r.scrim.id) ?? 0
      const c2 = r.scrim.slug && r.scrim.slug !== r.scrim.id ? (countMap.get(r.scrim.slug) ?? 0) : 0
      const normalized = normalizeScrim({ ...r.scrim, confirmedTeams: c1 + c2 }, isFriday, {
        roomTierOverrides,
        scheduleEval,
      })
      if (normalized.confirmedTeams >= (normalized.maxTeams || 12)) {
        if (normalized.icebergEnabled) normalized.icebergEnabled = false
        if (normalized.icebergShowAllFilled) normalized.icebergShowAllFilled = false
      }
      normalized.publicConfirmedTeams = computeIcebergDisplayCount({
        realConfirmed: normalized.confirmedTeams,
        maxTeams: normalized.maxTeams || 12,
        icebergEnabled: Boolean(normalized.icebergEnabled),
        icebergShowAllFilled: Boolean(normalized.icebergShowAllFilled),
        icebergAmount: Number(normalized.icebergAmount ?? 7),
        icebergThreshold: Number(normalized.icebergThreshold ?? 3),
        icebergStartRealCount: Number(normalized.icebergStartRealCount ?? 0),
      })
      return normalized
    })
    const combined = [...list.filter((s) => s.status !== "deleted")]
    for (const sample of samples) {
      if (!combined.some((s) => s.id === sample.id || s.slug === sample.slug)) {
        const c1 = countMap.get(sample.id) ?? 0
        const c2 = sample.slug && sample.slug !== sample.id ? (countMap.get(sample.slug) ?? 0) : 0
        sample.confirmedTeams = c1 + c2
        sample.publicConfirmedTeams = sample.confirmedTeams
        combined.push(sample)
      }
    }
    return sortScrimsAscending(combined)
  } catch (err) {
    console.warn("[Queries] Database error in getAllScrims:", err)
    return sortScrimsAscending(samples)
  }
}

/** Whether a user already has a non-cancelled booking for a scrim on the target date (defaults to current active date). */
export async function userHasBooking(userId: string, scrimIdOrSlug: string, targetDate?: string) {
  try {
    const activeDate = getBangladeshActiveDate()
    const target = (targetDate && targetDate >= activeDate) ? targetDate : activeDate
    const scrim = await getScrimById(scrimIdOrSlug).catch(() => null)
    const targetId = scrim?.id || scrimIdOrSlug
    const targetSlug = scrim?.slug || scrimIdOrSlug

    const rows = await db
      .select({
        id: bookings.id,
        status: bookings.status,
        scrimDate: bookings.scrimDate,
        teamName: bookings.teamName,
        slotNumber: bookings.slotNumber,
      })
      .from(bookings)
      .where(
        and(
          eq(bookings.userId, userId),
          or(eq(bookings.scrimId, targetId), eq(bookings.scrimId, targetSlug)),
          eq(bookings.isTrashed, false),
          eq(bookings.isArchived, false),
          eq(bookings.scrimDate, target),
          sql`${bookings.status} IN ('pending', 'confirmed')`,
        ),
      )
      .limit(1)
    return rows[0] ?? null
  } catch (err) {
    console.warn("[Queries] Database error in userHasBooking:", err)
    return null
  }
}

/**
 * Resolves a scrim by ID or slug. If it does not exist in the database table yet
 * (e.g. standard daily/Friday scrim or recovered scrim), it ensures the database record is inserted
 * and returns the active database scrim entity.
 */
export async function resolveOrEnsureScrim(scrimIdOrSlug: string) {
  try {
    await ensureSchemaReady()
    const rows = await db
      .select()
      .from(scrims)
      .where(or(eq(scrims.id, scrimIdOrSlug), eq(scrims.slug, scrimIdOrSlug)))
      .limit(1)

    const activeDate = getBangladeshActiveDate()

    if (rows.length > 0 && rows[0]) {
      // If the scrim in the DB is from a previous date, immediately update it to the current active cycle
      if (!rows[0].scrimDate || rows[0].scrimDate < activeDate) {
        const [synced] = await db
          .update(scrims)
          .set({
            scrimDate: activeDate,
            status: "upcoming",
            registrationOpen: true,
            roomPublished: false,
            roomId: null,
            roomPassword: null,
            icebergStartRealCount: 0,
            icebergShowAllFilled: false,
            updatedAt: new Date(),
          })
          .where(eq(scrims.id, rows[0].id))
          .returning()
        return synced || { ...rows[0], scrimDate: activeDate }
      }
      return rows[0]
    }

    const def = findStandardScrimDefinition(scrimIdOrSlug)

    if (def) {
      const scheduleConfig = await getScheduleOverrideConfig()
      const scheduleEval = evaluateScheduleOverride(scheduleConfig, activeDate)
      const inserted = await db
        .insert(scrims)
        .values({
          id: def.id,
          title: def.name,
          slug: def.slug,
          map: def.map,
          mode: "BATTLE ROYALE",
          startTime: def.time,
          scrimDate: scheduleEval.effectiveScrimDate,
          category: def.category || "Daily Scrims",
          priceBdt: def.priceBdt,
          prizePoolBdt: def.prizePoolBdt,
          maxTeams: 12,
          bannerUrl: def.bannerUrl || "/images/scrim-1.jpg",
          hidden: false,
          status: "upcoming",
          registrationOpen: true,
        })
        .onConflictDoUpdate({
          target: scrims.id,
          set: { updatedAt: new Date() },
        })
        .returning()

      return inserted[0] ?? null
    }

    return null
  } catch (err) {
    console.error("[Queries] Error in resolveOrEnsureScrim:", err)
    return null
  }
}



