"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { formatCurrency } from "@/lib/currency";
import { ReceiptText } from "lucide-react";
import { useBillingHistoryData } from "@/hooks/use-billing-offline";

const STATUS_VARIANT: Record<string, "success" | "secondary" | "destructive" | "outline" | "warning"> =
  {
    success: "success",
    pending: "secondary",
    processing: "secondary",
    failed: "destructive",
    cancelled: "outline",
    abandoned: "outline",
    expired: "outline",
    refunded: "warning",
  };

function formatDate(value: number) {
  return new Date(value).toLocaleDateString("en-GH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function BillingHistoryTable() {
  const { data: history, loading } = useBillingHistoryData();

  if (loading || history === undefined) {
    return (
      <Card>
        <CardContent className="p-6">
          <LoadingState label="Loading payments…" variant="table" />
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <EmptyState
            icon={ReceiptText}
            title="No payments yet"
            description="Invoices and receipts appear here once a plan is paid for."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 font-medium">Reference</th>
              <th className="px-4 py-3 text-right font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {history.map((row) => (
              <tr key={row.id} className="border-border border-t">
                <td className="text-muted-foreground px-4 py-3 whitespace-nowrap">
                  {formatDate(row.paidAt ?? row.createdAt)}
                </td>
                <td className="px-4 py-3 capitalize">
                  {(row.kind ?? "payment").replaceAll("_", " ")}
                </td>
                <td className="px-4 py-3">{row.description}</td>
                <td className="text-muted-foreground px-4 py-3 font-mono text-xs">
                  {row.reference}
                </td>
                <td className="px-4 py-3 text-right font-medium whitespace-nowrap">
                  {formatCurrency(row.amount)}
                </td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_VARIANT[row.status] ?? "outline"} className="capitalize">
                    {row.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
