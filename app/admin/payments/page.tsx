import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import { getAdminPayments } from "@/lib/queries/admin"
import { Button } from "@/components/ui/button"
import { ExternalLink } from "lucide-react"
import { AdminPaymentsView } from "@/components/admin/admin-payments-view"

export const dynamic = "force-dynamic"
export const metadata = { title: "Payments — Ace Scrims Admin" }

export default async function AdminPaymentsPage() {
  const user = await getSessionUser()
  if (user?.role !== "admin") redirect("/admin/scrims")

  const payments = await getAdminPayments()

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Payments</h1>
          <p className="text-sm text-muted-foreground">
            Every UddoktaPay transaction with verification status and trash management.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
            <a href="https://pay.acescrims.online" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-3.5" />
              Merchant Panel
            </a>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs border-amber-500/40 text-amber-400 hover:text-amber-300">
            <a href="https://pay.acescrims.online/paymentlink/default/BDT" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-3.5" />
              Default Payment Link
            </a>
          </Button>
        </div>
      </header>

      <AdminPaymentsView payments={payments as any} />
    </div>
  )
}
