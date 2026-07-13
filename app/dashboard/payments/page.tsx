import { requireUser } from "@/lib/session"
import { getUserPayments } from "@/lib/queries/dashboard"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { bdt, timeAgo } from "@/lib/format"
import { cn } from "@/lib/utils"
import { Receipt } from "lucide-react"

export const metadata = { title: "Payment History — Ace Scrims" }

const statusStyles: Record<string, string> = {
  completed: "bg-success/15 text-success border-success/30",
  pending: "bg-warning/15 text-warning border-warning/30",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
  cancelled: "bg-muted text-muted-foreground border-border",
  refunded: "bg-info/15 text-info border-info/30",
}

export default async function PaymentsPage() {
  const user = await requireUser()
  const rows = await getUserPayments(user.id)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-bold uppercase tracking-tight">Payment History</h1>
        <p className="mt-1 text-sm text-muted-foreground">Every transaction for your scrim bookings.</p>
      </div>

      {rows.length === 0 ? (
        <div className="glass flex flex-col items-center gap-3 rounded-2xl py-16 text-center">
          <Receipt className="size-10 text-muted-foreground" aria-hidden />
          <p className="font-display text-xl font-bold uppercase">No payments yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Your payment records will appear here after your first booking.
          </p>
        </div>
      ) : (
        <div className="glass overflow-x-auto rounded-2xl">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Scrim</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Transaction ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ payment, scrimTitle, scrimTime }) => (
                <TableRow key={payment.id}>
                  <TableCell>
                    <p className="font-semibold">{scrimTitle ?? "Scrim"}</p>
                    <p className="text-xs text-muted-foreground">{scrimTime}</p>
                  </TableCell>
                  <TableCell className="font-semibold">{bdt(payment.amountBdt)}</TableCell>
                  <TableCell className="capitalize">{payment.method ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{payment.transactionId ?? "—"}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn("border capitalize", statusStyles[payment.status] ?? statusStyles.pending)}
                    >
                      {payment.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {timeAgo(payment.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
