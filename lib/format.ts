/** Format an amount in BDT with the Bengali Taka sign. */
export function bdt(amount: number): string {
  return `\u09F3${amount}`
}

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
export function scrimStartDate(dateStr: string, timeStr: string): Date {
  const m = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  let hours = 20
  let minutes = 0
  if (m) {
    hours = Number.parseInt(m[1], 10) % 12
    minutes = Number.parseInt(m[2], 10)
    if (m[3].toUpperCase() === "PM") hours += 12
  }
  // 12:00 AM belongs to the following night in a 7PM–12AM schedule
  const base = new Date(`${dateStr}T00:00:00+06:00`)
  if (m && m[3].toUpperCase() === "AM" && Number.parseInt(m[1], 10) === 12) {
    base.setUTCDate(base.getUTCDate() + 1)
  }
  base.setUTCHours(base.getUTCHours() + hours, minutes)
  return base
}

/** Human readable date like "13 Jul 2026". */
export function formatDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(`${d}T00:00:00`) : d
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date)
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
): ScrimStatusInfo {
  if (status === "completed") return { label: "Completed", tone: "closed" }
  if (!registrationOpen) return { label: "Closed", tone: "closed" }
  if (confirmedTeams >= maxTeams) return { label: "Full", tone: "full" }
  if (confirmedTeams >= maxTeams - 3) return { label: "Filling Fast", tone: "filling" }
  return { label: "Open", tone: "open" }
}
