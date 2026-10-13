import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/currency";
import type { ReportPaymentTotals } from "@/lib/payments";

/** Period Cash / MoMo / Card tender totals for Reports and Analytics. */
export function PaymentTotalsCard({
  totals,
  description = "Gross sales by payment method for this period.",
}: {
  totals: ReportPaymentTotals;
  description?: string;
}) {
  const rows = [
    { label: "Cash", amount: totals.cash },
    { label: "MoMo", amount: totals.mobileMoney },
    { label: "Card", amount: totals.card },
    ...((totals.onAccount ?? 0) > 0
      ? [{ label: "On account", amount: totals.onAccount ?? 0 }]
      : []),
  ];

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Payment methods</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {rows.map((row) => (
            <li
              key={row.label}
              className="bg-muted/40 min-w-0 rounded-xl border border-transparent px-4 py-3"
            >
              <p className="text-muted-foreground text-sm">{row.label}</p>
              <p className="mt-1 truncate text-xl font-semibold tracking-tight">
                {formatCurrency(row.amount)}
              </p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
