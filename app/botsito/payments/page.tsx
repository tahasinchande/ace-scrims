import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/session"
import { getAdminPayments } from "@/lib/queries/admin"
import { formatTaka, timeAgo } from "@/lib/format"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ExternalLink } from "lucide-react"

export const dynamic = "force-dynamic"
export const metadata = { title: "Payments — Ace Scrims Admin" }

const statusVariant = (s: string) =>
  s === "completed" ? ("default" as const) : s === "pending" ? ("secondary" as const) : ("destructive" as const)

export default async function AdminPaymentsPage() {
  const user = await getSessionUser()
  if (user?.role !== "admin") redirect("/botsito/scrims")

  const payments = await getAdminPayments()

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold uppercase tracking-wide">Payments</h1>
          <p className="text-sm text-muted-foreground">
            Every UddoktaPay transaction with verification status.
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

      {payments.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center text-sm text-muted-foreground">
          No payments yet.
        </div>
      ) : (
        <div className="glass overflow-x-auto rounded-2xl">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-3 font-medium">Team / Scrim</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium">Transaction ID</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {payments.map(({ payment, teamName, scrimTitle, userEmail }) => (
                <tr key={payment.id} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium">{teamName ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{scrimTitle ?? "Deleted scrim"}</p>
                  </td>
                  <td className="max-w-40 truncate px-4 py-3 text-muted-foreground">{userEmail}</td>
                  <td className="px-4 py-3 font-display font-bold">{formatTaka(payment.amountBdt)}</td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">{payment.method ?? "—"}</td>
                  <td className="max-w-36 truncate px-4 py-3 font-mono text-xs text-muted-foreground">
                    {payment.transactionId ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={statusVariant(payment.status)} className="capitalize">
                      {payment.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {timeAgo(payment.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
