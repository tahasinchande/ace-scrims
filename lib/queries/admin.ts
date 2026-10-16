import "server-only"

import { db } from "@/lib/db"
import { scrims, bookings, payments, results, user, activityLogs, settings, reports, imageRequests } from "@/lib/db/schema"
import { eq, desc, and, or, gte, sql, count, isNull, type SQL } from "drizzle-orm"
import { appendGlobalScrimRules, getBangladeshActiveDate, archivePreviousDayBookings } from "@/lib/queries/scrims"
import { sortScrimsAscending } from "@/lib/format"

/** Today's revenue, bookings, totals for the admin analytics cards. */
export async function getAdminStats() {
  try {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [revenueToday, bookingsToday, totalUsers, totalBookings, revenueAll, activeScrims] =
      await Promise.all([
        db
          .select({ total: sql<number>`coalesce(sum(${payments.amountBdt}), 0)` })
          .from(payments)
          .where(and(eq(payments.status, "completed"), gte(payments.createdAt, todayStart))),
        db
          .select({ n: count() })
          .from(bookings)
          .where(and(eq(bookings.status, "confirmed"), eq(bookings.isTrashed, false), eq(bookings.isArchived, false), gte(bookings.createdAt, todayStart))),
        db.select({ n: count() }).from(user).where(eq(user.isTrashed, false)),
        db.select({ n: count() }).from(bookings).where(and(eq(bookings.status, "confirmed"), eq(bookings.isTrashed, false))),
        db
          .select({ total: sql<number>`coalesce(sum(${payments.amountBdt}), 0)` })
          .from(payments)
          .where(eq(payments.status, "completed")),
        db.select({ n: count() }).from(scrims).where(and(eq(scrims.status, "upcoming"), eq(scrims.isTrashed, false))),
      ])

    return {
      revenueToday: Number(revenueToday[0]?.total ?? 0),
      bookingsToday: bookingsToday[0]?.n ?? 0,
      totalUsers: totalUsers[0]?.n ?? 0,
      totalBookings: totalBookings[0]?.n ?? 0,
      revenueAll: Number(revenueAll[0]?.total ?? 0),
      activeScrims: activeScrims[0]?.n ?? 0,
    }
  } catch (err) {
    console.warn("[Admin Queries] Error in getAdminStats:", err)
    return {
      revenueToday: 0,
      bookingsToday: 0,
      totalUsers: 0,
      totalBookings: 0,
      revenueAll: 0,
      activeScrims: 0,
    }
  }
}

/** All scrims with confirmed + pending team counts, integrated with all daily and Friday definitions. */
export async function getAdminScrims(options: { includeDeleted?: boolean } = {}) {
  try {
    const { ALL_STANDARD_SCRIM_DEFINITIONS, getBangladeshActiveDate, archivePreviousDayBookings } = await import("@/lib/queries/scrims")
    await archivePreviousDayBookings().catch(() => {})
    const activeDate = getBangladeshActiveDate()

    const rows = await db
      .select({
        scrim: scrims,
        confirmedTeams: sql<number>`(
          select count(*) from bookings b
          where b."scrimId" = ${scrims.id} and b.status = 'confirmed' and b."isArchived" = false and b."isTrashed" = false and b."scrimDate" = ${activeDate}
        )`,
        pendingTeams: sql<number>`(
          select count(*) from bookings b
          where b."scrimId" = ${scrims.id} and b.status = 'pending' and b."isArchived" = false and b."isTrashed" = false and b."scrimDate" = ${activeDate}
        )`,
      })
      .from(scrims)
      .orderBy(desc(scrims.createdAt))

    const dbScrims = rows.map((r) => ({
      ...r.scrim,
      confirmedTeams: Number(r.confirmedTeams),
      pendingTeams: Number(r.pendingTeams),
    }))

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

    const merged = [...dbScrims]

    // Ensure all standard definitions exist in admin list (unless marked as deleted, trashed, or not hosted)
    for (const def of ALL_STANDARD_SCRIM_DEFINITIONS) {
      if (permanentlyDeletedIds.has(def.id) || permanentlyDeletedIds.has(def.slug)) {
        continue
      }

      const deletedInDb = dbScrims.some(
        (m) =>
          (m.id === def.id || m.slug === def.slug) &&
          (m.status === "deleted" || m.status === "permanently_deleted" || m.deletedAt !== null || m.isTrashed === true)
      )
      if (deletedInDb) continue

      const isCR = def.id.includes("-cr") || def.slug.includes("champion-rush") || def.name.toLowerCase().includes("champion rush")
      const isBlast = def.category === "Friday Special Blast"

      const existingIdx = merged.findIndex(
        (m) => m.id === def.id || m.slug === def.slug
      )

      if (existingIdx !== -1) {
        // Normalize the existing scrim with standard properties and ensure clean details
        const existing = merged[existingIdx]
        if (existing.status === "deleted" || existing.status === "permanently_deleted" || existing.deletedAt !== null || existing.isTrashed === true) {
          continue
        }

        let cleanTitle = existing.title && !existing.title.startsWith("scrim-") ? existing.title : def.name
        if (!isCR && cleanTitle && cleanTitle.toLowerCase().includes("champion rush")) {
          cleanTitle = def.name
        }

        let cleanDescription = existing.description
        if (!isCR && (!cleanDescription || cleanDescription.toLowerCase().includes("champion rush") || cleanDescription.toLowerCase().includes("survival championship"))) {
          cleanDescription = isBlast
            ? `Friday Special Blast (${cleanTitle}) — 5 competitive matches (Bermuda, Purgatory, Kalahari, Solana, and Nexterra).`
            : `Competitive Free Fire squad scrim lobby (${cleanTitle}).`
        }

        let cleanRules = existing.rules
        if (!isCR && (!cleanRules || cleanRules.toLowerCase().includes("champion rush") || cleanRules.toLowerCase().includes("80 points"))) {
          cleanRules = isBlast
            ? "1. 5 Matches (Bermuda, Purgatory, Kalahari, Solana, and Nexterra).\n2. BATTLE ROYALE squad mode (12 Teams).\n3. No emulators allowed.\n4. Join room 10-15 minutes prior to match start.\n5. If you want to submit a hacker report, you have to submit it within 1 hour after the match gets completed.\n6. Please note that a 5.00 BDT fee will be deducted from the final prize payout to cover transfer charges."
            : "1. 3 Matches (BERMUDA, PURGATORY & KALAHARI).\n2. BATTLE ROYALE squad mode (12 Teams).\n3. No emulators allowed.\n4. Join room 10-15 minutes prior to match start.\n5. If you want to submit a hacker report, you have to submit it within 1 hour after the match gets completed.\n6. Please note that a 5.00 BDT fee will be deducted from the final prize payout to cover transfer charges."
        } else if (cleanRules) {
          cleanRules = appendGlobalScrimRules(cleanRules)
        }

        let cleanNotes = existing.notes
        if (!isCR && (!cleanNotes || cleanNotes.toLowerCase().includes("champion rush") || cleanNotes.toLowerCase().includes("80 pts"))) {
          cleanNotes = isBlast
            ? "5 Matches Tournament (Bermuda, Purgatory, Kalahari, Solana, and Nexterra). Prize distributed to captain's bKash/Nagad within 6 hours of result publication (Maximum 24 hours). Receive payment within 6 hours (সর্বোচ্চ ২৪ ঘণ্টা)।"
            : "Prize distributed to captain's bKash/Nagad within 6 hours of result publication (Maximum 24 hours). Receive payment within 6 hours (সর্বোচ্চ ২৪ ঘণ্টা)।"
        }

        merged[existingIdx] = {
          ...existing,
          title: cleanTitle,
          description: cleanDescription,
          rules: cleanRules,
          notes: cleanNotes,
          slug: def.slug,
          map: def.map,
          startTime: def.time,
          priceBdt: def.priceBdt ?? existing.priceBdt ?? 35,
          prizePoolBdt: def.prizePoolBdt ?? existing.prizePoolBdt ?? 330,
          bannerUrl: (existing.bannerUrl && !existing.bannerUrl.includes("map-")) ? existing.bannerUrl : (def.bannerUrl || "/images/scrim-1.jpg"),
        }
      } else {
        // Query bookings for this defined scrim ID for the active date
        const bookingCounts = await db
          .select({
            confirmed: sql<number>`count(case when status = 'confirmed' then 1 end)`,
            pending: sql<number>`count(case when status = 'pending' then 1 end)`,
          })
          .from(bookings)
          .where(
            and(
              eq(bookings.scrimId, def.id),
              eq(bookings.isTrashed, false),
              eq(bookings.isArchived, false),
              eq(bookings.scrimDate, activeDate)
            )
          )

        merged.push({
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
            ? "RULES: MAX 8 MATCHES WILL OCCUR. NOT MORE THAN THAT. THE TEAM WHICH WOULD COLLECT 80 PTS CAN UNLOCK THE CHAMPION RUSH FORMAT, THEN IF ANY OF THE TEAMS THAT UNLOCKED THE CHAMPION RUSH FORMAT GETS A BOOYAH, THE SCRIM WILL FINISH THERE AND THAT TEAM WILL BE CHAMPION. Prize distributed to captain's bKash/Nagad within 6 hours of result publication (Maximum 24 hours)."
            : isBlast
              ? "5 Matches Tournament (Bermuda, Purgatory, Kalahari, Solana, and Nexterra). Prize distributed to captain's bKash/Nagad within 6 hours of result publication (Maximum 24 hours). Receive payment within 6 hours (সর্বোচ্চ ২৪ ঘণ্টা)।"
              : "Prize distributed to captain's bKash/Nagad within 6 hours of result publication (Maximum 24 hours). Receive payment within 6 hours (সর্বোচ্চ ২৪ ঘণ্টা)।",
          map: def.map,
          mode: "BATTLE ROYALE",
          startTime: def.time,
          scrimDate: activeDate,
          category: def.category || null,
          priceBdt: def.priceBdt,
          prizePoolBdt: def.prizePoolBdt,
          maxTeams: 12,
          bannerUrl: def.bannerUrl || "/images/scrim-1.jpg",
          roomId: null,
          roomPassword: null,
          roomPublished: false,
          registrationOpen: true,
          status: "upcoming",
          hidden: false,
          isTrashed: false,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          confirmedTeams: Number(bookingCounts[0]?.confirmed ?? 0),
          pendingTeams: Number(bookingCounts[0]?.pending ?? 0),
        })
      }
    }

    // Query exact confirmed and pending booking counts for all scrims from bookings table for today's active schedule
    try {
      archivePreviousDayBookings().catch(() => {})
      const activeDate = getBangladeshActiveDate()
      const allCounts = await db
        .select({
          scrimId: bookings.scrimId,
          confirmed: sql<number>`count(case when status = 'confirmed' then 1 end)::int`,
          pending: sql<number>`count(case when status = 'pending' then 1 end)::int`,
        })
        .from(bookings)
        .where(
          and(
            eq(bookings.isTrashed, false),
            eq(bookings.isArchived, false),
            eq(bookings.scrimDate, activeDate)
          )
        )
        .groupBy(bookings.scrimId)

      const cMap = new Map<string, number>()
      const pMap = new Map<string, number>()
      for (const row of allCounts) {
        cMap.set(row.scrimId, Number(row.confirmed))
        pMap.set(row.scrimId, Number(row.pending))
      }

      for (const item of merged) {
        const c1 = cMap.get(item.id) ?? 0
        const c2 = item.slug && item.slug !== item.id ? (cMap.get(item.slug) ?? 0) : 0
        item.confirmedTeams = c1 + c2

        const p1 = pMap.get(item.id) ?? 0
        const p2 = item.slug && item.slug !== item.id ? (pMap.get(item.slug) ?? 0) : 0
        item.pendingTeams = p1 + p2
      }
    } catch (countErr) {
      console.warn("[Admin Queries] Error syncing live booking counts:", countErr)
    }

    // Filter out invalid/corrupt test scrim entries, and exclude soft-deleted scrims (they belong in Trash)
    const valid = merged.filter((s) => {
      if (!s.title || s.title.trim().length === 0 || s.title.startsWith("test-scrim-fake")) return false
      if (!options.includeDeleted) {
        if (
          s.status === "deleted" ||
          s.status === "permanently_deleted" ||
          s.deletedAt !== null ||
          s.isTrashed === true
        ) {
          return false
        }
      }
      return true
    })

    return sortScrimsAscending(valid)
  } catch (err) {
    console.warn("[Admin Queries] Error in getAdminScrims:", err)
    return []
  }
}

/** Get soft-deleted scrims for the Trash page. */
export async function getTrashScrims() {
  try {
    const rows = await db
      .select()
      .from(scrims)
      .where(or(eq(scrims.status, "deleted"), sql`${scrims.deletedAt} IS NOT NULL`, eq(scrims.isTrashed, true)))
      .orderBy(desc(scrims.deletedAt), desc(scrims.updatedAt))
    return rows
  } catch (err) {
    console.warn("[Admin Queries] Error in getTrashScrims:", err)
    return []
  }
}

/** Get soft-deleted match results for the Trash page. */
export async function getTrashResults() {
  try {
    const { ALL_STANDARD_SCRIM_DEFINITIONS } = await import("@/lib/queries/scrims")
    const rows = await db
      .select({
        result: results,
        scrimTitle: scrims.title,
        scrimTime: scrims.startTime,
        scrimMap: scrims.map,
      })
      .from(results)
      .leftJoin(scrims, eq(results.scrimId, scrims.id))
      .where(or(eq(results.isTrashed, true), sql`${results.deletedAt} IS NOT NULL`))
      .orderBy(desc(results.deletedAt), desc(results.createdAt))

    return rows.map((r) => {
      let title = r.scrimTitle
      let time = r.scrimTime
      if ((!title || !time) && r.result.scrimId) {
        const match = ALL_STANDARD_SCRIM_DEFINITIONS.find(
          (d) => d.id === r.result.scrimId || d.slug === r.result.scrimId
        )
        if (match) {
          if (!title) title = match.name
          if (!time) time = match.time
        }
      }
      return {
        ...r.result,
        scrimTitle: title,
        scrimTime: time,
        scrimMap: r.scrimMap,
      }
    })
  } catch (err) {
    console.warn("[Admin Queries] Error in getTrashResults:", err)
    return []
  }
}

/** Only confirmed (successful) bookings grouped by scrim id, for the admin team roster. */
export async function getAllBookingsByScrim(dateFilter?: string, includeAllDates: boolean = false) {
  const activeDate = dateFilter || getBangladeshActiveDate()

  const whereClause = includeAllDates
    ? and(eq(bookings.status, "confirmed"), eq(bookings.isTrashed, false))
    : and(
        eq(bookings.status, "confirmed"),
        eq(bookings.isTrashed, false),
        eq(bookings.isArchived, false),
        eq(bookings.scrimDate, activeDate)
      )

  const [bookingRows, scrimRows] = await Promise.all([
    db
      .select({ booking: bookings, userEmail: user.email })
      .from(bookings)
      .leftJoin(user, eq(bookings.userId, user.id))
      .where(whereClause)
      .orderBy(bookings.slotNumber, bookings.createdAt),
    db.select({ id: scrims.id, slug: scrims.slug }).from(scrims),
  ])

  const slugToId = new Map<string, string>()
  const idToSlug = new Map<string, string>()
  for (const s of scrimRows) {
    if (s.slug && s.id) {
      slugToId.set(s.slug, s.id)
      idToSlug.set(s.id, s.slug)
    }
  }

  const grouped: Record<string, ((typeof bookingRows)[number]["booking"] & { userEmail: string | null })[]> = {}
  for (const r of bookingRows) {
    const item = { ...r.booking, userEmail: r.userEmail }
    const key = r.booking.scrimId
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(item)

    // Also link under counterpart id or slug
    const counterpart = slugToId.get(key) || idToSlug.get(key)
    if (counterpart && counterpart !== key) {
      if (!grouped[counterpart]) grouped[counterpart] = []
      if (!grouped[counterpart].some((b) => b.id === item.id)) {
        grouped[counterpart].push(item)
      }
    }
  }
  return grouped
}

/** Get distinct historical dates with bookings (descending) */
export async function getHistoricalDates(): Promise<string[]> {
  try {
    const rows = await db
      .select({
        scrimDate: bookings.scrimDate,
      })
      .from(bookings)
      .where(and(sql`${bookings.scrimDate} IS NOT NULL`, eq(bookings.status, "confirmed"), eq(bookings.isTrashed, false)))
      .groupBy(bookings.scrimDate)
      .orderBy(desc(bookings.scrimDate))

    const dates = rows.map((r) => r.scrimDate).filter(Boolean) as string[]
    return dates
  } catch (err) {
    console.warn("[Admin Queries] Error fetching historical dates:", err)
    return []
  }
}

/** Get historical team bookings for any chosen date and optional scrim */
export async function getHistoricalBookings(options?: { date?: string; scrimId?: string }) {
  try {
    const { ALL_STANDARD_SCRIM_DEFINITIONS } = await import("@/lib/queries/scrims")
    const conditions = [
      eq(bookings.status, "confirmed"),
      eq(bookings.isTrashed, false),
    ]

    if (options?.date) {
      conditions.push(eq(bookings.scrimDate, options.date))
    }
    if (options?.scrimId && options.scrimId !== "all") {
      const altId = options.scrimId.replace(/^scrim-/, "")
      const scrimMatch = or(eq(bookings.scrimId, options.scrimId), eq(bookings.scrimId, altId))
      if (scrimMatch) conditions.push(scrimMatch)
    }

    const rows = await db
      .select({
        booking: bookings,
        scrimTitle: scrims.title,
        scrimStartTime: scrims.startTime,
        scrimMap: scrims.map,
        userEmail: user.email,
        userName: user.name,
      })
      .from(bookings)
      .leftJoin(scrims, eq(bookings.scrimId, scrims.id))
      .leftJoin(user, eq(bookings.userId, user.id))
      .where(and(...conditions))
      .orderBy(desc(bookings.scrimDate), bookings.slotNumber, bookings.createdAt)

    return rows.map((r) => {
      let title = r.scrimTitle
      let time = r.scrimStartTime
      let map = r.scrimMap

      if ((!title || !time) && r.booking.scrimId) {
        const match = ALL_STANDARD_SCRIM_DEFINITIONS.find(
          (d) => d.id === r.booking.scrimId || d.slug === r.booking.scrimId
        )
        if (match) {
          title = match.name
          time = match.time
          map = match.map
        }
      }

      return {
        ...r.booking,
        scrimTitle: title || r.booking.scrimId,
        scrimStartTime: time || "N/A",
        scrimMap: map || "Bermuda",
        userEmail: r.userEmail,
        userName: r.userName,
      }
    })
  } catch (err) {
    console.warn("[Admin Queries] Error fetching historical bookings:", err)
    return []
  }
}

export async function getAdminUsers() {
  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
      banned: user.banned,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(eq(user.isTrashed, false))
    .orderBy(desc(user.createdAt))
    .limit(200)
}

export async function getAdminPayments() {
  const { ALL_STANDARD_SCRIM_DEFINITIONS } = await import("@/lib/queries/scrims")
  const rows = await db
    .select({
      payment: payments,
      teamName: bookings.teamName,
      scrimTitle: scrims.title,
      scrimId: payments.scrimId,
      userEmail: user.email,
    })
    .from(payments)
    .leftJoin(bookings, eq(payments.bookingId, bookings.id))
    .leftJoin(scrims, eq(payments.scrimId, scrims.id))
    .leftJoin(user, eq(payments.userId, user.id))
    .where(eq(payments.isTrashed, false))
    .orderBy(desc(payments.createdAt))
    .limit(200)

  return rows.map((r) => {
    let resolvedTitle = r.scrimTitle
    if (!resolvedTitle && r.scrimId) {
      const match = ALL_STANDARD_SCRIM_DEFINITIONS.find((d) => d.id === r.scrimId || d.slug === r.scrimId)
      if (match) resolvedTitle = match.name
    }
    return {
      payment: r.payment,
      teamName: r.teamName,
      scrimTitle: resolvedTitle,
      userEmail: r.userEmail,
    }
  })
}

/** Get soft-deleted reports for Trash page */
export async function getTrashReports() {
  try {
    return await db
      .select({
        report: reports,
        userName: user.name,
        userEmail: user.email,
      })
      .from(reports)
      .leftJoin(user, eq(reports.userId, user.id))
      .where(or(eq(reports.isTrashed, true), sql`${reports.deletedAt} IS NOT NULL`))
      .orderBy(desc(reports.deletedAt), desc(reports.createdAt))
  } catch (err) {
    console.warn("[Admin Queries] Error in getTrashReports:", err)
    return []
  }
}

/** Get soft-deleted image requests for Trash page */
export async function getTrashImageRequests() {
  try {
    return await db
      .select()
      .from(imageRequests)
      .where(or(eq(imageRequests.isTrashed, true), sql`${imageRequests.deletedAt} IS NOT NULL`))
      .orderBy(desc(imageRequests.deletedAt), desc(imageRequests.createdAt))
  } catch (err) {
    console.warn("[Admin Queries] Error in getTrashImageRequests:", err)
    return []
  }
}

/** Get soft-deleted users for Trash page */
export async function getTrashUsers() {
  try {
    return await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        image: user.image,
        deletedAt: user.deletedAt,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(or(eq(user.isTrashed, true), sql`${user.deletedAt} IS NOT NULL`))
      .orderBy(desc(user.deletedAt), desc(user.createdAt))
  } catch (err) {
    console.warn("[Admin Queries] Error in getTrashUsers:", err)
    return []
  }
}

/** Get soft-deleted payments for Trash page */
export async function getTrashPayments() {
  try {
    const { ALL_STANDARD_SCRIM_DEFINITIONS } = await import("@/lib/queries/scrims")
    const rows = await db
      .select({
        payment: payments,
        teamName: bookings.teamName,
        scrimTitle: scrims.title,
        scrimId: payments.scrimId,
        userEmail: user.email,
      })
      .from(payments)
      .leftJoin(bookings, eq(payments.bookingId, bookings.id))
      .leftJoin(scrims, eq(payments.scrimId, scrims.id))
      .leftJoin(user, eq(payments.userId, user.id))
      .where(or(eq(payments.isTrashed, true), sql`${payments.deletedAt} IS NOT NULL`))
      .orderBy(desc(payments.deletedAt), desc(payments.createdAt))

    return rows.map((r) => {
      let resolvedTitle = r.scrimTitle
      if (!resolvedTitle && r.scrimId) {
        const match = ALL_STANDARD_SCRIM_DEFINITIONS.find((d) => d.id === r.scrimId || d.slug === r.scrimId)
        if (match) resolvedTitle = match.name
      }
      return {
        payment: r.payment,
        teamName: r.teamName,
        scrimTitle: resolvedTitle,
        userEmail: r.userEmail,
      }
    })
  } catch (err) {
    console.warn("[Admin Queries] Error in getTrashPayments:", err)
    return []
  }
}

export async function getAdminResults(options?: { date?: string; scrimId?: string }) {
  const { ALL_STANDARD_SCRIM_DEFINITIONS } = await import("@/lib/queries/scrims")
  const conditions: (SQL<unknown> | undefined)[] = [eq(results.isTrashed, false), sql`${results.deletedAt} IS NULL`]

  if (options?.date) {
    conditions.push(eq(results.matchDate, options.date))
  }
  if (options?.scrimId && options.scrimId !== "all") {
    const cleanId = options.scrimId
    const altId = options.scrimId.replace(/^scrim-/, "")
    conditions.push(or(eq(results.scrimId, cleanId), eq(results.scrimId, altId)))
  }

  const validConditions = conditions.filter((c): c is SQL<unknown> => Boolean(c))

  const rows = await db
    .select({ result: results, scrimTitle: scrims.title, startTime: scrims.startTime, scrimId: results.scrimId })
    .from(results)
    .leftJoin(scrims, eq(results.scrimId, scrims.id))
    .where(and(...validConditions))
    .orderBy(desc(results.createdAt))
    .limit(100)

  return rows.map((r) => {
    let title = r.scrimTitle
    let time = r.startTime
    if ((!title || !time) && r.scrimId) {
      const match = ALL_STANDARD_SCRIM_DEFINITIONS.find((d) => d.id === r.scrimId || d.slug === r.scrimId)
      if (match) {
        if (!title) title = match.name
        if (!time) time = match.time
      }
    }
    return {
      result: r.result,
      scrimTitle: title,
      startTime: time,
    }
  })
}

export async function getAdminBookingsForScrim(scrimId: string) {
  return db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.scrimId, scrimId),
        eq(bookings.status, "confirmed"),
        eq(bookings.isTrashed, false),
        eq(bookings.isArchived, false)
      )
    )
    .orderBy(bookings.slotNumber)
}

export async function getActivityLogs() {
  return db
    .select({
      log: activityLogs,
      actorName: user.name,
    })
    .from(activityLogs)
    .leftJoin(user, eq(activityLogs.actorId, user.id))
    .orderBy(desc(activityLogs.createdAt))
    .limit(200)
}

export type HistoricalScrimMeta = {
  id: string
  title: string
  slug?: string
  startTime: string
  map: string
  priceBdt: number
  prizePoolBdt: number
  maxTeams: number
  confirmedCount: number
  category?: string
  hasResult?: boolean
}

export type HistoricalRosterBooking = any

export const getHistoricalScrimDates = getHistoricalDates

