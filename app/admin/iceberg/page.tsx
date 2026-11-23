import { requireAdmin } from "@/lib/session"
import { getAdminScrims } from "@/lib/queries/admin"
import {
  isDailyWeekdayScrim,
  isFridayScrimsActive,
  isFridayTournament,
  isRoom2Enabled,
} from "@/lib/queries/scrims"
import { AdminIcebergManager, type AdminIcebergScrim } from "@/components/admin/admin-iceberg-manager"

export const dynamic = "force-dynamic"
export const metadata = { title: "Iceberg Slot Automation — RushX Organization Admin" }

export default async function AdminIcebergPage() {
  await requireAdmin()

  const [scrims, isFriday, showRoom2] = await Promise.all([
    getAdminScrims().catch(() => []),
    isFridayScrimsActive().catch(() => false),
    isRoom2Enabled().catch(() => false),
  ])

  const mapped: AdminIcebergScrim[] = scrims
    .filter((s) => s.status !== "deleted" && !s.isTrashed)
    .map((s) => {
      const isFri = isFridayTournament(s)
      const isDaily = isDailyWeekdayScrim(s)
      let isTodaySchedule = true

      if (isFriday) {
        if (isDaily && !isFri) isTodaySchedule = false
      } else {
        if (isFri) isTodaySchedule = false
        if (!showRoom2 && (s.id.includes("r2") || s.slug.includes("room-2"))) {
          isTodaySchedule = false
        }
      }

      return {
        id: s.id,
        slug: s.slug,
        title: s.title,
        startTime: s.startTime,
        scrimDate: s.scrimDate,
        map: s.map,
        category: s.category ?? null,
        maxTeams: s.maxTeams || 12,
        confirmedTeams: Number(s.confirmedTeams ?? 0),
        registrationOpen: Boolean(s.registrationOpen),
        status: s.status,
        hidden: Boolean(s.hidden),
        icebergEnabled: Boolean(s.icebergEnabled),
        icebergShowAllFilled: Boolean(s.icebergShowAllFilled),
        icebergAmount: Number(s.icebergAmount ?? 7),
        icebergThreshold: Number(s.icebergThreshold ?? 3),
        icebergStartRealCount: Number(s.icebergStartRealCount ?? 0),
        isTodaySchedule,
      }
    })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">
          Iceberg Slot Automation
        </h1>
        <p className="text-sm text-muted-foreground">
          Set baseline filled slots, automate cyclic resets on real registrations, and manage 1-click fluctuations across lobbies.
        </p>
      </div>

      <AdminIcebergManager
        scrims={mapped}
        isFriday={isFriday}
        showRoom2={showRoom2}
      />
    </div>
  )
}
