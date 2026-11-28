import { z } from "zod"

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export interface ScheduleOverrideConfig {
  enabled: boolean
  /** Shut down scrims across shutdownStartDate..shutdownEndDate (same date = single day) */
  shutdownEnabled: boolean
  shutdownStartDate: string
  shutdownEndDate: string
  /** Open registrations for a specific targetScrimDate across regStartDate..regEndDate */
  regWindowEnabled: boolean
  targetScrimDate: string
  regStartDate: string
  regEndDate: string
  /** Optional public notice shown when override is active */
  reason: string
  updatedAt?: string
}

export const DEFAULT_SCHEDULE_OVERRIDE_CONFIG: ScheduleOverrideConfig = {
  enabled: false,
  shutdownEnabled: false,
  shutdownStartDate: "",
  shutdownEndDate: "",
  regWindowEnabled: false,
  targetScrimDate: "",
  regStartDate: "",
  regEndDate: "",
  reason: "",
}

function isValidOptionalIsoDate(val: string): boolean {
  if (!val) return true
  if (!ISO_DATE_RE.test(val)) return false
  const [y, m, d] = val.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

export const scheduleOverrideSchema = z
  .object({
    enabled: z.boolean(),
    shutdownEnabled: z.boolean().default(false),
    shutdownStartDate: z.string().trim().default("").refine(isValidOptionalIsoDate, "Invalid shutdown start date"),
    shutdownEndDate: z.string().trim().default("").refine(isValidOptionalIsoDate, "Invalid shutdown end date"),
    regWindowEnabled: z.boolean().default(false),
    targetScrimDate: z.string().trim().default("").refine(isValidOptionalIsoDate, "Invalid target scrim date"),
    regStartDate: z.string().trim().default("").refine(isValidOptionalIsoDate, "Invalid registration start date"),
    regEndDate: z.string().trim().default("").refine(isValidOptionalIsoDate, "Invalid registration end date"),
    reason: z.string().trim().max(240, "Reason must be 240 characters or less").default(""),
    updatedAt: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.enabled) return
    if (!data.shutdownEnabled && !data.regWindowEnabled) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["enabled"],
        message: "Enable either Scrim Shutdown or Target-Date Registration Window when turning the schedule override on.",
      })
    }
    if (data.shutdownEnabled) {
      if (!data.shutdownStartDate || !data.shutdownEndDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["shutdownStartDate"],
          message: "Select both start and end dates for the scrim shutdown window.",
        })
      } else if (data.shutdownEndDate < data.shutdownStartDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["shutdownEndDate"],
          message: "Shutdown end date cannot be earlier than start date.",
        })
      }
    }
    if (data.regWindowEnabled) {
      if (!data.targetScrimDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["targetScrimDate"],
          message: "Select the target scrim date that players are registering for.",
        })
      }
      if (!data.regStartDate || !data.regEndDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["regStartDate"],
          message: "Select both registration window start and end dates.",
        })
      } else if (data.regEndDate < data.regStartDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["regEndDate"],
          message: "Registration end date cannot be earlier than start date.",
        })
      }
    }
  })

export function parseScheduleOverrideConfig(rawJson: string | null | undefined): ScheduleOverrideConfig {
  if (!rawJson || !rawJson.trim()) return { ...DEFAULT_SCHEDULE_OVERRIDE_CONFIG }
  try {
    const parsed = JSON.parse(rawJson)
    if (!parsed || typeof parsed !== "object") return { ...DEFAULT_SCHEDULE_OVERRIDE_CONFIG }
    const merged: ScheduleOverrideConfig = {
      enabled: Boolean(parsed.enabled),
      shutdownEnabled: Boolean(parsed.shutdownEnabled),
      shutdownStartDate: typeof parsed.shutdownStartDate === "string" ? parsed.shutdownStartDate.trim() : "",
      shutdownEndDate: typeof parsed.shutdownEndDate === "string" ? parsed.shutdownEndDate.trim() : "",
      regWindowEnabled: Boolean(parsed.regWindowEnabled),
      targetScrimDate: typeof parsed.targetScrimDate === "string" ? parsed.targetScrimDate.trim() : "",
      regStartDate: typeof parsed.regStartDate === "string" ? parsed.regStartDate.trim() : "",
      regEndDate: typeof parsed.regEndDate === "string" ? parsed.regEndDate.trim() : "",
      reason: typeof parsed.reason === "string" ? parsed.reason.trim().slice(0, 240) : "",
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : undefined,
    }
    if (merged.shutdownEnabled && merged.shutdownStartDate && !merged.shutdownEndDate) {
      merged.shutdownEndDate = merged.shutdownStartDate
    }
    if (merged.regWindowEnabled && merged.regStartDate && !merged.regEndDate) {
      merged.regEndDate = merged.regStartDate
    }
    return merged
  } catch {
    return { ...DEFAULT_SCHEDULE_OVERRIDE_CONFIG }
  }
}

export function isIsoDateFriday(isoDate: string): boolean {
  if (!ISO_DATE_RE.test(isoDate)) return false
  const [y, m, d] = isoDate.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCDay() === 5
}

export function formatIsoDatePretty(isoDate: string): string {
  if (!ISO_DATE_RE.test(isoDate)) return isoDate
  const [y, m, d] = isoDate.split("-").map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export interface EvaluatedScheduleOverride {
  /** Whether the override is currently active for `activeDate` */
  active: boolean
  /** True when the configured end dates have all passed and normal schedule auto-resumed */
  expired: boolean
  /** True when scrims are currently shut down (and no advance registration window is open) */
  isShutdownActive: boolean
  /** True when advance/date-range registrations for `targetScrimDate` are currently open */
  isRegWindowActive: boolean
  /** The effective scrimDate to assign/display for active lobbies & bookings */
  effectiveScrimDate: string
  /** Whether the effective target date falls on a Friday (when registration window is active) */
  targetIsFriday: boolean | null
  /** Human-readable status summary for admin & public banners */
  summary: string
}

/**
 * Evaluates the schedule override against Bangladesh's active date (`YYYY-MM-DD`).
 * Automatically reverts to normal operation once `activeDate` passes the latest configured end date.
 */
export function evaluateScheduleOverride(
  config: ScheduleOverrideConfig | null | undefined,
  activeDate: string
): EvaluatedScheduleOverride {
  const base: EvaluatedScheduleOverride = {
    active: false,
    expired: false,
    isShutdownActive: false,
    isRegWindowActive: false,
    effectiveScrimDate: activeDate,
    targetIsFriday: null,
    summary: "",
  }

  if (!config || !config.enabled) return base

  const endDates: string[] = []
  if (config.shutdownEnabled && config.shutdownEndDate && ISO_DATE_RE.test(config.shutdownEndDate)) {
    endDates.push(config.shutdownEndDate)
  }
  if (config.regWindowEnabled && config.regEndDate && ISO_DATE_RE.test(config.regEndDate)) {
    endDates.push(config.regEndDate)
  }

  if (endDates.length === 0) return base

  const latestEndDate = endDates.sort()[endDates.length - 1]
  if (activeDate > latestEndDate) {
    return {
      ...base,
      expired: true,
      summary: `Override auto-expired after ${formatIsoDatePretty(latestEndDate)} — normal schedule restored.`,
    }
  }

  const inShutdownRange = Boolean(
    config.shutdownEnabled &&
      config.shutdownStartDate &&
      config.shutdownEndDate &&
      activeDate >= config.shutdownStartDate &&
      activeDate <= config.shutdownEndDate
  )

  const inRegWindow = Boolean(
    config.regWindowEnabled &&
      config.targetScrimDate &&
      config.regStartDate &&
      config.regEndDate &&
      activeDate >= config.regStartDate &&
      activeDate <= config.regEndDate
  )

  if (inRegWindow) {
    const targetPretty = formatIsoDatePretty(config.targetScrimDate)
    const endPretty = formatIsoDatePretty(config.regEndDate)
    const shutdownNote = inShutdownRange
      ? config.shutdownStartDate === config.shutdownEndDate
        ? `Regular scrims are paused on ${formatIsoDatePretty(config.shutdownStartDate)}. `
        : `Regular scrims are paused from ${formatIsoDatePretty(config.shutdownStartDate)} to ${formatIsoDatePretty(config.shutdownEndDate)}. `
      : ""
    return {
      active: true,
      expired: false,
      isShutdownActive: false,
      isRegWindowActive: true,
      effectiveScrimDate: config.targetScrimDate,
      targetIsFriday: isIsoDateFriday(config.targetScrimDate),
      summary: `${shutdownNote}Advance registrations are open for ${targetPretty} scrims through ${endPretty}.`,
    }
  }

  if (inShutdownRange) {
    const rangeText =
      config.shutdownStartDate === config.shutdownEndDate
        ? formatIsoDatePretty(config.shutdownStartDate)
        : `${formatIsoDatePretty(config.shutdownStartDate)} – ${formatIsoDatePretty(config.shutdownEndDate)}`
    return {
      active: true,
      expired: false,
      isShutdownActive: true,
      isRegWindowActive: false,
      effectiveScrimDate: activeDate,
      targetIsFriday: null,
      summary: config.reason
        ? `Scrims are paused (${rangeText}): ${config.reason}`
        : `Scrims are temporarily shut down for ${rangeText}. Normal schedule resumes automatically afterward.`,
    }
  }

  return base
}
