/** Format an amount in BDT with the Bengali Taka sign. */
export function bdt(amount: number): string {
  return `\u09F3${amount}`
}

/** Alias of {@link bdt} for readability at call sites. */
export const formatTaka = bdt

/** Today's date in YYYY-MM-DD (Asia/Dhaka). */
export function todayDhaka(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}

/** Parse "7:00 PM" + a YYYY-MM-DD date into a Date in Asia/Dhaka (UTC+6). */
export function scrimStartDate(dateInput: string | Date | null | undefined, timeStr: string): Date {
  // 1. Parse date input to year, month (1-indexed), day
  let year = 2026
  let month = 1
  let day = 1

  if (dateInput instanceof Date) {
    // If it's a Date object, read in UTC or ISO
    const iso = dateInput.toISOString()
    const parts = iso.slice(0, 10).split("-")
    year = Number.parseInt(parts[0], 10)
    month = Number.parseInt(parts[1], 10)
    day = Number.parseInt(parts[2], 10)
  } else if (typeof dateInput === "string" && dateInput.trim()) {
    const cleanStr = dateInput.trim().split("T")[0]
    const match = cleanStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
    if (match) {
      year = Number.parseInt(match[1], 10)
      month = Number.parseInt(match[2], 10)
      day = Number.parseInt(match[3], 10)
    } else {
      const parsed = new Date(dateInput)
      if (!isNaN(parsed.getTime())) {
        year = parsed.getUTCFullYear()
        month = parsed.getUTCMonth() + 1
        day = parsed.getUTCDate()
      }
    }
  } else {
    const today = todayDhaka().split("-")
    year = Number.parseInt(today[0], 10)
    month = Number.parseInt(today[1], 10)
    day = Number.parseInt(today[2], 10)
  }

  // 2. Parse time string like "7:00 PM" or "12:00 AM"
  const m = (timeStr || "8:00 PM").trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  let hours = 20
  let minutes = 0
  let isNextDayMidnight = false

  if (m) {
    const rawH = Number.parseInt(m[1], 10)
    const rawM = Number.parseInt(m[2], 10)
    const period = m[3].toUpperCase()

    if (period === "AM") {
      if (rawH === 12) {
        hours = 0
        isNextDayMidnight = true // In night schedule 7PM-12AM, 12:00 AM is midnight following 11 PM
      } else {
        hours = rawH
      }
    } else {
      // PM
      if (rawH === 12) {
        hours = 12
      } else {
        hours = rawH + 12
      }
    }
    minutes = rawM
  }

  // Dhaka is UTC+6. UTC time = Dhaka time - 6 hours
  // Date.UTC takes month 0-indexed
  const baseUtcMs = Date.UTC(year, month - 1, day, hours - 6, minutes, 0)
  const result = new Date(baseUtcMs)
  if (isNextDayMidnight) {
    result.setUTCDate(result.getUTCDate() + 1)
  }
  return result
}

/** Human readable date like "13 Jul 2026". */
export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return ""
  let date: Date
  if (d instanceof Date) {
    date = d
  } else if (typeof d === "string") {
    if (d.includes("T")) {
      date = new Date(d)
    } else {
      date = new Date(`${d}T00:00:00`)
    }
  } else {
    date = new Date(d)
  }
  if (isNaN(date.getTime())) {
    return String(d)
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  }).format(date)
}

/** Formatted date and time with Asia/Dhaka timezone like "18 Sep 2026, 08:35 PM". */
export function formatDateTime(d: string | Date | null | undefined): string {
  if (!d) return ""
  const date = typeof d === "string" ? new Date(d) : d instanceof Date ? d : new Date(String(d))
  if (isNaN(date.getTime())) return String(d)

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Dhaka",
  }).format(date)
}

/** Relative time like "2h ago" or "just now". */
export function timeAgo(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return formatDate(date)
}

export type ScrimStatusInfo = {
  label: "Open" | "Filling Fast" | "Full" | "Closed" | "Completed"
  tone: "open" | "filling" | "full" | "closed"
}

export function scrimStatus(
  confirmedTeams: number,
  maxTeams: number,
  registrationOpen: boolean,
  status: string,
  scrimDate?: string,
  startTime?: string,
): ScrimStatusInfo {
  if (status === "completed") return { label: "Completed", tone: "closed" }
  if (!registrationOpen) return { label: "Closed", tone: "closed" }
  if (scrimDate && startTime) {
    try {
      const start = scrimStartDate(scrimDate, startTime)
      if (new Date() >= start) {
        return { label: "Closed", tone: "closed" }
      }
    } catch {
      // Ignore parse errors if any
    }
  }
  if (confirmedTeams >= maxTeams) return { label: "Full", tone: "full" }
  if (confirmedTeams >= maxTeams - 3) return { label: "Filling Fast", tone: "filling" }
  return { label: "Open", tone: "open" }
}
