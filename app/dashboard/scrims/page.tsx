import Link from "next/link"
import { requireUser } from "@/lib/session"
import { getUserBookings, splitBookings } from "@/lib/queries/dashboard"
import { BookingCard } from "@/components/dashboard/booking-card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Swords } from "lucide-react"

export const metadata = { title: "My Scrims — Ace Scrims" }

export default async function MyScrimsPage() {
  const user = await requireUser()
  const bookings = await getUserBookings(user.id)
  const { upcoming, past } = splitBookings(bookings)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight">My Scrims</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All your purchased slots — room credentials appear once published.
        </p>
      </div>

      {bookings.length === 0 ? (
        <div className="glass flex flex-col items-center gap-3 rounded-2xl py-16 text-center">
          <Swords className="size-10 text-muted-foreground" aria-hidden />
          <p className="font-display text-xl font-bold uppercase">No bookings yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Your booked scrims will show up here with room details and results.
          </p>
          <Button asChild className="glow-primary mt-2 font-display font-bold uppercase">
            <Link href="/scrims">Browse Tonight&apos;s Scrims</Link>
          </Button>
        </div>
      ) : (
        <Tabs defaultValue="upcoming">
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
            <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="upcoming" className="mt-4 flex flex-col gap-4">
            {upcoming.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No upcoming matches.</p>
            ) : (
              upcoming.map((b) => <BookingCard key={b.id} booking={b} />)
            )}
          </TabsContent>
          <TabsContent value="past" className="mt-4 flex flex-col gap-4">
            {past.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No past matches yet.</p>
            ) : (
              past.map((b) => <BookingCard key={b.id} booking={b} />)
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  )
}
