import Link from "next/link"
import { getAdminScrims, getAllBookingsByScrim } from "@/lib/queries/admin"
import { isRoom2Enabled } from "@/lib/queries/scrims"
import { AdminScrimList } from "@/components/admin/admin-scrim-list"
import { CreateScrimButton } from "@/components/admin/scrim-form-dialog"
import { getSessionUser } from "@/lib/session"
import { KeyRound, Snowflake } from "lucide-react"

export const dynamic = "force-dynamic"
export const metadata = { title: "Manage Scrims — Ace Scrims Admin" }

export default async function AdminScrimsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>
}) {
  const sp = searchParams ? await searchParams : {}
  const [user, scrims, bookingsByScrim, room2Enabled] = await Promise.all([
    getSessionUser(),
    getAdminScrims({ includeDeleted: true }),
    getAllBookingsByScrim().catch(() => ({})),
    isRoom2Enabled().catch(() => false),
  ])

  const isAdmin = user?.role === "admin"

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Scrims</h1>
          <p className="text-sm text-muted-foreground">
            Publish room IDs and passwords, manage squad rosters, and toggle lobby registrations.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/scrims?tab=room1"
            className="inline-flex items-center gap-2 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-blue-300 transition-colors hover:bg-blue-500/20 hover:text-blue-200"
          >
            <KeyRound className="size-4 text-blue-400" />
            Room 1 Lobbies
          </Link>
          {isAdmin && (
            <Link
              href="/admin/iceberg"
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-cyan-300 transition-colors hover:bg-cyan-500/20 hover:text-cyan-200"
            >
              <Snowflake className="size-4 text-cyan-400" />
              Iceberg Controls
            </Link>
          )}
          {isAdmin && <CreateScrimButton />}
        </div>
      </header>

      <AdminScrimList
        scrims={scrims}
        isAdmin={isAdmin}
        bookingsByScrim={bookingsByScrim}
        initialRoom2Enabled={room2Enabled}
        initialTab={sp?.tab}
      />
    </div>
  )
}
