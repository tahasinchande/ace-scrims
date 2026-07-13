import { getAdminResults, getAdminScrims } from "@/lib/queries/admin"
import { AdminResults } from "@/components/admin/admin-results"

export const metadata = { title: "Manage Results — Ace Scrims" }

export default async function AdminResultsPage() {
  const [results, scrims] = await Promise.all([getAdminResults(), getAdminScrims()])

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Results</h1>
        <p className="text-sm text-muted-foreground">
          Publish match results, upload proof, and manage prize payouts.
        </p>
      </header>
      <AdminResults
        results={results}
        scrims={scrims.map((s) => ({ id: s.id, title: s.title, startTime: s.startTime }))}
      />
    </div>
  )
}
