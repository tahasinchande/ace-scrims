"use client"

import { useEffect, useMemo, useState } from "react"
import { getScrimRoomWeight, sortScrimsAscending } from "@/lib/format"
import { cn } from "@/lib/utils"

export type ScrimScheduleType = "daily" | "friday"

export type ScrimSelectorItem = {
  id: string
  slug?: string | null
  title: string
  startTime?: string | null
  scrimDate?: string | null
  category?: string | null
  status?: string | null
}

export type ScrimHierarchyInfo = {
  schedule: ScrimScheduleType
  category: string | null
  roomNumber: number
}

export function classifyScrimHierarchy(scrim: {
  title?: string | null
  slug?: string | null
  category?: string | null
  startTime?: string | null
}): ScrimHierarchyInfo {
  const title = (scrim.title || "").trim()
  const slug = (scrim.slug || "").trim().toLowerCase()
  const rawCategory = (scrim.category || "").trim()
  const combined = `${title} ${slug} ${rawCategory}`.toLowerCase()

  const isFriday =
    combined.includes("friday") ||
    combined.includes("champion rush") ||
    combined.includes("champion-rush") ||
    combined.includes("special blast") ||
    combined.includes("friday-special")

  const schedule: ScrimScheduleType = isFriday ? "friday" : "daily"

  let category: string | null = null
  if (rawCategory && !/^daily(\s+scrims?)?$/i.test(rawCategory)) {
    category = rawCategory
  } else if (isFriday) {
    if (combined.includes("special blast") || combined.includes("friday special") || combined.includes("friday-special")) {
      category = "Friday Special Blast"
    } else if (combined.includes("champion rush") || combined.includes("champion-rush")) {
      const timeStr = `${title} ${scrim.startTime || ""} ${slug}`.toLowerCase()
      if (timeStr.includes("3:00 pm") || timeStr.includes("3 pm") || timeStr.includes("3pm")) {
        category = "3 PM Champion Rush"
      } else if (timeStr.includes("10:00 pm") || timeStr.includes("10 pm") || timeStr.includes("10pm")) {
        category = "10 PM Champion Rush"
      } else {
        category = "Champion Rush"
      }
    } else {
      category = "Friday Special"
    }
  }

  const roomNumber = getScrimRoomWeight({
    title: scrim.title || "",
    slug: scrim.slug || "",
  })

  return { schedule, category, roomNumber }
}

function defaultFormatRoomLabel(scrim: ScrimSelectorItem): string {
  const parts: string[] = []
  if (scrim.startTime) parts.push(scrim.startTime)
  parts.push(scrim.title)
  if (scrim.scrimDate) parts.push(`(${scrim.scrimDate})`)
  return parts.join(" · ")
}

export function CascadingScrimSelector<T extends ScrimSelectorItem>({
  scrims,
  value,
  onChange,
  valueField = "id",
  allowAll = false,
  allValue = "all",
  allLabel = "All Lobbies",
  placeholder = "Select room / lobby…",
  formatRoomLabel = defaultFormatRoomLabel,
  disabled = false,
  compact = false,
  className,
  idPrefix = "scrim-cascade",
}: {
  scrims: T[]
  value: string
  onChange: (nextValue: string, scrim?: T) => void
  valueField?: "id" | "slug"
  allowAll?: boolean
  allValue?: string
  allLabel?: string
  placeholder?: string
  formatRoomLabel?: (scrim: T) => string
  disabled?: boolean
  compact?: boolean
  className?: string
  idPrefix?: string
}) {
  const getKey = (item: T) =>
    valueField === "slug" ? (item.slug || item.id) : item.id

  const sortedAll = useMemo(
    () =>
      sortScrimsAscending(
        scrims.map((s) => ({
          ...s,
          slug: s.slug || s.id,
          startTime: s.startTime || "",
          scrimDate: s.scrimDate || "",
        })),
      ) as unknown as T[],
    [scrims],
  )

  const classified = useMemo(
    () =>
      sortedAll.map((scrim) => ({
        scrim,
        meta: classifyScrimHierarchy(scrim),
      })),
    [sortedAll],
  )

  const dailyItems = useMemo(
    () => classified.filter((c) => c.meta.schedule === "daily"),
    [classified],
  )
  const fridayItems = useMemo(
    () => classified.filter((c) => c.meta.schedule === "friday"),
    [classified],
  )

  const selectedEntry = useMemo(
    () => classified.find((c) => getKey(c.scrim) === value),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [classified, value, valueField],
  )

  const defaultSchedule: "all" | ScrimScheduleType = useMemo(() => {
    if (selectedEntry) return selectedEntry.meta.schedule
    if (allowAll && (value === allValue || value === "")) return "all"
    if (dailyItems.length > 0) return "daily"
    if (fridayItems.length > 0) return "friday"
    return "daily"
  }, [selectedEntry, allowAll, value, allValue, dailyItems.length, fridayItems.length])

  const [schedule, setSchedule] = useState<"all" | ScrimScheduleType>(defaultSchedule)
  const [category, setCategory] = useState<string>(
    selectedEntry?.meta.category ?? "all",
  )

  // Keep schedule & category aligned whenever external `value` changes
  useEffect(() => {
    if (selectedEntry) {
      setSchedule(selectedEntry.meta.schedule)
      setCategory(selectedEntry.meta.category ?? "all")
    } else if (allowAll && (value === allValue || value === "")) {
      setSchedule("all")
      setCategory("all")
    }
  }, [selectedEntry, allowAll, value, allValue])

  const scheduleItems = useMemo(() => {
    if (schedule === "all") return classified
    return schedule === "friday" ? fridayItems : dailyItems
  }, [schedule, classified, fridayItems, dailyItems])

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const item of scheduleItems) {
      if (item.meta.category) {
        set.add(item.meta.category)
      }
    }
    return Array.from(set).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
    )
  }, [scheduleItems])

  const showCategoryStep = schedule !== "all" && categories.length > 0

  const effectiveCategory =
    showCategoryStep && category !== "all" && categories.includes(category)
      ? category
      : showCategoryStep && !allowAll && categories.length === 1
        ? categories[0]
        : showCategoryStep && !allowAll && category === "all"
          ? categories[0]
          : "all"

  const roomItems = useMemo(() => {
    if (!showCategoryStep || effectiveCategory === "all") {
      return scheduleItems.map((c) => c.scrim)
    }
    return scheduleItems
      .filter((c) => c.meta.category === effectiveCategory)
      .map((c) => c.scrim)
  }, [showCategoryStep, effectiveCategory, scheduleItems])

  function handleScheduleChange(nextSchedule: "all" | ScrimScheduleType) {
    setSchedule(nextSchedule)
    if (nextSchedule === "all") {
      setCategory("all")
      if (allowAll) onChange(allValue, undefined)
      return
    }
    const itemsForSchedule = nextSchedule === "friday" ? fridayItems : dailyItems
    const nextCats = Array.from(
      new Set(itemsForSchedule.map((i) => i.meta.category).filter(Boolean) as string[]),
    ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))

    const nextCat = !allowAll && nextCats.length > 0 ? nextCats[0] : "all"
    setCategory(nextCat)

    const filteredRooms =
      nextCat === "all"
        ? itemsForSchedule.map((i) => i.scrim)
        : itemsForSchedule.filter((i) => i.meta.category === nextCat).map((i) => i.scrim)

    if (allowAll) {
      // Keep current selection if it belongs to this schedule, otherwise switch to first matching or all
      const stillValid = filteredRooms.find((r) => getKey(r) === value)
      if (!stillValid) {
        onChange(allValue, undefined)
      }
    } else if (filteredRooms.length > 0) {
      const first = filteredRooms[0]
      onChange(getKey(first), first)
    } else {
      onChange("", undefined)
    }
  }

  function handleCategoryChange(nextCategory: string) {
    setCategory(nextCategory)
    const filteredRooms =
      nextCategory === "all"
        ? scheduleItems.map((i) => i.scrim)
        : scheduleItems.filter((i) => i.meta.category === nextCategory).map((i) => i.scrim)

    if (allowAll) {
      const stillValid = filteredRooms.find((r) => getKey(r) === value)
      if (!stillValid) {
        onChange(allValue, undefined)
      }
    } else if (filteredRooms.length > 0) {
      const first = filteredRooms[0]
      onChange(getKey(first), first)
    } else {
      onChange("", undefined)
    }
  }

  function handleRoomChange(nextVal: string) {
    if (allowAll && nextVal === allValue) {
      onChange(allValue, undefined)
      return
    }
    const found = roomItems.find((s) => getKey(s) === nextVal)
    onChange(nextVal, found)
  }

  const selectClass = cn(
    "w-full rounded-lg border border-white/15 bg-[#060b1a] text-foreground transition-colors focus:border-primary focus:outline-none disabled:opacity-55",
    compact ? "h-8 px-2.5 text-xs" : "h-9 px-3 text-xs sm:text-sm",
  )

  const labelClass = "text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"

  return (
    <div
      className={cn(
        "grid gap-2",
        showCategoryStep ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2",
        className,
      )}
    >
      {/* Step 1: Daily Scrims vs Friday Scrims */}
      <div className="flex flex-col gap-1 min-w-0">
        {!compact && (
          <label htmlFor={`${idPrefix}-schedule`} className={labelClass}>
            1. Schedule
          </label>
        )}
        <select
          id={`${idPrefix}-schedule`}
          value={schedule}
          disabled={disabled}
          onChange={(e) => handleScheduleChange(e.target.value as "all" | ScrimScheduleType)}
          aria-label="Select scrim schedule"
          className={selectClass}
        >
          {allowAll && <option value="all">All Schedules ({classified.length})</option>}
          <option value="daily">Daily Scrims ({dailyItems.length})</option>
          <option value="friday">Friday Scrims ({fridayItems.length})</option>
        </select>
      </div>

      {/* Step 2: Category (rendered dynamically whenever categories exist for this schedule) */}
      {showCategoryStep && (
        <div className="flex flex-col gap-1 min-w-0">
          {!compact && (
            <label htmlFor={`${idPrefix}-category`} className={labelClass}>
              2. Category
            </label>
          )}
          <select
            id={`${idPrefix}-category`}
            value={effectiveCategory}
            disabled={disabled}
            onChange={(e) => handleCategoryChange(e.target.value)}
            aria-label="Select scrim category"
            className={selectClass}
          >
            {allowAll && <option value="all">All Categories ({scheduleItems.length})</option>}
            {categories.map((cat) => {
              const count = scheduleItems.filter((i) => i.meta.category === cat).length
              return (
                <option key={cat} value={cat}>
                  {cat} ({count})
                </option>
              )
            })}
          </select>
        </div>
      )}

      {/* Step 3 (or 2): Ascending Room / Lobby List */}
      <div className="flex flex-col gap-1 min-w-0">
        {!compact && (
          <label htmlFor={`${idPrefix}-room`} className={labelClass}>
            {showCategoryStep ? "3. Room / Lobby" : "2. Room / Lobby"}
          </label>
        )}
        <select
          id={`${idPrefix}-room`}
          value={roomItems.some((r) => getKey(r) === value) ? value : allowAll ? allValue : ""}
          disabled={disabled || (!allowAll && roomItems.length === 0)}
          onChange={(e) => handleRoomChange(e.target.value)}
          aria-label="Select scrim room"
          className={selectClass}
        >
          {allowAll ? (
            <option value={allValue}>
              {allLabel} ({roomItems.length})
            </option>
          ) : (
            <option value="">
              {roomItems.length === 0 ? "No rooms available" : placeholder}
            </option>
          )}
          {roomItems.map((scrim) => (
            <option key={getKey(scrim)} value={getKey(scrim)}>
              {formatRoomLabel(scrim)}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
