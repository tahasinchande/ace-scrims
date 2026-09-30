import { getSessionUser } from "@/lib/session"
import { getAdminScrims, getAllBookingsByScrim, getHistoricalScrimDates } from "@/lib/queries/admin"
import { AdminScrimList } from "@/components/admin/admin-scrim-list"
import { CreateScrimButton } from "@/components/admin/scrim-form-dialog"
import { HistoricalScrimView } from "@/components/admin/historical-scrim-view"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Calendar, Swords } from "lucide-react"

export const dynamic = "force-dynamic"
export const metadata = { title: "Manage Scrims — Ace Scrims" }

export default async function AdminScrimsPage() {
  const [user, scrims, bookingsByScrim, historicalDates] = await Promise.all([
    getSessionUser(),
    getAdminScrims(),
    getAllBookingsByScrim(),
    getHistoricalScrimDates(),
  ])
  const isAdmin = user?.role === "admin"
  const today = new Date().toISOString().split("T")[0]
  const initialHistoricalDate = historicalDates[0] || today

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Scrims</h1>
          <p className="text-sm text-muted-foreground">
            {isAdmin
              ? "Create, edit, and manage every scrim and view historical rosters."
              : "Publish room credentials and view rosters for scrims."}
          </p>
        </div>
        {isAdmin && <CreateScrimButton />}
      </header>

      <Tabs defaultValue="active" className="w-full flex flex-col gap-6">
        <TabsList className="bg-secondary/60 p-1 rounded-xl w-fit">
          <TabsTrigger value="active" className="gap-2 font-bold uppercase text-xs">
            <Swords className="size-4" />
            Active Scrims ({scrims.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2 font-bold uppercase text-xs">
            <Calendar className="size-4" />
            Historical Archive & Rosters
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="m-0 focus-visible:outline-none">
          <AdminScrimList scrims={scrims} isAdmin={isAdmin} bookingsByScrim={bookingsByScrim} />
        </TabsContent>

        <TabsContent value="history" className="m-0 focus-visible:outline-none">
          <HistoricalScrimView
            initialDate={initialHistoricalDate}
            availableDates={historicalDates}
            isAdmin={isAdmin}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
